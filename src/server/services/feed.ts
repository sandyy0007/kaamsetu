/**
 * Feed ranking. Transparent heuristic today (recency × relationship × relevance × quality);
 * the `scorePost` seam is where a learned recommender plugs in later.
 * Users stay in control: muted/blocked accounts are excluded, and a topic chip always overrides ranking.
 */
import type { Db, Post, Reel, User } from "@/types/domain";
import type { FeedItem } from "@/types/dto";
import { blockedViewer, mutedOrBlockedBy } from "../privacy";
import { postDTO, reelDTO, type View } from "../mappers";

const HOUR = 3_600_000;

interface Profile {
  crops: Set<string>;
  interests: Set<string>;
  district?: string;
  following: Set<string>;
  communities: Set<string>;
  /** Professional whose profession has no farm modules — farm-only posts are de-prioritised, never hidden. */
  nonFarm?: boolean;
  professionId?: string;
}

function profileFor(d: Db, user: User): Profile {
  const fp = d.farmerProfiles.find((p) => p.userId === user.id);
  const bp = d.buyerProfiles.find((p) => p.userId === user.id);
  const pp = d.professionalProfiles.find((p) => p.userId === user.id);
  const prof = pp && d.professions.find((x) => x.id === pp.professionId);
  const lower = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase()));
  return {
    crops: lower([...d.crops.filter((c) => c.ownerId === user.id).map((c) => c.name), ...(bp?.cropsPurchased ?? [])]),
    // For non-farm professionals the profession and skills play the role farmers' crops/interests play.
    interests: lower([...(fp?.interests ?? []), ...(pp && !prof?.farmModules ? [prof?.name ?? "", pp.customProfession ?? "", ...pp.skills.map((s) => s.name)].filter(Boolean) : [])]),
    district: (fp?.district ?? bp?.district ?? pp?.location.district)?.toLowerCase(),
    following: new Set(d.follows.filter((f) => f.followerId === user.id).map((f) => f.followingId)),
    communities: new Set(d.communityMembers.filter((m) => m.userId === user.id).map((m) => m.communityId)),
    nonFarm: !!pp && !prof?.farmModules,
    professionId: pp?.professionId,
  };
}

export function scorePost(d: Db, p: Post, prof: Profile, now = Date.now()): number {
  const ageH = Math.max(0, (now - Date.parse(p.createdAt)) / HOUR);
  let s = 100 / (1 + ageH / 18); // recency half-life ≈ 18h
  if (prof.following.has(p.authorId)) s += 40;
  if (p.communityId && prof.communities.has(p.communityId)) s += 25;
  if (p.crop && prof.crops.has(p.crop.toLowerCase())) s += 30;
  if (p.tags.some((t) => prof.interests.has(t.toLowerCase()) || prof.crops.has(t.toLowerCase()))) s += 15;
  if (prof.district && p.district?.toLowerCase() === prof.district) s += 12;
  const likes = d.likes.filter((l) => l.targetType === "POST" && l.targetId === p.id).length;
  s += Math.min(15, likes * 1.2);
  const author = d.users.find((u) => u.id === p.authorId);
  if (author?.verifiedAt) s += 6;
  if (prof.nonFarm) {
    // Peers in the same profession matter more; crop/weather posts matter less unless the person chose to follow them.
    const authorPro = d.professionalProfiles.find((x) => x.userId === p.authorId);
    if (prof.professionId && authorPro?.professionId === prof.professionId) s += 18;
    const chosen = prof.following.has(p.authorId) || (p.communityId && prof.communities.has(p.communityId));
    if (!chosen && (p.crop || p.kind === "WEATHER")) s -= 35;
  }
  if (p.kind === "ANNOUNCEMENT" || p.kind === "WEATHER") s += 10;
  return s;
}

const topicMatches = (p: Post, d: Db, topic: string) => {
  const t = topic.toLowerCase();
  if (p.tags.some((x) => x.toLowerCase() === t)) return true;
  if (p.crop?.toLowerCase() === t) return true;
  if (t === "rajasthan") return true; // all demo content is Rajasthan-based; production: p.state === Rajasthan
  if (t === "governmentschemes") return d.users.find((u) => u.id === p.authorId)?.role === "GOVERNMENT" || p.kind === "ANNOUNCEMENT";
  if (t === "organicfarming") return p.tags.some((x) => x.toLowerCase().includes("organic"));
  // Universal categories (KaamSetu): by what kind of post it is, so they work for every profession.
  const KIND_TOPICS: Record<string, string[]> = { work: ["WORK", "OPPORTUNITY"], skills: ["SKILL", "TIP"], tutorials: ["TUTORIAL"], services: ["SERVICE"], events: ["EVENT"], announcements: ["ANNOUNCEMENT"] };
  const kinds = KIND_TOPICS[t];
  if (kinds) return kinds.includes(p.kind);
  if (t === "safety") return p.tags.some((x) => x.toLowerCase().includes("safety"));
  return false;
};

export interface FeedQuery {
  topic?: string;
  communityId?: string;
  authorId?: string;
  cursor?: number;
  limit?: number;
  mixReels?: boolean;
}

export function buildFeed(v: View, q: FeedQuery) {
  const { d, viewer } = v;
  const hide = viewer ? new Set([...mutedOrBlockedBy(d, viewer.id), ...blockedViewer(d, viewer.id)]) : new Set<string>();
  const prof = viewer && viewer.personalization ? profileFor(d, viewer) : undefined;

  let posts = d.posts.filter((p) => !p.hidden && !hide.has(p.authorId));
  if (q.communityId) posts = posts.filter((p) => p.communityId === q.communityId);
  if (q.authorId) posts = posts.filter((p) => p.authorId === q.authorId);
  const topic = q.topic && q.topic !== "ForYou" ? q.topic : undefined;
  if (topic) posts = posts.filter((p) => topicMatches(p, d, topic));

  const now = Date.now();
  const ranked =
    prof && !q.communityId && !q.authorId && !topic
      ? posts.map((p) => ({ p, s: scorePost(d, p, prof, now) })).sort((a, b) => b.s - a.s).map((x) => x.p)
      : posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const reels: Reel[] =
    q.mixReels && !q.communityId && !q.authorId
      ? d.reels.filter((r) => !r.hidden && !hide.has(r.authorId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];

  // Interleave: a reel after every 4 posts.
  const items: FeedItem[] = [];
  let ri = 0;
  ranked.forEach((p, i) => {
    items.push({ type: "post", post: postDTO(v, p) });
    if ((i + 1) % 4 === 0 && reels[ri]) items.push({ type: "reel", reel: reelDTO(v, reels[ri++]!) });
  });

  const start = q.cursor ?? 0;
  const limit = q.limit ?? 8;
  const page = items.slice(start, start + limit);
  return { items: page, nextCursor: start + limit < items.length ? String(start + limit) : null, total: items.length };
}
