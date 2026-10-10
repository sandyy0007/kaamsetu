/**
 * Work opportunities (jobs, daily/contract/seasonal work, freelance, apprenticeships, training), applications,
 * businesses, the approximate-location map and the adaptive professional home.
 *
 * Authorisation: only the poster can see applicants or change applications; only the applicant can withdraw.
 * A poster's phone number is released only when they chose phone contact AND accepted that applicant.
 */
import type { Business, WorkApplication, WorkOpportunity } from "@/types/domain";
import type { ApplicationDTO, BusinessDetailDTO, ProfessionalHomeDTO, WorkOpportunityDTO } from "@/types/dto";
import { applicationStatusSchema, businessSchema, workApplicationSchema, workOpportunitySchema } from "@/lib/schemas";
import { districtDistanceKm, findPlaceInText } from "@/lib/geo";
import { newId } from "../../crypto";
import { persist } from "../../db";
import { badRequest, conflict, forbidden, notFound } from "../../errors";
import { courseCard, summaryById, type View } from "../../mappers";
import { requireCap, requireUser } from "../../permissions";
import { isBlockedEitherWay } from "../../privacy";
import { assertSafeText, ensureConversation } from "../../services/messaging";
import { notify } from "../../services/notify";
import {
  businessCard,
  businessVisible,
  mapPoints,
  matchOpportunity,
  opportunityVisible,
  professionDTO,
  professionalCard,
  professionalVisible,
  professionOf,
  reputationFor,
  serviceDTO,
  serviceRequestDTO,
  workOpportunityDTO,
} from "../../services/professionals";
import { route, type Ctx } from "../router";
import { paginate } from "../paginate";
import { z } from "zod";

const view = (c: Ctx): View => ({ d: c.d, viewer: c.user });
const nowIso = () => new Date().toISOString();
const lower = (s: string | undefined) => (s ?? "").toLowerCase();

// ───────────── discovery ─────────────
route("GET", "/work", (c) => {
  const v = view(c);
  const { d, user } = c;
  const q = (c.query.get("q") ?? "").trim();
  const kind = c.query.get("kind");
  const profession = c.query.get("profession");
  const skill = lower(c.query.get("skill") ?? "");
  const district = c.query.get("district");
  const mine = c.query.get("mine") === "1";
  const place = c.query.get("near") || district || (q ? findPlaceInText(q) : null) || undefined;
  const maxKm = c.query.get("maxKm") ? Number(c.query.get("maxKm")) : undefined;
  const words = q.toLowerCase().split(/[\s,]+/).filter((t) => t.length > 1 && !(place && lower(place).includes(t)) && !["in", "near", "for", "work", "job", "jobs", "kaam", "the"].includes(t));
  const myPro = user ? d.professionalProfiles.find((p) => p.userId === user.id) : undefined;

  const out: { dto: WorkOpportunityDTO; score: number }[] = [];
  for (const w of d.workOpportunities) {
    if (mine ? w.posterId !== user?.id : !opportunityVisible(v, w) || w.status !== "OPEN" || w.hidden) continue;
    if (kind && w.kind !== kind) continue;
    if (profession && !w.professionIds.includes(profession)) continue;
    if (skill && !w.skills.some((s) => lower(s).includes(skill))) continue;
    const km = place ? (lower(w.location.district) === lower(place) ? 0 : districtDistanceKm(w.location.district, place)) : null;
    if (district && km === null && lower(w.location.district) !== lower(district)) continue;
    if (maxKm !== undefined && km !== null && km > maxKm) continue;
    if (words.length) {
      const profNames = w.professionIds.map((id) => { const p = professionOf(d, id); return p ? `${p.name} ${p.nameHi} ${p.synonyms.join(" ")}` : ""; }).join(" ");
      const text = lower(`${w.title} ${w.description} ${w.skills.join(" ")} ${profNames} ${w.location.district}`);
      if (!words.some((t) => text.includes(t))) continue;
    }
    const dto = workOpportunityDTO(v, w, place);
    const m = user?.personalization ? matchOpportunity(d, user.id, w) : { score: 0, reasons: [] };
    const recency = Math.max(0, 14 - (Date.now() - Date.parse(w.createdAt)) / 86_400_000);
    const proximity = km === null ? 0 : km === 0 ? 20 : Math.max(0, 15 - km / 20);
    out.push({ dto, score: m.score + recency + proximity + (myPro ? 0 : 0) });
  }
  const sort = c.query.get("sort");
  out.sort((a, b) => (sort === "newest" ? b.dto.createdAt.localeCompare(a.dto.createdAt) : sort === "distance" ? (a.dto.distanceKm ?? 9999) - (b.dto.distanceKm ?? 9999) : b.score - a.score));
  return paginate(out.map((x) => x.dto), c, 12);
}, { auth: "optional" });

