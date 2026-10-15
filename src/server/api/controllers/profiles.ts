import { z } from "zod";
import type { Db, User } from "@/types/domain";
import type { ConnectionState, FarmerProfileDTO, OrgProfileDTO, Page, UserListItem } from "@/types/dto";
import { buyerProfileSchema, expertProfileSchema, farmerProfileSchema, organizationProfileSchema } from "@/lib/schemas";
import { computeCycleStats, computeFarmHealthScore } from "@/lib/farm-calc";
import { newId } from "../../crypto";
import { persist } from "../../db";
import { badRequest, notFound } from "../../errors";
import {
  buyerCard,
  cropDTO,
  eventDTO,
  expertCard,
  farmDTO,
  followerCount,
  isFollowing,
  listingDTO,
  listingVisible,
  orgCard,
  postDTO,
  questionDTO,
  requirementDTO,
  schemeDTO,
  summaryById,
  userSummary,
  type View,
} from "../../mappers";
import { requireRole, requireUser } from "../../permissions";
import { canSee, isBlockedEitherWay } from "../../privacy";
import { notify } from "../../services/notify";
import { searchFarmers } from "../../services/search";
import { route, type Ctx } from "../router";

const view = (c: Ctx): View => ({ d: c.d, viewer: c.user });

function paginate<T>(items: T[], c: Ctx, defaultLimit = 12): Page<T> {
  const start = Number(c.query.get("cursor") ?? 0) || 0;
  const limit = Math.min(50, Number(c.query.get("limit") ?? defaultLimit) || defaultLimit);
  return { items: items.slice(start, start + limit), nextCursor: start + limit < items.length ? String(start + limit) : null, total: items.length };
}

function connectionState(d: Db, me: string, other: string): ConnectionState {
  const row = d.connections.find((c) => (c.requesterId === me && c.receiverId === other) || (c.requesterId === other && c.receiverId === me));
  if (!row) return "NONE";
  if (row.status === "ACCEPTED") return "CONNECTED";
  return row.requesterId === me ? "PENDING_SENT" : "PENDING_RECEIVED";
}

function connectionIds(d: Db, id: string): Set<string> {
  const ids = new Set<string>();
  d.connections.filter((c) => c.status === "ACCEPTED").forEach((c) => {
    if (c.requesterId === id) ids.add(c.receiverId);
    if (c.receiverId === id) ids.add(c.requesterId);
  });
  const following = new Set(d.follows.filter((f) => f.followerId === id).map((f) => f.followingId));
  d.follows.filter((f) => f.followingId === id && following.has(f.followerId)).forEach((f) => ids.add(f.followerId));
  return ids;
}

