/**
 * Language-aware intent detection shared by the voice buttons and the AI assistant.
 * Handles Hindi (Devanagari), English and Hinglish (Roman Hindi). Deterministic and offline,
 * so voice navigation works on weak networks. Regional languages = add alias rows.
 */

import { findPlaceInText } from "@/lib/geo";

export type IntentId =
  | "WEATHER"
  | "MY_CROPS"
  | "SELL_PRODUCE"
  | "FIND_BUYER"
  | "CROP_PROBLEM"
  | "EVENTS"
  | "SCHEMES"
  | "LEARN"
  | "HEALTH"
  | "MACHINERY"
  | "FARM_RECORD"
  | "EXPERT"
  | "COMMUNITY"
  | "MARKET"
  | "ADD_CROP"
  | "ADD_FARM"
  | "CREATE_POST"
  | "OPPORTUNITIES"
  | "FIND_PROFESSIONAL"
  | "FIND_WORK"
  | "POST_WORK"
  | "CREATE_PROFILE"
  | "ADD_SERVICE"
  | "MY_WORK"
  | "FALLBACK";

export interface IntentMatch {
  id: IntentId;
  href: string;
  label: string;
  crop?: string;
  /** Canonical profession word found in the text (e.g. "Electrician"), for professional/work intents. */
  profession?: string;
  quantity?: { value: number; unit: "QUINTAL" | "KG" | "TONNE" };
  confidence: number;
}

/** Hindi / Hinglish / English words people use for trades and professions → canonical search word. */
export const PROFESSION_ALIASES: [RegExp, string][] = [
  [/बिजली|bijli|electrician|wireman|इलेक्ट्रीशियन/i, "Electrician"],
  [/बढ़ई|बढई|badhai|carpenter|कारपेंटर|लकड़ी का काम|furniture/i, "Carpenter"],
  [/प्लंबर|नलसाज़?|plumber|nal wala/i, "Plumber"],
  [/राजमिस्त्री|raj ?mistri|mason|चिनाई/i, "Mason"],
  [/ड्राइवर|चालक|driver|chalak/i, "Driver"],
  [/दर्ज़ी|दर्जी|darzi|tailor|सिलाई|silai/i, "Tailor"],
  [/मैकेनिक|mechanic|mistri|मिस्त्री/i, "Mechanic"],
  [/पेंटर|रंगाई|painter|rang ?rez/i, "Painter"],
  [/कुम्हार|kumhar|potter|pottery/i, "Potter"],
  [/बुनकर|bunkar|weaver/i, "Weaver"],
  [/ट्यूटर|tutor|शिक्षक|teacher|tuition/i, "Tutor"],
  [/mobile (repair|technician)|मोबाइल (रिपेयर|मिस्त्री)|computer (repair|technician)/i, "Mobile technician"],
  [/मज़दूर|मजदूर|majdoor|mazdoor|labou?r(er)?|farm worker|खेत मज़दूर/i, "Farm worker"],
  [/ट्रैक्टर (चालक|ड्राइवर|operator)|tractor operator/i, "Tractor operator"],
];

export function extractProfession(text: string): string | undefined {
  return PROFESSION_ALIASES.find(([re]) => re.test(text))?.[1];
}

const NEED = "need|want|chahiye|चाहिए|find|near|paas|पास|dhundh|ढूं?ढ|book|bulao|बुला|looking for|available|ko bula|hire an?|someone";
const both = (a: string, b: string) => new RegExp(`(?=.*(?:${a}))(?=.*(?:${b}))`, "i");
const PROF_RE_SRC = PROFESSION_ALIASES.map(([re]) => re.source).join("|");

export const CROP_ALIASES: [RegExp, string][] = [
  [/सरसों|सरसो|sarson|sarso|mustard|rapeseed/i, "Mustard"],
  [/गेहूं|गेहूँ|गेहु|gehu|gehun|wheat/i, "Wheat"],
  [/बाजरा|bajra|pearl millet|millet/i, "Bajra"],
  [/चना|chana|chickpea|\bgram\b/i, "Chickpea"],
  [/मूंग|moong|mung/i, "Moong"],
  [/ग्वार|guar/i, "Guar"],
  [/जीरा|jeera|cumin/i, "Cumin"],
  [/टमाटर|tamatar|tomato/i, "Tomato"],
  [/प्याज|pyaz|onion/i, "Onion"],
  [/कपास|kapas|cotton/i, "Cotton"],
  [/जौ|\bjau\b|barley/i, "Barley"],
  [/मूंगफली|moongfali|groundnut|peanut/i, "Groundnut"],
  [/दूध|doodh|milk|dairy|डेयरी/i, "Milk"],
];

export function extractCrop(text: string): string | undefined {
  return CROP_ALIASES.find(([re]) => re.test(text))?.[1];
}

