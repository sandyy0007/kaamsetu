/**
 * Universal professional layer — read-side helpers (DTO mappers, search, reputation, matching, map points).
 * Everything profession-specific comes from the Profession catalog rows; nothing here hardcodes a trade.
 * Privacy is applied here, at the DTO boundary, through the same `canSee` the farmer profile uses.
 */
import type { Business, Db, Profession, ProfessionalProfile, Service, ServiceRequest, WorkOpportunity } from "@/types/domain";
import type {
  BusinessCardDTO,
  CatalogDTO,
  MapPointDTO,
  PortfolioEntryDTO,
  ProfessionalCardDTO,
  ProfessionDTO,
  RecommendationDTO,
  ReputationDTO,
  ServiceDTO,
  ServiceRequestDTO,
  WorkHistoryDTO,
  WorkOpportunityDTO,
} from "@/types/dto";
import { districtDistanceKm, findPlaceInText, RAJASTHAN_DISTRICTS } from "@/lib/geo";
import { formatNumber, unitLabel } from "@/lib/utils";
import { areConnected, canSee, isBlockedEitherWay } from "../privacy";
import { isFollowing, listingVisible, summaryById, userSummary, type View } from "../mappers";

const THIS_YEAR = () => new Date().getFullYear();
const lower = (s: string | undefined) => (s ?? "").toLowerCase();

// ───────────── catalog ─────────────
export function professionOf(d: Db, id: string): Profession | undefined {
  return d.professions.find((p) => p.id === id);
}

export function professionDTO(d: Db, p: Profession): ProfessionDTO {
  const cat = d.professionCategories.find((c) => c.id === p.categoryId);
  return {
    id: p.id,
    categoryId: p.categoryId,
    categoryName: cat?.name ?? "Other",
    name: p.name,
    nameHi: p.nameHi,
    emoji: p.emoji,
    suggestedSkills: p.suggestedSkills,
    suggestedServices: p.suggestedServices,
    attributes: p.attributes,
    dashboard: p.dashboard,
    farmModules: p.farmModules,
    status: p.status,
    custom: p.custom,
  };
}

/** Public catalog: ACTIVE professions plus the viewer's own pending custom one (so they can see it). */
export function catalogDTO(v: View): CatalogDTO {
  const { d, viewer } = v;
  const visible = (p: Profession) => p.status === "ACTIVE" || (p.status === "PENDING" && !!viewer && p.createdBy === viewer.id);
  return {
    categories: [...d.professionCategories]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ id: c.id, name: c.name, nameHi: c.nameHi, emoji: c.emoji, professions: d.professions.filter((p) => p.categoryId === c.id && visible(p)).map((p) => professionDTO(d, p)) }))
      .filter((c) => c.professions.length),
    skills: d.skillCatalog.filter((s) => s.status === "ACTIVE").map((s) => ({ id: s.id, name: s.name, professionIds: s.professionIds })),
  };
}

// ───────────── labels ─────────────
export const AVAILABILITY_LABEL: Record<string, string> = { AVAILABLE: "Available", BUSY: "Busy right now", OPEN_TO_WORK: "Open to work", NOT_AVAILABLE: "Not available" };

export function priceLabel(s: Pick<Service, "price" | "priceType">): string {
  if (s.priceType === "NEGOTIABLE" || s.price === undefined) return "Price on request";
  const amt = `₹${formatNumber(s.price)}`;
  const per = { FIXED: "", HOURLY: " / hour", DAILY: " / day", PER_VISIT: " / visit", MONTHLY: " / month" }[s.priceType];
  return amt + per;
}

export function payLabel(p: WorkOpportunity["pay"]): string {
  if (p.unit === "NEGOTIABLE" || (p.min === undefined && p.max === undefined)) return "Pay to be discussed";
  const unit = { HOUR: "hour", DAY: "day", MONTH: "month", PROJECT: "project" }[p.unit];
  const range = p.min !== undefined && p.max !== undefined && p.min !== p.max ? `₹${formatNumber(p.min)}–${formatNumber(p.max)}` : `₹${formatNumber((p.min ?? p.max)!)}`;
  return `${range} / ${unit}`;
}

