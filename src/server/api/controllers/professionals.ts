/**
 * Universal professional profile, services, service requests, portfolio, work history, recommendations.
 * Authorisation rules (all enforced here, not in the browser):
 *   - Profiles obey `privacy.profile`; phone obeys `privacy.phone`; village obeys `locationPrecision`.
 *   - Services / portfolio / work-history rows can only be changed by their owner (others get 404, not 403, so ids don't leak).
 *   - A service request is visible only to its provider and requester.
 */
import type { Db, Profession, ProfessionalProfile, ProfessionalSkill, Service, ServiceRequest, User } from "@/types/domain";
import type { ConnectionState, MyWorkDTO, ProfessionalProfileDTO } from "@/types/dto";
import {
  professionalProfileSchema,
  recommendationSchema,
  serviceRequestActionSchema,
  serviceRequestSchema,
  serviceSchema,
  workHistorySchema,
  workPortfolioSchema,
} from "@/lib/schemas";
import { newId } from "../../crypto";
import { persist } from "../../db";
import { badRequest, conflict, forbidden, notFound } from "../../errors";
import { findProfession, resolveCustomProfession, syncProfessionalToExpert, syncProfessionalToFarmer } from "../../migrate";
import { followerCount, isFollowing, summaryById, userSummary, type View } from "../../mappers";
import { requireCap, requireUser } from "../../permissions";
import { areConnected, canSee, isBlockedEitherWay } from "../../privacy";
import { assertSafeText, ensureConversation } from "../../services/messaging";
import { notify } from "../../services/notify";
import {
  AVAILABILITY_LABEL,
  businessCard,
  catalogDTO,
  experienceYears,
  hasVerifiedInteraction,
  portfolioFor,
  professionDTO,
  professionalCard,
  professionOf,
  recommendationsFor,
  reputationFor,
  sceneForProfession,
  searchProfessionals,
  serviceDTO,
  serviceRequestDTO,
  serviceVisible,
  workHistoryFor,
  workOpportunityDTO,
} from "../../services/professionals";
import { route, type Ctx } from "../router";
import { paginate } from "../paginate";
import { farmerProfileDTO } from "./profiles";

const view = (c: Ctx): View => ({ d: c.d, viewer: c.user });
const nowIso = () => new Date().toISOString();
const MAX = { services: 30, portfolio: 60, history: 25 };

function connectionState(d: Db, me: string, other: string): ConnectionState {
  const row = d.connections.find((c) => (c.requesterId === me && c.receiverId === other) || (c.requesterId === other && c.receiverId === me));
  if (!row) return "NONE";
  if (row.status === "ACCEPTED") return "CONNECTED";
  return row.requesterId === me ? "PENDING_SENT" : "PENDING_RECEIVED";
}

function ownProfile(c: Ctx): { u: User; pp: ProfessionalProfile } {
  const u = requireUser(c.user);
  const pp = c.d.professionalProfiles.find((p) => p.userId === u.id);
  if (!pp) throw forbidden("Your account type does not have a professional profile.");
  return { u, pp };
}