route("GET", "/work/:id", (c) => {
  const w = c.d.workOpportunities.find((x) => x.id === c.params.id);
  const v = view(c);
  if (!w || !opportunityVisible(v, w)) throw notFound("Opportunity");
  return workOpportunityDTO(v, w);
}, { auth: "optional" });

// ───────────── posting ─────────────
function normalise(c: Ctx, input: z.infer<typeof workOpportunitySchema>, posterId: string): Omit<WorkOpportunity, "id" | "posterId" | "status" | "hidden" | "createdAt" | "isDemo"> {
  const d = c.d;
  for (const id of input.professionIds) {
    const p = professionOf(d, id);
    if (!p || p.status === "REJECTED") throw badRequest("Choose professions from the list.", { professionIds: "Unknown profession" });
  }
  if (input.businessId) {
    const b = d.businesses.find((x) => x.id === input.businessId);
    if (!b || b.ownerId !== posterId) throw forbidden("You can only post on behalf of your own business.");
  }
  if (input.payUnit !== "NEGOTIABLE" && input.payMin === undefined && input.payMax === undefined) throw badRequest("Enter the pay, or choose “To be discussed”.", { payMin: "Enter the pay" });
  if (input.payMin !== undefined && input.payMax !== undefined && input.payMin > input.payMax) throw badRequest("Minimum pay cannot be more than maximum pay.", { payMin: "Higher than maximum" });
  assertSafeText(`${input.title} ${input.description}`);
  const poster = d.users.find((u) => u.id === posterId)!;
  if (input.contactMethod === "PHONE" && !poster.phone) throw badRequest("Add a phone number to your account to use phone contact.", { contactMethod: "No phone on your account" });
  return {
    businessId: input.businessId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    professionIds: Array.from(new Set(input.professionIds)),
    skills: input.skills,
    openings: Math.round(input.openings),
    location: { village: input.village, district: input.district, state: input.state },
    startDate: input.startDate?.slice(0, 10),
    mode: input.mode,
    pay: input.payUnit === "NEGOTIABLE" ? { unit: "NEGOTIABLE" } : { min: input.payMin ?? input.payMax, max: input.payMax ?? input.payMin, unit: input.payUnit },
    duration: input.duration,
    contactMethod: input.contactMethod,
  };
}

route("POST", "/work", async (c) => {
  const u = requireCap(c.user, "work:post");
  const input = await c.body(workOpportunitySchema);
  if (c.d.workOpportunities.filter((w) => w.posterId === u.id && w.status === "OPEN").length >= 25) throw badRequest("You have 25 open listings. Close one before posting another.");
  const w: WorkOpportunity = { id: newId("wo"), posterId: u.id, ...normalise(c, input, u.id), status: "OPEN", hidden: false, createdAt: nowIso(), isDemo: false };
  c.d.workOpportunities.push(w);
  persist();
  return workOpportunityDTO(view(c), w);
});

function ownedOpp(c: Ctx) {
  const u = requireUser(c.user);
  const w = c.d.workOpportunities.find((x) => x.id === c.params.id);
  if (!w || w.posterId !== u.id) throw notFound("Opportunity");
  return { u, w };
}

route("PATCH", "/work/:id", async (c) => {
  const { u, w } = ownedOpp(c);
  const input = await c.body(workOpportunitySchema);
  Object.assign(w, normalise(c, input, u.id));
  persist();
  return workOpportunityDTO(view(c), w);
});

route("POST", "/work/:id/status", async (c) => {
  const { w } = ownedOpp(c);
  const { status } = await c.body(z.object({ status: z.enum(["OPEN", "CLOSED", "FILLED"]) }));
  if (w.hidden && status === "OPEN") throw forbidden("This listing was hidden by a moderator.");
  w.status = status;
  persist();
  return workOpportunityDTO(view(c), w);
});

route("DELETE", "/work/:id", (c) => {
  const { w } = ownedOpp(c);
  c.d.workOpportunities = c.d.workOpportunities.filter((x) => x.id !== w.id);
  c.d.applications = c.d.applications.filter((a) => a.opportunityId !== w.id);
  persist();
  return { ok: true };
});

