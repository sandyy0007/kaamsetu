/**
 * Capability matrix shared by the server (enforcement) and the browser (hiding buttons).
 * Hiding a button is a convenience only — every API route re-checks with requireCap().
 */
import type { PostKind, Role } from "@/types/domain";

export type Capability =
  | "post:create"
  | "reel:create"
  | "farm:manage"
  | "listing:create"
  | "requirement:create"
  | "enquiry:send"
  | "question:ask"
  | "question:answer"
  | "scheme:publish"
  | "event:create"
  | "live:host"
  | "course:create"
  | "machinery:list"
  | "community:create"
  | "community:join"
  | "farmer:search"
  | "learning:take"
  | "professional:search"
  | "service:manage"
  | "service:request"
  | "portfolio:manage"
  | "work:post"
  | "work:apply"
  | "business:manage"
  | "recommend:write"
  | "admin:access";

export const ALL_CAPABILITIES: Capability[] = [
  "post:create",
  "reel:create",
  "farm:manage",
  "listing:create",
  "requirement:create",
  "enquiry:send",
  "question:ask",
  "question:answer",
  "scheme:publish",
  "event:create",
  "live:host",
  "course:create",
  "machinery:list",
  "community:create",
  "community:join",
  "farmer:search",
  "learning:take",
  "professional:search",
  "service:manage",
  "service:request",
  "portfolio:manage",
  "work:post",
  "work:apply",
  "business:manage",
  "recommend:write",
  "admin:access",
];

/** Capabilities every signed-in, non-admin account shares (a Farmer is a Professional too). */
const COMMON: Capability[] = ["professional:search", "service:request", "recommend:write"];

export const MATRIX: Record<Role, Capability[]> = {
  FARMER: ["post:create", "reel:create", "farm:manage", "listing:create", "question:ask", "machinery:list", "community:create", "community:join", "farmer:search", "learning:take", "service:manage", "portfolio:manage", "work:post", "work:apply", "business:manage", ...COMMON],
  PROFESSIONAL: ["post:create", "reel:create", "question:ask", "machinery:list", "community:create", "community:join", "learning:take", "service:manage", "portfolio:manage", "work:post", "work:apply", "business:manage", "listing:create", ...COMMON],
  BUYER: ["post:create", "requirement:create", "enquiry:send", "farmer:search", "community:join", "work:post", "business:manage", ...COMMON],
  EXPERT: ["post:create", "reel:create", "question:answer", "live:host", "course:create", "event:create", "community:join", "farmer:search", "learning:take", "service:manage", "portfolio:manage", ...COMMON],
  GOVERNMENT: ["post:create", "reel:create", "scheme:publish", "event:create", "live:host", "course:create", "farmer:search", "work:post", "professional:search"],
  FPO: ["post:create", "reel:create", "listing:create", "enquiry:send", "event:create", "live:host", "community:join", "farmer:search", "machinery:list", "work:post", "business:manage", ...COMMON],
  // Admins moderate; they do not take part in the work marketplace as a user.
  ADMIN: ALL_CAPABILITIES.filter((c) => !["service:request", "service:manage", "portfolio:manage", "work:post", "work:apply", "business:manage", "recommend:write"].includes(c)),
};

/** Which post kinds each role may publish. Official kinds are restricted to organisations. */
export const POST_KINDS: Record<Role, PostKind[]> = {
  FARMER: ["POST", "STORY", "QUESTION", "MARKET", "WORK", "SKILL", "TUTORIAL", "SERVICE", "OPPORTUNITY"],
  PROFESSIONAL: ["POST", "STORY", "QUESTION", "MARKET", "WORK", "SKILL", "TUTORIAL", "SERVICE", "OPPORTUNITY"],
  BUYER: ["POST", "MARKET", "OPPORTUNITY"],
  EXPERT: ["POST", "TIP", "EXPERT_ANSWER", "EVENT", "SKILL", "TUTORIAL", "WORK"],
  GOVERNMENT: ["POST", "TIP", "ANNOUNCEMENT", "EVENT", "WEATHER", "OPPORTUNITY"],
  FPO: ["POST", "ANNOUNCEMENT", "EVENT", "MARKET", "OPPORTUNITY"],
  ADMIN: ["POST", "TIP", "ANNOUNCEMENT", "EVENT", "STORY", "MARKET", "WEATHER", "QUESTION", "EXPERT_ANSWER", "WORK", "SKILL", "OPPORTUNITY", "TUTORIAL", "SERVICE"],
};


export const roleCan = (role: Role | undefined, cap: Capability) => !!role && MATRIX[role].includes(cap);