export function extractQuantity(text: string): IntentMatch["quantity"] {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(क्विंटल|quintal|qtl|kg|किलो|kilo|टन|ton|tonne)/i);
  if (!m) return undefined;
  const value = Number(m[1]!.replace(",", "."));
  const u = m[2]!.toLowerCase();
  const unit = /kg|किलो|kilo/.test(u) ? "KG" : /टन|ton/.test(u) ? "TONNE" : "QUINTAL";
  return { value, unit };
}

interface Rule {
  id: IntentId;
  label: string;
  href: string;
  test: RegExp;
  weight: number;
}

const RULES: Rule[] = [
  { id: "WEATHER", label: "Weather alerts", href: "/notifications?type=WEATHER", weight: 2, test: /मौसम|बारिश|आंधी|तापमान|weather|mausam|baarish|barish|\brain(s|fall)?\b|temperature|forecast/i },
  { id: "MY_CROPS", label: "My crops", href: "/crops", weight: 3, test: /मेरी फसल|मेरी फ़सल|कौनसी फसल|meri fasal|my crops?|which crop|current crop|crops? i grow/i },
  { id: "SELL_PRODUCE", label: "List produce", href: "/create?type=produce", weight: 4, test: /मेरे पास.*(क्विंटल|किलो|टन|quintal|qtl|kg)|(i have|mere paas).*(quintal|qtl|kg|क्विंटल)|list (my )?produce|sell my|बेचना है|bechna hai/i },
  { id: "FIND_BUYER", label: "Find buyers", href: "/market?tab=requirements", weight: 4, test: /buyer|खरीदार|ख़रीदार|फसल बेच|बेचने|kharidar|bechne|sell.*crop|find (a )?buyer|मंडी|खरीदने वाला/i },
  { id: "CROP_PROBLEM", label: "Ask an expert", href: "/experts?tab=questions&ask=1", weight: 5, test: /पीली|पीले|पीला|कीड़े|कीट|रोग|बीमारी|सूख|मुरझा|धब्बे|इल्ली|yellow|\bpests?\b|disease|insect|aphid|fung|\bwilt|\bspots?\b|blight|infest|keede|peele|bimari|\brog\b/i },
  { id: "EVENTS", label: "Events", href: "/events", weight: 3, test: /कार्यक्रम|इवेंट|मेला|प्रशिक्षण|कैंप|event|mela|workshop|training|\bcamp\b|expo/i },
  { id: "SCHEMES", label: "Government schemes", href: "/schemes", weight: 3, test: /योजना|सब्सिडी|अनुदान|सरकारी|बीमा|yojana|scheme|subsidy|government|insurance|loan|ऋण|programmes?\b|programs?\b/i },
  { id: "LEARN", label: "Learning Hub", href: "/learning", weight: 2, test: /सीख|ध्यान रखना|कैसे करें|खेती की|course|learn|how to|guide|tips|सलाह|dhyan|kaise/i },
  { id: "HEALTH", label: "Health & safety", href: "/health", weight: 4, test: /साँप|सांप|snake|चोट|first aid|गर्मी|heat stroke|स्वास्थ्य|dawai|दवा छिड़|pesticide safety|sehat|health|injur|ambulance|emergency/i },
  { id: "MACHINERY", label: "Machinery", href: "/machinery", weight: 3, test: /ट्रैक्टर|हार्वेस्टर|मशीन|tractor|harvester|machinery|rotavator|sprayer|thresher|किराये|rent/i },
  { id: "FARM_RECORD", label: "Farm records", href: "/farms", weight: 3, test: /खर्च|खर्चा|हिसाब|मुनाफा|मुनाफ़ा|profit|expense|cost|kharcha|hisab|record|ledger/i },
  { id: "EXPERT", label: "Experts", href: "/experts", weight: 2, test: /expert|विशेषज्ञ|वैज्ञानिक|सवाल|question|पूछ|ask an?/i },
  { id: "COMMUNITY", label: "Communities", href: "/communities", weight: 2, test: /समूह|कम्युनिटी|community|group/i },
  { id: "MARKET", label: "Marketplace", href: "/market", weight: 2, test: /भाव|दाम|price|\brates?\b|market|bazaar|mandi/i },
  { id: "ADD_CROP", label: "Add crop", href: "/create?type=crop", weight: 5, test: /फसल जोड़|फसल जोड़ें|add (a )?crop|new crop/i },
  { id: "ADD_FARM", label: "Add farm", href: "/create?type=farm", weight: 5, test: /खेत जोड़|खेत जोड़ें|add (a )?farm|new farm/i },
  { id: "CREATE_POST", label: "Create post", href: "/create?type=post", weight: 4, test: /पोस्ट|post|share update|अपडेट डाल/i },
  { id: "OPPORTUNITIES", label: "Opportunities", href: "/opportunities", weight: 3, test: /अवसर|मौका|opportunit|for me|मेरे लिए/i },
  // KaamSetu — universal professionals
  { id: "FIND_PROFESSIONAL", label: "Find professionals", href: "/professionals", weight: 5, test: both(PROF_RE_SRC, NEED) },
  { id: "FIND_WORK", label: "Find work", href: "/opportunities?tab=work", weight: 5, test: /काम चाहिए|काम ढूं?ढ|kaam chahiye|kaam dhundh|kaam dhoondh|naukri|नौकरी|रोज़गार|रोजगार|rozgar|dihadi|दिहाड़ी|\bjobs?\b|find work|looking for work|work near/i },
  { id: "POST_WORK", label: "Post an opportunity", href: "/create?type=opportunity", weight: 6, test: /(काम|kaam) (है|hai|देना|dena)|need (workers|labou?rers|helpers?)|(workers?|labou?r|helpers?|majdoor|मज़दूर|मजदूर|हेल्पर|आदमी) (chahiye|चाहिए)|post (a |an )?(job|opportunity|work)|hiring/i },
  { id: "CREATE_PROFILE", label: "Create professional profile", href: "/profile/edit", weight: 6, test: /(create|make|banao|banana|बनाओ|बनाना|बनाएं|बनाएँ|setup|set up).*(profile|प्रोफ़ाइल|प्रोफाइल)|(profile|प्रोफ़ाइल|प्रोफाइल).*(banao|banana|बनाओ|बनाना|बनाएं|बनाएँ|create|make)/i },
  { id: "ADD_SERVICE", label: "Add a service", href: "/create?type=service", weight: 6, test: /(add|list|start|offer|jodo|जोड़|shuru).*(service|सेवा)|meri service|मेरी सेवा/i },
  { id: "FIND_PROFESSIONAL", label: "Find professionals", href: "/professionals", weight: 5, test: /(find|search|show|dhoondh|dhundh|खोज|ढूं?ढ)\w*.*(professionals?|workers?|kaarigar|karigar|कारीगर|skilled people)|professionals? (near|nearby)/i },
  { id: "LEARN", label: "Learning Hub", href: "/learning", weight: 4, test: /^(?!.*(scheme|yojana|योजना|government|sarkari|सरकारी|subsidy)).*(skill (training|development|course)|learn (a |new )?skill|hunar seekh|हुनर सीख)/i },
  { id: "MY_WORK", label: "My work", href: "/my-work", weight: 5, test: /my (service )?(requests?|applications?|work|jobs?)|मेरे (काम|अनुरोध|आवेदन)|mere (requests?|kaam|applications?)/i },
];

