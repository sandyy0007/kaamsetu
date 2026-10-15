import { parseLocalVoiceIntent } from "./intent-parser";
import { voiceIntentSchema, type ResolvedVoiceAction, type VoiceIntent } from "./intent-schema";
import { api } from "@/lib/api";

export function resolveIntentToRoute(intent: VoiceIntent): ResolvedVoiceAction {
  switch (intent.type) {
    case "SEARCH_PROFESSIONALS": {
      const params = new URLSearchParams();
      if (intent.profession) params.set("q", intent.profession);
      else if (intent.query) params.set("q", intent.query);
      if (intent.location && intent.location !== "near me") params.set("district", intent.location);
      if (intent.verifiedOnly) params.set("verified", "1");

      const qs = params.toString();
      const targetUrl = `/professionals${qs ? `?${qs}` : ""}`;
      const title = intent.profession
        ? `${intent.profession}s${intent.location ? ` in ${intent.location}` : ""}`
        : "Search Professionals";
      const description = `Finding verified professionals matching "${intent.profession || intent.query || "all"}"`;

      return {
        intent,
        targetUrl,
        displayTitle: title,
        displayDescription: description,
        confidence: 0.95,
      };
    }

    case "SEARCH_JOBS": {
      const params = new URLSearchParams();
      params.set("tab", "work");
      if (intent.profession) params.set("q", intent.profession);
      else if (intent.query) params.set("q", intent.query);
      if (intent.location && intent.location !== "near me") params.set("district", intent.location);

      const qs = params.toString();
      const targetUrl = `/opportunities${qs ? `?${qs}` : ""}`;
      const title = intent.profession
        ? `${intent.profession} Jobs${intent.location ? ` in ${intent.location}` : ""}`
        : "Opportunities & Work";
      const description = `Searching opportunities for "${intent.profession || intent.query || "work"}"`;

      return {
        intent,
        targetUrl,
        displayTitle: title,
        displayDescription: description,
        confidence: 0.92,
      };
    }

    case "SEARCH_SERVICES": {
      const targetUrl = `/opportunities?tab=work${intent.service ? `&q=${encodeURIComponent(intent.service)}` : ""}`;
      return {
        intent,
        targetUrl,
        displayTitle: `Services for ${intent.service || "you"}`,
        displayDescription: "Browsing services and requests",
        confidence: 0.88,
      };
    }

    case "OPEN_MY_PROFILE": {
      return {
        intent,
        targetUrl: "/profile",
        displayTitle: "My Profile",
        displayDescription: "Opening your professional profile and credentials",
        confidence: 1.0,
      };
    }

    case "OPEN_PROFILE": {
      const q = intent.query || "";
      const targetUrl = intent.profileId
        ? `/professionals/${intent.profileId}`
        : `/professionals?q=${encodeURIComponent(q)}`;
      return {
        intent,
        targetUrl,
        displayTitle: q ? `Profile: ${q}` : "Search Profile",
        displayDescription: `Opening profile for ${q || "user"}`,
        confidence: 0.85,
      };
    }

    case "OPEN_FOLLOWING": {
      return {
        intent,
        targetUrl: "/profile",
        displayTitle: "People You Follow",
        displayDescription: "Opening your network and following list",
        confidence: 0.95,
      };
    }

    case "OPEN_FOLLOWERS": {
      return {
        intent,
        targetUrl: "/profile",
        displayTitle: "Your Followers",
        displayDescription: "Opening your followers list",
        confidence: 0.95,
      };
    }

    case "OPEN_MESSAGES": {
      return {
        intent,
        targetUrl: "/messages",
        displayTitle: "Messages",
        displayDescription: "Opening your private conversations",
        confidence: 1.0,
      };
    }

    case "OPEN_NOTIFICATIONS": {
      return {
        intent,
        targetUrl: "/notifications",
        displayTitle: "Notifications",
        displayDescription: "Viewing your latest updates and alerts",
        confidence: 1.0,
      };
    }

    case "OPEN_SAVED_ITEMS": {
      return {
        intent,
        targetUrl: "/saved",
        displayTitle: "Saved Items",
        displayDescription: "Opening your bookmarked jobs and profiles",
        confidence: 0.95,
      };
    }

    case "OPEN_HOME": {
      return {
        intent,
        targetUrl: "/home",
        displayTitle: "Home Dashboard",
        displayDescription: "Navigating to your main home feed",
        confidence: 1.0,
      };
    }

    case "SEARCH_GENERAL": {
      const targetUrl = `/explore?q=${encodeURIComponent(intent.query)}`;
      return {
        intent,
        targetUrl,
        displayTitle: `Search: "${intent.query}"`,
        displayDescription: `Searching across people, produce, and opportunities`,
        confidence: 0.8,
      };
    }

    case "UNKNOWN":
    default: {
      return {
        intent,
        targetUrl: `/explore?q=${encodeURIComponent(intent.transcript)}`,
        displayTitle: `Search for "${intent.transcript}"`,
        displayDescription: "Could not classify exact intent — showing general search results",
        confidence: 0.4,
      };
    }
  }
}

/**
 * Hybrid Voice Intent Resolver.
 * Uses Level 1 offline deterministic parsing first.
 * For ambiguous cases, queries optional backend AI intent endpoint with fallback.
 */
export async function resolveVoiceIntent(
  transcript: string,
  options: { allowBackendAi?: boolean; language?: string } = {}
): Promise<ResolvedVoiceAction> {
  const localIntent = parseLocalVoiceIntent(transcript);

  // If local parser identified a confident intent, return immediately (fast & offline)
  if (localIntent.type !== "UNKNOWN" && localIntent.type !== "SEARCH_GENERAL") {
    return resolveIntentToRoute(localIntent);
  }

  // Level 2: Optional backend AI intent enhancement if requested and available
  if (options.allowBackendAi && transcript.trim().length > 3) {
    try {
      const aiResponse = await api<{ intent: unknown }>("POST", "/ai/intent", {
        transcript,
        language: options.language,
      });

      const parsed = voiceIntentSchema.safeParse(aiResponse.intent);
      if (parsed.success && parsed.data.type !== "UNKNOWN") {
        return resolveIntentToRoute(parsed.data);
      }
    } catch {
      // Backend AI unavailable or returned non-200; safely keep local resolution
    }
  }

  return resolveIntentToRoute(localIntent);
}