export function farmerProfileDTO(v: View, userId: string): FarmerProfileDTO | null {
  const { d, viewer } = v;
  const user = d.users.find((u) => u.id === userId);
  const p = d.farmerProfiles.find((x) => x.userId === userId);
  if (!user || !p) return null;
  if (viewer && isBlockedEitherWay(d, viewer.id, userId)) return null;
  if (user.status !== "ACTIVE" && viewer?.id !== userId && viewer?.role !== "ADMIN") return null;
  const isSelf = viewer?.id === userId;
  const visible = canSee(d, viewer, userId, p.privacy.profile);
  const showVillage = isSelf || canSee(d, viewer, userId, p.privacy.locationPrecision === "VILLAGE" ? "PUBLIC" : "PRIVATE");
  const base = {
    user: userSummary(d, user),
    district: p.district,
    state: p.state,
    farmingSince: p.farmingSince,
    experienceYears: Math.max(0, new Date().getFullYear() - p.farmingSince),
  };
  const conns = connectionIds(d, userId);
  const connUsers = Array.from(conns).map((id) => d.users.find((u) => u.id === id)).filter((u): u is User => !!u);
  const network = {
    followers: followerCount(d, userId),
    following: d.follows.filter((f) => f.followerId === userId).length,
    connections: conns.size,
    farmerConnections: connUsers.filter((u) => u.role === "FARMER").length,
    expertConnections: connUsers.filter((u) => u.role === "EXPERT").length,
    fpos: p.fpoIds.map((id) => d.fpos.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f).map((f) => ({ id: f.id, userId: f.userId, name: f.name })),
  };
  const viewerInfo = {
    isSelf,
    isFollowing: isFollowing(v, userId),
    connection: viewer && !isSelf ? connectionState(d, viewer.id, userId) : ("NONE" as ConnectionState),
    saved: !!viewer && d.saved.some((s) => s.userId === viewer.id && s.targetType === "FARMER" && s.targetId === userId),
  };

  if (!visible) {
    return { ...base, restricted: true, languages: [], specialization: "", methods: [], livestock: [], story: "", skills: [], interests: [], certifications: [], achievements: [], portfolio: [], media: [], crops: [], farms: [], produce: [], network, viewer: viewerInfo };
  }

  const crops = d.crops.filter((c) => c.ownerId === userId).map((c) => cropDTO(d, c));
  const farms = d.farms.filter((f) => f.ownerId === userId).map((f) => {
    const dto = farmDTO(d, f);
    return showVillage ? dto : { ...dto, village: "" };
  });
  const showMedia = canSee(d, viewer, userId, p.privacy.farmPhotos);

  // Aggregate financial summary — only if the owner explicitly allowed this viewer. Never the ledger.
  let financialSummary: FarmerProfileDTO["financialSummary"] = null;
  if (!isSelf && canSee(d, viewer, userId, p.privacy.income, { financial: true })) {
    const cycles = d.cropCycles.filter((c) => c.ownerId === userId && c.status !== "PLANNED");
    const stats = cycles.map((c) => computeCycleStats(c, d.expenses.filter((e) => e.cycleId === c.id), d.harvests.find((h) => h.cycleId === c.id)));
    const sold = stats.filter((s) => s.revenue > 0);
    if (sold.length) {
      financialSummary = {
        totalRevenueLastYear: Math.round(sold.reduce((s, x) => s + x.revenue, 0)),
        avgProfitPerAcre: Math.round(sold.reduce((s, x) => s + x.profitPerAcre, 0) / sold.length),
      };
    }
  }

  let health: FarmerProfileDTO["health"];
  if (isSelf) {
    const cycles = d.cropCycles.filter((c) => c.ownerId === userId);
    health = computeFarmHealthScore({
      farms: d.farms.filter((f) => f.ownerId === userId),
      crops: d.crops.filter((c) => c.ownerId === userId),
      cycles,
      expenses: d.expenses.filter((e) => e.ownerId === userId),
      harvests: d.harvests.filter((h) => h.ownerId === userId),
    });
  }

  return {
    ...base,
    restricted: false,
    village: showVillage ? p.village : undefined,
    languages: p.languages,
    specialization: p.specialization,
    methods: p.methods,
    livestock: p.livestock,
    story: p.story,
    skills: p.skills,
    interests: p.interests,
    certifications: p.certifications,
    achievements: p.achievements,
    portfolio: p.portfolio,
    media: showMedia ? p.media : [],
    crops,
    farms,
    produce: d.listings.filter((l) => l.ownerId === userId && l.status === "AVAILABLE" && listingVisible(v, l)).map((l) => listingDTO(v, l)),
    network,
    viewer: viewerInfo,
    phone: canSee(d, viewer, userId, p.privacy.phone) ? user.phone : undefined,
    privacy: isSelf ? p.privacy : undefined,
    financialSummary,
    health,
  };
}

// ───────────── farmers ─────────────
route("GET", "/farmers", (c) => {
  const q = c.query;
  const items = searchFarmers(view(c), {
    q: q.get("q") ?? undefined,
    crop: q.get("crop") ?? undefined,
    district: q.get("district") ?? undefined,
    near: q.get("near") ?? undefined,
    verified: q.get("verified") === "1",
    fpo: q.get("fpo") === "1",
    organic: q.get("organic") === "1",
    minQty: q.get("minQty") ? Number(q.get("minQty")) : undefined,
  });
  return paginate(items, c);
});

route("GET", "/farmers/:id", (c) => {
  const dto = farmerProfileDTO(view(c), c.params.id!);
  if (!dto) throw notFound("Farmer");
  return dto;
});

route("GET", "/profile/me", (c) => {
  const u = requireUser(c.user);
  const v = view(c);
  if (u.role === "FARMER") return { role: u.role, farmer: farmerProfileDTO(v, u.id) };
  if (u.role === "BUYER") return { role: u.role, buyer: buyerProfileDTO(v, u.id) };
  if (u.role === "EXPERT") return { role: u.role, expert: expertProfileDTO(v, u.id) };
  return { role: u.role, org: orgProfileDTO(v, u.id) };
});

route("PATCH", "/profile/farmer", async (c) => {
  const u = requireRole(c.user, "FARMER");
  const input = await c.body(farmerProfileSchema);
  const p = c.d.farmerProfiles.find((x) => x.userId === u.id);
  if (!p) throw notFound("Profile");
  Object.assign(p, input);
  persist();
  return farmerProfileDTO(view(c), u.id);
});

