import type { Role } from "@/types/domain";

/** Public profile URL for a user, by role. Organisations & FPOs are addressed by their user id. */
export function profileHref(u?: { id?: string; role?: Role; handle?: string } | null) {
  if (!u) return "/professionals";
  const target = u.id || u.handle || "";
  if (!target) return "/professionals";
  switch (u.role) {
    case "FARMER":
    case "PROFESSIONAL":
      // One universal profile page; the farming sections appear on it for farmers. (/farmers/:id still works.)
      return `/professionals/${target}`;
    case "BUYER":
      return `/buyers/${target}`;
    case "EXPERT":
      return `/experts/${target}`;
    case "GOVERNMENT":
    case "FPO":
      return `/orgs/${target}`;
    default:
      return `/professionals/${target}`;
  }
}