export const experienceYears = (p: Pick<ProfessionalProfile, "startedYear">) => Math.max(0, THIS_YEAR() - p.startedYear);

// ───────────── reputation: only what can be checked ─────────────
export function reputationFor(d: Db, userId: string): ReputationDTO {
  const pp = d.professionalProfiles.find((p) => p.userId === userId);
  const received = d.serviceRequests.filter((r) => r.providerId === userId);
  // A request counts as "responded" once the provider accepted or rejected it (cancelled-by-requester ones are excluded).
  const considered = received.filter((r) => r.status !== "CANCELLED");
  const responded = considered.filter((r) => r.status !== "PENDING");
  const recs = d.recommendations.filter((r) => r.subjectId === userId && !r.hidden);
  const farmPortfolio = d.farmerProfiles.find((f) => f.userId === userId)?.portfolio.length ?? 0;
  return {
    completedJobs: received.filter((r) => r.status === "COMPLETED").length,
    recommendations: recs.length,
    verifiedRecommendations: recs.filter((r) => r.interactionVerified).length,
    verifiedSkills: pp?.skills.filter((s) => s.verified).length ?? 0,
    certifications: pp?.certifications.length ?? 0,
    responseRate: considered.length >= 3 ? Math.round((responded.length / considered.length) * 100) : null,
    requestsReceived: considered.length,
    experienceYears: pp ? experienceYears(pp) : 0,
    portfolioCount: d.portfolioEntries.filter((e) => e.ownerId === userId && !e.hidden).length + farmPortfolio,
  };
}

// ───────────── services ─────────────
export function serviceDTO(v: View, s: Service, near?: string): ServiceDTO {
  const { d, viewer } = v;
  const owner = d.users.find((u) => u.id === s.ownerId);
  const district = d.professionalProfiles.find((p) => p.userId === s.ownerId)?.location.district;
  return {
    id: s.id,
    ownerId: s.ownerId,
    owner: owner ? userSummary(d, owner) : summaryById(d, s.ownerId),
    name: s.name,
    description: s.description,
    price: s.price,
    priceType: s.priceType,
    priceLabel: priceLabel(s),
    areas: s.areas,
    availability: s.availability,
    media: s.media,
    active: s.active,
    isOwn: viewer?.id === s.ownerId,
    isDemo: s.isDemo,
    district,
    distanceKm: near && district ? (lower(district) === lower(near) ? 0 : districtDistanceKm(district, near)) : null,
  };
}

export function serviceVisible(v: View, s: Service): boolean {
  const { d, viewer } = v;
  if (viewer?.id === s.ownerId || viewer?.role === "ADMIN") return true;
  if (s.hidden || !s.active) return false;
  const owner = d.users.find((u) => u.id === s.ownerId);
  if (!owner || owner.status !== "ACTIVE") return false;
  if (viewer && isBlockedEitherWay(d, viewer.id, s.ownerId)) return false;
  const pp = d.professionalProfiles.find((p) => p.userId === s.ownerId);
  return !pp || canSee(d, viewer, s.ownerId, pp.privacy.profile);
}

export function serviceRequestDTO(v: View, r: ServiceRequest): ServiceRequestDTO {
  const { d, viewer } = v;
  const svc = d.services.find((s) => s.id === r.serviceId);
  const isProvider = viewer?.id === r.providerId;
  return {
    id: r.id,
    service: { id: r.serviceId, name: svc?.name ?? "Service", priceLabel: svc ? priceLabel(svc) : "" },
    provider: summaryById(d, r.providerId),
    requester: summaryById(d, r.requesterId),
    date: r.date,
    // Requester's village/address is shared with the provider only — the provider needs it to do the job.
    location: { village: r.location.village, district: r.location.district, state: r.location.state },
    description: r.description,
    status: r.status,
    conversationId: r.conversationId,
    createdAt: r.createdAt,
    role: isProvider ? "PROVIDER" : "REQUESTER",
    isDemo: r.isDemo,
  };
}