/** Pick the highest-weight matching rule; extras (crop / quantity) enrich the destination. */
export function detectIntent(text: string): IntentMatch {
  const crop = extractCrop(text);
  const quantity = extractQuantity(text);
  const profession = extractProfession(text);
  const hits = RULES.filter((r) => r.test.test(text)).sort((a, b) => b.weight - a.weight);
  const top = hits[0];

  if (!top) {
    return { id: "FALLBACK", href: "/ai-assistant", label: "Ask the assistant", crop, profession, quantity, confidence: 0 };
  }

  let href = top.href;
  if (top.id === "SELL_PRODUCE") {
    const p = new URLSearchParams({ type: "produce" });
    if (crop) p.set("crop", crop);
    if (quantity) {
      p.set("quantity", String(quantity.value));
      p.set("unit", quantity.unit);
    }
    href = `/create?${p.toString()}`;
  } else if (top.id === "FIND_BUYER" && crop) {
    href = `/market?tab=requirements&crop=${encodeURIComponent(crop)}`;
  } else if (top.id === "LEARN" && crop) {
    href = `/learning?category=${encodeURIComponent(crop)}`;
  } else if (top.id === "MARKET" && crop) {
    href = `/market?crop=${encodeURIComponent(crop)}`;
  } else if (top.id === "CROP_PROBLEM" && crop) {
    href = `/experts?tab=questions&ask=1&crop=${encodeURIComponent(crop)}`;
  } else if (top.id === "FIND_PROFESSIONAL") {
    const place = findPlaceInText(text);
    const q = [profession, place ? `near ${place}` : ""].filter(Boolean).join(" ");
    href = q ? `/professionals?q=${encodeURIComponent(q)}` : "/professionals";
  } else if (top.id === "FIND_WORK" && profession) {
    href = `/opportunities?tab=work&q=${encodeURIComponent(profession)}`;
  } else if (top.id === "POST_WORK" && profession) {
    href = `/create?type=opportunity&profession=${encodeURIComponent(profession)}`;
  }

  return { id: top.id, href, label: top.label, crop, profession, quantity, confidence: Math.min(1, 0.4 + top.weight * 0.12 + hits.length * 0.05) };
}

export type VoiceLocale = "hi-IN" | "en-IN";
export const localeFor = (lang: "en" | "hi" | "hinglish"): VoiceLocale => (lang === "en" ? "en-IN" : "hi-IN");
