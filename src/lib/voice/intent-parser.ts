import type { VoiceIntent } from "./intent-schema";
import { findPlaceInText } from "@/lib/geo";

/**
 * Trade and Profession synonyms across Hindi (Devanagari), Hinglish (Roman Hindi), and English.
 */
export const VOICE_PROFESSION_MAP: { pattern: RegExp; canonical: string }[] = [
  { pattern: /बिजली|बिजलीवाला|bijli|electrician|wireman|इलेक्ट्रीशियन/i, canonical: "Electrician" },
  { pattern: /बढ़ई|बढई|badhai|carpenter|कारपेंटर|लकड़ी का काम|woodwork|furniture/i, canonical: "Carpenter" },
  { pattern: /प्लंबर|नलसाज़?|plumber|nal wala|नल वाला/i, canonical: "Plumber" },
  { pattern: /राजमिस्त्री|raj ?mistri|mason|चिनाई|construction/i, canonical: "Mason" },
  { pattern: /ड्राइवर|चालक|driver|chalak|driving/i, canonical: "Driver" },
  { pattern: /दर्ज़ी|दर्जी|darzi|tailor|सिलाई|silai/i, canonical: "Tailor" },
  { pattern: /मैकेनिक|mechanic|mistri|मिस्त्री|गाड़ी रिपेयर/i, canonical: "Mechanic" },
  { pattern: /पेंटर|रंगाई|painter|rang ?rez|रंगाई पुताई/i, canonical: "Painter" },
  { pattern: /कुम्हार|kumhar|potter|pottery|मिट्टी का काम/i, canonical: "Potter" },
  { pattern: /बुनकर|bunkar|weaver|हथकरघा|handloom/i, canonical: "Weaver" },
  { pattern: /किसान|kisan|farmer|खेती|खेतीबाड़ी/i, canonical: "Farmer" },
  { pattern: /ट्यूटर|tutor|शिक्षक|teacher|tuition|पढ़ाने वाला/i, canonical: "Tutor" },
  { pattern: /mobile (repair|technician)|मोबाइल (रिपेयर|मिस्त्री)|computer/i, canonical: "Mobile technician" },
  { pattern: /मज़दूर|मजदूर|majdoor|mazdoor|labour|laborer|farm worker|खेत मज़दूर/i, canonical: "Farm worker" },
  { pattern: /ट्रैक्टर (चालक|ड्राइवर|operator)|tractor operator/i, canonical: "Tractor operator" },
];

export function extractVoiceProfession(text: string): string | undefined {
  for (const { pattern, canonical } of VOICE_PROFESSION_MAP) {
    if (pattern.test(text)) {
      return canonical;
    }
  }
  return undefined;
}

export const HINDI_DISTRICTS: Record<string, string> = {
  "जयपुर": "Jaipur",
  "चूरू": "Churu",
  "सीकर": "Sikar",
  "जोधपुर": "Jodhpur",
  "बीकानेर": "Bikaner",
  "अजमेर": "Ajmer",
  "कोटा": "Kota",
  "उदयपुर": "Udaipur",
  "दिल्ली": "Delhi",
  "मुंबई": "Mumbai",
  "लखनऊ": "Lucknow",
  "पटना": "Patna",
  "अलवर": "Alwar",
  "झुंझुनू": "Jhunjhunu",
  "झुंझुनूं": "Jhunjhunu",
  "नागौर": "Nagaur",
  "भरतपुर": "Bharatpur",
  "भीलवाड़ा": "Bhilwara",
  "बाड़मेर": "Barmer",
  "जैसलमेर": "Jaisalmer",
  "पाली": "Pali",
  "टोंक": "Tonk",
  "हनुमानगढ़": "Hanumangarh",
  "गंगानगर": "Sri Ganganagar",
};

export function extractVoiceLocation(text: string): string | undefined {
  if (/(?:mere\s+)?(?:paas|aas\s*paas|nearby|near\s+me|आस\s*पास|पास)/i.test(text)) {
    return "near me";
  }
  for (const [hindi, canonical] of Object.entries(HINDI_DISTRICTS)) {
    if (text.includes(hindi)) {
      return canonical;
    }
  }
  const geoMatch = findPlaceInText(text);
  if (geoMatch) {
    return geoMatch;
  }
  // Common city / district checks
  const cityMatch = text.match(/\b(jaipur|churu|sikar|jodhpur|bikaner|ajmer|kota|udaipur|delhi|mumbai|lucknow|patna|alwar|jhunjhunu|nagaur)\b/i);
  if (cityMatch && cityMatch[1]) {
    return cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
  }
  return undefined;
}

