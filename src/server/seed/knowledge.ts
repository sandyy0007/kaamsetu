import type {
  Conversation,
  Course,
  CourseModule,
  CourseProgress,
  ExpertAnswer,
  ExpertQuestion,
  HealthResource,
  Message,
  Notification,
  NotificationType,
  QuizQuestion,
  Report,
  SceneKind,
  VerificationRequest,
} from "@/types/domain";
import { iso } from "./helpers";

// ───────────── Courses ─────────────
const courses: Course[] = [];
const modules: CourseModule[] = [];

function course(id: string, title: string, category: string, level: Course["level"], scene: SceneKind, authorId: string, description: string, outcomes: string[]) {
  courses.push({ id, title, category, level, scene, authorId, description, outcomes, hidden: false, createdAt: iso(-90), isDemo: true });
}
function mod(courseId: string, order: number, title: string, kind: CourseModule["kind"], durationMin: number, body: string, quiz?: QuizQuestion[]) {
  modules.push({ id: `${courseId}_m${order}`, courseId, order, title, kind, durationMin, body, quiz, isDemo: true });
}
const q = (id: string, question: string, options: string[], answerIndex: number): QuizQuestion => ({ id, question, options, answerIndex });

const ADVICE = " Always cross-check dates and doses with your local KVK or state agricultural university — recommendations vary by location and variety.";

course("crs_mustard", "Mustard: From Sowing to Sale", "Mustard", "Beginner", "mustard", "u_e_anita", "A practical course for Rabi mustard: seed, sowing, irrigation, pest scouting and selling. Built for arid and semi-arid Rajasthan conditions.", [
  "Plan sowing and seed treatment",
  "Schedule irrigation at critical stages",
  "Scout aphids before spraying",
  "Prepare mustard for sale",
]);
mod("crs_mustard", 1, "Choosing variety and sowing time", "ARTICLE", 8, "Mustard is a Rabi crop. In north-west India it is commonly sown from the last week of September to mid-October. Choose a variety recommended for your district, buy certified seed, and keep the bill. Early sowing can escape late-season aphid and heat stress, but too early can expose plants to warm weather." + ADVICE);
mod("crs_mustard", 2, "Seed treatment and land preparation", "VIDEO", 12, "Prepare a fine, firm seedbed with ploughing and levelling. Treat seed before sowing as advised for your area, dry it in shade and sow the same day. Keep rows around 30–45 cm apart so you can walk, scout and weed between rows." + ADVICE);
mod("crs_mustard", 3, "Irrigation at critical stages", "ARTICLE", 9, "Mustard responds well to irrigation at a few key stages: around rosette/branching (roughly 25–35 days after sowing), at flowering, and during pod filling. A light pre-sowing irrigation helps uniform germination. Avoid waterlogging — yellowing and root problems often follow standing water." + ADVICE);
mod("crs_mustard", 4, "Scouting aphids and diseases", "ARTICLE", 11, "Aphids usually build up in cool, cloudy weather from December to February. Walk the field weekly, check the growing tips of 10 plants across the field, and use yellow sticky traps to see arrival early. Spray only when scouting says it is needed and protect yourself with gloves, mask and full clothing. Ask an expert if you are unsure of the cause of leaf symptoms." + ADVICE);
mod("crs_mustard", 5, "Quiz: mustard basics", "QUIZ", 5, "Test what you learned.", [
  q("m1", "Which stage is commonly a critical irrigation stage for mustard?", ["Only after harvest", "Flowering", "Only at sowing", "Never needed"], 1),
  q("m2", "Before spraying for pests, what should you do first?", ["Scout the field", "Spray all inputs", "Wait for the neighbour", "Spray at noon"], 0),
  q("m3", "A good habit when buying seed is to:", ["Skip the bill", "Keep the bill and choose certified seed", "Mix old seed", "Buy any loose seed"], 1),
]);