// ───────────── portfolio / history / recommendations ─────────────
export function portfolioFor(v: View, userId: string): PortfolioEntryDTO[] {
  const { d } = v;
  const own = d.portfolioEntries
    .filter((e) => e.ownerId === userId && (!e.hidden || v.viewer?.id === userId))
    .map<PortfolioEntryDTO>((e) => ({ id: e.id, title: e.title, description: e.description, category: e.category, date: e.date, skillsUsed: e.skillsUsed, media: e.media, imageUrl: e.imageUrl, videoUrl: e.videoUrl, meta: e.meta, source: "PORTFOLIO" }));
  // Existing farm portfolio items are surfaced, not copied — one source of truth, nothing migrated or lost.
  const farm = (d.farmerProfiles.find((f) => f.userId === userId)?.portfolio ?? []).map<PortfolioEntryDTO>((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: "Farm",
    date: `${p.year}-01-01`,
    skillsUsed: [p.crop, p.method].filter(Boolean),
    media: [{ id: `${p.id}_m`, kind: "PHOTO", caption: p.title, scene: p.scene }],
    meta: { Crop: p.crop, Area: `${p.areaAcres} acres`, Yield: p.yieldText, Method: p.method },
    source: "FARM",
  }));
  return [...own, ...farm].sort((a, b) => b.date.localeCompare(a.date));
}

export function workHistoryFor(d: Db, userId: string): WorkHistoryDTO[] {
  return d.workHistory
    .filter((w) => w.ownerId === userId)
    .sort((a, b) => (b.endDate ? 0 : 1) - (a.endDate ? 0 : 1) || b.startDate.localeCompare(a.startDate))
    .map(({ id, role, organization, kind, location, startDate, endDate, description, skills }) => ({ id, role, organization, kind, location, startDate, endDate, description, skills }));
}

export function recommendationsFor(v: View, userId: string): RecommendationDTO[] {
  const { d, viewer } = v;
  return d.recommendations
    .filter((r) => r.subjectId === userId && (!r.hidden || viewer?.id === r.authorId || viewer?.role === "ADMIN") && !(viewer && isBlockedEitherWay(d, viewer.id, r.authorId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ id: r.id, author: summaryById(d, r.authorId), relationship: r.relationship, body: r.body, skill: r.skill, interactionVerified: r.interactionVerified, createdAt: r.createdAt, isOwn: viewer?.id === r.authorId }));
}

/** True when the two users have actually transacted: a completed service request or an accepted application. */
export function hasVerifiedInteraction(d: Db, a: string, b: string): boolean {
  if (d.serviceRequests.some((r) => r.status === "COMPLETED" && ((r.providerId === a && r.requesterId === b) || (r.providerId === b && r.requesterId === a)))) return true;
  return d.applications.some((ap) => {
    if (ap.status !== "ACCEPTED") return false;
    const wo = d.workOpportunities.find((w) => w.id === ap.opportunityId);
    return !!wo && ((wo.posterId === a && ap.applicantId === b) || (wo.posterId === b && ap.applicantId === a));
  });
}

// ───────────── cards ─────────────
export function professionalVisible(v: View, userId: string): boolean {
  const { d, viewer } = v;
  const pp = d.professionalProfiles.find((p) => p.userId === userId);
  const u = d.users.find((x) => x.id === userId);
  if (!pp || !u || u.status !== "ACTIVE") return false;
  if (viewer && isBlockedEitherWay(d, viewer.id, userId)) return false;
  return canSee(d, viewer, userId, pp.privacy.profile);
}