/**
 * Level 1 Deterministic Intent Parser.
 * Runs instantly on device, completely offline without API keys.
 */
export function parseLocalVoiceIntent(rawTranscript: string): VoiceIntent {
  const text = (rawTranscript || "").trim();
  if (!text) {
    return { type: "UNKNOWN", transcript: "" };
  }

  const lower = text.toLowerCase();

  // 1. My Profile
  if (
    /meri profile|mera profile|my profile|open my profile|view my profile|मेरी प्रोफाइल|मेरा प्रोफाइल|meri account/i.test(
      lower
    )
  ) {
    return { type: "OPEN_MY_PROFILE" };
  }

  // 2. Following / Followers
  if (
    /following|follow kiya|jinhe follow|follo|फॉलोइंग|फॉलो किया/i.test(lower) &&
    /list|show|dikhao|kholo|open|दिखाओ|खोलो/i.test(lower)
  ) {
    return { type: "OPEN_FOLLOWING" };
  }
  if (
    /followers|follower|फॉलोवर|फॉलोअर्स/i.test(lower) &&
    /list|show|dikhao|kholo|open|दिखाओ|खोलो/i.test(lower)
  ) {
    return { type: "OPEN_FOLLOWERS" };
  }

  // 3. Messages / Chat
  if (
    /messages?|chat|inbox|sandesh|मैसेज|संदेश|बातचीत/i.test(lower) &&
    /open|show|kholo|dikhao|dekho|खोलो|दिखाओ/i.test(lower)
  ) {
    return { type: "OPEN_MESSAGES" };
  }

  // 4. Notifications / Alerts
  if (/notifications?|alerts?|सूचनाएं|नोटिफिकेशन/i.test(lower)) {
    return { type: "OPEN_NOTIFICATIONS" };
  }

  // 5. Saved Items
  if (
    /saved|bookmark|पसंदीदा|सेव/i.test(lower) &&
    /items?|opportunities|jobs|profiles|काम|दिखाओ|show|open/i.test(lower)
  ) {
    return { type: "OPEN_SAVED_ITEMS" };
  }

  // 6. Home
  if (/^(\/)?(home|homepage|dash|dashboard|होम|घर|मुख्य पृष्ठ)$/i.test(lower) || /go to home|open home|होम खोलो/i.test(lower)) {
    return { type: "OPEN_HOME" };
  }

  // 7. Specific Person Profile: "Open Rahul's profile", "Rahul ki profile dikhao"
  const personProfileMatch =
    lower.match(/(?:open|show|dikhao|kholo|view)\s+([a-zA-Z\u0900-\u097F]+(?:\s+[a-zA-Z\u0900-\u097F]+)*)(?:'s|\s+ki|\s+ke|\s+ka)?\s+profile/i) ||
    lower.match(/([a-zA-Z\u0900-\u097F]+(?:\s+[a-zA-Z\u0900-\u097F]+)*)(?:'s|\s+ki|\s+ke|\s+ka)\s+profile\s+(?:open|show|dikhao|kholo)/i);

  if (personProfileMatch && personProfileMatch[1]) {
    const candidate = personProfileMatch[1].trim();
    if (!["my", "meri", "mera", "apni", "open", "show"].includes(candidate.toLowerCase())) {
      return { type: "OPEN_PROFILE", query: candidate };
    }
  }

  const profession = extractVoiceProfession(text);
  const location = extractVoiceLocation(text);
  const verifiedOnly = /verified|सत्यापित|certified/i.test(lower);

  // 8. Jobs / Work / Opportunities
  if (/job|jobs|work|kaam|काम|naukri|naukr|नौकरी|नौकरिया|नौकरियां|vacancy|vacanc|opportunity|opportunities|seasonal/i.test(lower)) {
    const jobType = /seasonal|मौसमी/i.test(lower)
      ? "seasonal"
      : /contract|ठेका/i.test(lower)
      ? "contract"
      : undefined;

    return {
      type: "SEARCH_JOBS",
      profession,
      location,
      jobType,
      query: text,
    };
  }

  // 9. Search Professionals / Find Tradesmen
  if (profession || /chahiye|चाहिए|dhundh|ढूंढ|search|khojo|खोजो|looking for|need|bulao|बुलाओ|find/i.test(lower)) {
    return {
      type: "SEARCH_PROFESSIONALS",
      profession,
      location,
      verifiedOnly: verifiedOnly ? true : undefined,
      query: text,
    };
  }

  // 10. General text search fallback if valid query words exist
  if (text.length >= 3) {
    return {
      type: "SEARCH_GENERAL",
      query: text,
    };
  }

  return { type: "UNKNOWN", transcript: text };
}

