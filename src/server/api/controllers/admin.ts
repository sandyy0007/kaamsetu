import { z } from "zod";
import type { Db, Role, User } from "@/types/domain";
import type { AdminContentRow, AdminOverviewDTO, AdminReportRow, AdminUserRow, AdminVerificationRow } from "@/types/dto";
import { adminProfessionSchema, adminProfessionStatusSchema, adminSkillSchema, reportResolveSchema, verificationRequestSchema, verificationReviewSchema } from "@/lib/schemas";
import { newId, persist, purgeDemoData } from "../../db";
import { badRequest, notFound } from "../../errors";
import { summaryById, userSummary } from "../../mappers";
import { requireCap, requireUser } from "../../permissions";
import { sanitizeText } from "@/lib/utils";
import { notify } from "../../services/notify";
import { route, type Ctx } from "../router";

const admin = (c: Ctx) => requireCap(c.user, "admin:access");

/** Heuristic fake-profile / spam signal. Deterministic today; the seam for an ML risk service tomorrow. */
export function assessAccountRisk(d: Db, u: User): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const ageDays = (Date.now() - Date.parse(u.createdAt)) / 86_400_000;
  if (ageDays < 3 && !u.verifiedAt) {
    score += 15;
    reasons.push("Account is less than 3 days old");
  }
  const sent = d.enquiries.filter((e) => e.buyerId === u.id && Date.now() - Date.parse(e.createdAt) < 86_400_000).length;
  if (sent > 5) {
    score += 30;
    reasons.push(`${sent} enquiries in 24 hours`);
  }
  const reports = d.reports.filter((r) => r.targetType === "USER" && r.targetId === u.id && r.status === "OPEN").length;
  if (reports) {
    score += Math.min(50, reports * 25);
    reasons.push(`${reports} open user report${reports > 1 ? "s" : ""}`);
  }
  const profileEmpty = u.role === "FARMER" && !d.farmerProfiles.find((p) => p.userId === u.id)?.district;
  if (profileEmpty) {
    score += 10;
    reasons.push("Profile is incomplete");
  }
  if (!u.email && !u.phone) score += 20;
  return { score: Math.min(100, score), reasons };
}

route("GET", "/admin/overview", (c): AdminOverviewDTO => {
  admin(c);
  const d = c.d;
  const roleCount = new Map<string, number>();
  d.users.forEach((u) => roleCount.set(u.role, (roleCount.get(u.role) ?? 0) + 1));
  const cropCount = new Map<string, number>();
  d.listings.filter((l) => !l.hidden).forEach((l) => cropCount.set(l.crop, (cropCount.get(l.crop) ?? 0) + 1));
  const signups: AdminOverviewDTO["signups"] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    signups.push({ day, count: d.users.filter((u) => u.createdAt.slice(0, 10) === day).length });
  }
  const all = Object.values(d as unknown as Record<string, { isDemo?: boolean }[]>).flat().filter((r) => r && typeof r === "object" && "isDemo" in r);
  return {
    counts: {
      users: d.users.length,
      farmers: d.farmerProfiles.length,
      buyers: d.buyerProfiles.length,
      experts: d.expertProfiles.length,
      organizations: d.organizations.length,
      fpos: d.fpos.length,
      posts: d.posts.length,
      reels: d.reels.length,
      listings: d.listings.length,
      requirements: d.requirements.length,
      events: d.events.length,
      schemes: d.schemes.length,
      courses: d.courses.length,
      communities: d.communities.length,
      professionals: d.professionalProfiles.length,
      professions: d.professions.filter((p) => p.status === "ACTIVE").length,
      services: d.services.length,
      opportunities: d.workOpportunities.length,
      applications: d.applications.length,
      businesses: d.businesses.length,
      pendingProfessions: d.professions.filter((p) => p.status === "PENDING").length,
    },
    usersByRole: Array.from(roleCount.entries()).map(([role, count]) => ({ role, count })),
    listingsByCrop: Array.from(cropCount.entries()).map(([crop, count]) => ({ crop, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    signups,
    openReports: d.reports.filter((r) => r.status === "OPEN").length,
    pendingVerifications: d.verificationRequests.filter((r) => r.status === "PENDING").length,
    demoRecords: all.filter((r) => r.isDemo).length,
    realRecords: all.filter((r) => !r.isDemo).length,
  };
});

route("GET", "/admin/users", (c) => {
  admin(c);
  const role = c.query.get("role") as Role | null;
  const q = (c.query.get("q") ?? "").toLowerCase();
  const status = c.query.get("status");
  const rows: AdminUserRow[] = c.d.users
    .filter((u) => (!role || u.role === role) && (!status || u.status === status) && (!q || `${u.name} ${u.handle} ${u.email ?? ""}`.toLowerCase().includes(q)))
    .map((u) => ({ user: userSummary(c.d, u), email: u.email, status: u.status, createdAt: u.createdAt, risk: assessAccountRisk(c.d, u) }))
    .sort((a, b) => b.risk.score - a.risk.score || b.createdAt.localeCompare(a.createdAt));
  return rows.slice(0, 100);
});

route("PATCH", "/admin/users/:id", async (c) => {
  const a = admin(c);
  const u = c.d.users.find((x) => x.id === c.params.id);
  if (!u) throw notFound("User");
  if (u.id === a.id) throw badRequest("You cannot suspend your own admin account.");
  const { status } = await c.body(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }));
  u.status = status;
  persist();
  return { ok: true };
});