// ───────────── buyers ─────────────
function buyerProfileDTO(v: View, userId: string) {
  const { d, viewer } = v;
  const card = buyerCard(v, userId);
  const p = d.buyerProfiles.find((x) => x.userId === userId);
  if (!card || !p) return null;
  return {
    ...card,
    about: p.about,
    website: p.website,
    contactOptions: p.contactOptions,
    requirements: d.requirements.filter((r) => r.buyerId === userId && !r.hidden && (r.status === "OPEN" || viewer?.id === userId)).map((r) => requirementDTO(v, r)),
    followers: followerCount(d, userId),
    viewer: { isSelf: viewer?.id === userId, isFollowing: isFollowing(v, userId), saved: !!viewer && d.saved.some((s) => s.userId === viewer.id && s.targetType === "FARMER" && s.targetId === userId) },
  };
}

route("GET", "/buyers", (c) => {
  const q = (c.query.get("q") ?? "").toLowerCase();
  const crop = (c.query.get("crop") ?? "").toLowerCase();
  const v = view(c);
  const items = c.d.buyerProfiles
    .filter((b) => (!q || `${b.businessName} ${b.industry} ${b.district} ${b.about}`.toLowerCase().includes(q)) && (!crop || b.cropsPurchased.some((x) => x.toLowerCase() === crop)))
    .map((b) => buyerCard(v, b.userId)!)
    .filter(Boolean)
    .sort((a, b) => Number(b.user.verified) - Number(a.user.verified) || b.openRequirements - a.openRequirements);
  return paginate(items, c);
});

route("GET", "/buyers/:id", (c) => {
  const dto = buyerProfileDTO(view(c), c.params.id!);
  if (!dto) throw notFound("Buyer");
  return dto;
});

route("PATCH", "/profile/buyer", async (c) => {
  const u = requireRole(c.user, "BUYER");
  const input = await c.body(buyerProfileSchema);
  const p = c.d.buyerProfiles.find((x) => x.userId === u.id);
  if (!p) throw notFound("Profile");
  Object.assign(p, input);
  persist();
  return buyerProfileDTO(view(c), u.id);
});

// ───────────── experts ─────────────
function expertProfileDTO(v: View, userId: string) {
  const { d, viewer } = v;
  const card = expertCard(v, userId);
  const p = d.expertProfiles.find((x) => x.userId === userId);
  if (!card || !p) return null;
  const answered = d.answers.filter((a) => a.expertId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return {
    ...card,
    about: p.about,
    languages: p.languages,
    recentAnswers: answered.map((a) => d.questions.find((q) => q.id === a.questionId)).filter((q): q is NonNullable<typeof q> => !!q && !q.hidden).map((q) => ({ question: questionDTO(v, q) })),
    posts: d.posts.filter((x) => x.authorId === userId && !x.hidden).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((x) => postDTO(v, x)),
    viewer: { isSelf: viewer?.id === userId, isFollowing: isFollowing(v, userId) },
  };
}

route("GET", "/experts", (c) => {
  const q = (c.query.get("q") ?? "").toLowerCase();
  const category = c.query.get("category");
  const v = view(c);
  const items = c.d.expertProfiles
    .map((e) => expertCard(v, e.userId)!)
    .filter((e) => e && (!category || e.category === category) && (!q || `${e.user.name} ${e.category} ${e.specialization.join(" ")} ${e.organization} ${e.district}`.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.user.verified) - Number(a.user.verified) || b.answerCount - a.answerCount);
  return paginate(items, c, 20);
});

route("GET", "/experts/:id", (c) => {
  const dto = expertProfileDTO(view(c), c.params.id!);
  if (!dto) throw notFound("Expert");
  return dto;
});

route("PATCH", "/profile/expert", async (c) => {
  const u = requireRole(c.user, "EXPERT");
  const input = await c.body(expertProfileSchema);
  const p = c.d.expertProfiles.find((x) => x.userId === u.id);
  if (!p) throw notFound("Profile");
  Object.assign(p, input);
  persist();
  return expertProfileDTO(view(c), u.id);
});

// ───────────── organisations & FPOs ─────────────
function orgProfileDTO(v: View, userId: string): OrgProfileDTO | null {
  const { d, viewer } = v;
  const card = orgCard(v, userId);
  if (!card) return null;
  const org = d.organizations.find((o) => o.userId === userId);
  const fpo = d.fpos.find((f) => f.userId === userId);
  const members = fpo ? fpo.memberIds.map((id) => d.users.find((u) => u.id === id)).filter((u): u is User => !!u).map((u) => ({ user: userSummary(d, u) })) : [];
  return {
    ...card,
    posts: d.posts.filter((p) => p.authorId === userId && !p.hidden).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((p) => postDTO(v, p)),
    events: d.events.filter((e) => e.organizerId === userId && !e.hidden).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 6).map((e) => eventDTO(v, e)),
    schemes: org ? d.schemes.filter((s) => s.orgId === org.id && !s.hidden).map((s) => schemeDTO(v, s)) : [],
    listings: d.listings.filter((l) => l.ownerId === userId && l.status === "AVAILABLE" && !l.hidden).map((l) => listingDTO(v, l)),
    members,
    viewer: { isSelf: viewer?.id === userId, isFollowing: isFollowing(v, userId), isMember: !!fpo && !!viewer && fpo.memberIds.includes(viewer.id) },
  };
}

