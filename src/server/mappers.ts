/**
 * DTO mappers — the single boundary where database rows become API responses.
 * Anything private (phone, exact village, financial ledgers, password hashes) is removed or
 * conditionally included here, using the privacy layer.
 */
import type {
  AgriEvent,
  Comment,
  Community,
  CropCycle,
  Db,
  ExpertAnswer,
  ExpertQuestion,
  GovernmentScheme,
  LiveSession,
  MachineryListing,
  Post,
  ProduceListing,
  Reel,
  Crop,
  Farm,
  User,
  BuyerRequirement,
  Course,
  StoryItem,
} from "@/types/domain";
import type {
  AnswerDTO,
  CommentDTO,
  CommunityDTO,
  CourseCardDTO,
  CropDTO,
  CycleDTO,
  EventDTO,
  ExpertCardDTO,
  FarmDTO,
  FarmerCardDTO,
  ListingCardDTO,
  LiveDTO,
  MachineryDTO,
  OrgCardDTO,
  PostDTO,
  QuestionDTO,
  ReelDTO,
  RequirementDTO,
  SchemeDTO,
  StoryDTO,
  UserSummary,
  BuyerCardDTO,
} from "@/types/dto";
import { VERIFIED_LABEL } from "@/lib/constants";
import { computeCycleStats } from "@/lib/farm-calc";
import { daysUntil } from "@/lib/utils";
import { canSee } from "./privacy";

export interface View {
  d: Db;
  viewer: User | null;
}

// ───────────── users ─────────────
export function userDistrict(d: Db, userId: string): string | undefined {
  return (
    d.professionalProfiles.find((p) => p.userId === userId)?.location.district ||
    d.farmerProfiles.find((p) => p.userId === userId)?.district ||
    d.buyerProfiles.find((p) => p.userId === userId)?.district ||
    d.expertProfiles.find((p) => p.userId === userId)?.district ||
    d.organizations.find((p) => p.userId === userId)?.district ||
    d.fpos.find((p) => p.userId === userId)?.district ||
    undefined
  );
}

export function userSummary(d: Db, u: User): UserSummary {
  const verified = !!u.verifiedAt;
  const org = u.role === "GOVERNMENT" || u.role === "FPO";
  const pp = d.professionalProfiles.find((p) => p.userId === u.id);
  const prof = pp && d.professions.find((x) => x.id === pp.professionId);
  const profession = prof ? { id: prof.id, name: pp?.customProfession || prof.name, emoji: prof.emoji } : undefined;
  return {
    id: u.id,
    name: u.name,
    handle: u.handle,
    role: u.role,
    hue: u.hue,
    headline: u.headline,
    verified,
    // Verified badge names the actual trade ("Verified Electrician"); the admin approval behind it is unchanged.
    badge: verified ? (u.role === "PROFESSIONAL" && profession ? `Verified ${profession.name}` : VERIFIED_LABEL[u.role]) : undefined,
    district: org ? undefined : userDistrict(d, u.id),
    profession,
    isDemo: u.isDemo,
  };
}

export function summaryById(d: Db, id: string): UserSummary {
  const u = d.users.find((x) => x.id === id);
  if (!u) return { id, name: "Deleted user", handle: "deleted", role: "FARMER", hue: 0, verified: false, isDemo: false };
  return userSummary(d, u);
}

export const followerCount = (d: Db, id: string) => d.follows.filter((f) => f.followingId === id).length;
export const isFollowing = (v: View, id: string) => !!v.viewer && v.d.follows.some((f) => f.followerId === v.viewer!.id && f.followingId === id);

const savedBy = (v: View, type: string, id: string) => !!v.viewer && v.d.saved.some((s) => s.userId === v.viewer!.id && s.targetType === type && s.targetId === id);

