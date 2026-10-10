/**
 * KaamSetu Assistant — provider-agnostic assistant layer.
 *
 *   controller → answer() → AIProvider.respond()
 *                              ├─ RuleBasedProvider   (default: offline, deterministic, Hindi/English/Hinglish)
 *                              └─ OpenAICompatibleProvider (any OpenAI-style /chat/completions endpoint)
 *
 * Whatever the provider says, ROUTING (module links, expert escalation) always comes from the
 * shared intent router, so the assistant behaves the same with or without an LLM.
 * Safety rules are enforced in the system prompt AND by post-processing (disclaimers are appended server-side).
 */
import type { AIAction, AIMessage, Db, Language, User } from "@/types/domain";
import { detectIntent, type IntentMatch } from "@/lib/intents";
import { formatNumber } from "@/lib/utils";
import { EMERGENCY_CONTACTS } from "@/lib/constants";
import { newId } from "../crypto";
import { env } from "../env";
import { eventStatus } from "../mappers";

export interface AIInput {
  message: string;
  language: Language;
  user: User;
  d: Db;
}
export interface AIOutput {
  content: string;
  actions: AIAction[];
  followUps: string[];
}
export interface AIProvider {
  readonly name: string;
  respond(input: AIInput, intent: IntentMatch): Promise<AIOutput>;
}

const isHindi = (s: string) => /[ऀ-ॿ]/.test(s);
const pick = (hi: boolean, en: string, hiText: string) => (hi ? hiText : en);

export const AI_DISCLAIMER_EN = "This is general educational guidance, not a definitive diagnosis. For a field-specific answer, ask a verified expert.";
export const AI_DISCLAIMER_HI = "यह सामान्य शैक्षणिक जानकारी है, पक्का निदान नहीं। खेत के अनुसार सटीक सलाह के लिए किसी सत्यापित विशेषज्ञ से पूछें।";
const MEDICAL_EN = "I am not a doctor. For any serious symptom or injury, get professional medical care immediately.";
const MEDICAL_HI = "मैं डॉक्टर नहीं हूँ। किसी भी गंभीर लक्षण या चोट में तुरंत डॉक्टर/अस्पताल से मिलें।";

/** What the assistant knows about the signed-in user: profession, skills, experience, location, services, availability. */
export function userContext(d: Db, user: User) {
  const crops = Array.from(new Set(d.crops.filter((c) => c.ownerId === user.id).map((c) => c.name)));
  const pro = d.professionalProfiles.find((p) => p.userId === user.id);
  const prof = pro && d.professions.find((x) => x.id === pro.professionId);
  const district = pro?.location.district || d.farmerProfiles.find((p) => p.userId === user.id)?.district || d.buyerProfiles.find((p) => p.userId === user.id)?.district;
  return {
    crops,
    district,
    profession: prof ? (pro?.customProfession && prof.id === "pr_other" ? pro.customProfession : prof.name) : undefined,
    farmModules: !!prof?.farmModules,
    skills: pro?.skills.map((s) => s.name) ?? [],
    experienceYears: pro ? Math.max(0, new Date().getFullYear() - pro.startedYear) : undefined,
    services: d.services.filter((s) => s.ownerId === user.id && s.active && !s.hidden).map((s) => s.name),
    availability: pro?.availability.status,
  };
}

