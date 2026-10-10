import type { Comment, Db, Post, Reel, SceneKind } from "@/types/domain";
import type { FarmerCardDTO, HomeDTO, ListingCardDTO, Page, PostDTO, ReelDTO, SchemeDTO, EventDTO } from "@/types/dto";
import { commentSchema, communitySchema, postSchema, reactionSchema, reelSchema, reportSchema, saveSchema } from "@/lib/schemas";
import { STAGE_KEYS } from "@/types/domain";
import { STAGE_LABEL } from "@/lib/constants";
import { extractHashtags } from "@/lib/utils";
import { newId } from "../../crypto";
import { persist } from "../../db";
import { badRequest, forbidden, notFound } from "../../errors";
import {
  commentDTO,
  communityDTO,
  courseCard,
  eventDTO,
  eventStatus,
  farmerCard,
  listingDTO,
  postDTO,
  reelDTO,
  schemeDTO,
  storyDTO,
  userDistrict,
  type View,
} from "../../mappers";
import { allowedPostKinds, requireCap, requirePostKind, requireUser } from "../../permissions";
import { blockedViewer, mutedOrBlockedBy } from "../../privacy";
import { buildFeed } from "../../services/feed";
import { assertSafeText } from "../../services/messaging";
import { notify } from "../../services/notify";
import { route, type Ctx } from "../router";

const view = (c: Ctx): View => ({ d: c.d, viewer: c.user });

const CROP_SCENE: Record<string, SceneKind> = { wheat: "wheat", mustard: "mustard", bajra: "bajra", chickpea: "chickpea", moong: "chickpea", tomato: "vegetables", onion: "vegetables", vegetables: "vegetables", milk: "dairy", fruits: "orchard" };
export const sceneForCrop = (crop?: string): SceneKind => (crop && CROP_SCENE[crop.toLowerCase()]) || "sunrise";

const CATEGORY_SCENE: Record<string, SceneKind> = { Machinery: "tractor", Government: "classroom", Dairy: "dairy", "Organic Farming": "organic", "Market Education": "market", "Healthcare Awareness": "health", "Expert Advice": "classroom", "Farmer Stories": "sunrise", "Farming Hacks": "irrigation", "Crop Tips": "wheat" };

function paginate<T>(items: T[], c: Ctx, limit = 12): Page<T> {
  const start = Number(c.query.get("cursor") ?? 0) || 0;
  const l = Math.min(50, Number(c.query.get("limit") ?? limit) || limit);
  return { items: items.slice(start, start + l), nextCursor: start + l < items.length ? String(start + l) : null, total: items.length };
}

// ───────────── feed & posts ─────────────
route("GET", "/feed", (c) =>
  buildFeed(view(c), {
    topic: c.query.get("topic") ?? undefined,
    communityId: c.query.get("community") ?? undefined,
    authorId: c.query.get("author") ?? undefined,
    cursor: Number(c.query.get("cursor") ?? 0) || 0,
    limit: Number(c.query.get("limit") ?? 8) || 8,
    mixReels: c.query.get("reels") !== "0",
  }),
);

route("POST", "/posts", async (c) => {
  const u = requireCap(c.user, "post:create");
  const input = await c.body(postSchema);
  requirePostKind(u, input.kind);
  assertSafeText(input.body);
  if (input.imageUrl && !input.imageUrl.startsWith("/api/files/")) throw badRequest("Images must be uploaded through KaamSetu.");
  if (input.communityId) {
    const member = c.d.communityMembers.some((m) => m.communityId === input.communityId && m.userId === u.id);
    if (!member && u.role !== "ADMIN") throw forbidden("Join the community before posting in it.");
  }
  const tags = Array.from(new Set([...input.tags, ...extractHashtags(input.body)])).slice(0, 8);
  const post: Post = {
    id: newId("p"),
    authorId: u.id,
    kind: input.kind,
    body: input.body,
    tags,
    scene: input.imageUrl ? undefined : sceneForCrop(input.crop),
    imageUrl: input.imageUrl,
    communityId: input.communityId,
    crop: input.crop,
    district: userDistrict(c.d, u.id),
    hidden: false,
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  c.d.posts.push(post);
  persist();
  return postDTO(view(c), post);
});

route("GET", "/posts/allowed-kinds", (c) => allowedPostKinds(requireUser(c.user).role));

route("GET", "/posts/:id", (c) => {
  const p = c.d.posts.find((x) => x.id === c.params.id);
  if (!p || (p.hidden && c.user?.id !== p.authorId && c.user?.role !== "ADMIN")) throw notFound("Post");
  return postDTO(view(c), p);
});

route("DELETE", "/posts/:id", (c) => {
  const u = requireUser(c.user);
  const p = c.d.posts.find((x) => x.id === c.params.id);
  if (!p) throw notFound("Post");
  const moderator = !!p.communityId && c.d.communityMembers.some((m) => m.communityId === p.communityId && m.userId === u.id && m.role === "MODERATOR");
  if (p.authorId !== u.id && u.role !== "ADMIN" && !moderator) throw forbidden();
  c.d.posts = c.d.posts.filter((x) => x.id !== p.id);
  c.d.comments = c.d.comments.filter((x) => !(x.targetType === "POST" && x.targetId === p.id));
  persist();
  return { ok: true };
});

// ───────────── reels ─────────────
route("GET", "/reels", (c) => {
  const v = view(c);
  const category = c.query.get("category");
  const hide = v.viewer ? new Set([...mutedOrBlockedBy(c.d, v.viewer.id), ...blockedViewer(c.d, v.viewer.id)]) : new Set<string>();
  const items = c.d.reels
    .filter((r) => !r.hidden && !hide.has(r.authorId) && (!category || r.category === category))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => reelDTO(v, r));
  return paginate<ReelDTO>(items, c, 6);
});

