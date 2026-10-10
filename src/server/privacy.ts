/**
 * Server-side privacy enforcement. The profile owner chooses a visibility level per data
 * category; `canSee` is the ONLY place that interprets those levels.
 * The browser never receives data this function rejects.
 */
import type { Db, User, Visibility } from "@/types/domain";

export function areConnected(d: Db, a: string, b: string) {
  if (a === b) return true;
  const accepted = d.connections.some(
    (c) => c.status === "ACCEPTED" && ((c.requesterId === a && c.receiverId === b) || (c.requesterId === b && c.receiverId === a)),
  );
  if (accepted) return true;
  // Mutual follow also counts as a connection.
  return d.follows.some((f) => f.followerId === a && f.followingId === b) && d.follows.some((f) => f.followerId === b && f.followingId === a);
}

/** True if viewer and owner belong to the same FPO (or viewer IS the owner's FPO account). */
export function sharesFpo(d: Db, viewer: User, ownerId: string) {
  const owner = d.farmerProfiles.find((p) => p.userId === ownerId);
  if (!owner) return false;
  if (viewer.role === "FPO") {
    const fpo = d.fpos.find((f) => f.userId === viewer.id);
    return !!fpo && fpo.memberIds.includes(ownerId);
  }
  const mine = d.farmerProfiles.find((p) => p.userId === viewer.id);
  return !!mine && mine.fpoIds.some((id) => owner.fpoIds.includes(id));
}

export interface CanSeeOptions {
  /** Financial data is excluded even for admins — they moderate, they do not browse ledgers. */
  financial?: boolean;
}

export function canSee(d: Db, viewer: User | null, ownerId: string, level: Visibility, opts: CanSeeOptions = {}): boolean {
  if (!viewer) return level === "PUBLIC";
  if (viewer.id === ownerId) return true;
  if (viewer.role === "ADMIN") return !opts.financial;
  switch (level) {
    case "PUBLIC":
      return true;
    case "PRIVATE":
      return false;
    case "CONNECTIONS":
      return areConnected(d, viewer.id, ownerId);
    case "BUYERS":
      return viewer.role === "BUYER" || areConnected(d, viewer.id, ownerId);
    case "FPO":
      return sharesFpo(d, viewer, ownerId) || areConnected(d, viewer.id, ownerId);
  }
}

export function isBlockedEitherWay(d: Db, a: string, b: string) {
  return d.blocks.some((x) => x.kind === "BLOCK" && ((x.userId === a && x.targetId === b) || (x.userId === b && x.targetId === a)));
}

export function mutedOrBlockedBy(d: Db, viewerId: string): Set<string> {
  return new Set(d.blocks.filter((x) => x.userId === viewerId).map((x) => x.targetId));
}

/** Users who blocked the viewer — content from them must not surface either. */
export function blockedViewer(d: Db, viewerId: string): Set<string> {
  return new Set(d.blocks.filter((x) => x.kind === "BLOCK" && x.targetId === viewerId).map((x) => x.userId));
}