export const ruleBasedProvider: AIProvider = {
  name: "rules",
  async respond({ message, d, user }, intent) {
    const hi = isHindi(message);
    const { crops, district, profession, skills, experienceYears, services, availability, farmModules } = userContext(d, user);
    const crop = intent.crop;
    const actions: AIAction[] = [{ label: pick(hi, `Open ${intent.label}`, `${intent.label} खोलें`), href: intent.href }];
    let content = "";
    let followUps: string[] = [];

    switch (intent.id) {
      case "CROP_PROBLEM": {
        const cropName = crop ?? crops[0];
        content = pick(
          hi,
          `Let's look at this step by step${cropName ? ` for your ${cropName}` : ""}. Leaf yellowing or pest damage can have several causes — standing water, low nitrogen or sulphur, cold nights, early aphids or disease. Please check: (1) crop age, (2) whether older or younger leaves are affected, (3) the last irrigation and fertiliser date, (4) any insects under leaves or at tips. Avoid spraying until the cause is clear. ${AI_DISCLAIMER_EN}`,
          `चलिए इसे एक-एक करके देखते हैं${cropName ? ` (${cropName})` : ""}। पत्तियों का पीला होना या कीट-नुकसान कई कारणों से हो सकता है — पानी भराव, नाइट्रोजन/सल्फर की कमी, ठंडी रातें, शुरुआती माहू या रोग। कृपया देखें: (1) फसल की उम्र, (2) पुरानी या नई पत्तियाँ प्रभावित हैं, (3) आख़िरी सिंचाई/खाद की तारीख़, (4) पत्तियों के नीचे या सिरों पर कीट। कारण साफ़ होने तक दवा का छिड़काव न करें। ${AI_DISCLAIMER_HI}`,
        );
        followUps = [
          pick(hi, "How many days old is the crop?", "फसल कितने दिन की है?"),
          pick(hi, "Are older or younger leaves yellow?", "पुरानी पत्तियाँ पीली हैं या नई?"),
          pick(hi, "When was the last irrigation?", "आख़िरी सिंचाई कब की थी?"),
        ];
        actions.push({ label: pick(hi, "Ask a verified expert", "विशेषज्ञ से पूछें"), href: `/experts?tab=questions&ask=1${cropName ? `&crop=${cropName}` : ""}` });
        if (cropName) actions.push({ label: pick(hi, `${cropName} pest management course`, `${cropName} कीट प्रबंधन कोर्स`), href: `/learning?category=${cropName}` });
        break;
      }
      case "WEATHER":
        content = pick(
          hi,
          `Live weather data is not connected in this version, so I cannot give a forecast${district ? ` for ${district}` : ""}. Official weather alerts posted on KaamSetu appear in your notifications. For forecasts please check your local meteorological service.`,
          `इस संस्करण में लाइव मौसम डेटा जुड़ा नहीं है, इसलिए${district ? ` ${district} के लिए` : ""} पूर्वानुमान नहीं दे सकता। KaamSetu पर आए आधिकारिक मौसम अलर्ट आपकी सूचनाओं में दिखेंगे। पूर्वानुमान के लिए स्थानीय मौसम विभाग देखें।`,
        );
        followUps = [pick(hi, "Show weather alerts", "मौसम अलर्ट दिखाओ")];
        break;
      case "MY_CROPS": {
        const mine = d.crops.filter((c) => c.ownerId === user.id);
        content = mine.length
          ? pick(hi, `You have ${mine.length} crop${mine.length > 1 ? "s" : ""} recorded: ${mine.map((c) => `${c.name} (${c.status.toLowerCase()})`).join(", ")}.`, `आपकी ${mine.length} फसलें दर्ज हैं: ${mine.map((c) => `${c.name} (${c.status.toLowerCase()})`).join(", ")}।`)
          : pick(hi, "You have not added any crops yet. Add one to start your farming profile.", "आपने अभी कोई फसल नहीं जोड़ी है। अपनी खेती प्रोफ़ाइल शुरू करने के लिए फसल जोड़ें।");
        actions.push({ label: pick(hi, "Add a crop", "फसल जोड़ें"), href: "/create?type=crop" });
        break;
      }
      case "SELL_PRODUCE": {
        const q = intent.quantity;
        content = pick(
          hi,
          `I can help you list ${q ? `${formatNumber(q.value)} ${q.unit.toLowerCase()} of ` : ""}${crop ?? "your produce"}. I have pre-filled what I understood — please check the price, grade and harvest date before publishing. Your phone number stays private; buyers contact you through KaamSetu messages.`,
          `मैं ${crop ?? "आपकी उपज"}${q ? ` (${formatNumber(q.value)} ${q.unit === "QUINTAL" ? "क्विंटल" : q.unit === "KG" ? "किलो" : "टन"})` : ""} की लिस्टिंग बनाने में मदद कर सकता हूँ। मैंने जो समझा वह भर दिया है — प्रकाशित करने से पहले भाव, ग्रेड और कटाई की तारीख़ जाँच लें। आपका फ़ोन नंबर निजी रहता है; खरीदार KaamSetu संदेश से संपर्क करेंगे।`,
        );
        followUps = [pick(hi, "What price should I expect?", "भाव क्या रखूँ?")];
        break;
      }
      case "FIND_BUYER": {
        const open = d.requirements.filter((r) => r.status === "OPEN" && !r.hidden && (!crop || r.crop.toLowerCase() === crop.toLowerCase())).length;
        content = pick(
          hi,
          `${open} open buyer requirement${open === 1 ? "" : "s"}${crop ? ` for ${crop}` : ""} on KaamSetu right now. Open them to see how well your produce matches. Never share OTP, bank or UPI details with a buyer — genuine buyers pay after quality check.`,
          `अभी KaamSetu पर${crop ? ` ${crop} के लिए` : ""} ${open} खरीदार आवश्यकताएँ खुली हैं। अपनी उपज का मिलान देखने के लिए खोलें। किसी खरीदार को OTP, बैंक या UPI जानकारी कभी न दें — असली खरीदार माल की जाँच के बाद भुगतान करते हैं।`,
        );
        actions.push({ label: pick(hi, "List my produce", "अपनी उपज लिस्ट करें"), href: "/create?type=produce" });
        break;
      }
      case "EVENTS": {
        const upcoming = d.events
          .filter((e) => !e.hidden && eventStatus(e) !== "ENDED")
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .slice(0, 3);
        content = upcoming.length
          ? pick(hi, `Upcoming events: ${upcoming.map((e) => e.name).join("; ")}.`, `आगामी कार्यक्रम: ${upcoming.map((e) => e.name).join("; ")}।`)
          : pick(hi, "There are no upcoming events listed right now.", "अभी कोई आगामी कार्यक्रम सूचीबद्ध नहीं है।");
        break;
      }
      case "SCHEMES":
        content = pick(
          hi,
          "Scheme pages list eligibility, documents and the official source link. Entries marked DEMO are placeholders — always confirm details on the official source before applying.",
          "योजना पेज पर पात्रता, दस्तावेज़ और आधिकारिक स्रोत का लिंक होता है। DEMO चिह्नित प्रविष्टियाँ नमूना हैं — आवेदन से पहले आधिकारिक स्रोत पर जानकारी ज़रूर जाँचें।",
        );
        break;
      case "LEARN":
        content = pick(
          hi,
          `Here are learning courses${crop ? ` for ${crop}` : ""}. Each has lessons, a short quiz and a completion certificate. ${AI_DISCLAIMER_EN}`,
          `यहाँ${crop ? ` ${crop} के` : ""} सीखने के कोर्स हैं। हर कोर्स में पाठ, छोटी क्विज़ और पूर्णता प्रमाणपत्र है। ${AI_DISCLAIMER_HI}`,
        );
        followUps = [pick(hi, "What should I check before sowing?", "बुवाई से पहले क्या देखें?")];
        break;
      case "HEALTH": {
        const urgent = /snake|साँप|सांप|emergency|ambulance|chot|चोट|injur/i.test(message);
        content = urgent
          ? pick(
              hi,
              `If this is an emergency, call ${EMERGENCY_CONTACTS[0]!.number} or ${EMERGENCY_CONTACTS[1]!.number} NOW and go to the nearest hospital. For snake-bite: keep the person calm and still, do NOT cut, suck or tie tightly, and travel to hospital immediately. ${MEDICAL_EN}`,
              `अगर यह आपातकाल है तो अभी ${EMERGENCY_CONTACTS[0]!.number} या ${EMERGENCY_CONTACTS[1]!.number} पर कॉल करें और नज़दीकी अस्पताल जाएँ। साँप के काटने पर: व्यक्ति को शांत और स्थिर रखें, घाव को काटें/चूसें नहीं, कसकर न बाँधें, तुरंत अस्पताल पहुँचें। ${MEDICAL_HI}`,
            )
          : pick(hi, `Open Kisan Health & Safety for heat, pesticide, first-aid and mental-health guidance. ${MEDICAL_EN}`, `गर्मी, कीटनाशक, प्राथमिक उपचार और मानसिक स्वास्थ्य की जानकारी के लिए किसान स्वास्थ्य खोलें। ${MEDICAL_HI}`);
        break;
      }
      case "MACHINERY":
        content = pick(hi, "Find tractors, harvesters and other equipment listed by farmers near you.", "अपने पास के किसानों द्वारा लिस्ट किए ट्रैक्टर, हार्वेस्टर और अन्य मशीनें देखें।");
        break;
      case "FARM_RECORD":
        content = pick(hi, "Your farm records are private by default. Open Farm Management to add expenses, harvest and see cost per quintal and profit per acre.", "आपके खेती रिकॉर्ड डिफ़ॉल्ट रूप से निजी हैं। खर्च, उपज और प्रति क्विंटल लागत/प्रति एकड़ मुनाफ़ा देखने के लिए खेती प्रबंधन खोलें।");
        break;
      case "OPPORTUNITIES":
        content = pick(hi, "Your Opportunity Center collects buyer requirements, schemes, trainings, equipment and events that fit your profile.", "आपका अवसर केंद्र आपकी प्रोफ़ाइल से मेल खाती खरीदार माँग, योजनाएँ, प्रशिक्षण, मशीनें और कार्यक्रम एक जगह दिखाता है।");
        break;
      case "FIND_PROFESSIONAL": {
        const who = intent.profession ?? "professional";
        content = pick(
          hi,
          `I will open Find Professionals for "${who}"${district ? ` — results near ${district} are ranked first when you share a place` : ""}. Check their verified skills, recommendations and completed jobs, then send a service request. Agree the rate and date in Messages. KaamSetu does not handle payments.`,
          `मैं "${who}" के लिए प्रोफ़ेशनल खोज खोल रहा हूँ${district ? ` — जगह बताने पर ${district} के पास वाले पहले दिखेंगे` : ""}। उनके सत्यापित हुनर, सिफ़ारिशें और पूरे किए काम देखें, फिर सेवा अनुरोध भेजें। भाव और तारीख़ संदेश में तय करें। KaamSetu भुगतान नहीं संभालता।`,
        );
        followUps = [pick(hi, "Show only verified professionals", "सिर्फ़ सत्यापित प्रोफ़ेशनल दिखाओ"), pick(hi, "Who is available this week?", "इस हफ़्ते कौन उपलब्ध है?")];
        break;
      }
      case "FIND_WORK": {
        const mine = skills.length ? ` I can match using your skills (${skills.slice(0, 4).join(", ")})${experienceYears ? ` and ${experienceYears} years of experience` : ""}.` : " Add your skills to your profile so I can match better.";
        content = pick(
          hi,
          `Opening work opportunities${profession ? ` for a ${profession}` : ""}${district ? ` near ${district}` : ""}.${mine} Each card says why it matched. Never pay anyone to get a job, and never share OTP, bank or UPI details.`,
          `${profession ? `${profession} के लिए ` : ""}काम के अवसर${district ? ` (${district} के पास)` : ""} खोल रहा हूँ।${skills.length ? ` आपके हुनर (${skills.slice(0, 4).join(", ")}) के हिसाब से मिलान होगा।` : " बेहतर मिलान के लिए प्रोफ़ाइल में हुनर जोड़ें।"} हर कार्ड बताता है कि वह क्यों मिला। नौकरी के लिए किसी को पैसे न दें, और OTP/बैंक/UPI जानकारी कभी साझा न करें।`,
        );
        followUps = [pick(hi, "Show daily-wage work", "दिहाड़ी का काम दिखाओ"), pick(hi, "Show training and apprenticeships", "प्रशिक्षण और अप्रेंटिसशिप दिखाओ")];
        actions.push({ label: pick(hi, "Update my availability", "मेरी उपलब्धता अपडेट करें"), href: "/profile/edit" });
        break;
      }
      case "POST_WORK":
        content = pick(
          hi,
          "I will open the Post an Opportunity form. Add the title, the profession and skills you need, how many people, the place and date, and the pay or budget. Applicants message you in the app; your phone number is shared only if you choose phone contact and accept that person.",
          "मैं अवसर पोस्ट करने का फ़ॉर्म खोल रहा हूँ। शीर्षक, ज़रूरी पेशा और हुनर, कितने लोग, जगह और तारीख़, और मज़दूरी/बजट भरें। आवेदक ऐप में संदेश भेजेंगे; आपका फ़ोन नंबर तभी साझा होगा जब आप फ़ोन संपर्क चुनें और उस व्यक्ति को स्वीकार करें।",
        );
        break;
      case "CREATE_PROFILE":
        content = pick(
          hi,
          "Creating a professional profile takes a few simple steps: your profession, experience, skills, services, location, availability, portfolio and who can see it. You choose what is public — your exact address is never shown.",
          "प्रोफ़ेशनल प्रोफ़ाइल बनाना आसान है: आपका पेशा, अनुभव, हुनर, सेवाएँ, जगह, उपलब्धता, पोर्टफ़ोलियो और कौन देख सकता है। क्या सार्वजनिक हो यह आप चुनते हैं — आपका सही पता कभी नहीं दिखता।",
        );
        break;
      case "ADD_SERVICE":
        content = services.length
          ? pick(hi, `You already offer ${services.length} service${services.length > 1 ? "s" : ""} (${services.slice(0, 3).join(", ")}). You can add another with a clear price type and the areas you cover.`, `आप पहले से ${services.length} सेवा${services.length > 1 ? "एँ" : ""} देते हैं (${services.slice(0, 3).join(", ")})। साफ़ भाव-प्रकार और कवर किए इलाकों के साथ और सेवा जोड़ सकते हैं।`)
          : pick(hi, "Add a service so people can send you requests: name it, say what is included, the price type and the areas you cover.", "सेवा जोड़ें ताकि लोग आपको अनुरोध भेज सकें: नाम दें, क्या शामिल है, भाव-प्रकार और कवर किए इलाके बताएँ।");
        break;
      default: {
        const proLine = profession && !farmModules;
        content = proLine
          ? pick(
              hi,
              `I can help you find work, find professionals, set up your ${profession} profile and services, and look up training and programmes${district ? ` near ${district}` : ""}${availability ? `. You are currently marked "${availability.toLowerCase().replace("_", " ")}"` : ""}. Try one of the suggestions below.`,
              `मैं काम ढूँढने, प्रोफ़ेशनल खोजने, आपकी ${profession} प्रोफ़ाइल और सेवाएँ बनाने, और${district ? ` ${district} के पास` : ""} प्रशिक्षण व कार्यक्रम खोजने में मदद कर सकता हूँ। नीचे दिए सुझाव आज़माएँ।`,
            )
          : pick(
              hi,
              `I can help with crop questions, buyers, schemes, events, learning, health and your farm records${crops.length ? `. I see you grow ${crops.join(", ")}` : ""}. You can also ask me to find an electrician, carpenter or other professional, or to find work. Try one of the suggestions below.`,
              `मैं फसल के सवाल, खरीदार, योजनाएँ, कार्यक्रम, सीखने की सामग्री, स्वास्थ्य और आपके खेती रिकॉर्ड में मदद कर सकता हूँ${crops.length ? `। आप ${crops.join(", ")} उगाते हैं` : ""}। आप मुझसे इलेक्ट्रीशियन, कारपेंटर जैसे प्रोफ़ेशनल या काम ढूँढने को भी कह सकते हैं। नीचे दिए सुझाव आज़माएँ।`,
            );
        followUps = proLine
          ? [pick(hi, "Kaam chahiye near me", "मेरे पास काम चाहिए"), pick(hi, "Add my service", "मेरी सेवा जोड़ो"), pick(hi, "Which skill camps are coming?", "कौनसे स्किल कैंप आ रहे हैं?")]
          : [
              pick(hi, "My mustard leaves are turning yellow", "मेरी सरसों की पत्तियां पीली हो रही हैं"),
              pick(hi, "Which events are near me?", "मेरे इलाके में कौनसे कार्यक्रम हैं?"),
              pick(hi, "I need a buyer for my crop", "मुझे अपनी फसल के लिए buyer चाहिए"),
            ];
        actions.length = 0;
      }
    }
    return { content, actions, followUps };
  },
};