route("POST", "/reels", async (c) => {
  const u = requireCap(c.user, "reel:create");
  const input = await c.body(reelSchema);
  assertSafeText(input.caption);
  if (input.videoUrl && !input.videoUrl.startsWith("/api/files/")) throw badRequest("Videos must be uploaded through KaamSetu.");
  const reel: Reel = {
    id: newId("r"),
    authorId: u.id,
    caption: input.caption,
    category: input.category,
    tags: Array.from(new Set([...input.tags, ...extractHashtags(input.caption)])).slice(0, 8),
    scene: CATEGORY_SCENE[input.category] ?? "sunrise",
    durationSec: input.durationSec,
    videoUrl: input.videoUrl,
    hidden: false,
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  c.d.reels.push(reel);
  persist();
  return reelDTO(view(c), reel);
});

// ───────────── interactions ─────────────
function targetAuthor(d: Db, type: string, id: string): string | undefined {
  if (type === "POST") return d.posts.find((p) => p.id === id)?.authorId;
  if (type === "REEL") return d.reels.find((r) => r.id === id)?.authorId;
  if (type === "QUESTION") return d.questions.find((q) => q.id === id)?.askerId;
  return undefined;
}

route("POST", "/like", async (c) => {
  const u = requireUser(c.user);
  const { targetType, targetId } = await c.body(reactionSchema);
  const author = targetAuthor(c.d, targetType, targetId);
  if (!author) throw notFound("Item");
  const idx = c.d.likes.findIndex((l) => l.userId === u.id && l.targetType === targetType && l.targetId === targetId);
  let liked: boolean;
  if (idx >= 0) {
    c.d.likes.splice(idx, 1);
    liked = false;
  } else {
    c.d.likes.push({ userId: u.id, targetType, targetId, createdAt: new Date().toISOString(), isDemo: false });
    liked = true;
    if (author !== u.id) notify(c.d, author, "LIKE", `${u.name} liked your ${targetType.toLowerCase()}`, "", targetType === "REEL" ? "/reels" : "/home");
  }
  persist();
  return { liked, count: c.d.likes.filter((l) => l.targetType === targetType && l.targetId === targetId).length };
});

route("POST", "/save", async (c) => {
  const u = requireUser(c.user);
  const { targetType, targetId } = await c.body(saveSchema);
  const idx = c.d.saved.findIndex((s) => s.userId === u.id && s.targetType === targetType && s.targetId === targetId);
  let saved: boolean;
  if (idx >= 0) {
    c.d.saved.splice(idx, 1);
    saved = false;
  } else {
    c.d.saved.push({ userId: u.id, targetType, targetId, createdAt: new Date().toISOString(), isDemo: false });
    saved = true;
  }
  persist();
  return { saved };
});

route("GET", "/saved", (c) => {
  const u = requireUser(c.user);
  const v = view(c);
  const mine = c.d.saved.filter((s) => s.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ids = (t: string) => mine.filter((s) => s.targetType === t).map((s) => s.targetId);
  return {
    posts: ids("POST").map((id) => c.d.posts.find((p) => p.id === id)).filter((p): p is Post => !!p && !p.hidden).map((p) => postDTO(v, p)) as PostDTO[],
    reels: ids("REEL").map((id) => c.d.reels.find((r) => r.id === id)).filter((r): r is Reel => !!r && !r.hidden).map((r) => reelDTO(v, r)) as ReelDTO[],
    listings: ids("LISTING").map((id) => c.d.listings.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l && !l.hidden).map((l) => listingDTO(v, l)) as ListingCardDTO[],
    schemes: ids("SCHEME").map((id) => c.d.schemes.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s && !s.hidden).map((s) => schemeDTO(v, s)) as SchemeDTO[],
    events: ids("EVENT").map((id) => c.d.events.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e && !e.hidden).map((e) => eventDTO(v, e)) as EventDTO[],
    farmers: ids("FARMER").map((id) => farmerCard(v, id)).filter((f): f is FarmerCardDTO => !!f),
  };
});

route("GET", "/comments", (c) => {
  const targetType = c.query.get("targetType") ?? "POST";
  const targetId = c.query.get("targetId") ?? "";
  const v = view(c);
  return c.d.comments
    .filter((x) => x.targetType === targetType && x.targetId === targetId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((x) => commentDTO(v, x));
});

route("POST", "/comments", async (c) => {
  const u = requireUser(c.user);
  const input = await c.body(commentSchema);
  assertSafeText(input.body);
  const author = targetAuthor(c.d, input.targetType, input.targetId);
  if (!author) throw notFound("Item");
  const comment: Comment = { id: newId("cm"), ...input, authorId: u.id, createdAt: new Date().toISOString(), isDemo: false };
  c.d.comments.push(comment);
  if (author !== u.id) notify(c.d, author, "COMMENT", `${u.name} commented`, input.body.slice(0, 80), input.targetType === "REEL" ? "/reels" : "/home");
  persist();
  return commentDTO(view(c), comment);
});

route("DELETE", "/comments/:id", (c) => {
  const u = requireUser(c.user);
  const cm = c.d.comments.find((x) => x.id === c.params.id);
  if (!cm) throw notFound("Comment");
  if (cm.authorId !== u.id && u.role !== "ADMIN") throw forbidden();
  c.d.comments = c.d.comments.filter((x) => x.id !== cm.id);
  persist();
  return { ok: true };
});

// ───────────── reports (user safety) ─────────────
const AUTO_HIDE_THRESHOLD = 3;

route("POST", "/reports", async (c) => {
  const u = requireUser(c.user);
  const input = await c.body(reportSchema);
  if (c.d.reports.some((r) => r.reporterId === u.id && r.targetType === input.targetType && r.targetId === input.targetId && r.status === "OPEN")) {
    return { ok: true, duplicate: true };
  }
  c.d.reports.push({ id: newId("rp"), reporterId: u.id, ...input, status: "OPEN", createdAt: new Date().toISOString(), isDemo: false });
  // Spam-protection architecture: several independent reports temporarily hide content until an admin reviews it.
  const distinct = new Set(c.d.reports.filter((r) => r.targetType === input.targetType && r.targetId === input.targetId && r.status === "OPEN").map((r) => r.reporterId)).size;
  if (distinct >= AUTO_HIDE_THRESHOLD) {
    const t = input.targetType;
    const hide = (arr: { id: string; hidden: boolean }[]) => arr.forEach((x) => x.id === input.targetId && (x.hidden = true));
    if (t === "POST") hide(c.d.posts);
    if (t === "REEL") hide(c.d.reels);
    if (t === "LISTING") hide(c.d.listings);
    if (t === "QUESTION") hide(c.d.questions);
    if (t === "REQUIREMENT") hide(c.d.requirements);
    if (t === "SERVICE") hide(c.d.services);
    if (t === "OPPORTUNITY") hide(c.d.workOpportunities);
    if (t === "BUSINESS") hide(c.d.businesses);
  }
  persist();
  return { ok: true };
});

// ───────────── stories (auto-expiring) ─────────────
route("GET", "/stories", (c) => {
  const now = Date.now();
  return c.d.stories.filter((s) => Date.parse(s.expiresAt) > now).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)).map((s) => storyDTO(view(c), s));
});

// ───────────── communities ─────────────
route("GET", "/communities", (c) => {
  const q = (c.query.get("q") ?? "").toLowerCase();
  const kind = c.query.get("kind");
  const v = view(c);
  return c.d.communities
    .filter((x) => !x.hidden && (!kind || x.kind === kind) && (!q || `${x.name} ${x.description}`.toLowerCase().includes(q)))
    .map((x) => communityDTO(v, x))
    .filter((x) => c.query.get("joined") !== "1" || x.joined)
    .sort((a, b) => Number(b.joined) - Number(a.joined) || b.memberCount - a.memberCount);
});

route("GET", "/communities/:id", (c) => {
  const community = c.d.communities.find((x) => x.id === c.params.id && !x.hidden);
  if (!community) throw notFound("Community");
  return communityDTO(view(c), community);
});

route("POST", "/communities", async (c) => {
  const u = requireCap(c.user, "community:create");
  const input = await c.body(communitySchema);
  if (c.d.communities.some((x) => x.name.toLowerCase() === input.name.toLowerCase())) throw badRequest("A community with this name already exists.");
  const community = { id: newId("c"), ...input, scene: "sunrise" as const, createdBy: u.id, rules: ["Be respectful and help each other.", "No spam, no sharing of bank/UPI/OTP details."], hidden: false, createdAt: new Date().toISOString(), isDemo: false };
  c.d.communities.push(community);
  c.d.communityMembers.push({ communityId: community.id, userId: u.id, role: "MODERATOR", joinedAt: new Date().toISOString(), isDemo: false });
  persist();
  return communityDTO(view(c), community);
});

route("POST", "/communities/:id/join", (c) => {
  const u = requireCap(c.user, "community:join");
  if (!c.d.communities.some((x) => x.id === c.params.id)) throw notFound("Community");
  if (!c.d.communityMembers.some((m) => m.communityId === c.params.id && m.userId === u.id)) {
    c.d.communityMembers.push({ communityId: c.params.id!, userId: u.id, role: "MEMBER", joinedAt: new Date().toISOString(), isDemo: false });
  }
  persist();
  return communityDTO(view(c), c.d.communities.find((x) => x.id === c.params.id)!);
});

route("DELETE", "/communities/:id/join", (c) => {
  const u = requireUser(c.user);
  c.d.communityMembers = c.d.communityMembers.filter((m) => !(m.communityId === c.params.id && m.userId === u.id));
  persist();
  const community = c.d.communities.find((x) => x.id === c.params.id);
  if (!community) throw notFound("Community");
  return communityDTO(view(c), community);
});

// ───────────── home dashboard ─────────────
const STAGE_ORDER = [...STAGE_KEYS];

function toQuintalPrice(price: number, unit: "QUINTAL" | "KG" | "TONNE") {
  return unit === "KG" ? price * 100 : unit === "TONNE" ? price / 10 : price;
}

route("GET", "/home", (c): HomeDTO => {
  const u = requireUser(c.user);
  const d = c.d;
  const v = view(c);
  const now = Date.now();
  const home: HomeDTO = {
    greetingName: u.name.split(" ")[0] ?? u.name,
    role: u.role,
    government: { count: d.schemes.filter((s) => !s.hidden).length, latest: undefined },
    community: { newPosts: 0 },
    stories: d.stories.filter((s) => Date.parse(s.expiresAt) > now).map((s) => storyDTO(v, s)),
    stats: [],
  };

  const latestScheme = d.schemes.filter((s) => !s.hidden).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latestScheme) home.government.latest = schemeDTO(v, latestScheme);

  const myDistrict = userDistrict(d, u.id);
  const upcoming = d.events.filter((e) => !e.hidden && eventStatus(e) !== "ENDED").sort((a, b) => (Number(b.district === myDistrict) - Number(a.district === myDistrict)) || a.startsAt.localeCompare(b.startsAt));
  const soonest = upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).find((e) => !myDistrict || e.district === myDistrict) ?? upcoming[0];
  if (soonest) home.event = eventDTO(v, soonest);

  const myCommunityIds = new Set(d.communityMembers.filter((m) => m.userId === u.id).map((m) => m.communityId));
  const recent = d.posts.filter((p) => !p.hidden && p.communityId && myCommunityIds.has(p.communityId) && now - Date.parse(p.createdAt) < 7 * 86_400_000);
  home.community = { newPosts: recent.length, name: d.communities.find((x) => myCommunityIds.has(x.id))?.name, id: d.communities.find((x) => myCommunityIds.has(x.id))?.id };

  // Learning: continue an in-progress course, otherwise suggest one for the user's crops.
  const myCrops = new Set(d.crops.filter((x) => x.ownerId === u.id).map((x) => x.name.toLowerCase()));
  const cards = d.courses.filter((x) => !x.hidden).map((x) => courseCard(v, x));
  const inProgress = cards.find((x) => x.progressPct > 0 && x.progressPct < 100);
  const suggested = cards.find((x) => !x.completed && myCrops.has(x.category.toLowerCase())) ?? cards.find((x) => !x.completed);
  const pick = inProgress ?? suggested;
  if (pick) home.learning = { courseId: pick.id, title: pick.title, progressPct: pick.progressPct };

  if (u.role === "FARMER") {
    const cycles = d.cropCycles.filter((x) => x.ownerId === u.id);
    const active = cycles.filter((x) => x.status === "GROWING").sort((a, b) => b.year - a.year)[0];
    const crop = active && d.crops.find((x) => x.id === active.cropId);
    if (active && crop) {
      const lastDone = [...STAGE_ORDER].reverse().find((k) => active.stages[k].done);
      home.currentCrop = { cropId: crop.id, name: crop.name, areaAcres: active.areaAcres, stageLabel: lastDone ? STAGE_LABEL[lastDone]! : "Planned", sownOn: active.stages.sowing.date };
    }
    // Next activity: earliest not-done stage with a date from today onwards.
    let next: HomeDTO["nextActivity"];
    for (const cy of cycles.filter((x) => x.status === "GROWING" || x.status === "PLANNED")) {
      for (const k of STAGE_ORDER) {
        const st = cy.stages[k];
        if (!st.done && st.date && Date.parse(st.date) >= now - 86_400_000 && (!next || st.date < next.date)) {
          next = { label: STAGE_LABEL[k]!, date: st.date, cropName: d.crops.find((x) => x.id === cy.cropId)?.name ?? "Crop", cropId: cy.cropId };
        }
      }
    }
    home.nextActivity = next;

    // Market: average LISTED price on the platform for the focus crop — clearly not an official mandi rate.
    const focus = crop?.name ?? d.crops.find((x) => x.ownerId === u.id)?.name;
    if (focus) {
      const lots = d.listings.filter((l) => l.crop.toLowerCase() === focus.toLowerCase() && l.status === "AVAILABLE" && !l.hidden);
      if (lots.length) home.market = { crop: focus, avgPrice: Math.round(lots.reduce((s, l) => s + toQuintalPrice(l.expectedPrice, l.unit), 0) / lots.length), unit: "QUINTAL", listings: lots.length };
    }
    home.stats = [
      { label: "Crops", value: String(d.crops.filter((x) => x.ownerId === u.id).length), href: "/crops" },
      { label: "Farms", value: String(d.farms.filter((x) => x.ownerId === u.id).length), href: "/farms" },
      { label: "Listings", value: String(d.listings.filter((l) => l.ownerId === u.id && l.status === "AVAILABLE").length), href: "/market?mine=1" },
      { label: "Enquiries", value: String(d.enquiries.filter((e) => e.farmerId === u.id && e.status === "NEW").length), href: "/market?tab=enquiries" },
    ];
  } else if (u.role === "BUYER") {
    home.stats = [
      { label: "Open requirements", value: String(d.requirements.filter((r) => r.buyerId === u.id && r.status === "OPEN").length), href: `/buyers/${u.id}` },
      { label: "Enquiries sent", value: String(d.enquiries.filter((e) => e.buyerId === u.id).length), href: "/market?tab=enquiries" },
      { label: "Saved farmers", value: String(d.saved.filter((s) => s.userId === u.id && s.targetType === "FARMER").length), href: "/profile" },
    ];
  } else if (u.role === "EXPERT") {
    home.stats = [
      { label: "Open questions", value: String(d.questions.filter((q) => q.status === "OPEN" && !q.hidden && (!q.expertId || q.expertId === u.id)).length), href: "/experts?tab=questions" },
      { label: "Answers given", value: String(d.answers.filter((a) => a.expertId === u.id).length), href: `/experts/${u.id}` },
      { label: "Followers", value: String(d.follows.filter((f) => f.followingId === u.id).length), href: `/experts/${u.id}` },
    ];
  } else if (u.role === "ADMIN") {
    home.stats = [
      { label: "Open reports", value: String(d.reports.filter((r) => r.status === "OPEN").length), href: "/admin" },
      { label: "Pending verifications", value: String(d.verificationRequests.filter((r) => r.status === "PENDING").length), href: "/admin" },
    ];
  } else {
    home.stats = [
      { label: "Followers", value: String(d.follows.filter((f) => f.followingId === u.id).length), href: "/profile" },
      { label: "Events", value: String(d.events.filter((e) => e.organizerId === u.id).length), href: "/events" },
    ];
  }
  return home;
});