export function professionalCard(v: View, userId: string, near?: string): ProfessionalCardDTO | null {
  const { d, viewer } = v;
  const pp = d.professionalProfiles.find((p) => p.userId === userId);
  const u = d.users.find((x) => x.id === userId);
  const prof = pp && professionOf(d, pp.professionId);
  if (!pp || !u || !prof) return null;
  const cat = d.professionCategories.find((c) => c.id === prof.categoryId);
  const rep = reputationFor(d, userId);
  const services = d.services.filter((s) => s.ownerId === userId && s.active && !s.hidden).slice(0, 3).map((s) => ({ id: s.id, name: s.name, priceLabel: priceLabel(s) }));
  const card: ProfessionalCardDTO = {
    user: userSummary(d, u),
    profession: { id: prof.id, name: pp.customProfession || prof.name, emoji: prof.emoji, categoryName: cat?.name ?? "" },
    secondaryProfessions: pp.secondaryProfessionIds.map((id) => professionOf(d, id)).filter((p): p is Profession => !!p).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji })),
    customProfession: pp.customProfession,
    experienceYears: experienceYears(pp),
    district: pp.location.district,
    state: pp.location.state,
    distanceKm: near && pp.location.district ? (lower(pp.location.district) === lower(near) ? 0 : districtDistanceKm(pp.location.district, near)) : null,
    skills: pp.skills.slice(0, 5).map((s) => s.name),
    services,
    availability: { status: pp.availability.status, label: AVAILABILITY_LABEL[pp.availability.status] ?? "" },
    openToWork: pp.availability.status === "OPEN_TO_WORK" || pp.availability.status === "AVAILABLE",
    reputation: { completedJobs: rep.completedJobs, recommendations: rep.recommendations, verifiedSkills: rep.verifiedSkills },
    saved: !!viewer && d.saved.some((s) => s.userId === viewer.id && s.targetType === "PROFESSIONAL" && s.targetId === userId),
    isFollowing: isFollowing(v, userId),
    isSelf: viewer?.id === userId,
  };
  if (prof.farmModules) {
    const lots = d.listings.filter((l) => l.ownerId === userId && l.status === "AVAILABLE" && !l.hidden && listingVisible(v, l)).slice(0, 3);
    const crops = Array.from(new Set(d.crops.filter((c) => c.ownerId === userId).map((c) => c.name))).slice(0, 4);
    card.farmer = { crops, produce: lots.map((l) => ({ crop: l.crop, quantity: l.quantity, unit: unitLabel(l.unit) })) };
  }
  const biz = pp.businessId ? d.businesses.find((b) => b.id === pp.businessId && !b.hidden) : undefined;
  if (biz) card.business = { id: biz.id, name: biz.name };
  return card;
}

// ───────────── discovery ─────────────
export interface ProfessionalSearch {
  q?: string;
  profession?: string;
  category?: string;
  skill?: string;
  district?: string;
  near?: string;
  maxKm?: number;
  minExperience?: number;
  availableNow?: boolean;
  verified?: boolean;
  service?: string;
  sort?: "relevance" | "distance" | "experience" | "verified";
}

const STOP = new Set(["near", "in", "from", "of", "the", "at", "around", "and", "with", "who", "for", "a", "an", "में", "के", "पास", "और"]);
const tokens = (q: string) => q.toLowerCase().split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 1 && !STOP.has(t));