// ───────────── applications ─────────────
route("POST", "/work/:id/apply", async (c) => {
  const u = requireCap(c.user, "work:apply");
  const v = view(c);
  const w = c.d.workOpportunities.find((x) => x.id === c.params.id);
  if (!w || !opportunityVisible(v, w) || w.hidden) throw notFound("Opportunity");
  if (w.posterId === u.id) throw badRequest("You cannot apply to your own listing.");
  if (w.status !== "OPEN") throw badRequest("This listing is no longer accepting applications.");
  if (isBlockedEitherWay(c.d, u.id, w.posterId)) throw forbidden("You cannot apply to this listing.");
  if (!c.d.professionalProfiles.some((p) => p.userId === u.id)) throw badRequest("Create your professional profile before applying.");
  const { note } = await c.body(workApplicationSchema);
  assertSafeText(note);
  const existing = c.d.applications.find((a) => a.opportunityId === w.id && a.applicantId === u.id);
  if (existing && existing.status !== "WITHDRAWN") throw conflict("You have already applied.");
  let app: WorkApplication;
  if (existing) {
    app = existing;
    Object.assign(app, { status: "APPLIED", note, updatedAt: nowIso() });
  } else {
    app = { id: newId("ap"), opportunityId: w.id, applicantId: u.id, note, status: "APPLIED", createdAt: nowIso(), updatedAt: nowIso(), isDemo: false };
    c.d.applications.push(app);
  }
  notify(c.d, w.posterId, "WORK", `New applicant for “${w.title}”`, `${u.name} applied.`, "/my-work?tab=applicants");
  persist();
  return workOpportunityDTO(view(c), w);
});

route("DELETE", "/work/:id/apply", (c) => {
  const u = requireUser(c.user);
  const app = c.d.applications.find((a) => a.opportunityId === c.params.id && a.applicantId === u.id && a.status !== "WITHDRAWN");
  if (!app) throw notFound("Application");
  app.status = "WITHDRAWN";
  app.updatedAt = nowIso();
  persist();
  return { ok: true };
});

function applicationDTO(v: View, a: WorkApplication): ApplicationDTO {
  const wo = v.d.workOpportunities.find((w) => w.id === a.opportunityId);
  return {
    id: a.id,
    opportunity: { id: a.opportunityId, title: wo?.title ?? "Opportunity", status: wo?.status ?? "CLOSED" },
    applicant: professionalCard(v, a.applicantId),
    applicantUser: summaryById(v.d, a.applicantId),
    note: a.note,
    status: a.status,
    conversationId: a.conversationId,
    createdAt: a.createdAt,
  };
}

route("GET", "/work/:id/applications", (c) => {
  const { w } = ownedOpp(c); // applicants are visible to the poster only
  const v = view(c);
  return c.d.applications.filter((a) => a.opportunityId === w.id && a.status !== "WITHDRAWN").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => applicationDTO(v, a));
});

route("PATCH", "/work/applications/:appId", async (c) => {
  const u = requireUser(c.user);
  const app = c.d.applications.find((a) => a.id === c.params.appId);
  const w = app && c.d.workOpportunities.find((x) => x.id === app.opportunityId);
  if (!app || !w || w.posterId !== u.id) throw notFound("Application");
  if (app.status === "WITHDRAWN") throw badRequest("The applicant withdrew this application.");
  const { status, message } = await c.body(applicationStatusSchema);
  if (message) assertSafeText(message);
  app.status = status;
  app.updatedAt = nowIso();
  if (status === "ACCEPTED") {
    const convo = ensureConversation(c.d, u.id, app.applicantId, { kind: "OPPORTUNITY", id: w.id, title: w.title });
    app.conversationId = convo.id;
    if (message) c.d.messages.push({ id: newId("ms"), conversationId: convo.id, senderId: u.id, body: message, attachments: [], readBy: [u.id], createdAt: nowIso(), isDemo: false });
    convo.updatedAt = nowIso();
    const accepted = c.d.applications.filter((a) => a.opportunityId === w.id && a.status === "ACCEPTED").length;
    if (accepted >= w.openings && w.status === "OPEN") w.status = "FILLED";
  }
  const verb = { SHORTLISTED: "shortlisted you", ACCEPTED: "accepted your application", REJECTED: "could not take your application" }[status];
  notify(c.d, app.applicantId, "WORK", `${u.name} ${verb}`, `“${w.title}”${status === "ACCEPTED" ? " — you can now message each other." : ""}`, status === "ACCEPTED" ? `/messages?c=${app.conversationId}` : "/my-work?tab=applications");
  persist();
  return applicationDTO(view(c), app);
});