course("crs_wheat", "Wheat Production Basics", "Wheat", "Beginner", "wheat", "u_e_anita", "Rabi wheat from land preparation to harvest: sowing window, nutrient plan and irrigation stages.", ["Pick a sowing window", "Plan irrigations", "Recognise common problems early"]);
mod("crs_wheat", 1, "Sowing window and seed rate", "ARTICLE", 8, "Timely wheat is commonly sown in November in north-west India. Use clean certified seed, treat it, and calibrate your seed drill. Late sowing generally reduces yield, so plan land preparation ahead." + ADVICE);
mod("crs_wheat", 2, "Irrigation stages", "VIDEO", 10, "Wheat has several critical stages: crown-root initiation (about 3 weeks after sowing), tillering, jointing, flowering and grain filling. Missing the crown-root stage irrigation is a common cause of weak crops." + ADVICE);
mod("crs_wheat", 3, "Nutrients and weeds", "ARTICLE", 9, "Use soil-test based fertiliser rather than a fixed dose. Split nitrogen across stages and control weeds early, when they compete most." + ADVICE);
mod("crs_wheat", 4, "Quiz: wheat basics", "QUIZ", 5, "Quick quiz.", [
  q("w1", "Crown-root initiation irrigation happens about…", ["1 week after sowing", "3 weeks after sowing", "At harvest", "Before land preparation"], 1),
  q("w2", "Fertiliser doses are best decided by…", ["A soil test report", "Guesswork", "The shop's stock", "A neighbour's habit only"], 0),
]);

course("crs_bajra", "Bajra in Arid Zones", "Bajra", "Beginner", "bajra", "u_e_meenakshi", "Pearl millet for dry regions: sowing with the first rains, thinning, disease watch and storage.", ["Time sowing with rainfall", "Thin and weed properly", "Store grain safely"]);
mod("crs_bajra", 1, "Sowing with the first good rain", "ARTICLE", 7, "Bajra is drought-hardy. Sow with the onset of effective monsoon rain, using improved or locally adapted seed. Do not sow into a dry spell expecting rain." + ADVICE);
mod("crs_bajra", 2, "Thinning and weed control", "VIDEO", 9, "Thin to maintain spacing at about 2–3 weeks after sowing and weed early. Good spacing improves tillering and earhead size." + ADVICE);
mod("crs_bajra", 3, "Disease watch and storage", "ARTICLE", 8, "Watch for downy mildew and ergot in humid spells; remove affected plants early. Dry grain well before storage and keep bags off the floor to avoid moisture." + ADVICE);

course("crs_organic", "Organic Farming Starter", "Organic farming", "Intermediate", "organic", "u_e_sunil", "Soil health, composting, bio-inputs and the paperwork behind organic farming.", ["Make good compost", "Use bio-inputs safely", "Understand organic documentation"]);
mod("crs_organic", 1, "Why soil health first", "ARTICLE", 8, "Organic farming starts with living soil: organic matter, crop rotation and cover. The transition period may reduce yield; plan cash flow for it." + ADVICE);
mod("crs_organic", 2, "Compost and bio-inputs", "VIDEO", 12, "Layer dung, crop residue and a little soil, keep moist and turn every two weeks. Bio-inputs like neem products help only when applied on the basis of scouting." + ADVICE);
mod("crs_organic", 3, "Certification and record keeping", "ARTICLE", 9, "Buyers pay a premium for credible organic claims. Learn the certification options available for your region, record every input and sale, and never claim organic without valid documentation." + ADVICE);
mod("crs_organic", 4, "Quiz: organic basics", "QUIZ", 5, "Quick quiz.", [
  q("o1", "How often should a compost heap be turned?", ["Never", "About every two weeks", "Once a year", "Daily"], 1),
  q("o2", "Organic claims to buyers should be backed by…", ["Valid documentation", "Only a verbal promise", "A photo", "Nothing"], 0),
]);