const SYSTEM_PROMPT = `You are the KaamSetu Assistant, the assistant inside KaamSetu — a professional network for skilled, independent and local professionals in India (Rajasthan focus): farmers, electricians, carpenters, drivers, tailors, mechanics, artisans, farm workers and more.
Reply in the user's language (Hindi, English or Hinglish), in short, simple sentences.
Rules: you give general educational guidance only (agriculture and trade skills). Never give a definitive crop disease diagnosis; ask follow-up questions and recommend a verified expert for field-specific advice. You are not a doctor: for health emergencies tell the user to call 112/108 and seek professional care. Never ask for OTP, bank, UPI or Aadhaar details. Never invent government schemes, eligibility, wages, prices, ratings, reviews or dates — say you do not know and point to the official source. KaamSetu does not process payments; never claim a payment, verification or application succeeded unless the app shows it. For trade work (electrical, construction, vehicles) always remind the user to follow safety rules and use licensed professionals where required.`;

export const openAICompatibleProvider: AIProvider = {
  name: "openai-compatible",
  async respond(input, intent) {
    const e = env();
    const fallback = () => ruleBasedProvider.respond(input, intent);
    if (!e.AI_BASE_URL || !e.AI_API_KEY || !e.AI_MODEL) return fallback();
    try {
      const res = await fetch(`${e.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${e.AI_API_KEY}` },
        body: JSON.stringify({
          model: e.AI_MODEL,
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: input.message },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return fallback();
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) return fallback();
      const base = await ruleBasedProvider.respond(input, intent); // routing + follow-ups stay deterministic
      const hi = isHindi(input.message);
      const disclaimer = intent.id === "CROP_PROBLEM" ? ` ${hi ? AI_DISCLAIMER_HI : AI_DISCLAIMER_EN}` : intent.id === "HEALTH" ? ` ${hi ? MEDICAL_HI : MEDICAL_EN}` : "";
      return { content: text + disclaimer, actions: base.actions, followUps: base.followUps };
    } catch {
      return fallback();
    }
  },
};