// ───────────── verification (the ONLY place badges are granted) ─────────────
route("GET", "/admin/verifications", (c): AdminVerificationRow[] => {
  admin(c);
  const status = c.query.get("status") ?? "PENDING";
  return c.d.verificationRequests
    .filter((r) => r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ id: r.id, user: summaryById(c.d, r.userId), kind: r.kind, targetName: r.kind === "BUSINESS" ? c.d.businesses.find((b) => b.id === r.targetId)?.name : undefined, note: r.note, documentLabels: r.documentLabels, status: r.status, createdAt: r.createdAt, reviewNote: r.reviewNote }));
});

route("POST", "/admin/verifications/:id/review", async (c) => {
  const a = admin(c);
  const req = c.d.verificationRequests.find((r) => r.id === c.params.id && r.status === "PENDING");
  if (!req) throw notFound("Request");
  const { decision, note } = await c.body(verificationReviewSchema);
  req.status = decision;
  req.reviewedBy = a.id;
  req.reviewNote = note;
  const user = c.d.users.find((u) => u.id === req.userId);
  if (req.kind === "BUSINESS") {
    // Business verification marks the business — it never gives the owner a personal badge.
    const biz = c.d.businesses.find((b) => b.id === req.targetId);
    if (biz && decision === "APPROVED") {
      biz.verifiedAt = new Date().toISOString();
      biz.verifiedBy = a.id;
    }
  } else if (user && decision === "APPROVED") {
    user.verifiedAt = new Date().toISOString();
    user.verifiedBy = a.id;
  }
  notify(c.d, req.userId, "GOVERNMENT", decision === "APPROVED" ? "You are now verified" : "Verification request update", decision === "APPROVED" ? "Your verified badge is now visible on your profile." : (note ?? "Your request was not approved. You can submit again with clearer documents."), "/settings");
  persist();
  return { ok: true };
});