// ───────────── social ─────────────
export function postDTO(v: View, p: Post): PostDTO {
  const { d, viewer } = v;
  const author = d.users.find((u) => u.id === p.authorId);
  const community = p.communityId ? d.communities.find((c) => c.id === p.communityId) : undefined;
  return {
    id: p.id,
    kind: p.kind,
    body: p.body,
    tags: p.tags,
    scene: p.scene,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt,
    author: author ? userSummary(d, author) : summaryById(d, p.authorId),
    community: community ? { id: community.id, name: community.name } : undefined,
    crop: p.crop,
    district: p.district,
    linkedEventId: p.linkedEventId,
    likeCount: d.likes.filter((l) => l.targetType === "POST" && l.targetId === p.id).length,
    commentCount: d.comments.filter((c) => c.targetType === "POST" && c.targetId === p.id).length,
    liked: !!viewer && d.likes.some((l) => l.userId === viewer.id && l.targetType === "POST" && l.targetId === p.id),
    saved: savedBy(v, "POST", p.id),
    followingAuthor: isFollowing(v, p.authorId),
    isOwn: viewer?.id === p.authorId,
    official: author?.role === "GOVERNMENT" || author?.role === "FPO" || author?.role === "ADMIN",
    isDemo: p.isDemo,
  };
}

export function reelDTO(v: View, r: Reel): ReelDTO {
  const { d, viewer } = v;
  return {
    id: r.id,
    caption: r.caption,
    category: r.category,
    tags: r.tags,
    scene: r.scene,
    durationSec: r.durationSec,
    videoUrl: r.videoUrl,
    createdAt: r.createdAt,
    author: summaryById(d, r.authorId),
    likeCount: d.likes.filter((l) => l.targetType === "REEL" && l.targetId === r.id).length,
    commentCount: d.comments.filter((c) => c.targetType === "REEL" && c.targetId === r.id).length,
    liked: !!viewer && d.likes.some((l) => l.userId === viewer.id && l.targetType === "REEL" && l.targetId === r.id),
    saved: savedBy(v, "REEL", r.id),
    followingAuthor: isFollowing(v, r.authorId),
    isOwn: viewer?.id === r.authorId,
    isDemo: r.isDemo,
  };
}

export const commentDTO = (v: View, c: Comment): CommentDTO => ({
  id: c.id,
  body: c.body,
  createdAt: c.createdAt,
  author: summaryById(v.d, c.authorId),
  isOwn: v.viewer?.id === c.authorId,
});

export const storyDTO = (v: View, s: StoryItem): StoryDTO => ({
  id: s.id,
  kind: s.kind,
  title: s.title,
  body: s.body,
  link: s.link,
  scene: s.scene,
  author: summaryById(v.d, s.authorId),
  expiresAt: s.expiresAt,
  isDemo: s.isDemo,
});

export function communityDTO(v: View, c: Community): CommunityDTO {
  const member = v.viewer ? v.d.communityMembers.find((m) => m.communityId === c.id && m.userId === v.viewer!.id) : undefined;
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    description: c.description,
    scene: c.scene,
    memberCount: v.d.communityMembers.filter((m) => m.communityId === c.id).length,
    postCount: v.d.posts.filter((p) => p.communityId === c.id && !p.hidden).length,
    joined: !!member,
    isModerator: member?.role === "MODERATOR" || v.viewer?.role === "ADMIN",
    rules: c.rules,
  };
}

// ───────────── farm management ─────────────
export function cropDTO(d: Db, c: Crop): CropDTO {
  const farm = d.farms.find((f) => f.id === c.farmId);
  const cycles = d.cropCycles.filter((x) => x.cropId === c.id).sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));
  const current = cycles.find((x) => x.status === "GROWING" || x.status === "PLANNED") ?? cycles[0];
  return {
    id: c.id,
    name: c.name,
    experienceYears: c.experienceYears,
    season: c.season,
    areaAcres: c.areaAcres,
    method: c.method,
    typicalYieldQtlPerAcre: c.typicalYieldQtlPerAcre,
    status: c.status,
    farmId: c.farmId,
    farmName: farm?.name ?? "Farm",
    currentCycleId: current?.id,
  };
}

export const farmDTO = (d: Db, f: Farm): FarmDTO => ({
  id: f.id,
  name: f.name,
  areaAcres: f.areaAcres,
  soil: f.soil,
  irrigation: f.irrigation,
  village: f.village,
  district: f.district,
  scene: f.scene,
  history: f.history,
  crops: d.crops.filter((c) => c.farmId === f.id).map((c) => cropDTO(d, c)),
});