// ───────────── profile DTO ─────────────
export function professionalProfileDTO(v: View, userId: string): ProfessionalProfileDTO | null {
  const { d, viewer } = v;
  const pp = d.professionalProfiles.find((p) => p.userId === userId);
  const user = d.users.find((u) => u.id === userId);
  const prof = pp && professionOf(d, pp.professionId);
  if (!pp || !user || !prof) return null;
  if (viewer && isBlockedEitherWay(d, viewer.id, userId)) return null;
  if (user.status !== "ACTIVE" && viewer?.id !== userId && viewer?.role !== "ADMIN") return null;

  const isSelf = viewer?.id === userId;
  const visible = canSee(d, viewer, userId, pp.privacy.profile);
  const showVillage = isSelf || canSee(d, viewer, userId, pp.privacy.locationPrecision === "VILLAGE" ? "PUBLIC" : "PRIVATE");
  const conns = d.connections.filter((x) => x.status === "ACCEPTED" && (x.requesterId === userId || x.receiverId === userId)).length;
  const network = { followers: followerCount(d, userId), following: d.follows.filter((f) => f.followerId === userId).length, connections: conns };
  const interacted = !!viewer && !isSelf && hasVerifiedInteraction(d, viewer.id, userId);
  const viewerInfo: ProfessionalProfileDTO["viewer"] = {
    isSelf,
    isFollowing: isFollowing(v, userId),
    connection: viewer && !isSelf ? connectionState(d, viewer.id, userId) : "NONE",
    saved: !!viewer && d.saved.some((s) => s.userId === viewer.id && s.targetType === "PROFESSIONAL" && s.targetId === userId),
    canRequestService: !!viewer && !isSelf && (viewer.role !== "ADMIN") && d.services.some((s) => s.ownerId === userId && s.active && !s.hidden),
    canRecommend: !!viewer && !isSelf && viewer.role !== "ADMIN" && (interacted || areConnected(d, viewer.id, userId)),
    hasRecommended: !!viewer && d.recommendations.some((r) => r.subjectId === userId && r.authorId === viewer.id),
  };
  const base = {
    user: userSummary(d, user),
    profession: professionDTO(d, prof),
    secondaryProfessions: pp.secondaryProfessionIds.map((id) => professionOf(d, id)).filter((p): p is Profession => !!p).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji })),
    customProfession: pp.customProfession,
    startedYear: pp.startedYear,
    experienceYears: experienceYears(pp),
    district: pp.location.district,
    state: pp.location.state,
    network,
    viewer: viewerInfo,
  };
  if (!visible) {
    return { ...base, restricted: true, serviceAreas: [], about: "", languages: [], skills: [], attributes: {}, certifications: [], achievements: [], services: [], portfolio: [], workHistory: [], recommendations: [], reputation: reputationFor(d, userId) };
  }
  const services = d.services.filter((s) => s.ownerId === userId && (isSelf || (s.active && !s.hidden))).map((s) => serviceDTO(v, s));
  const biz = pp.businessId ? d.businesses.find((b) => b.id === pp.businessId) : undefined;
  const farmer = prof.farmModules ? farmerProfileDTO(v, userId) : undefined;
  return {
    ...base,
    restricted: false,
    village: showVillage ? pp.location.village : undefined,
    serviceRadiusKm: pp.location.serviceRadiusKm,
    serviceAreas: pp.location.serviceAreas,
    about: pp.about,
    languages: pp.languages,
    skills: pp.skills,
    attributes: pp.attributes,
    availability: {
      status: pp.availability.status,
      label: AVAILABILITY_LABEL[pp.availability.status] ?? "",
      days: pp.availability.days,
      note: pp.availability.note,
      preferences: pp.availability.preferences,
      // Expected wage is only shown to the owner and to people the owner shares their phone/contacts with.
      expectedWage: pp.availability.expectedWage && (isSelf || canSee(d, viewer, userId, pp.privacy.phone)) ? pp.availability.expectedWage : undefined,
    },
    certifications: pp.certifications,
    achievements: pp.achievements,
    services,
    portfolio: portfolioFor(v, userId),
    workHistory: workHistoryFor(d, userId),
    recommendations: recommendationsFor(v, userId),
    reputation: reputationFor(d, userId),
    business: biz && (!biz.hidden || isSelf) ? businessCard(v, biz) : undefined,
    farmer,
    phone: canSee(d, viewer, userId, pp.privacy.phone) ? user.phone : undefined,
    privacy: isSelf ? pp.privacy : undefined,
  };
}

// ───────────── catalog ─────────────
route("GET", "/catalog", (c) => catalogDTO(view(c)), { auth: "optional" });