// ───────────── reports & moderation ─────────────
function previewFor(d: Db, type: string, id: string): { text: string; ownerId?: string } {
  switch (type) {
    case "POST": { const p = d.posts.find((x) => x.id === id); return { text: p?.body.slice(0, 120) ?? "(deleted)", ownerId: p?.authorId }; }
    case "REEL": { const r = d.reels.find((x) => x.id === id); return { text: r?.caption.slice(0, 120) ?? "(deleted)", ownerId: r?.authorId }; }
    case "LISTING": { const l = d.listings.find((x) => x.id === id); return { text: l ? `${l.crop} — ${l.quantity} ${l.unit}` : "(deleted)", ownerId: l?.ownerId }; }
    case "QUESTION": { const q = d.questions.find((x) => x.id === id); return { text: q?.body.slice(0, 120) ?? "(deleted)", ownerId: q?.askerId }; }
    case "REQUIREMENT": { const r = d.requirements.find((x) => x.id === id); return { text: r ? `${r.crop} — ${r.quantity} ${r.unit}` : "(deleted)", ownerId: r?.buyerId }; }
    case "COMMENT": { const m = d.comments.find((x) => x.id === id); return { text: m?.body.slice(0, 120) ?? "(deleted)", ownerId: m?.authorId }; }
    case "SERVICE": { const x = d.services.find((k) => k.id === id); return { text: x ? `${x.name} — ${x.description.slice(0, 90)}` : "(deleted)", ownerId: x?.ownerId }; }
    case "OPPORTUNITY": { const x = d.workOpportunities.find((k) => k.id === id); return { text: x?.title ?? "(deleted)", ownerId: x?.posterId }; }
    case "BUSINESS": { const x = d.businesses.find((k) => k.id === id); return { text: x?.name ?? "(deleted)", ownerId: x?.ownerId }; }
    case "USER": { const u = d.users.find((x) => x.id === id); return { text: u ? `${u.name} (@${u.handle})` : "(deleted)", ownerId: u?.id }; }
    default: return { text: id };
  }
}

route("GET", "/admin/reports", (c): AdminReportRow[] => {
  admin(c);
  const status = c.query.get("status") ?? "OPEN";
  return c.d.reports
    .filter((r) => r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ id: r.id, reporter: summaryById(c.d, r.reporterId), targetType: r.targetType, targetId: r.targetId, targetPreview: previewFor(c.d, r.targetType, r.targetId).text, reason: r.reason, details: r.details, status: r.status, createdAt: r.createdAt }));
});

const HIDEABLE: Record<string, (d: Db) => { id: string; hidden: boolean }[]> = {
  POST: (d) => d.posts,
  REEL: (d) => d.reels,
  LISTING: (d) => d.listings,
  QUESTION: (d) => d.questions,
  REQUIREMENT: (d) => d.requirements,
  SERVICE: (d) => d.services,
  OPPORTUNITY: (d) => d.workOpportunities,
  BUSINESS: (d) => d.businesses,
};

route("POST", "/admin/reports/:id/resolve", async (c) => {
  admin(c);
  const report = c.d.reports.find((r) => r.id === c.params.id && r.status === "OPEN");
  if (!report) throw notFound("Report");
  const { action } = await c.body(reportResolveSchema);
  const target = HIDEABLE[report.targetType]?.(c.d).find((x) => x.id === report.targetId);
  if (action === "HIDE_CONTENT") {
    if (target) target.hidden = true;
    report.status = "ACTIONED";
  } else if (action === "SUSPEND_USER") {
    const ownerId = previewFor(c.d, report.targetType, report.targetId).ownerId;
    const owner = c.d.users.find((u) => u.id === ownerId);
    if (owner && owner.role !== "ADMIN") owner.status = "SUSPENDED";
    if (target) target.hidden = true;
    report.status = "ACTIONED";
  } else {
    if (target) target.hidden = false; // auto-hidden content is restored when reports are dismissed
    report.status = "DISMISSED";
  }
  // Close sibling reports on the same target.
  c.d.reports.filter((r) => r.status === "OPEN" && r.targetType === report.targetType && r.targetId === report.targetId).forEach((r) => (r.status = report.status));
  persist();
  return { ok: true };
});

// ───────────── content management ─────────────
type ContentSource = { rows: (d: Db) => { id: string; hidden?: boolean; createdAt?: string; isDemo: boolean }[]; title: (d: Db, id: string) => [string, string]; href?: (id: string) => string };