// ───────────── businesses ─────────────
function businessDetail(v: View, b: Business): BusinessDetailDTO {
  const { d } = v;
  const base = businessCard(v, b);
  const team = d.professionalProfiles.filter((p) => p.businessId === b.id || p.userId === b.ownerId).map((p) => professionalCard(v, p.userId)).filter((x): x is NonNullable<typeof x> => !!x);
  const rep = reputationFor(d, b.ownerId);
  return {
    ...base,
    opportunities: d.workOpportunities.filter((w) => (w.businessId === b.id || (!w.businessId && w.posterId === b.ownerId)) && w.status === "OPEN" && !w.hidden).map((w) => workOpportunityDTO(v, w)),
    team,
    services_offered: d.services.filter((s) => s.ownerId === b.ownerId && s.active && !s.hidden).map((s) => serviceDTO(v, s)),
    reputation: { completedJobs: rep.completedJobs, recommendations: rep.recommendations },
  };
}

route("GET", "/businesses", (c) => {
  const v = view(c);
  const q = lower(c.query.get("q") ?? "");
  const district = c.query.get("district");
  const profession = c.query.get("profession");
  const mine = c.query.get("mine") === "1";
  const items = c.d.businesses
    .filter((b) => businessVisible(v, b) && (!mine || (!!c.user && b.ownerId === c.user.id)))
    .filter((b) => (!district || lower(b.district) === lower(district)) && (!profession || b.professionIds.includes(profession)) && (!q || lower(`${b.name} ${b.kind} ${b.about} ${b.services.join(" ")} ${b.district}`).includes(q)))
    .map((b) => businessCard(v, b))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.openOpportunities - a.openOpportunities);
  return paginate(items, c, 12);
}, { auth: "optional" });

route("GET", "/businesses/:id", (c) => {
  const b = c.d.businesses.find((x) => x.id === c.params.id);
  const v = view(c);
  if (!b || !businessVisible(v, b)) throw notFound("Business");
  return businessDetail(v, b);
}, { auth: "optional" });

function businessFromInput(input: z.infer<typeof businessSchema>) {
  for (const t of [input.name, input.about]) assertSafeText(t);
  return { name: input.name, kind: input.kind, about: input.about, services: input.services, professionIds: input.professionIds, district: input.district, state: input.state, website: input.website };
}

route("POST", "/businesses", async (c) => {
  const u = requireCap(c.user, "business:manage");
  const input = await c.body(businessSchema);
  if (c.d.businesses.filter((b) => b.ownerId === u.id && !b.id.startsWith("biz_u_")).length >= 3) throw badRequest("You can add up to 3 businesses.");
  const b: Business = { id: newId("biz"), ownerId: u.id, ...businessFromInput(input), hidden: false, createdAt: nowIso(), isDemo: false };
  c.d.businesses.push(b);
  const pp = c.d.professionalProfiles.find((p) => p.userId === u.id);
  if (pp && !pp.businessId) pp.businessId = b.id;
  persist();
  return businessDetail(view(c), b);
});

function ownedBusiness(c: Ctx) {
  const u = requireUser(c.user);
  const b = c.d.businesses.find((x) => x.id === c.params.id);
  if (!b || b.ownerId !== u.id) throw notFound("Business");
  return b;
}

route("PATCH", "/businesses/:id", async (c) => {
  const b = ownedBusiness(c);
  const input = await c.body(businessSchema);
  Object.assign(b, businessFromInput(input)); // verifiedAt / verifiedBy are never writable here
  persist();
  return businessDetail(view(c), b);
});

route("DELETE", "/businesses/:id", (c) => {
  const b = ownedBusiness(c);
  c.d.businesses = c.d.businesses.filter((x) => x.id !== b.id);
  c.d.professionalProfiles.forEach((p) => p.businessId === b.id && (p.businessId = undefined));
  c.d.workOpportunities.forEach((w) => w.businessId === b.id && (w.businessId = undefined));
  persist();
  return { ok: true };
});

// ───────────── local map (approximate area only) ─────────────
route("GET", "/map/points", (c) => {
  const types = new Set((c.query.get("types") ?? "PROFESSIONAL,OPPORTUNITY,BUSINESS,SERVICE,EVENT").split(",").map((t) => t.trim().toUpperCase()));
  return mapPoints(view(c), types, { profession: c.query.get("profession") ?? undefined, district: c.query.get("district") ?? undefined });
}, { auth: "optional" });

// ───────────── adaptive professional home ─────────────
const STEP_LINKS = { profile: "/profile/edit", services: "/create?type=service", portfolio: "/create?type=portfolio" } as const;