export function searchProfessionals(v: View, o: ProfessionalSearch): (ProfessionalCardDTO & { matchReason?: string })[] {
  const { d, viewer } = v;
  const q = o.q?.trim() ?? "";
  const place = o.near || o.district || (q ? findPlaceInText(q) : null) || undefined;
  const words = tokens(q).filter((t) => !(place && lower(place).includes(t)));
  const out: { card: ProfessionalCardDTO & { matchReason?: string }; score: number }[] = [];

  for (const pp of d.professionalProfiles) {
    if (viewer?.id === pp.userId) continue;
    if (!professionalVisible(v, pp.userId)) continue;
    const prof = professionOf(d, pp.professionId);
    if (!prof || prof.status === "REJECTED") continue;
    if (o.profession && pp.professionId !== o.profession && !pp.secondaryProfessionIds.includes(o.profession)) continue;
    if (o.category && prof.categoryId !== o.category) continue;
    if (o.skill && !pp.skills.some((s) => lower(s.name).includes(lower(o.skill)))) continue;
    if (o.minExperience && experienceYears(pp) < o.minExperience) continue;
    if (o.availableNow && !(pp.availability.status === "AVAILABLE" || pp.availability.status === "OPEN_TO_WORK")) continue;
    const user = d.users.find((u) => u.id === pp.userId)!;
    if (o.verified && !user.verifiedAt) continue;
    const services = d.services.filter((s) => s.ownerId === pp.userId && s.active && !s.hidden);
    if (o.service && !services.some((s) => lower(`${s.name} ${s.description}`).includes(lower(o.service)))) continue;

    const card = professionalCard(v, pp.userId, place);
    if (!card) continue;
    let score = 0;
    const reasons: string[] = [];

    if (place) {
      const km = card.distanceKm ?? null;
      // Distance filter counts the professional's own travel radius: someone willing to travel 40 km serves a place 35 km away.
      if (o.maxKm !== undefined && km !== null && km > Math.max(o.maxKm, 0) && km > pp.location.serviceRadiusKm) continue;
      if (o.district && km === null && lower(pp.location.district) !== lower(o.district)) continue;
      if (km === 0) {
        score += 40;
        reasons.push(`In ${place}`);
      } else if (km !== null) {
        score += Math.max(0, 35 - km / 8);
        reasons.push(`~${km} km from ${place}`);
        if (km <= pp.location.serviceRadiusKm) {
          score += 8;
          reasons.push("Travels to your area");
        }
      }
    }
    if (words.length) {
      const text = lower(
        [user.name, user.headline, prof.name, prof.nameHi, prof.synonyms.join(" "), pp.customProfession, pp.location.district, pp.location.village, pp.skills.map((s) => s.name).join(" "), services.map((s) => s.name).join(" "), pp.secondaryProfessionIds.map((id) => professionOf(d, id)?.name).join(" "), Object.values(pp.attributes).flat().join(" ")].filter(Boolean).join(" "),
      );
      const hits = words.filter((w) => text.includes(w)).length;
      if (hits === 0 && !place) continue;
      if (hits === 0 && place && !card.distanceKm && card.distanceKm !== 0) continue;
      if (hits === 0 && words.length) continue;
      score += (hits / words.length) * 45;
      if (hits) reasons.push(`Matches “${words.filter((w) => text.includes(w)).join(" ")}”`);
    }
    if (user.verifiedAt) score += 10;
    score += Math.min(10, card.reputation.recommendations * 2 + card.reputation.completedJobs);
    if (card.openToWork) score += 3;
    score += Math.min(6, card.experienceYears / 4);
    card.matchReason = reasons.join(" · ") || undefined;
    out.push({ card, score });
  }
  const sort = o.sort ?? "relevance";
  out.sort((a, b) => {
    if (sort === "distance") return (a.card.distanceKm ?? 9999) - (b.card.distanceKm ?? 9999) || b.score - a.score;
    if (sort === "experience") return b.card.experienceYears - a.card.experienceYears;
    if (sort === "verified") return Number(b.card.user.verified) - Number(a.card.user.verified) || b.score - a.score;
    return b.score - a.score;
  });
  return out.map((x) => x.card);
}

// ───────────── work opportunities ─────────────
export function opportunityVisible(v: View, w: WorkOpportunity): boolean {
  const { d, viewer } = v;
  if (viewer?.id === w.posterId || viewer?.role === "ADMIN") return true;
  if (w.hidden || w.status === "CLOSED") return false;
  const poster = d.users.find((u) => u.id === w.posterId);
  if (!poster || poster.status !== "ACTIVE") return false;
  return !(viewer && isBlockedEitherWay(d, viewer.id, w.posterId));
}

export function matchOpportunity(d: Db, viewerId: string, w: WorkOpportunity): { score: number; reasons: string[] } {
  const pp = d.professionalProfiles.find((p) => p.userId === viewerId);
  if (!pp) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;
  const profMatch = w.professionIds.includes(pp.professionId) || w.professionIds.some((id) => pp.secondaryProfessionIds.includes(id));
  if (profMatch) {
    score += 50;
    reasons.push(`Looking for a ${professionOf(d, pp.professionId)?.name ?? "professional"}`.replace(/^Looking for a /, "Matches your profession: "));
  }
  const mine = new Set(pp.skills.map((s) => lower(s.name)));
  const common = w.skills.filter((s) => mine.has(lower(s)));
  if (common.length) {
    score += Math.min(25, common.length * 10);
    reasons.push(`Uses your skills: ${common.slice(0, 3).join(", ")}`);
  }
  const km = lower(w.location.district) === lower(pp.location.district) ? 0 : districtDistanceKm(w.location.district, pp.location.district);
  if (km === 0) {
    score += 25;
    reasons.push(`In your district (${w.location.district})`);
  } else if (km !== null && km <= pp.location.serviceRadiusKm) {
    score += 15;
    reasons.push(`Within your ${pp.location.serviceRadiusKm} km range`);
  } else if (km !== null) score += Math.max(0, 10 - km / 30);
  return { score, reasons };
}