const CONTENT: Record<string, ContentSource> = {
  posts: { rows: (d) => d.posts, title: (d, id) => { const p = d.posts.find((x) => x.id === id)!; return [p.body.slice(0, 90), `${p.kind} · ${summaryById(d, p.authorId).name}`]; } },
  reels: { rows: (d) => d.reels, title: (d, id) => { const r = d.reels.find((x) => x.id === id)!; return [r.caption.slice(0, 90), `${r.category} · ${summaryById(d, r.authorId).name}`]; }, href: () => "/reels" },
  listings: { rows: (d) => d.listings, title: (d, id) => { const l = d.listings.find((x) => x.id === id)!; return [`${l.crop} — ${l.quantity} ${l.unit}`, `${l.location.district} · ${summaryById(d, l.ownerId).name}`]; }, href: (id) => `/market/${id}` },
  requirements: { rows: (d) => d.requirements, title: (d, id) => { const r = d.requirements.find((x) => x.id === id)!; return [`${r.crop} — ${r.quantity} ${r.unit}`, `${r.district} · ${summaryById(d, r.buyerId).name}`]; } },
  events: { rows: (d) => d.events, title: (d, id) => { const e = d.events.find((x) => x.id === id)!; return [e.name, `${e.category} · ${e.location}`]; }, href: (id) => `/events/${id}` },
  schemes: { rows: (d) => d.schemes, title: (d, id) => { const s = d.schemes.find((x) => x.id === id)!; return [s.name, `${s.category} · ${s.state}`]; }, href: (id) => `/schemes/${id}` },
  live: { rows: (d) => d.liveSessions, title: (d, id) => { const l = d.liveSessions.find((x) => x.id === id)!; return [l.title, `${l.status} · ${summaryById(d, l.hostId).name}`]; }, href: (id) => `/live/${id}` },
  communities: { rows: (d) => d.communities, title: (d, id) => { const x = d.communities.find((k) => k.id === id)!; return [x.name, x.kind]; }, href: (id) => `/communities/${id}` },
  health: { rows: (d) => d.healthResources.map((h) => ({ ...h, createdAt: undefined })), title: (d, id) => { const h = d.healthResources.find((x) => x.id === id)!; return [h.title, `${h.topic} · ${h.kind}`]; } },
  questions: { rows: (d) => d.questions, title: (d, id) => { const q = d.questions.find((x) => x.id === id)!; return [q.body.slice(0, 90), `${q.category} · ${summaryById(d, q.askerId).name}`]; } },
  machinery: { rows: (d) => d.machinery, title: (d, id) => { const m = d.machinery.find((x) => x.id === id)!; return [m.name, `${m.type} · ${m.district}`]; }, href: () => "/machinery" },
  services: { rows: (d) => d.services, title: (d, id) => { const x = d.services.find((k) => k.id === id)!; return [x.name, `${x.priceType} · ${summaryById(d, x.ownerId).name}`]; }, href: (id) => `/services/${id}` },
  opportunities: { rows: (d) => d.workOpportunities, title: (d, id) => { const x = d.workOpportunities.find((k) => k.id === id)!; return [x.title, `${x.kind} · ${x.location.district} · ${summaryById(d, x.posterId).name}`]; }, href: (id) => `/opportunities/${id}` },
  businesses: { rows: (d) => d.businesses, title: (d, id) => { const x = d.businesses.find((k) => k.id === id)!; return [x.name, `${x.kind} · ${x.district}${x.verifiedAt ? " · verified" : ""}`]; }, href: (id) => `/businesses/${id}` },
  courses: { rows: (d) => d.courses, title: (d, id) => { const x = d.courses.find((k) => k.id === id)!; return [x.title, x.category]; }, href: (id) => `/learning/${id}` },
};