course("crs_drip", "Drip Irrigation Fundamentals", "Irrigation", "Beginner", "irrigation", "u_e_vikram", "Components, scheduling and maintenance of drip systems for vegetables and orchards.", ["Know the system components", "Schedule by crop need", "Maintain filters and emitters"]);
mod("crs_drip", 1, "Components of a drip system", "ARTICLE", 8, "A typical system has a pump, filter, pressure regulation, mainline, sub-main, laterals and emitters. Fit a filter suitable for your water source; sand and clogging are the most common problems." + ADVICE);
mod("crs_drip", 2, "Scheduling and fertigation", "VIDEO", 10, "Irrigate by crop stage and soil, not by habit. Short, frequent cycles keep moisture steady. Apply soluble fertiliser through drip only after learning dosage and compatibility." + ADVICE);
mod("crs_drip", 3, "Weekly maintenance checklist", "ARTICLE", 7, "Clean filters weekly, flush laterals, check for leaks and walk the field while the system runs to spot blocked emitters." + ADVICE);

course("crs_dairy", "Dairy Animal Care Essentials", "Dairy", "Beginner", "dairy", "u_e_imran", "Feeding, housing, hygiene and health routines for dairy cows and buffaloes.", ["Balance the ration", "Keep clean milk", "Know when to call the vet"]);
mod("crs_dairy", 1, "Feeding a balanced ration", "ARTICLE", 9, "Provide clean water at all times, green fodder, dry fodder and a measured concentrate based on milk yield. Sudden diet changes upset the rumen." + ADVICE);
mod("crs_dairy", 2, "Housing and hygiene", "VIDEO", 8, "Dry, shaded, well-ventilated housing reduces disease and heat stress. Clean udders before milking and keep milking utensils washed." + ADVICE);
mod("crs_dairy", 3, "Health routine and vaccination", "ARTICLE", 8, "Keep a vaccination and deworming calendar prepared with your veterinarian. Call early if an animal is off feed, has a swollen udder or abnormal milk." + ADVICE);
mod("crs_dairy", 4, "Quiz: dairy basics", "QUIZ", 4, "Quick quiz.", [
  q("d1", "Who should set your vaccination calendar?", ["A veterinarian", "Anyone online", "Nobody", "A random trader"], 0),
  q("d2", "What should always be available to animals?", ["Clean water", "Only concentrate", "Nothing", "Warm water only"], 0),
]);

export const coursesSeed = courses;
export const courseModulesSeed = modules;
export const courseProgressSeed: CourseProgress[] = [
  { userId: "u_ramesh", courseId: "crs_mustard", completedModuleIds: ["crs_mustard_m1", "crs_mustard_m2", "crs_mustard_m3"], quizScores: {}, updatedAt: iso(-2), isDemo: true },
];

// ───────────── Health & safety ─────────────
const H = (id: string, topic: string, kind: HealthResource["kind"], title: string, summary: string, steps: string[], scene: SceneKind, emergency = false, phone?: string): HealthResource => ({
  id,
  topic,
  kind,
  title,
  summary,
  steps,
  emergency,
  scene,
  phone,
  hidden: false,
  isDemo: true,
});

const SEEK = "If symptoms are serious or you are unsure, get professional medical care immediately.";