export function cycleDTO(d: Db, c: CropCycle): CycleDTO {
  const crop = d.crops.find((x) => x.id === c.cropId);
  const farm = d.farms.find((x) => x.id === c.farmId);
  const expenses = d.expenses.filter((e) => e.cycleId === c.id).sort((a, b) => a.date.localeCompare(b.date));
  const harvest = d.harvests.find((h) => h.cycleId === c.id);
  return {
    id: c.id,
    cropId: c.cropId,
    cropName: crop?.name ?? "Crop",
    farmId: c.farmId,
    farmName: farm?.name ?? "Farm",
    season: c.season,
    year: c.year,
    areaAcres: c.areaAcres,
    seed: c.seed,
    status: c.status,
    stages: c.stages,
    stats: computeCycleStats(c, expenses, harvest),
    expenses: expenses.map((e) => ({ id: e.id, category: e.category, amount: e.amount, date: e.date, note: e.note })),
    harvest: harvest && { id: harvest.id, date: harvest.date, quantityQtl: harvest.quantityQtl, soldQtl: harvest.soldQtl, sellingPricePerQtl: harvest.sellingPricePerQtl },
  };
}

// ───────────── market ─────────────
export function listingDTO(v: View, l: ProduceListing): ListingCardDTO {
  const { d, viewer } = v;
  const owner = d.users.find((u) => u.id === l.ownerId);
  const fpo = l.fpoId ? d.fpos.find((f) => f.id === l.fpoId) : undefined;
  return {
    id: l.id,
    crop: l.crop,
    variety: l.variety,
    quantity: l.quantity,
    unit: l.unit,
    expectedPrice: l.expectedPrice,
    location: l.location,
    harvestDate: l.harvestDate,
    grade: l.grade,
    method: l.method,
    organic: l.organic,
    status: l.status,
    createdAt: l.createdAt,
    owner: owner ? userSummary(d, owner) : summaryById(d, l.ownerId),
    fpo: fpo ? { id: fpo.id, name: fpo.name } : undefined,
    verifiedFarmer: !!owner?.verifiedAt,
    saved: savedBy(v, "LISTING", l.id),
    isOwn: viewer?.id === l.ownerId,
    description: l.description,
    isDemo: l.isDemo,
  };
}

/** A listing is publicly visible if not hidden and the owner's produce visibility allows this viewer. */
export function listingVisible(v: View, l: ProduceListing) {
  if (l.hidden && v.viewer?.id !== l.ownerId && v.viewer?.role !== "ADMIN") return false;
  const profile = v.d.farmerProfiles.find((p) => p.userId === l.ownerId);
  if (!profile) return true; // FPO listings etc.
  return canSee(v.d, v.viewer, l.ownerId, profile.privacy.produce);
}

export function requirementDTO(v: View, r: BuyerRequirement): RequirementDTO {
  const { d, viewer } = v;
  const profile = d.buyerProfiles.find((p) => p.userId === r.buyerId);
  return {
    id: r.id,
    buyer: summaryById(d, r.buyerId),
    businessName: profile?.businessName ?? summaryById(d, r.buyerId).name,
    crop: r.crop,
    quantity: r.quantity,
    unit: r.unit,
    district: r.district,
    state: r.state,
    windowStart: r.windowStart,
    windowEnd: r.windowEnd,
    notes: r.notes,
    status: r.status,
    createdAt: r.createdAt,
    isOwn: viewer?.id === r.buyerId,
    responded: !!viewer && d.enquiries.some((e) => e.requirementId === r.id && e.farmerId === viewer.id),
    isDemo: r.isDemo,
  };
}

export const machineryDTO = (v: View, m: MachineryListing): MachineryDTO => ({
  id: m.id,
  type: m.type,
  name: m.name,
  district: m.district,
  state: m.state,
  available: m.available,
  rate: m.rate,
  rateUnit: m.rateUnit,
  description: m.description,
  owner: summaryById(v.d, m.ownerId),
  isOwn: v.viewer?.id === m.ownerId,
});