route("GET", "/admin/content", (c) => {
  admin(c);
  const type = c.query.get("type") ?? "posts";
  const src = CONTENT[type];
  if (!src) throw badRequest("Unknown content type.");
  const q = (c.query.get("q") ?? "").toLowerCase();
  const rows: AdminContentRow[] = src
    .rows(c.d)
    .map((r) => {
      const [title, subtitle] = src.title(c.d, r.id);
      return { id: r.id, title, subtitle, hidden: !!r.hidden, createdAt: r.createdAt ?? "", isDemo: r.isDemo, href: src.href?.(r.id) };
    })
    .filter((r) => !q || `${r.title} ${r.subtitle}`.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.slice(0, 100);
});

route("PATCH", "/admin/content/:type/:id", async (c) => {
  admin(c);
  const src = CONTENT[c.params.type!];
  if (!src) throw badRequest("Unknown content type.");
  const row = src.rows(c.d).find((r) => r.id === c.params.id);
  if (!row) throw notFound("Item");
  const { hidden } = await c.body(z.object({ hidden: z.boolean() }));
  row.hidden = hidden;
  // `health` rows are copies for listing; mutate the real resource.
  if (c.params.type === "health") {
    const h = c.d.healthResources.find((x) => x.id === c.params.id);
    if (h) h.hidden = hidden;
  }
  persist();
  return { ok: true };
});

route("POST", "/admin/purge-demo", async (c) => {
  const a = admin(c);
  const { confirm } = await c.body(z.object({ confirm: z.string() }));
  if (confirm !== "REMOVE DEMO DATA") throw badRequest('Type "REMOVE DEMO DATA" to confirm.');
  if (a.isDemo) throw badRequest("Sign in with a non-demo admin account before removing demo data, or you would lock yourself out.");
  return { removed: purgeDemoData() };
});

// ───────────── Phase 2: profession & skill catalog, professional verification ─────────────
const profRow = (d: Db, p: Db["professions"][number]) => ({
  id: p.id,
  name: p.name,
  nameHi: p.nameHi,
  emoji: p.emoji,
  categoryId: p.categoryId,
  categoryName: d.professionCategories.find((c) => c.id === p.categoryId)?.name ?? "",
  status: p.status,
  custom: p.custom,
  farmModules: p.farmModules,
  createdBy: p.createdBy ? summaryById(d, p.createdBy) : undefined,
  users: d.professionalProfiles.filter((x) => x.professionId === p.id).length,
});

route("GET", "/admin/professions", (c) => {
  admin(c);
  const status = c.query.get("status");
  return c.d.professions.filter((p) => !status || p.status === status).map((p) => profRow(c.d, p)).sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name));
});

route("POST", "/admin/professions", async (c) => {
  admin(c);
  const input = await c.body(adminProfessionSchema);
  if (!c.d.professionCategories.some((x) => x.id === input.categoryId)) throw badRequest("Choose a category.");
  if (c.d.professions.some((p) => p.name.toLowerCase() === input.name.toLowerCase() && p.status !== "REJECTED")) throw badRequest("A profession with this name already exists.");
  const base = c.d.professions.find((p) => p.id === "pr_other")!;
  c.d.professions.push({ id: newId("pr"), categoryId: input.categoryId, name: input.name, nameHi: input.nameHi, emoji: input.emoji, synonyms: input.synonyms, suggestedSkills: input.suggestedSkills, suggestedServices: [], attributes: base.attributes, dashboard: "GENERAL", farmModules: false, status: "ACTIVE", custom: false, isDemo: false });
  persist();
  return { ok: true };
});