// ───────────── discovery ─────────────
route("GET", "/professionals", (c) => {
  const q = c.query;
  const items = searchProfessionals(view(c), {
    q: q.get("q") ?? undefined,
    profession: q.get("profession") ?? undefined,
    category: q.get("category") ?? undefined,
    skill: q.get("skill") ?? undefined,
    district: q.get("district") ?? undefined,
    near: q.get("near") ?? undefined,
    maxKm: q.get("maxKm") ? Number(q.get("maxKm")) : undefined,
    minExperience: q.get("minExperience") ? Number(q.get("minExperience")) : undefined,
    availableNow: q.get("available") === "1",
    verified: q.get("verified") === "1",
    service: q.get("service") ?? undefined,
    sort: (q.get("sort") as "relevance" | "distance" | "experience" | "verified" | null) ?? undefined,
  });
  return paginate(items, c, 12);
}, { auth: "optional" });

route("GET", "/professionals/:id", (c) => {
  const id = c.params.id === "me" ? requireUser(c.user).id : c.params.id!;
  const dto = professionalProfileDTO(view(c), id);
  if (!dto) throw notFound("Professional");
  return dto;
}, { auth: "optional" });

// ───────────── own profile ─────────────
const safeAttrs = (prof: Profession, raw: Record<string, string | string[] | number>) => {
  // Only keys the profession's schema declares are stored — nothing arbitrary reaches the database.
  const out: ProfessionalProfile["attributes"] = {};
  for (const f of prof.attributes) {
    const val = raw[f.key];
    if (val === undefined || val === "") continue;
    if (f.type === "chips") out[f.key] = Array.isArray(val) ? val.map(String).slice(0, 20) : String(val).split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);
    else if (f.type === "number") {
      const n = Number(val);
      if (Number.isFinite(n)) out[f.key] = Math.max(0, Math.min(1_000_000, n));
    } else if (f.type === "select") {
      const sv = String(val);
      if (!f.options || f.options.includes(sv)) out[f.key] = sv;
    } else out[f.key] = String(val).slice(0, 120);
  }
  return out;
};

route("PATCH", "/professionals/me", async (c) => {
  const { u, pp } = ownProfile(c);
  const input = await c.body(professionalProfileSchema);
  const d = c.d;
  const isPro = u.role === "PROFESSIONAL";

  if (input.about) assertSafeText(input.about);
  if (input.professionId !== undefined || input.customProfession !== undefined) {
    if (!isPro) throw forbidden("Your profession is fixed by your account type.");
    if (input.professionId) {
      const p = findProfession(d, input.professionId);
      if (!p || !(p.status === "ACTIVE" || (p.status === "PENDING" && p.createdBy === u.id))) throw badRequest("Choose a profession from the list.");
      if (p.farmModules) throw badRequest("Farmer accounts are created at sign-up so that farms and crops are set up correctly.");
      pp.professionId = p.id;
      pp.customProfession = undefined;
    } else if (input.customProfession) {
      pp.professionId = resolveCustomProfession(d, input.customProfession, u.id).id;
      pp.customProfession = input.customProfession;
    }
  }
  if (input.secondaryProfessionIds) {
    const ids = Array.from(new Set(input.secondaryProfessionIds)).filter((id) => id !== pp.professionId);
    for (const id of ids) {
      const p = d.professions.find((x) => x.id === id);
      if (!p || p.status !== "ACTIVE" || (p.farmModules && u.role !== "FARMER")) throw badRequest("Choose additional professions from the list.");
    }
    pp.secondaryProfessionIds = ids.slice(0, 3);
  }
  if (input.about !== undefined) pp.about = input.about;
  if (input.startedYear !== undefined) pp.startedYear = input.startedYear;
  if (input.skills) {
    const keep = new Map(pp.skills.map((s) => [s.name.toLowerCase(), s]));
    const seen = new Set<string>();
    // `verified` can never come from the client — it is copied only from an existing server-set flag.
    pp.skills = input.skills.filter((s) => !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase())).map<ProfessionalSkill>((s) => ({ name: s.name, level: s.level, years: s.years, verified: keep.get(s.name.toLowerCase())?.verified }));
  }
  if (input.languages) pp.languages = input.languages;
  if (input.location) pp.location = { ...input.location, village: input.location.village };
  if (input.availability) pp.availability = { ...input.availability };
  if (input.certifications) pp.certifications = input.certifications;
  if (input.achievements) pp.achievements = input.achievements;
  if (input.headline !== undefined) u.headline = input.headline;
  if (input.attributes || input.professionId !== undefined || input.customProfession !== undefined) {
    const prof = professionOf(d, pp.professionId)!;
    pp.attributes = safeAttrs(prof, input.attributes ?? pp.attributes);
  }
  pp.updatedAt = nowIso();
  if (u.role === "FARMER") syncProfessionalToFarmer(d, u.id);
  if (u.role === "EXPERT") syncProfessionalToExpert(d, u.id);
  persist();
  return professionalProfileDTO(view(c), u.id);
});

