import { describe, it, expect } from "vitest";
import { parseLocalVoiceIntent, extractVoiceProfession, extractVoiceLocation } from "@/lib/voice/intent-parser";
import { resolveIntentToRoute } from "@/lib/voice/intent-resolver";
import { voiceIntentSchema } from "@/lib/voice/intent-schema";

describe("Voice Intent System — Multilingual Voice Search", () => {
  describe("Profession and Location Extraction", () => {
    it("extracts canonical profession from Hindi, Hinglish, and English tokens", () => {
      expect(extractVoiceProfession("मुझे बिजलीवाला चाहिए")).toBe("Electrician");
      expect(extractVoiceProfession("electrician chahiye")).toBe("Electrician");
      expect(extractVoiceProfession("find a wireman")).toBe("Electrician");
      expect(extractVoiceProfession("लकड़ी का काम करने वाला बढ़ई")).toBe("Carpenter");
      expect(extractVoiceProfession("badhai mistri in jaipur")).toBe("Carpenter");
      expect(extractVoiceProfession("plumber near me")).toBe("Plumber");
      expect(extractVoiceProfession("नल वाला भेजो")).toBe("Plumber");
      expect(extractVoiceProfession("raj mistri chahiye")).toBe("Mason");
      expect(extractVoiceProfession("चालक की जरूरत है")).toBe("Driver");
      expect(extractVoiceProfession("tailor for stitching")).toBe("Tailor");
      expect(extractVoiceProfession("kisan sammelan")).toBe("Farmer");
      expect(extractVoiceProfession("मजदूर चाहिए खेत के लिए")).toBe("Farm worker");
    });

    it("extracts recognized locations including regional districts and 'near me'", () => {
      expect(extractVoiceLocation("electrician in jaipur")).toBe("Jaipur");
      expect(extractVoiceLocation("plumber in Lucknow")).toBe("Lucknow");
      expect(extractVoiceLocation("badhai in Churu")).toBe("Churu");
      expect(extractVoiceLocation("mere aas paas electrician")).toBe("near me");
      expect(extractVoiceLocation("plumber near me")).toBe("near me");
      expect(extractVoiceLocation("आस पास कोई मिस्त्री है")).toBe("near me");
    });
  });

  describe("Deterministic Intent Parsing — Hindi, Hinglish, English", () => {
    it("parses Hindi tradesperson searches", () => {
      const intent1 = parseLocalVoiceIntent("मुझे लखनऊ में इलेक्ट्रीशियन चाहिए");
      expect(intent1.type).toBe("SEARCH_PROFESSIONALS");
      if (intent1.type === "SEARCH_PROFESSIONALS") {
        expect(intent1.profession).toBe("Electrician");
        expect(intent1.location).toBe("Lucknow");
      }

      const intent2 = parseLocalVoiceIntent("कारपेंटर ढूंढो");
      expect(intent2.type).toBe("SEARCH_PROFESSIONALS");
      if (intent2.type === "SEARCH_PROFESSIONALS") {
        expect(intent2.profession).toBe("Carpenter");
      }
    });

    it("parses Hinglish queries with locations and filters", () => {
      const intent = parseLocalVoiceIntent("plumber chahiye delhi me");
      expect(intent.type).toBe("SEARCH_PROFESSIONALS");
      if (intent.type === "SEARCH_PROFESSIONALS") {
        expect(intent.profession).toBe("Plumber");
        expect(intent.location).toBe("Delhi");
      }
    });

    it("parses Job and Work searches", () => {
      const intentJob1 = parseLocalVoiceIntent("नौकरियां दिखाओ");
      expect(intentJob1.type).toBe("SEARCH_JOBS");

      const intentJob2 = parseLocalVoiceIntent("electrician jobs in jaipur");
      expect(intentJob2.type).toBe("SEARCH_JOBS");
      if (intentJob2.type === "SEARCH_JOBS") {
        expect(intentJob2.profession).toBe("Electrician");
        expect(intentJob2.location).toBe("Jaipur");
      }

      const intentSeasonal = parseLocalVoiceIntent("seasonal kisan kaam");
      expect(intentSeasonal.type).toBe("SEARCH_JOBS");
      if (intentSeasonal.type === "SEARCH_JOBS") {
        expect(intentSeasonal.jobType).toBe("seasonal");
      }
    });

    it("parses Navigation and Personal Profile requests", () => {
      expect(parseLocalVoiceIntent("meri profile dikhao").type).toBe("OPEN_MY_PROFILE");
      expect(parseLocalVoiceIntent("open my profile").type).toBe("OPEN_MY_PROFILE");
      expect(parseLocalVoiceIntent("मेरी प्रोफाइल").type).toBe("OPEN_MY_PROFILE");

      expect(parseLocalVoiceIntent("messages kholo").type).toBe("OPEN_MESSAGES");
      expect(parseLocalVoiceIntent("संदेश दिखाओ").type).toBe("OPEN_MESSAGES");

      expect(parseLocalVoiceIntent("notifications dikhao").type).toBe("OPEN_NOTIFICATIONS");
      expect(parseLocalVoiceIntent("सूचनाएं खोलो").type).toBe("OPEN_NOTIFICATIONS");

      expect(parseLocalVoiceIntent("following list dikhao").type).toBe("OPEN_FOLLOWING");
      expect(parseLocalVoiceIntent("फॉलोअर्स दिखाओ").type).toBe("OPEN_FOLLOWERS");

      expect(parseLocalVoiceIntent("saved items open").type).toBe("OPEN_SAVED_ITEMS");
      expect(parseLocalVoiceIntent("home").type).toBe("OPEN_HOME");
    });

    it("parses Specific User Profile lookup", () => {
      const intent = parseLocalVoiceIntent("Rahul Sharma ki profile dikhao");
      expect(intent.type).toBe("OPEN_PROFILE");
      if (intent.type === "OPEN_PROFILE") {
        expect(intent.query?.toLowerCase()).toContain("rahul");
      }
    });

    it("validates all generated intents against Zod schema", () => {
      const samples = [
        "electrician chahiye",
        "meri profile",
        "jobs in delhi",
        "messages",
        "unknown gibberish query 12345",
      ];
      for (const sample of samples) {
        const parsed = parseLocalVoiceIntent(sample);
        const validated = voiceIntentSchema.safeParse(parsed);
        expect(validated.success).toBe(true);
      }
    });
  });

  describe("Route Resolution & Navigation Targets", () => {
    it("resolves SEARCH_PROFESSIONALS to /professionals with query parameters", () => {
      const intent = parseLocalVoiceIntent("electrician in jaipur");
      const action = resolveIntentToRoute(intent);
      expect(action.targetUrl).toContain("/professionals");
      expect(action.targetUrl).toContain("q=Electrician");
      expect(action.targetUrl).toContain("district=Jaipur");
      expect(action.displayTitle).toBe("Electricians in Jaipur");
      expect(action.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("resolves SEARCH_JOBS to /opportunities with tab=work", () => {
      const intent = parseLocalVoiceIntent("carpenter jobs in churu");
      const action = resolveIntentToRoute(intent);
      expect(action.targetUrl).toContain("/opportunities");
      expect(action.targetUrl).toContain("tab=work");
      expect(action.targetUrl).toContain("q=Carpenter");
      expect(action.targetUrl).toContain("district=Churu");
    });

    it("resolves navigation intents to clean internal routes", () => {
      expect(resolveIntentToRoute({ type: "OPEN_MY_PROFILE" }).targetUrl).toBe("/profile");
      expect(resolveIntentToRoute({ type: "OPEN_MESSAGES" }).targetUrl).toBe("/messages");
      expect(resolveIntentToRoute({ type: "OPEN_NOTIFICATIONS" }).targetUrl).toBe("/notifications");
      expect(resolveIntentToRoute({ type: "OPEN_SAVED_ITEMS" }).targetUrl).toBe("/saved");
      expect(resolveIntentToRoute({ type: "OPEN_HOME" }).targetUrl).toBe("/home");
      expect(resolveIntentToRoute({ type: "OPEN_FOLLOWING" }).targetUrl).toBe("/profile");
    });
  });
});