route("GET", "/home/professional", (c): ProfessionalHomeDTO => {
  const u = requireUser(c.user);
  const v = view(c);
  const { d } = c;
  const pp = d.professionalProfiles.find((p) => p.userId === u.id);
  const prof = pp && professionOf(d, pp.professionId);
  if (!pp || !prof) {
    return { profession: null, completeness: { percent: 0, missing: [] }, nearbyWork: [], recommendedWork: [], pendingRequests: [], myServicesCount: 0, portfolioCount: 0, reputation: null, learning: [], nearbyProfessionals: [], trendingProfessions: [] };
  }
  const services = d.services.filter((s) => s.ownerId === u.id);
  const portfolio = reputationFor(d, u.id).portfolioCount;
  const hasHistory = d.workHistory.some((w) => w.ownerId === u.id);
  const checks: { key: string; label: string; href: string; ok: boolean }[] = [
    { key: "about", label: "Write a short about section", href: STEP_LINKS.profile, ok: pp.about.trim().length >= 30 },
    { key: "skills", label: "Add at least 3 skills", href: STEP_LINKS.profile, ok: pp.skills.length >= 3 },
    { key: "location", label: "Add your district and service area", href: STEP_LINKS.profile, ok: !!pp.location.district && pp.location.serviceAreas.length > 0 },
    { key: "availability", label: "Set your availability", href: STEP_LINKS.profile, ok: pp.availability.days.length > 0 },
    { key: "services", label: "List a service people can request", href: STEP_LINKS.services, ok: services.length > 0 || prof.farmModules },
    { key: "portfolio", label: "Add a work sample to your portfolio", href: STEP_LINKS.portfolio, ok: portfolio > 0 },
    { key: "history", label: "Add your work history", href: "/profile/edit?tab=history", ok: hasHistory },
  ];
  const done = checks.filter((x) => x.ok).length;
  const open = d.workOpportunities.filter((w) => opportunityVisible(v, w) && w.status === "OPEN" && !w.hidden && w.posterId !== u.id);
  const ranked = open.map((w) => ({ w, m: matchOpportunity(d, u.id, w), km: lower(w.location.district) === lower(pp.location.district) ? 0 : districtDistanceKm(w.location.district, pp.location.district) }));
  const nearby = ranked.filter((x) => x.km !== null && x.km <= Math.max(60, pp.location.serviceRadiusKm)).sort((a, b) => (a.km ?? 0) - (b.km ?? 0)).slice(0, 4);
  const recommended = ranked.filter((x) => x.m.score >= 50).sort((a, b) => b.m.score - a.m.score).slice(0, 4);
  const near = pp.location.district;
  const peers = d.professionalProfiles
    .filter((p) => p.userId !== u.id && professionalVisible(v, p.userId))
    .map((p) => ({ p, km: lower(p.location.district) === lower(near) ? 0 : districtDistanceKm(p.location.district, near) }))
    .filter((x) => x.km !== null && x.km <= 120)
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || Number(b.p.professionId === pp.professionId) - Number(a.p.professionId === pp.professionId))
    .slice(0, 6)
    .map((x) => professionalCard(v, x.p.userId, near))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const counts = new Map<string, number>();
  for (const p of d.professionalProfiles) if (lower(p.location.district) === lower(near) && professionalVisible(v, p.userId)) counts.set(p.professionId, (counts.get(p.professionId) ?? 0) + 1);
  const learning = d.courses
    .filter((cr) => !cr.hidden && (cr.professionIds?.includes(pp.professionId) || (prof.farmModules && !cr.professionIds?.length)))
    .slice(0, 3)
    .map((cr) => courseCard(v, cr));
  return {
    profession: professionDTO(d, prof),
    completeness: { percent: Math.round((done / checks.length) * 100), missing: checks.filter((x) => !x.ok).map(({ key, label, href }) => ({ key, label, href })) },
    nearbyWork: nearby.map((x) => workOpportunityDTO(v, x.w, near)),
    recommendedWork: recommended.map((x) => workOpportunityDTO(v, x.w, near)),
    pendingRequests: d.serviceRequests.filter((r) => r.providerId === u.id && r.status === "PENDING").map((r) => serviceRequestDTO(v, r)),
    myServicesCount: services.length,
    portfolioCount: portfolio,
    reputation: reputationFor(d, u.id),
    learning,
    nearbyProfessionals: peers,
    trendingProfessions: Array.from(counts.entries()).map(([id, count]) => ({ id, name: professionOf(d, id)?.name ?? id, emoji: professionOf(d, id)?.emoji ?? "👤", count })).sort((a, b) => b.count - a.count).slice(0, 6),
  };
});