// ───────────── services ─────────────
function ownedService(c: Ctx): Service {
  const u = requireCap(c.user, "service:manage");
  const s = c.d.services.find((x) => x.id === c.params.id);
  if (!s || s.ownerId !== u.id) throw notFound("Service");
  return s;
}

function serviceMedia(c: Ctx, input: { imageUrl?: string; scene?: import("@/types/domain").SceneKind; name: string }, pp: ProfessionalProfile) {
  if (input.imageUrl && !input.imageUrl.startsWith("/api/files/")) throw badRequest("Images must be uploaded through KaamSetu.");
  const scene = input.scene ?? sceneForProfession(pp.professionId, professionOf(c.d, pp.professionId)?.dashboard);
  return [{ id: newId("sm"), kind: "PHOTO" as const, caption: input.name, scene }];
}

route("GET", "/services", (c) => {
  const q = (c.query.get("q") ?? "").toLowerCase();
  const profession = c.query.get("profession");
  const near = c.query.get("near") ?? c.query.get("district") ?? undefined;
  const mine = c.query.get("mine") === "1";
  const v = view(c);
  const items = c.d.services
    .filter((s) => (mine ? s.ownerId === c.user?.id : serviceVisible(v, s)))
    .filter((s) => {
      const pp = c.d.professionalProfiles.find((p) => p.userId === s.ownerId);
      if (profession && pp?.professionId !== profession) return false;
      if (!q) return true;
      const owner = c.d.users.find((u) => u.id === s.ownerId);
      return `${s.name} ${s.description} ${owner?.name ?? ""} ${professionOf(c.d, pp?.professionId ?? "")?.name ?? ""} ${s.areas.join(" ")}`.toLowerCase().includes(q);
    })
    .map((s) => serviceDTO(v, s, near))
    .filter((s) => !near || s.distanceKm == null || s.distanceKm <= 300 || s.areas.some((a) => a.toLowerCase() === near.toLowerCase()))
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  return paginate(items, c, 12);
}, { auth: "optional" });

route("GET", "/services/:id", (c) => {
  const s = c.d.services.find((x) => x.id === c.params.id);
  const v = view(c);
  if (!s || !serviceVisible(v, s)) throw notFound("Service");
  return { service: serviceDTO(v, s), provider: professionalCard(v, s.ownerId) };
}, { auth: "optional" });

route("POST", "/services", async (c) => {
  const u = requireCap(c.user, "service:manage");
  const { pp } = ownProfile(c);
  const input = await c.body(serviceSchema);
  if (c.d.services.filter((s) => s.ownerId === u.id).length >= MAX.services) throw badRequest(`You can list up to ${MAX.services} services.`);
  assertSafeText(`${input.name} ${input.description}`);
  if (input.priceType !== "NEGOTIABLE" && input.price === undefined) throw badRequest("Enter a price, or choose “Price on request”.", { price: "Enter a price" });
  const svc: Service = {
    id: newId("sv"),
    ownerId: u.id,
    name: input.name,
    description: input.description,
    priceType: input.priceType,
    price: input.priceType === "NEGOTIABLE" ? undefined : input.price,
    areas: input.areas.length ? input.areas : [pp.location.district].filter(Boolean),
    availability: input.availability,
    media: serviceMedia(c, input, pp),
    active: input.active ?? true,
    hidden: false,
    createdAt: nowIso(),
    isDemo: false,
  };
  c.d.services.push(svc);
  persist();
  return serviceDTO(view(c), svc);
});