export const healthSeed: HealthResource[] = [
  H("h_heat", "Heat safety", "ARTICLE", "Working safely in extreme heat", "Heat illness can become dangerous quickly. Plan work around the hottest hours.", ["Work in early morning and evening; rest in shade between 12 and 4 pm.", "Drink water or ORS regularly — do not wait until you are thirsty.", "Wear a light cotton full-sleeve shirt, a wide hat or a wet cloth over the head.", "Watch for dizziness, headache, vomiting or confusion — move to shade, cool the body with water and seek medical help.", SEEK], "health", false),
  H("h_pesticide", "Pesticide safety", "ARTICLE", "Spraying pesticides safely", "Most pesticide poisoning is preventable with simple habits.", ["Read the label. Use only the product and dose recommended for the crop.", "Wear gloves, mask/respirator, eye protection, full clothing and boots.", "Never spray against the wind or in the hottest hours; never eat, drink or smoke while spraying.", "Wash hands and body with soap after work; wash spray clothes separately.", "Store in original labelled containers away from food, children and animals.", "If someone feels unwell after spraying, move them to fresh air, remove contaminated clothing, rinse skin and call a doctor — take the product label with you."], "health"),
  H("h_resp", "Respiratory protection", "ARTICLE", "Protecting your lungs from dust and fumes", "Threshing, grain handling, chaff cutting and spraying release harmful dust and fumes.", ["Wear a properly fitting dust mask or respirator when threshing, cleaning grain or handling fertiliser.", "Work with the wind at your back where possible.", "Do not use a cloth scarf as a substitute when spraying chemicals — use a suitable respirator.", "Persistent cough or breathlessness should be checked by a doctor."], "health"),
  H("h_eye", "Eye protection", "ARTICLE", "Keeping your eyes safe on the farm", "Dust, thorns, chemical splashes and flying chips cause preventable eye injuries.", ["Wear safety glasses when spraying, grinding, welding or using a chaff cutter.", "If chemicals splash into the eye, rinse with clean running water for at least 15 minutes and go to a doctor.", "Do not rub the eye or put home remedies in an injured eye.", "Wear sunglasses and a hat in bright sun to reduce glare."], "health"),
  H("h_hearing", "Hearing protection", "ARTICLE", "Protecting your hearing from machine noise", "Tractors, threshers and generators are loud. Hearing loss builds slowly and is permanent.", ["Use ear plugs or ear muffs when operating loud machinery for long periods.", "Take breaks away from noise.", "Maintain machines — a well-maintained engine is quieter.", "Get your hearing checked if you often feel ringing in your ears."], "health"),
  H("h_firstaid", "First aid", "ARTICLE", "Basic first aid for cuts, burns and falls", "Know these steps before an emergency happens.", ["Bleeding: press firmly with a clean cloth and raise the limb; do not remove the cloth if soaked — add another.", "Burns: cool under clean running water for 15–20 minutes; do not apply oil, toothpaste or ice; cover loosely.", "Suspected fracture: keep the limb still, do not straighten it, and get the person to a hospital.", "Unconscious or not breathing: call 112 or 108 immediately.", SEEK], "health", true),
  H("h_snake", "Snake-bite", "ARTICLE", "Snake-bite: what to do and what NOT to do", "Snake-bite is a medical emergency. Fast transport to a hospital with anti-venom matters most.", ["Keep the person calm and still; reassure them — panic speeds the spread of venom.", "Keep the bitten limb still and at about heart level; remove rings, bangles and tight items before swelling starts.", "Call 112 or 108 and go to the nearest hospital at once. Do not wait for symptoms.", "DO NOT cut the wound, suck the venom, apply a tight tourniquet, use ice, or rely on herbal/religious healers.", "If it is safe, note the time of the bite and remember the snake's appearance — do not try to catch or kill it."], "health", true),
  H("h_machinery", "Machinery safety", "ARTICLE", "Safe use of tractors and farm machinery", "Rollovers, entanglement and PTO shaft accidents cause serious injuries.", ["Never start or adjust a machine while someone is near the moving parts.", "Keep PTO shaft guards in place and avoid loose clothing, long scarves and hanging cloth.", "Stop the engine before cleaning, unblocking or repairing.", "Take slopes and ditches slowly; do not carry extra passengers on a tractor.", "Keep children away from working machinery."], "tractor", true),
  H("h_seasonal", "Seasonal health", "ARTICLE", "Seasonal health awareness", "Different seasons bring different risks for farming families.", ["Summer: heat illness, dehydration and snake activity during evening irrigation.", "Monsoon: waterborne illness and mosquito-borne disease — drink boiled or treated water.", "Winter: cold exposure and respiratory infections — protect chest and head during early morning field work.", "Keep vaccinations up to date for the family and livestock, as advised by your health worker."], "health"),
  H("h_mental", "Mental health", "ARTICLE", "Mental health awareness for farming families", "Financial pressure and uncertain weather can weigh heavily. Feeling low is common — and help is available.", ["Talk to someone you trust: family, a friend, a farmer group or a health worker.", "Persistent sadness, loss of sleep, withdrawing from people or thoughts of self-harm are signs to seek help now.", "Tele-MANAS (14416) offers free counselling support. In an emergency call 112.", "Support others too — checking in on a neighbour can make a difference."], "sunrise", true),
  H("h_safety", "Occupational safety", "ARTICLE", "A simple farm safety checklist", "Small habits prevent most farm accidents.", ["Keep a stocked first-aid kit at home and at the farm shed.", "Keep emergency numbers written down and charged phone on you.", "Never work alone in remote fields at night during irrigation without telling someone.", "Wear sturdy footwear and gloves; avoid walking barefoot in fields."], "health"),
  H("h_video_heat", "Heat safety", "VIDEO", "Video: 5-minute heat safety for farm work", "A short demonstration of heat protection and ORS preparation. (Demo placeholder — real video to be attached.)", ["Watch the demonstration.", "Practise the steps with your family."], "health"),
  H("h_video_snake", "Snake-bite", "VIDEO", "Video: Snake-bite first response", "Short animated guide to the correct first response. (Demo placeholder — real video to be attached.)", ["Watch the demonstration.", "Share it with your village."], "health", true),
  H("h_c_112", "Emergency contacts", "CONTACT", "National Emergency Number — 112", "Police, fire and ambulance. Works across India.", ["Call 112 for any life-threatening emergency."], "health", true, "112"),
  H("h_c_108", "Emergency contacts", "CONTACT", "Ambulance — 108", "Emergency ambulance service in most states.", ["Call 108 and state your location clearly."], "health", true, "108"),
  H("h_c_kcc", "Emergency contacts", "CONTACT", "Kisan Call Centre — 1800-180-1551", "Toll-free agriculture advice line for crop questions.", ["Use for crop advice, not for medical emergencies."], "health", false, "1800-180-1551"),
  H("h_c_mind", "Emergency contacts", "CONTACT", "Tele-MANAS — 14416", "Free mental health support line.", ["Call any time if you or someone you know feels overwhelmed."], "health", false, "14416"),
  H("h_f_phc", "Nearby healthcare", "FACILITY", "Primary Health Centre (PHC)", "Your first stop for basic treatment, vaccines and referral. Ask your village health worker for the nearest PHC.", ["Ask your ASHA or ANM worker for the nearest PHC.", "Carry your ID and any previous prescriptions."], "health"),
  H("h_f_chc", "Nearby healthcare", "FACILITY", "Community Health Centre / District Hospital", "For serious injury, poisoning or snake-bite go directly to the nearest CHC or district hospital.", ["Do not delay transport for serious emergencies.", "Real facility directory with maps will be connected through the map provider."], "health", true),
];