route("PATCH", "/admin/professions/:id", async (c) => {
  const a = admin(c);
  const prof = c.d.professions.find((p) => p.id === c.params.id);
  if (!prof) throw notFound("Profession");
  if (prof.farmModules || prof.id === "pr_other") throw badRequest("This profession is built in and cannot be changed here.");
  const { status, mergeInto, categoryId } = await c.body(adminProfessionStatusSchema);
  if (categoryId) {
    if (!c.d.professionCategories.some((x) => x.id === categoryId)) throw badRequest("Choose a category.");
    prof.categoryId = categoryId;
  }
  const affected = c.d.professionalProfiles.filter((p) => p.professionId === prof.id || p.secondaryProfessionIds.includes(prof.id));
  if (mergeInto) {
    const target = c.d.professions.find((p) => p.id === mergeInto && p.status === "ACTIVE" && p.id !== prof.id);
    if (!target) throw badRequest("Choose an approved profession to merge into.");
    for (const p of affected) {
      if (p.professionId === prof.id) p.professionId = target.id;
      p.secondaryProfessionIds = Array.from(new Set(p.secondaryProfessionIds.map((id) => (id === prof.id ? target.id : id)))).filter((id) => id !== p.professionId);
    }
    c.d.workOpportunities.forEach((w) => (w.professionIds = Array.from(new Set(w.professionIds.map((id) => (id === prof.id ? target.id : id))))));
    c.d.businesses.forEach((b) => (b.professionIds = Array.from(new Set(b.professionIds.map((id) => (id === prof.id ? target.id : id))))));
    prof.status = "REJECTED";
  } else if (status === "ACTIVE") {
    prof.status = "ACTIVE";
    prof.custom = false;
  } else {
    // Rejected: people keep their profile under "Other" with the words they chose — nobody loses an account.
    for (const p of affected) {
      if (p.professionId === prof.id) {
        p.professionId = "pr_other";
        p.customProfession = prof.name;
      }
      p.secondaryProfessionIds = p.secondaryProfessionIds.filter((id) => id !== prof.id);
    }
    prof.status = "REJECTED";
  }
  if (prof.createdBy) notify(c.d, prof.createdBy, "GOVERNMENT", prof.status === "ACTIVE" ? `“${prof.name}” is now in the profession list` : `Update on “${prof.name}”`, prof.status === "ACTIVE" ? "Your profession was approved and appears for everyone." : "Your profile stays active under “Other”. You can choose a listed profession any time.", "/profile/edit");
  void a;
  persist();
  return { ok: true };
});

route("GET", "/admin/skills", (c) => {
  admin(c);
  const q = (c.query.get("q") ?? "").toLowerCase();
  return c.d.skillCatalog.filter((s) => !q || s.name.toLowerCase().includes(q)).map((s) => ({ ...s, professions: s.professionIds.map((id) => c.d.professions.find((p) => p.id === id)?.name).filter(Boolean) })).slice(0, 200);
});

route("POST", "/admin/skills", async (c) => {
  admin(c);
  const input = await c.body(adminSkillSchema);
  if (c.d.skillCatalog.some((s) => s.name.toLowerCase() === input.name.toLowerCase())) throw badRequest("This skill already exists.");
  c.d.skillCatalog.push({ id: newId("sk"), name: input.name, professionIds: input.professionIds, status: "ACTIVE", isDemo: false });
  persist();
  return { ok: true };
});

route("DELETE", "/admin/skills/:id", (c) => {
  admin(c);
  c.d.skillCatalog = c.d.skillCatalog.filter((s) => s.id !== c.params.id);
  persist();
  return { ok: true };
});

// Skill verification is an admin action — a user can never set `verified` on their own skills.
route("POST", "/admin/professionals/:id/verify-skill", async (c) => {
  admin(c);
  const { skill, verified } = await c.body(z.object({ skill: z.string().min(1), verified: z.boolean() }));
  const pp = c.d.professionalProfiles.find((p) => p.userId === c.params.id);
  const s = pp?.skills.find((x) => x.name.toLowerCase() === skill.toLowerCase());
  if (!pp || !s) throw notFound("Skill");
  s.verified = verified || undefined;
  persist();
  return { ok: true };
});

route("POST", "/businesses/:id/verification", async (c) => {
  const u = requireUser(c.user);
  const b = c.d.businesses.find((x) => x.id === c.params.id);
  if (!b || b.ownerId !== u.id) throw notFound("Business");
  if (b.verifiedAt) throw badRequest("This business is already verified.");
  if (c.d.verificationRequests.some((r) => r.userId === u.id && r.targetId === b.id && r.status === "PENDING")) throw badRequest("You already have a pending request for this business.");
  const input = await c.body(verificationRequestSchema);
  c.d.verificationRequests.push({ id: newId("vr"), userId: u.id, kind: "BUSINESS", targetId: b.id, note: input.note, documentLabels: input.documentLabels.map(sanitizeText), status: "PENDING", createdAt: new Date().toISOString(), isDemo: false });
  persist();
  return { ok: true };
});