// ───────────── people cards ─────────────
export function farmerCard(v: View, userId: string): FarmerCardDTO | null {
  const { d, viewer } = v;
  const user = d.users.find((u) => u.id === userId);
  const p = d.farmerProfiles.find((x) => x.userId === userId);
  if (!user || !p) return null;
  const visibleProfile = canSee(d, viewer, userId, p.privacy.profile);
  const showVillage = canSee(d, viewer, userId, p.privacy.locationPrecision === "VILLAGE" ? "PUBLIC" : "PRIVATE");
  const produceOk = canSee(d, viewer, userId, p.privacy.produce);
  return {
    user: userSummary(d, user),
    village: visibleProfile && showVillage ? p.village : undefined,
    district: p.district,
    state: p.state,
    experienceYears: Math.max(0, new Date().getFullYear() - p.farmingSince),
    specialization: visibleProfile ? p.specialization : "",
    crops: visibleProfile ? Array.from(new Set(d.crops.filter((c) => c.ownerId === userId).map((c) => c.name))) : [],
    produce: produceOk
      ? d.listings.filter((l) => l.ownerId === userId && l.status === "AVAILABLE" && !l.hidden).map((l) => ({ id: l.id, crop: l.crop, quantity: l.quantity, unit: l.unit }))
      : [],
    fpos: p.fpoIds.map((id) => d.fpos.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f).map((f) => ({ id: f.id, userId: f.userId, name: f.name })),
    followers: followerCount(d, userId),
    isFollowing: isFollowing(v, userId),
    restricted: !visibleProfile,
  };
}

export function buyerCard(v: View, userId: string): BuyerCardDTO | null {
  const user = v.d.users.find((u) => u.id === userId);
  const p = v.d.buyerProfiles.find((x) => x.userId === userId);
  if (!user || !p) return null;
  return {
    user: userSummary(v.d, user),
    businessName: p.businessName,
    industry: p.industry,
    district: p.district,
    state: p.state,
    cropsPurchased: p.cropsPurchased,
    openRequirements: v.d.requirements.filter((r) => r.buyerId === userId && r.status === "OPEN" && !r.hidden).length,
    isFollowing: isFollowing(v, userId),
  };
}

export function expertCard(v: View, userId: string): ExpertCardDTO | null {
  const { d } = v;
  const user = d.users.find((u) => u.id === userId);
  const p = d.expertProfiles.find((x) => x.userId === userId);
  if (!user || !p) return null;
  return {
    user: userSummary(d, user),
    category: p.category,
    qualification: p.qualification,
    organization: p.organization,
    specialization: p.specialization,
    experienceYears: p.experienceYears,
    district: p.district,
    state: p.state,
    followers: followerCount(d, userId),
    answerCount: d.answers.filter((a) => a.expertId === userId).length,
    isFollowing: isFollowing(v, userId),
  };
}

export function orgCard(v: View, userId: string): OrgCardDTO | null {
  const { d } = v;
  const user = d.users.find((u) => u.id === userId);
  if (!user) return null;
  const org = d.organizations.find((o) => o.userId === userId);
  const fpo = d.fpos.find((f) => f.userId === userId);
  if (!org && !fpo) return null;
  return {
    user: userSummary(d, user),
    kind: org ? "GOVERNMENT" : "FPO",
    name: (org ?? fpo)!.name,
    department: org?.department,
    district: (org ?? fpo)!.district,
    state: (org ?? fpo)!.state,
    about: (org ?? fpo)!.about,
    website: org?.website,
    memberCount: fpo?.memberIds.length,
    crops: fpo?.crops,
    followers: followerCount(d, userId),
    isFollowing: isFollowing(v, userId),
  };
}

// ───────────── knowledge ─────────────
export function answerDTO(v: View, a: ExpertAnswer): AnswerDTO {
  return {
    id: a.id,
    expert: summaryById(v.d, a.expertId),
    body: a.body,
    helpful: a.helpful,
    createdAt: a.createdAt,
    markedHelpful: v.viewer ? v.d.likes.some((l) => l.userId === v.viewer!.id && l.targetType === "COMMENT" && l.targetId === a.id) : false,
  };
}