// ───────────── Expert Q&A ─────────────
export const questionsSeed: ExpertQuestion[] = [
  { id: "q1", askerId: "u_dinesh", category: "Pest", crop: "Mustard", district: "Alwar", body: "मेरी सरसों के पत्ते पीले हो रहे हैं, क्या करूं? पौधे 20 दिन के हैं।", expertId: undefined, status: "ANSWERED", hidden: false, createdAt: iso(-3), isDemo: true },
  { id: "q2", askerId: "u_hanuman", category: "Crop", crop: "Chickpea", district: "Churu", body: "Is mid-October too early for chickpea sowing in Churu district?", expertId: "u_e_anita", status: "ANSWERED", hidden: false, createdAt: iso(-2), isDemo: true },
  { id: "q3", askerId: "u_sunita", category: "Livestock", crop: undefined, district: "Hanumangarh", body: "Buffalo ko garmi me khana kam kar diya hai. Kya dhyan rakhein?", expertId: "u_e_imran", status: "ANSWERED", hidden: false, createdAt: iso(-4), isDemo: true },
  { id: "q4", askerId: "u_ramesh", category: "Soil", crop: "Mustard", district: "Churu", body: "My soil report shows low organic carbon. How should I plan fertiliser for mustard?", expertId: "u_e_vikram", status: "OPEN", hidden: false, createdAt: iso(-1), isDemo: true },
  { id: "q5", askerId: "u_kailash", category: "Irrigation", crop: "Tomato", district: "Jaipur", body: "Drip emitters block every few weeks. Filter cleaning is weekly. What else can I do?", status: "OPEN", hidden: false, createdAt: iso(0, -8), isDemo: true },
  { id: "q6", askerId: "u_mohan", category: "Machinery", crop: undefined, district: "Sikar", body: "Rotavator blades wear fast in sandy soil. Any tips on choosing blades?", status: "OPEN", hidden: false, createdAt: iso(0, -20), isDemo: true },
];