export const getProvider = (): AIProvider => (env().AI_PROVIDER === "openai-compatible" ? openAICompatibleProvider : ruleBasedProvider);

/** Persist a user message, ask the provider, persist and return the reply. */
export async function answer(d: Db, user: User, message: string, conversationId?: string): Promise<{ conversationId: string; reply: AIMessage }> {
  let convo = conversationId ? d.aiConversations.find((c) => c.id === conversationId && c.userId === user.id) : undefined;
  convo ??= d.aiConversations.filter((c) => c.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!convo) {
    convo = { id: newId("aic"), userId: user.id, createdAt: new Date().toISOString(), isDemo: false };
    d.aiConversations.push(convo);
  }
  const now = new Date().toISOString();
  d.aiMessages.push({ id: newId("aim"), conversationId: convo.id, role: "USER", content: message, actions: [], followUps: [], createdAt: now, isDemo: false });
  const intent = detectIntent(message);
  const out = await getProvider().respond({ message, language: user.language, user, d }, intent);
  const reply: AIMessage = { id: newId("aim"), conversationId: convo.id, role: "ASSISTANT", content: out.content, actions: out.actions, followUps: out.followUps, createdAt: new Date().toISOString(), isDemo: false };
  d.aiMessages.push(reply);
  return { conversationId: convo.id, reply };
}