route("GET", "/orgs", (c) => {
  const kind = c.query.get("kind");
  const v = view(c);
  const ids = [...(kind === "fpo" ? [] : c.d.organizations.map((o) => o.userId)), ...(kind === "government" ? [] : c.d.fpos.map((f) => f.userId))];
  return ids.map((id) => orgCard(v, id)!).filter(Boolean);
});

route("GET", "/orgs/:id", (c) => {
  const dto = orgProfileDTO(view(c), c.params.id!);
  if (!dto) throw notFound("Organisation");
  return dto;
});

route("PATCH", "/profile/org", async (c) => {
  const u = requireRole(c.user, "GOVERNMENT", "FPO");
  const input = await c.body(organizationProfileSchema);
  const org = c.d.organizations.find((o) => o.userId === u.id);
  const fpo = c.d.fpos.find((f) => f.userId === u.id);
  const target = org ?? fpo;
  if (!target) throw notFound("Profile");
  target.name = input.name;
  target.about = input.about;
  if (org) org.website = input.website ?? "";
  if (input.district) target.district = input.district;
  u.name = input.name;
  persist();
  return orgProfileDTO(view(c), u.id);
});

route("POST", "/fpo/:id/join", (c) => {
  const u = requireRole(c.user, "FARMER");
  const fpo = c.d.fpos.find((f) => f.id === c.params.id);
  if (!fpo) throw notFound("FPO");
  const profile = c.d.farmerProfiles.find((p) => p.userId === u.id);
  if (!profile) throw notFound("Profile");
  if (!fpo.memberIds.includes(u.id)) fpo.memberIds.push(u.id);
  if (!profile.fpoIds.includes(fpo.id)) profile.fpoIds.push(fpo.id);
  notify(c.d, fpo.userId, "COMMUNITY", "New FPO member", `${u.name} joined ${fpo.name}.`, `/orgs/${fpo.userId}`);
  persist();
  return { member: true };
});

route("DELETE", "/fpo/:id/join", (c) => {
  const u = requireRole(c.user, "FARMER");
  const fpo = c.d.fpos.find((f) => f.id === c.params.id);
  if (!fpo) throw notFound("FPO");
  fpo.memberIds = fpo.memberIds.filter((id) => id !== u.id);
  const profile = c.d.farmerProfiles.find((p) => p.userId === u.id);
  if (profile) profile.fpoIds = profile.fpoIds.filter((id) => id !== fpo.id);
  persist();
  return { member: false };
});

route("POST", "/fpo/members", async (c) => {
  const u = requireRole(c.user, "FPO");
  const { farmerId } = await c.body(z.object({ farmerId: z.string() }));
  const fpo = c.d.fpos.find((f) => f.userId === u.id);
  const profile = c.d.farmerProfiles.find((p) => p.userId === farmerId);
  if (!fpo || !profile) throw notFound("Farmer");
  if (!fpo.memberIds.includes(farmerId)) fpo.memberIds.push(farmerId);
  if (!profile.fpoIds.includes(fpo.id)) profile.fpoIds.push(fpo.id);
  notify(c.d, farmerId, "COMMUNITY", `Added to ${fpo.name}`, "You can leave any time from the FPO page.", `/orgs/${u.id}`);
  persist();
  return { ok: true };
});

route("DELETE", "/fpo/members/:id", (c) => {
  const u = requireRole(c.user, "FPO");
  const fpo = c.d.fpos.find((f) => f.userId === u.id);
  if (!fpo) throw notFound("FPO");
  fpo.memberIds = fpo.memberIds.filter((id) => id !== c.params.id);
  const profile = c.d.farmerProfiles.find((p) => p.userId === c.params.id);
  if (profile) profile.fpoIds = profile.fpoIds.filter((id) => id !== fpo.id);
  persist();
  return { ok: true };
});