export const answersSeed: ExpertAnswer[] = [
  { id: "a1", questionId: "q1", expertId: "u_e_sunil", body: "Yellowing at 20 days can come from several causes: waterlogging or standing water, low nitrogen or sulphur, cold nights, or early pest damage. Check these in order: (1) Is there water standing around roots? (2) Is yellowing on older or younger leaves? Older-leaf yellowing often points to nitrogen; young-leaf yellowing to sulphur. (3) Look under leaves and at growing tips for aphids or caterpillars. Please upload a photo and tell us your last irrigation and fertiliser date — this is general guidance, not a diagnosis. Do not spray anything until the cause is confirmed.", helpful: 18, createdAt: iso(-3, 2), isDemo: true },
  { id: "a2", questionId: "q2", expertId: "u_e_anita", body: "For chickpea in Churu the sowing window generally runs through October to early November; mid-October is within the commonly advised window if soil moisture is adequate. Treat seed, choose a variety recommended for your district and avoid sowing into a very hot spell. Confirm local dates with Demo KVK Churu.", helpful: 11, createdAt: iso(-2, 3), isDemo: true },
  { id: "a3", questionId: "q3", expertId: "u_e_imran", body: "Do not reduce water or green fodder in summer. Offer feed in the cooler hours, give clean cool water often, provide shade and ventilation, and add mineral mixture as advised by your veterinarian. If an animal is off feed or panting heavily, call your vet early.", helpful: 24, createdAt: iso(-4, 3), isDemo: true },
];

// ───────────── Notifications (for the main demo farmer) ─────────────
const N = (id: string, type: NotificationType, title: string, body: string, link: string, hoursAgo: number, read = false): Notification => ({
  id,
  userId: "u_ramesh",
  type,
  title,
  body,
  link,
  read,
  createdAt: iso(0, -hoursAgo),
  isDemo: true,
});

export const notificationsSeed: Notification[] = [
  N("n1", "CROP", "Irrigation planned in 2 days", "Mustard · Bada Khet — light irrigation after germination.", "/crops/c_r_mustard", 1),
  N("n2", "ENQUIRY", "New buyer enquiry", "Marudhara Oil Mills asked about your mustard requirement match.", "/messages", 2),
  N("n3", "EXPERT", "Dr. Anita Sharma replied", "A reply to your question about fertiliser planning is ready.", "/experts?tab=questions", 5),
  N("n4", "EVENT", "Reminder: Mustard Pest Management Workshop", "Starts in 3 days — add to calendar.", "/events/e_mustard_workshop", 8),
  N("n5", "GOVERNMENT", `${"[DEMO]"} Sample department notice`, "A demo notice from Demo State Agriculture Department.", "/schemes/s_heat", 12),
  N("n6", "FOLLOW", "Sunita Devi Jakhar started following you", "You now have 8 followers.", "/farmers/u_sunita", 20, true),
  N("n7", "MARKET", "New requirement near you", "Marudhara Oil Mills needs 100 quintal mustard in Churu.", "/market?tab=requirements", 26),
  N("n8", "LEARNING", "Continue: Mustard — Irrigation at critical stages", "You finished 3 of 5 lessons.", "/learning/crs_mustard", 30, true),
  N("n9", "COMMUNITY", "12 new posts in Mustard Farmers", "Dinesh asked about leaf patches.", "/communities/c_mustard", 40, true),
  N("n10", "WEATHER", `${"[DEMO]"} Sample weather alert`, "Layout preview for weather advisories.", "/notifications", 50, true),
  N("n11", "AI", "Opportunity for you", "Organic Farming Workshop matches your interests.", "/opportunities", 60, true),
];