route("PATCH", "/services/:id", async (c) => {
  const s = ownedService(c);
  const { pp } = ownProfile(c);
  const input = await c.body(serviceSchema.partial());
  if (input.name || input.description) assertSafeText(`${input.name ?? ""} ${input.description ?? ""}`);
  if (input.name !== undefined) s.name = input.name;
  if (input.description !== undefined) s.description = input.description;
  if (input.priceType !== undefined) s.priceType = input.priceType;
  if (input.price !== undefined) s.price = input.price;
  if (s.priceType === "NEGOTIABLE") s.price = undefined;
  else if (s.price === undefined) throw badRequest("Enter a price, or choose “Price on request”.", { price: "Enter a price" });
  if (input.areas) s.areas = input.areas;
  if (input.availability !== undefined) s.availability = input.availability;
  if (input.active !== undefined) s.active = input.active;
  if (input.imageUrl || input.scene) s.media = serviceMedia(c, { imageUrl: input.imageUrl, scene: input.scene, name: s.name }, pp);
  persist();
  return serviceDTO(view(c), s);
});

route("DELETE", "/services/:id", (c) => {
  const s = ownedService(c);
  c.d.services = c.d.services.filter((x) => x.id !== s.id);
  persist();
  return { ok: true };
});

// ───────────── service requests (no payments — request, accept/reject, then talk) ─────────────
const today = () => new Date().toISOString().slice(0, 10);

route("POST", "/service-requests", async (c) => {
  const u = requireCap(c.user, "service:request");
  const input = await c.body(serviceRequestSchema);
  const v = view(c);
  const svc = c.d.services.find((s) => s.id === input.serviceId);
  if (!svc || !serviceVisible(v, svc) || !svc.active) throw notFound("Service");
  if (svc.ownerId === u.id) throw badRequest("You cannot request your own service.");
  if (isBlockedEitherWay(c.d, u.id, svc.ownerId)) throw forbidden("You cannot send a request to this person.");
  if (input.date.slice(0, 10) < today()) throw badRequest("Choose today or a later date.", { date: "Choose today or a later date" });
  assertSafeText(input.description);
  if (c.d.serviceRequests.some((r) => r.serviceId === svc.id && r.requesterId === u.id && (r.status === "PENDING" || r.status === "ACCEPTED"))) throw conflict("You already have an open request for this service.");
  const recent = c.d.serviceRequests.filter((r) => r.requesterId === u.id && Date.parse(r.createdAt) > Date.now() - 3_600_000).length;
  if (recent >= 10) throw badRequest("You have sent many requests recently. Please wait a little before sending more.");
  const now = nowIso();
  const r: ServiceRequest = {
    id: newId("sr"),
    serviceId: svc.id,
    providerId: svc.ownerId,
    requesterId: u.id,
    date: input.date.slice(0, 10),
    location: { village: input.village, district: input.district, state: input.state },
    description: input.description,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    isDemo: false,
  };
  c.d.serviceRequests.push(r);
  notify(c.d, svc.ownerId, "SERVICE", `New request: ${svc.name}`, `${u.name} needs this on ${r.date} in ${input.district}.`, "/my-work?tab=requests");
  persist();
  return serviceRequestDTO(v, r);
});