export function workOpportunityDTO(v: View, w: WorkOpportunity, near?: string): WorkOpportunityDTO {
  const { d, viewer } = v;
  const isOwn = viewer?.id === w.posterId;
  const my = viewer ? d.applications.find((a) => a.opportunityId === w.id && a.applicantId === viewer.id && a.status !== "WITHDRAWN") : undefined;
  const poster = d.users.find((u) => u.id === w.posterId);
  const biz = w.businessId ? d.businesses.find((b) => b.id === w.businessId) : undefined;
  const m = viewer && viewer.personalization ? matchOpportunity(d, viewer.id, w) : { score: 0, reasons: [] };
  const km = near ? (lower(w.location.district) === lower(near) ? 0 : districtDistanceKm(w.location.district, near)) : null;
  return {
    id: w.id,
    poster: poster ? userSummary(d, poster) : summaryById(d, w.posterId),
    business: biz ? { id: biz.id, name: biz.name } : undefined,
    title: w.title,
    description: w.description,
    kind: w.kind,
    professions: w.professionIds.map((id) => professionOf(d, id)).filter((p): p is Profession => !!p).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji })),
    skills: w.skills,
    openings: w.openings,
    district: w.location.district,
    state: w.location.state,
    village: isOwn ? w.location.village : undefined,
    startDate: w.startDate,
    mode: w.mode,
    pay: w.pay,
    payLabel: payLabel(w.pay),
    duration: w.duration,
    contactMethod: w.contactMethod,
    status: w.status,
    createdAt: w.createdAt,
    distanceKm: km,
    applicantCount: isOwn ? d.applications.filter((a) => a.opportunityId === w.id && a.status !== "WITHDRAWN").length : undefined,
    viewer: {
      isOwn,
      applied: !!my,
      applicationStatus: my?.status,
      saved: !!viewer && d.saved.some((s) => s.userId === viewer.id && s.targetType === "WORK" && s.targetId === w.id),
      matchReasons: m.reasons,
      canApply: !!viewer && !isOwn && w.status === "OPEN" && !my,
    },
    // The poster's number is shared only when they chose phone contact AND they accepted this applicant.
    contactPhone: w.contactMethod === "PHONE" && poster?.phone && (isOwn || my?.status === "ACCEPTED") ? poster.phone : undefined,
    isDemo: w.isDemo,
  };
}

// ───────────── businesses ─────────────
export function businessCard(v: View, b: Business): BusinessCardDTO {
  const { d, viewer } = v;
  return {
    id: b.id,
    owner: summaryById(d, b.ownerId),
    name: b.name,
    kind: b.kind,
    about: b.about,
    services: b.services,
    professions: b.professionIds.map((id) => professionOf(d, id)).filter((p): p is Profession => !!p).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji })),
    district: b.district,
    state: b.state,
    website: b.website,
    verified: !!b.verifiedAt,
    openOpportunities: d.workOpportunities.filter((w) => (w.businessId === b.id || w.posterId === b.ownerId) && w.status === "OPEN" && !w.hidden).length,
    isOwn: viewer?.id === b.ownerId,
    isDemo: b.isDemo,
  };
}

export function businessVisible(v: View, b: Business) {
  if (v.viewer?.id === b.ownerId || v.viewer?.role === "ADMIN") return true;
  if (b.hidden) return false;
  const owner = v.d.users.find((u) => u.id === b.ownerId);
  return !!owner && owner.status === "ACTIVE" && !(v.viewer && isBlockedEitherWay(v.d, v.viewer.id, b.ownerId));
}

// ───────────── map: approximate points only ─────────────
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Deterministic offset from the district centroid (about ±6 km). The point shows "this area", never a home or shop —
 * even a user who chose VILLAGE precision is shown by district here.
 */