// ───────────── Conversations ─────────────
export const conversationsSeed: Conversation[] = [
  { id: "cv1", participantIds: ["u_ramesh", "u_b_marudhara"], context: { kind: "REQUIREMENT", id: "req_marudhara_mustard", title: "Mustard — 100 qtl near Churu" }, createdAt: iso(-1), updatedAt: iso(0, -2), isDemo: true },
  { id: "cv2", participantIds: ["u_ramesh", "u_e_anita"], context: { kind: "QUESTION", id: "q4", title: "Fertiliser planning for mustard" }, createdAt: iso(-3), updatedAt: iso(0, -5), isDemo: true },
  { id: "cv3", participantIds: ["u_ramesh", "u_sunita"], context: { kind: "DIRECT", title: "Direct message" }, createdAt: iso(-5), updatedAt: iso(-1), isDemo: true },
];

const MSG = (id: string, conversationId: string, senderId: string, body: string, hoursAgo: number, readBy: string[]): Message => ({
  id,
  conversationId,
  senderId,
  body,
  attachments: [],
  readBy,
  createdAt: iso(0, -hoursAgo),
  isDemo: true,
});

export const messagesSeed: Message[] = [
  MSG("ms1", "cv1", "u_b_marudhara", "Namaste Ramesh ji. Your profile shows mustard experience in Churu. Do you or your FPO have stock available for mid to late October?", 26, ["u_b_marudhara", "u_ramesh"]),
  MSG("ms2", "cv1", "u_ramesh", "Namaste. I sold my mustard in March. The Shekhawati FPO has a 45 quintal collective lot listed — please check the marketplace.", 24, ["u_b_marudhara", "u_ramesh"]),
  MSG("ms3", "cv1", "u_b_marudhara", "Thank you, will look. We never ask for advance payments — payment after quality check at pickup.", 2, ["u_b_marudhara"]),
  MSG("ms4", "cv2", "u_e_anita", "Hello Ramesh ji, please share your soil test numbers (organic carbon, N, P, K) and last crop. I will suggest a nutrient plan.", 5, ["u_e_anita"]),
  MSG("ms5", "cv3", "u_sunita", "Ramesh bhai, which wheat seed are you planning this year?", 30, ["u_sunita", "u_ramesh"]),
  MSG("ms6", "cv3", "u_ramesh", "Certified seed from the KVK. Will decide dates after the workshop.", 28, ["u_sunita", "u_ramesh"]),
];

export const verificationSeed: VerificationRequest[] = [
  { id: "vr1", userId: "u_dinesh", kind: "FARMER", note: "Please verify my farmer profile. I can share land records.", documentLabels: ["Land record (khasra)", "ID proof"], status: "PENDING", createdAt: iso(-3), isDemo: true },
  { id: "vr2", userId: "u_b_aravali", kind: "BUYER", note: "Organic trading business — GST registered.", documentLabels: ["GST certificate", "Shop licence"], status: "PENDING", createdAt: iso(-2), isDemo: true },
  { id: "vr3", userId: "u_e_meenakshi", kind: "EXPERT", note: "KVK subject-matter specialist.", documentLabels: ["Appointment letter", "Degree certificate"], status: "PENDING", createdAt: iso(-1), isDemo: true },
];

export const reportsSeed: Report[] = [
  { id: "rp1", reporterId: "u_sunita", targetType: "POST", targetId: "p_kvk_tip", reason: "Misleading information", details: "Please confirm this tip with the official source.", status: "OPEN", createdAt: iso(-1), isDemo: true },
  { id: "rp2", reporterId: "u_kailash", targetType: "USER", targetId: "u_b_aravali", reason: "Scam or fraud", details: "Asked me to share bank details before visiting.", status: "OPEN", createdAt: iso(0, -6), isDemo: true },
];