export function questionDTO(v: View, q: ExpertQuestion): QuestionDTO {
  return {
    id: q.id,
    asker: summaryById(v.d, q.askerId),
    category: q.category,
    crop: q.crop,
    district: q.district,
    body: q.body,
    imageUrl: q.imageUrl,
    status: q.status,
    createdAt: q.createdAt,
    expert: q.expertId ? summaryById(v.d, q.expertId) : undefined,
    answers: v.d.answers.filter((a) => a.questionId === q.id).map((a) => answerDTO(v, a)),
    isOwn: v.viewer?.id === q.askerId,
    isDemo: q.isDemo,
  };
}

export function courseCard(v: View, c: Course): CourseCardDTO {
  const { d, viewer } = v;
  const mods = d.courseModules.filter((m) => m.courseId === c.id);
  const progress = viewer ? d.courseProgress.find((p) => p.userId === viewer.id && p.courseId === c.id) : undefined;
  const done = progress ? progress.completedModuleIds.filter((id) => mods.some((m) => m.id === id)).length : 0;
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    level: c.level,
    description: c.description,
    scene: c.scene,
    author: summaryById(d, c.authorId),
    moduleCount: mods.length,
    totalMinutes: mods.reduce((s, m) => s + m.durationMin, 0),
    progressPct: mods.length ? Math.round((done / mods.length) * 100) : 0,
    completed: mods.length > 0 && done === mods.length,
  };
}

export function schemeDTO(v: View, s: GovernmentScheme): SchemeDTO {
  const org = v.d.organizations.find((o) => o.id === s.orgId);
  const orgUser = org && v.d.users.find((u) => u.id === org.userId);
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    state: s.state,
    description: s.description,
    eligibility: s.eligibility,
    benefits: s.benefits,
    documents: s.documents,
    applicationMethod: s.applicationMethod,
    officialSource: s.officialSource,
    deadline: s.deadline,
    daysLeft: s.deadline ? daysUntil(s.deadline) : null,
    createdAt: s.createdAt,
    topic: s.topic ?? "Agriculture",
    audience: s.audience?.length ? s.audience : ["AGRICULTURE"],
    org: {
      id: org?.id ?? s.orgId,
      userId: org?.userId ?? "",
      name: org?.name ?? "Organisation",
      department: org?.department ?? "",
      website: org?.website ?? "",
      verified: !!orgUser?.verifiedAt,
    },
    saved: savedBy(v, "SCHEME", s.id),
    isDemo: s.isDemo,
  };
}

export function eventStatus(e: AgriEvent, now = Date.now()): "UPCOMING" | "LIVE" | "ENDED" {
  if (Date.parse(e.endsAt) < now) return "ENDED";
  if (Date.parse(e.startsAt) <= now) return "LIVE";
  return "UPCOMING";
}

export function eventDTO(v: View, e: AgriEvent): EventDTO {
  const { d, viewer } = v;
  const reg = viewer ? d.eventRegistrations.find((r) => r.eventId === e.id && r.userId === viewer.id) : undefined;
  const live = d.liveSessions.find((l) => l.eventId === e.id && !l.hidden);
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    description: e.description,
    topics: e.topics,
    location: e.location,
    district: e.district,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    scene: e.scene,
    organizer: summaryById(d, e.organizerId),
    registered: !!reg?.registered,
    reminder: !!reg?.reminder,
    registrationCount: d.eventRegistrations.filter((r) => r.eventId === e.id && r.registered).length,
    liveSessionId: live?.id,
    status: live?.status === "LIVE" ? "LIVE" : eventStatus(e),
    saved: savedBy(v, "EVENT", e.id),
    isOwn: viewer?.id === e.organizerId,
    isDemo: e.isDemo,
  };
}

export function liveDTO(v: View, l: LiveSession): LiveDTO {
  const ev = l.eventId ? v.d.events.find((e) => e.id === l.eventId) : undefined;
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    status: l.status,
    scheduledAt: l.scheduledAt,
    viewerCount: l.viewerCount,
    scene: l.scene,
    host: summaryById(v.d, l.hostId),
    followingHost: isFollowing(v, l.hostId),
    streamConnected: !!l.streamUrl,
    event: ev ? { id: ev.id, name: ev.name } : undefined,
    isHost: v.viewer?.id === l.hostId,
    isDemo: l.isDemo,
  };
}