// ───────────── follow / connections ─────────────
route("POST", "/follow/:id", (c) => {
  const u = requireUser(c.user);
  const target = c.d.users.find((x) => x.id === c.params.id) || c.d.users.find((x) => x.handle === c.params.id);
  if (!target) throw notFound("User");
  if (target.id === u.id) throw badRequest("You cannot follow yourself.");
  if (isBlockedEitherWay(c.d, u.id, target.id)) throw badRequest("You cannot follow this account.");
  if (!c.d.follows.some((f) => f.followerId === u.id && f.followingId === target.id)) {
    c.d.follows.push({ followerId: u.id, followingId: target.id, createdAt: new Date().toISOString(), isDemo: false });
    notify(c.d, target.id, "FOLLOW", `${u.name} started following you`, `You now have ${followerCount(c.d, target.id)} followers.`, `/${target.role === "FARMER" ? "farmers" : target.role === "BUYER" ? "buyers" : target.role === "EXPERT" ? "experts" : "orgs"}/${u.id}`);
  }
  persist();
  return { following: true, followers: followerCount(c.d, target.id) };
});

route("DELETE", "/follow/:id", (c) => {
  const u = requireUser(c.user);
  const target = c.d.users.find((x) => x.id === c.params.id) || c.d.users.find((x) => x.handle === c.params.id);
  const targetId = target ? target.id : c.params.id!;
  c.d.follows = c.d.follows.filter((f) => !(f.followerId === u.id && f.followingId === targetId));
  persist();
  return { following: false, followers: followerCount(c.d, targetId) };
});

route("GET", "/users/:id/network", (c) => {
  const type = c.query.get("type") === "following" ? "following" : "followers";
  const ids = c.d.follows.filter((f) => (type === "followers" ? f.followingId === c.params.id : f.followerId === c.params.id)).map((f) => (type === "followers" ? f.followerId : f.followingId));
  const v = view(c);
  const items: UserListItem[] = ids.map((id) => c.d.users.find((u) => u.id === id)).filter((u): u is User => !!u).map((u) => ({ user: userSummary(c.d, u), isFollowing: isFollowing(v, u.id) }));
  return paginate(items, c, 30);
});

route("POST", "/connections/:id", (c) => {
  const u = requireUser(c.user);
  const target = c.d.users.find((x) => x.id === c.params.id);
  if (!target || target.id === u.id) throw badRequest("Invalid connection request.");
  if (isBlockedEitherWay(c.d, u.id, target.id)) throw badRequest("You cannot connect with this account.");
  const reverse = c.d.connections.find((x) => x.requesterId === target.id && x.receiverId === u.id);
  if (reverse) {
    reverse.status = "ACCEPTED";
  } else if (!c.d.connections.some((x) => x.requesterId === u.id && x.receiverId === target.id)) {
    c.d.connections.push({ id: newId("cn"), requesterId: u.id, receiverId: target.id, status: "PENDING", createdAt: new Date().toISOString(), isDemo: false });
    notify(c.d, target.id, "FOLLOW", `${u.name} wants to connect`, "Accept to share contact details you allow for connections.", `/farmers/${u.id}`);
  }
  persist();
  return { state: connectionState(c.d, u.id, target.id) };
});

route("POST", "/connections/:id/accept", (c) => {
  const u = requireUser(c.user);
  const row = c.d.connections.find((x) => x.requesterId === c.params.id && x.receiverId === u.id && x.status === "PENDING");
  if (!row) throw notFound("Request");
  row.status = "ACCEPTED";
  notify(c.d, row.requesterId, "FOLLOW", `${u.name} accepted your request`, "You are now connected.", `/farmers/${u.id}`);
  persist();
  return { state: "CONNECTED" as ConnectionState };
});

route("DELETE", "/connections/:id", (c) => {
  const u = requireUser(c.user);
  c.d.connections = c.d.connections.filter((x) => !((x.requesterId === u.id && x.receiverId === c.params.id) || (x.receiverId === u.id && x.requesterId === c.params.id)));
  persist();
  return { state: "NONE" as ConnectionState };
});

route("GET", "/connections", (c) => {
  const u = requireUser(c.user);
  const pending = c.d.connections.filter((x) => x.receiverId === u.id && x.status === "PENDING").map((x) => summaryById(c.d, x.requesterId));
  const connected = Array.from(connectionIds(c.d, u.id)).map((id) => summaryById(c.d, id));
  return { pending, connected, count: connected.length };
});