route("GET", "/service-requests", (c) => {
  const u = requireUser(c.user);
  const box = c.query.get("box") === "sent" ? "sent" : "received";
  const v = view(c);
  const items = c.d.serviceRequests
    .filter((r) => (box === "sent" ? r.requesterId === u.id : r.providerId === u.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => serviceRequestDTO(v, r));
  return paginate(items, c, 20);
});

route("PATCH", "/service-requests/:id", async (c) => {
  const u = requireUser(c.user);
  const { action, message } = await c.body(serviceRequestActionSchema);
  const r = c.d.serviceRequests.find((x) => x.id === c.params.id);
  // Not a participant → 404, so request ids can't be probed.
  if (!r || (r.providerId !== u.id && r.requesterId !== u.id)) throw notFound("Request");
  const svc = c.d.services.find((s) => s.id === r.serviceId);
  const isProvider = r.providerId === u.id;
  const other = isProvider ? r.requesterId : r.providerId;
  const title = svc?.name ?? "service";
  const bad = () => badRequest("That action is not available for this request right now.");
  if (message) assertSafeText(message);

  switch (action) {
    case "ACCEPT":
      if (!isProvider || r.status !== "PENDING") throw bad();
      r.status = "ACCEPTED";
      {
        const convo = ensureConversation(c.d, r.providerId, r.requesterId, { kind: "SERVICE", id: r.id, title });
        r.conversationId = convo.id;
        // The requester's own words open the conversation so the provider has full context.
        c.d.messages.push({ id: newId("ms"), conversationId: convo.id, senderId: r.requesterId, body: `Request for ${title} on ${r.date}: ${r.description}`, attachments: [], readBy: [r.requesterId], createdAt: nowIso(), isDemo: false });
        if (message) c.d.messages.push({ id: newId("ms"), conversationId: convo.id, senderId: u.id, body: message, attachments: [], readBy: [u.id], createdAt: nowIso(), isDemo: false });
        convo.updatedAt = nowIso();
      }
      notify(c.d, other, "SERVICE", `${u.name} accepted your request`, `${title} · ${r.date}. You can now message each other.`, `/messages?c=${r.conversationId}`);
      break;
    case "REJECT":
      if (!isProvider || r.status !== "PENDING") throw bad();
      r.status = "REJECTED";
      notify(c.d, other, "SERVICE", `${u.name} could not take your request`, message ?? `${title} · ${r.date}. You can search for another professional.`, "/my-work?tab=requests");
      break;
    case "CANCEL":
      if (isProvider || (r.status !== "PENDING" && r.status !== "ACCEPTED")) throw bad();
      r.status = "CANCELLED";
      notify(c.d, other, "SERVICE", `${u.name} cancelled the request`, `${title} · ${r.date}`, "/my-work?tab=requests");
      break;
    case "MARK_DONE":
      if (!isProvider || r.status !== "ACCEPTED") throw bad();
      r.status = "AWAITING_CONFIRMATION";
      notify(c.d, other, "SERVICE", `${u.name} marked the work as done`, `Please confirm that “${title}” was completed.`, "/my-work?tab=requests");
      break;
    case "CONFIRM_DONE":
      // Completed jobs only count when BOTH sides agree — that is what makes the number trustworthy.
      if (isProvider || r.status !== "AWAITING_CONFIRMATION") throw bad();
      r.status = "COMPLETED";
      notify(c.d, other, "SERVICE", `${u.name} confirmed the job`, `“${title}” is now counted in your completed jobs.`, "/my-work?tab=requests");
      break;
  }
  r.updatedAt = nowIso();
  persist();
  return serviceRequestDTO(view(c), r);
});

// ───────────── portfolio ─────────────
function ownedEntry(c: Ctx) {
  const u = requireCap(c.user, "portfolio:manage");
  const e = c.d.portfolioEntries.find((x) => x.id === c.params.id);
  if (!e || e.ownerId !== u.id) throw notFound("Portfolio item");
  return e;
}

route("POST", "/me/portfolio", async (c) => {
  const u = requireCap(c.user, "portfolio:manage");
  const { pp } = ownProfile(c);
  const input = await c.body(workPortfolioSchema);
  if (c.d.portfolioEntries.filter((e) => e.ownerId === u.id).length >= MAX.portfolio) throw badRequest(`You can add up to ${MAX.portfolio} portfolio items.`);
  assertSafeText(`${input.title} ${input.description}`);
  if (input.imageUrl && !input.imageUrl.startsWith("/api/files/")) throw badRequest("Images must be uploaded through KaamSetu.");
  if (input.videoUrl && !input.videoUrl.startsWith("/api/files/")) throw badRequest("Videos must be uploaded through KaamSetu.");
  const e = {
    id: newId("pf"),
    ownerId: u.id,
    title: input.title,
    description: input.description,
    category: input.category,
    date: input.date.slice(0, 10),
    skillsUsed: input.skillsUsed,
    media: [{ id: newId("pm"), kind: input.videoUrl ? ("VIDEO" as const) : ("PHOTO" as const), caption: input.title, scene: input.scene ?? sceneForProfession(pp.professionId) }],
    imageUrl: input.imageUrl,
    videoUrl: input.videoUrl,
    meta: input.meta,
    hidden: false,
    createdAt: nowIso(),
    isDemo: false,
  };
  c.d.portfolioEntries.push(e);
  persist();
  return portfolioFor(view(c), u.id).find((x) => x.id === e.id);
});

route("PATCH", "/me/portfolio/:id", async (c) => {
  const e = ownedEntry(c);
  const input = await c.body(workPortfolioSchema.partial());
  if (input.title || input.description) assertSafeText(`${input.title ?? ""} ${input.description ?? ""}`);
  if (input.imageUrl && !input.imageUrl.startsWith("/api/files/")) throw badRequest("Images must be uploaded through KaamSetu.");
  Object.assign(e, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.date !== undefined && { date: input.date.slice(0, 10) }),
    ...(input.skillsUsed !== undefined && { skillsUsed: input.skillsUsed }),
    ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
    ...(input.videoUrl !== undefined && { videoUrl: input.videoUrl }),
    ...(input.meta !== undefined && { meta: input.meta }),
  });
  if (input.scene && e.media[0]) e.media[0].scene = input.scene;
  persist();
  return portfolioFor(view(c), e.ownerId).find((x) => x.id === e.id);
});