export function approxPoint(id: string, district: string): { lat: number; lng: number } | null {
  const key = Object.keys(RAJASTHAN_DISTRICTS).find((k) => lower(k) === lower(district));
  if (!key) return null;
  const c = RAJASTHAN_DISTRICTS[key]!;
  const h1 = hash(id) / 4294967296;
  const h2 = hash(id + "x") / 4294967296;
  return { lat: Math.round((c.lat + (h1 - 0.5) * 0.12) * 1000) / 1000, lng: Math.round((c.lng + (h2 - 0.5) * 0.12) * 1000) / 1000 };
}

export function mapPoints(v: View, types: Set<string>, filters: { profession?: string; district?: string }): MapPointDTO[] {
  const { d } = v;
  const out: MapPointDTO[] = [];
  const add = (p: Omit<MapPointDTO, "lat" | "lng" | "area"> & { district: string }) => {
    const pt = approxPoint(p.id, p.district);
    if (pt) out.push({ id: p.id, type: p.type, title: p.title, subtitle: p.subtitle, emoji: p.emoji, href: p.href, ...pt, area: p.district });
  };
  if (types.has("PROFESSIONAL")) {
    for (const pp of d.professionalProfiles) {
      if (v.viewer?.id === pp.userId || !professionalVisible(v, pp.userId)) continue;
      if (filters.profession && pp.professionId !== filters.profession) continue;
      if (filters.district && lower(pp.location.district) !== lower(filters.district)) continue;
      const prof = professionOf(d, pp.professionId);
      const u = d.users.find((x) => x.id === pp.userId)!;
      add({ id: `mp_${pp.userId}`, type: "PROFESSIONAL", title: u.name, subtitle: `${prof?.name ?? ""} · ${experienceYears(pp)} yrs`, emoji: prof?.emoji ?? "👤", href: `/professionals/${pp.userId}`, district: pp.location.district });
    }
  }
  if (types.has("SERVICE")) {
    for (const s of d.services) {
      if (!serviceVisible(v, s) || s.ownerId === v.viewer?.id) continue;
      const pp = d.professionalProfiles.find((p) => p.userId === s.ownerId);
      if (!pp || (filters.profession && pp.professionId !== filters.profession)) continue;
      if (filters.district && lower(pp.location.district) !== lower(filters.district)) continue;
      add({ id: `ms_${s.id}`, type: "SERVICE", title: s.name, subtitle: `${priceLabel(s)} · ${summaryById(d, s.ownerId).name}`, emoji: "🧰", href: `/professionals/${s.ownerId}?tab=services`, district: pp.location.district });
    }
  }
  if (types.has("OPPORTUNITY")) {
    for (const w of d.workOpportunities) {
      if (!opportunityVisible(v, w) || w.status !== "OPEN" || w.hidden) continue;
      if (filters.profession && !w.professionIds.includes(filters.profession)) continue;
      if (filters.district && lower(w.location.district) !== lower(filters.district)) continue;
      add({ id: `mo_${w.id}`, type: "OPPORTUNITY", title: w.title, subtitle: payLabel(w.pay), emoji: "💼", href: `/opportunities/${w.id}`, district: w.location.district });
    }
  }
  if (types.has("BUSINESS")) {
    for (const b of d.businesses) {
      if (!businessVisible(v, b) || b.hidden) continue;
      if (filters.district && lower(b.district) !== lower(filters.district)) continue;
      if (filters.profession && !b.professionIds.includes(filters.profession)) continue;
      add({ id: `mb_${b.id}`, type: "BUSINESS", title: b.name, subtitle: b.kind, emoji: "🏪", href: `/businesses/${b.id}`, district: b.district });
    }
  }
  if (types.has("EVENT")) {
    for (const e of d.events) {
      if (e.hidden || !e.district || Date.parse(e.endsAt ?? e.startsAt) < Date.now()) continue;
      if (filters.district && lower(e.district) !== lower(filters.district)) continue;
      add({ id: `me_${e.id}`, type: "EVENT", title: e.name, subtitle: e.category, emoji: "📅", href: `/events/${e.id}`, district: e.district });
    }
  }
  return out;
}

export { areConnected };

// ───────────── default artwork per profession (procedural scenes — no stock photos) ─────────────
export { sceneForProfession } from "@/lib/profession-scene";
