import type { Role } from "@/types/domain";

/** Public profile URL for a user, by role. Organisations & FPOs are addressed by their user id. */
export function profileHref(
  u?: { id?: string; role?: Role; handle?: string } | null,
  entryPoint?: string
) {
  if (!u) return "/professionals";
  const target = u.id || u.handle || "";
  if (!target) return "/professionals";

  let href: string;
  switch (u.role) {
    case "FARMER":
    case "PROFESSIONAL":
      // Using query parameter navigation (/professionals?id=...) provides instant client-side
      // rendering on Next.js static exports (Capacitor) without relying on unexported dynamic HTML files.
      // Dynamic path routes (/professionals/:id) remain supported through useRouteEntityId.
      href = `/professionals?id=${encodeURIComponent(target)}`;
      break;
    case "BUYER":
      href = `/buyers?id=${encodeURIComponent(target)}`;
      break;
    case "EXPERT":
      href = `/experts?id=${encodeURIComponent(target)}`;
      break;
    case "GOVERNMENT":
    case "FPO":
      href = `/orgs?id=${encodeURIComponent(target)}`;
      break;
    default:
      href = `/professionals?id=${encodeURIComponent(target)}`;
      break;
  }

  if (typeof window !== "undefined") {
    console.log("[KaamSetu:Nav:profileHref]", {
      entryPoint: entryPoint ?? "unspecified",
      targetId: u.id,
      handle: u.handle,
      role: u.role,
      href,
      currentPath: window.location.pathname,
    });
  }

  return href;
}
