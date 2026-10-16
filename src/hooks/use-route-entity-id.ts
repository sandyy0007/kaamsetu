"use client";
import { useParams, usePathname, useSearchParams } from "next/navigation";

const KNOWN_ROUTE_PREFIXES = new Set([
  "professionals",
  "farmers",
  "buyers",
  "experts",
  "orgs",
  "businesses",
  "crops",
  "events",
  "learning",
  "live",
  "market",
  "opportunities",
  "schemes",
  "farms",
  "communities",
  "questions",
]);

const PLACEHOLDER_TOKENS = new Set([
  "_default",
  "default",
  "index",
  "undefined",
  "null",
  "",
]);

function cleanSegment(seg: string | undefined): string | null {
  if (!seg) return null;
  // Remove file extensions (e.g. "u_ramesh.html" -> "u_ramesh", "index.html" -> "index")
  const stripped = seg.replace(/\.(html|htm|txt|json)$/i, "").trim();
  const lower = stripped.toLowerCase();
  if (PLACEHOLDER_TOKENS.has(lower) || KNOWN_ROUTE_PREFIXES.has(lower)) {
    return null;
  }
  return decodeURIComponent(stripped);
}

function parseEntityIdFromPath(pathname: string | undefined): string | null {
  if (!pathname) return null;
  // Normalize path and strip query/hash
  const pathWithoutQuery = pathname.split("?")[0].split("#")[0];
  const segments = pathWithoutQuery.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // Pattern 1: /[prefix]/[entityId] or /[prefix]/[entityId]/[subtab]
  if (KNOWN_ROUTE_PREFIXES.has(segments[0].toLowerCase()) && segments.length >= 2) {
    const candidate = cleanSegment(segments[1]);
    if (candidate) return candidate;
  }

  // Pattern 2: Inspect remaining segments backwards for an entity ID (skipping known prefixes and stubs)
  for (let i = segments.length - 1; i >= 0; i--) {
    const candidate = cleanSegment(segments[i]);
    if (candidate) return candidate;
  }

  return null;
}

/**
 * Universal hook to resolve dynamic route entity IDs across Next.js Server Components,
 * Client transitions, and Capacitor Static HTML exports.
 */
export function useRouteEntityId(initialId?: string): string {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // 1. Check explicit prop if valid and non-placeholder
  const cleanedInitial = cleanSegment(initialId);
  if (cleanedInitial) {
    return cleanedInitial;
  }

  // 2. Check query string (?id=... or ?userId=... or ?profileId=... or ?handle=...)
  const queryParam =
    searchParams?.get("id") ||
    searchParams?.get("userId") ||
    searchParams?.get("profileId") ||
    searchParams?.get("handle");
  const cleanedQuery = cleanSegment(queryParam || undefined);
  if (cleanedQuery) {
    return cleanedQuery;
  }

  // 3. Check client route params (useParams().id)
  const paramId = routeParams?.id;
  if (typeof paramId === "string") {
    const cleanedParam = cleanSegment(paramId);
    if (cleanedParam) return cleanedParam;
  }

  // 4. Check reactive Next.js pathname (subscribes to client navigation transitions)
  const fromPathname = parseEntityIdFromPath(pathname);
  if (fromPathname) {
    return fromPathname;
  }

  // 5. Fallback to window.location (for cold starts / static Capacitor file load)
  if (typeof window !== "undefined") {
    // Check window.location.search first
    try {
      const windowSp = new URLSearchParams(window.location.search);
      const winQuery =
        windowSp.get("id") ||
        windowSp.get("userId") ||
        windowSp.get("profileId") ||
        windowSp.get("handle");
      const cleanedWinQuery = cleanSegment(winQuery || undefined);
      if (cleanedWinQuery) return cleanedWinQuery;
    } catch {
      // Ignore
    }

    const fromWindowPath = parseEntityIdFromPath(window.location.pathname);
    if (fromWindowPath) {
      return fromWindowPath;
    }
  }

  return "";
}
