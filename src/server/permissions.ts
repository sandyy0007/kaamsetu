/**
 * Role-based access control. Every mutation in the service layer calls `requireCap`.
 * The browser hides buttons based on the same matrix, but THIS is the enforcement point.
 */
import type { PostKind, Role, User } from "@/types/domain";
import { forbidden, unauthorized } from "./errors";

import { MATRIX, POST_KINDS, type Capability } from "@/lib/capabilities";
export type { Capability };

export const can = (user: User | null, cap: Capability) => !!user && MATRIX[user.role].includes(cap);

export function requireUser(user: User | null): User {
  if (!user) throw unauthorized();
  return user;
}

export const SENSITIVE_CAPABILITIES: Capability[] = [
  "listing:create",
  "work:post",
  "machinery:list",
  "service:manage",
  "requirement:create",
  "scheme:publish",
  "business:manage",
];

export function requireCap(user: User | null, cap: Capability): User {
  const u = requireUser(user);
  if (!can(u, cap)) throw forbidden("Your account type cannot do this.");
  if (u.phoneVerified === false && SENSITIVE_CAPABILITIES.includes(cap)) {
    throw forbidden("Phone verification is required to perform this action. Your account is in unverified testing mode.");
  }
  return u;
}

export function requireRole(user: User | null, ...roles: Role[]): User {
  const u = requireUser(user);
  if (!roles.includes(u.role)) throw forbidden();
  return u;
}

export const allowedPostKinds = (role: Role) => POST_KINDS[role];

export function requirePostKind(user: User, kind: PostKind) {
  if (!POST_KINDS[user.role].includes(kind)) throw forbidden("Your account type cannot publish this kind of post.");
}