route("DELETE", "/me/portfolio/:id", (c) => {
  const e = ownedEntry(c);
  c.d.portfolioEntries = c.d.portfolioEntries.filter((x) => x.id !== e.id);
  persist();
  return { ok: true };
});

// ───────────── work history ─────────────
route("POST", "/me/work-history", async (c) => {
  const u = requireUser(c.user);
  ownProfile(c);
  const input = await c.body(workHistorySchema);
  if (c.d.workHistory.filter((w) => w.ownerId === u.id).length >= MAX.history) throw badRequest(`You can add up to ${MAX.history} work history entries.`);
  if (input.endDate && input.endDate < input.startDate) throw badRequest("The end date cannot be before the start date.", { endDate: "End date is before start date" });
  assertSafeText(`${input.role} ${input.organization} ${input.description}`);
  const w = { id: newId("wh"), ownerId: u.id, ...input, createdAt: nowIso(), isDemo: false };
  c.d.workHistory.push(w);
  persist();
  return workHistoryFor(c.d, u.id).find((x) => x.id === w.id);
});

route("PATCH", "/me/work-history/:id", async (c) => {
  const u = requireUser(c.user);
  const w = c.d.workHistory.find((x) => x.id === c.params.id);
  if (!w || w.ownerId !== u.id) throw notFound("Work history");
  const input = await c.body(workHistorySchema);
  if (input.endDate && input.endDate < input.startDate) throw badRequest("The end date cannot be before the start date.", { endDate: "End date is before start date" });
  assertSafeText(`${input.role} ${input.organization} ${input.description}`);
  Object.assign(w, input);
  persist();
  return workHistoryFor(c.d, u.id).find((x) => x.id === w.id);
});

route("DELETE", "/me/work-history/:id", (c) => {
  const u = requireUser(c.user);
  const w = c.d.workHistory.find((x) => x.id === c.params.id);
  if (!w || w.ownerId !== u.id) throw notFound("Work history");
  c.d.workHistory = c.d.workHistory.filter((x) => x.id !== w.id);
  persist();
  return { ok: true };
});

