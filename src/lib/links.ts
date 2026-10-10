import type { Role } from "@/types/domain";

/** Public profile URL for a user, by role. Organisations & FPOs are addressed by their user id. */
export function profileHref(u: { id: string; role: Role }) {
  switch (u.role) {
    case "FARMER":
    case "PROFESSIONAL":
      // One universal profile page; the farming sections appear on it for farmers. (/farmers/:id still works.)
      return `/professionals/${u.id}`;
    case "BUYER":
      return `/buyers/${u.id}`;
    case "EXPERT":
      return `/experts/${u.id}`;
    case "GOVERNMENT":
    case "FPO":
      return `/orgs/${u.id}`;
    default:
      return `/orgs/${u.id}`;
  }
}
