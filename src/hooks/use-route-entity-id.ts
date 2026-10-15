"use client";
import { useParams, useSearchParams } from "next/navigation";

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
  "_default",
]);

/**
 * Universal hook to resolve dynamic route entity IDs across Next.js Server Rendering
 * and Capacitor Static HTML exports.
 *
 * In Next.js static exports (output: "export"), generateStaticParams produces stub pages
 * like "/professionals/_default.html". When loaded in client runtime, the actual URL
 * in window.location or searchParams contains the true entity ID.
 *
 * This hook inspects:
 * 1. Client route params (`useParams().id`)
 * 2. Query parameters (`?id=...` or `?profileId=...`)
 * 3. Browser pathname segments (e.g. "/professionals/usr_abc123" -> "usr_abc123")
 * 4. Fallback prop (if not "_default")
 */
export function useRouteEntityId(initialId?: string): string {
  const routeParams = useParams();
  const searchParams = useSearchParams();

  // 1. Check useParams
  const paramId = routeParams?.id;
  if (typeof paramId === "string" && paramId && paramId !== "_default") {
    return decodeURIComponent(paramId);
  }

  // 2. Check query string
  const queryId = searchParams?.get("id") || searchParams?.get("profileId");
  if (queryId && queryId !== "_default") {
    return decodeURIComponent(queryId);
  }

  // 3. Check browser pathname
  if (typeof window !== "undefined") {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && !KNOWN_ROUTE_PREFIXES.has(lastSegment) && lastSegment !== "_default") {
      return decodeURIComponent(lastSegment);
    }
  }

  // 4. Fallback to initialId if valid
  if (initialId && initialId !== "_default") {
    return initialId;
  }

  return "";
}