// ───────────── recommendations (written by others; verifiable basis only) ─────────────
route("POST", "/professionals/:id/recommendations", async (c) => {
  const u = requireCap(c.user, "recommend:write");
  const subjectId = c.params.id!;
  if (subjectId === u.id) throw badRequest("You cannot recommend yourself.");
  if (!c.d.professionalProfiles.some((p) => p.userId === subjectId)) throw notFound("Professional");
  if (isBlockedEitherWay(c.d, u.id, subjectId)) throw forbidden();
  const input = await c.body(recommendationSchema);
  assertSafeText(input.body);
  const verified = hasVerifiedInteraction(c.d, u.id, subjectId);
  // Fake-recommendation guard: you must have worked together or be connected.
  if (!verified && !areConnected(c.d, u.id, subjectId)) throw forbidden("You can recommend someone after you have worked together or connected with them.");
  const existing = c.d.recommendations.find((r) => r.subjectId === subjectId && r.authorId === u.id);
  if (existing) {
    Object.assign(existing, { relationship: input.relationship, body: input.body, skill: input.skill, interactionVerified: verified, createdAt: nowIso() });
  } else {
    c.d.recommendations.push({ id: newId("rc"), subjectId, authorId: u.id, relationship: input.relationship, body: input.body, skill: input.skill, interactionVerified: verified, hidden: false, createdAt: nowIso(), isDemo: false });
    notify(c.d, subjectId, "FOLLOW", `${u.name} recommended you`, input.body.slice(0, 80), `/professionals/${subjectId}`);
  }
  persist();
  return recommendationsFor(view(c), subjectId);
});

route("DELETE", "/recommendations/:id", (c) => {
  const u = requireUser(c.user);
  const r = c.d.recommendations.find((x) => x.id === c.params.id);
  if (!r || (r.authorId !== u.id && r.subjectId !== u.id && u.role !== "ADMIN")) throw notFound("Recommendation");
  // The person recommended can hide a recommendation from their page; only the author (or admin) can delete it.
  if (r.authorId === u.id || u.role === "ADMIN") c.d.recommendations = c.d.recommendations.filter((x) => x.id !== r.id);
  else r.hidden = true;
  persist();
  return { ok: true };
});

// ───────────── "My Work" hub ─────────────
route("GET", "/my/work", (c): MyWorkDTO => {
  const u = requireUser(c.user);
  const v = view(c);
  const d = c.d;
  const reqs = d.serviceRequests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const mine = d.workOpportunities.filter((w) => w.posterId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const myIds = new Set(mine.map((w) => w.id));
  const toApp = (a: (typeof d.applications)[number]) => {
    const wo = d.workOpportunities.find((w) => w.id === a.opportunityId);
    return {
      id: a.id,
      opportunity: { id: a.opportunityId, title: wo?.title ?? "Opportunity", status: wo?.status ?? "CLOSED" },
      applicant: professionalCard(v, a.applicantId),
      applicantUser: summaryById(d, a.applicantId),
      note: a.note,
      status: a.status,
      conversationId: a.conversationId,
      createdAt: a.createdAt,
    };
  };
  return {
    profileExists: d.professionalProfiles.some((p) => p.userId === u.id),
    services: d.services.filter((s) => s.ownerId === u.id).map((s) => serviceDTO(v, s)),
    requestsReceived: reqs.filter((r) => r.providerId === u.id).map((r) => serviceRequestDTO(v, r)),
    requestsSent: reqs.filter((r) => r.requesterId === u.id).map((r) => serviceRequestDTO(v, r)),
    opportunities: mine.map((w) => workOpportunityDTO(v, w)),
    applicationsSent: d.applications.filter((a) => a.applicantId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toApp),
    applicationsReceived: d.applications.filter((a) => myIds.has(a.opportunityId) && a.status !== "WITHDRAWN").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toApp),
  };
});
