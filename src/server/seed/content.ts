import type {
  AgriEvent,
  Comment,
  Community,
  CommunityMember,
  Follow,
  GovernmentScheme,
  Like,
  LiveMessage,
  LiveSession,
  Post,
  Reel,
  SavedItem,
  SceneKind,
  StoryItem,
} from "@/types/domain";
import { iso } from "./helpers";

const DEMO_TAG = "[DEMO]";

// ───────────── Communities ─────────────
const C = (id: string, name: string, kind: Community["kind"], scene: SceneKind, description: string, rules: string[] = []): Community => ({
  id,
  name,
  kind,
  scene,
  description,
  createdBy: "u_admin",
  rules: rules.length ? rules : ["Be respectful and help each other.", "No spam, no sharing of bank/UPI/OTP details.", "Ask before sharing a buyer's contact."],
  hidden: false,
  createdAt: iso(-180),
  isDemo: true,
});

export const communitiesSeed: Community[] = [
  C("c_churu", "Churu Farmers", "LOCATION", "sunrise", "Farmers of Churu district — weather, mandi, schemes, local advice."),
  C("c_rajasthan", "Rajasthan Farmers", "LOCATION", "tractor", "Statewide discussion for all crops and seasons."),
  C("c_wheat", "Wheat Farmers", "CROP", "wheat", "Sowing dates, varieties, irrigation schedule and rust/aphid watch."),
  C("c_mustard", "Mustard Farmers", "CROP", "mustard", "From seed to oil mill: mustard agronomy, pests and selling."),
  C("c_dairy", "Dairy Farmers", "LIVESTOCK", "dairy", "Feeding, breeding, health and milk marketing."),
  C("c_organic", "Organic Farming India", "METHOD", "organic", "Compost, bio-inputs, certification and organic buyers."),
  C("c_irrigation", "Drip & Sprinkler Irrigation", "METHOD", "irrigation", "Set-up, maintenance and scheduling."),
  C("c_machinery", "Machinery Exchange", "MACHINERY", "tractor", "Share, hire and troubleshoot farm machinery."),
  C("c_bajra", "Bajra & Millets", "CROP", "bajra", "Dryland millets, seed saving and processing."),
];

const memberships: Record<string, string[]> = {
  c_churu: ["u_ramesh", "u_hanuman", "u_e_meenakshi", "u_f_shekhawati"],
  c_rajasthan: ["u_ramesh", "u_sunita", "u_mohan", "u_kailash", "u_geeta", "u_dinesh", "u_bhanwar", "u_pushpa", "u_hanuman", "u_laxmi"],
  c_wheat: ["u_ramesh", "u_sunita", "u_laxmi", "u_e_anita"],
  c_mustard: ["u_ramesh", "u_hanuman", "u_dinesh", "u_e_anita", "u_e_sunil"],
  c_dairy: ["u_sunita", "u_pushpa", "u_e_imran", "u_ramesh"],
  c_organic: ["u_geeta", "u_ramesh", "u_b_aravali"],
  c_irrigation: ["u_kailash", "u_ramesh", "u_mohan"],
  c_machinery: ["u_laxmi", "u_ramesh", "u_mohan", "u_hanuman"],
  c_bajra: ["u_mohan", "u_geeta", "u_ramesh", "u_f_thar"],
};

export const communityMembersSeed: CommunityMember[] = Object.entries(memberships).flatMap(([communityId, userIds], ci) =>
  userIds.map((userId, i) => ({ communityId, userId, role: i === 0 && ci % 2 === 0 ? ("MODERATOR" as const) : ("MEMBER" as const), joinedAt: iso(-150 + i), isDemo: true })),
);

// ───────────── Posts ─────────────
const P = (id: string, authorId: string, kind: Post["kind"], body: string, tags: string[], scene: SceneKind | undefined, hoursAgo: number, extra: Partial<Post> = {}): Post => ({
  id,
  authorId,
  kind,
  body,
  tags,
  scene,
  hidden: false,
  createdAt: iso(0, -hoursAgo),
  isDemo: true,
  ...extra,
});

export const postsSeed: Post[] = [
  P("p_ramesh_mustard", "u_ramesh", "POST", "Mustard sowing is done on 6 acres at Rajaldesar. Seed was treated before sowing and rows are at 45 cm. First light irrigation is planned in 2 days — will share a weekly update. 🌱", ["Mustard", "Rajasthan", "Churu"], "mustard", 5, { crop: "Mustard", district: "Churu", state: "Rajasthan", communityId: "c_mustard" }),
  P("p_anita_tip", "u_e_anita", "TIP", "Mustard tip: thin the crop 15–20 days after sowing so plants stand about 10–15 cm apart in the row. Crowded plants compete for light and are weaker against aphids later in the season.", ["Mustard", "ExpertTip", "Rabi"], "mustard", 9, { crop: "Mustard" }),
  P("p_kvk_event", "u_g_kvk", "EVENT", `${DEMO_TAG} Kisan Mela 2026 at Demo KVK Churu — demonstration plots, machinery display and expert Q&A. Registration is open on KaamSetu. (Demo event for illustration.)`, ["KisanMela", "Events", "Churu"], "sunrise", 14, { linkedEventId: "e_kisanmela", district: "Churu" }),
  P("p_agri_announce", "u_g_agri", "ANNOUNCEMENT", `${DEMO_TAG} Sample department notice: this post only shows how a verified organisation's announcement looks in the feed. It is NOT a real notice. Always confirm schemes on the official source linked on the scheme page.`, ["GovernmentSchemes", "Demo"], undefined, 20),
  P("p_sunita_dairy", "u_sunita", "POST", "Berseem fodder sowing is complete. Our herd feed chart: green fodder 25 kg, dry fodder 6 kg and a measured concentrate ration. Milk fat has been steady since we began weighing the ration. #Dairy", ["Dairy", "Fodder", "Hanumangarh"], "dairy", 26, { communityId: "c_dairy", district: "Hanumangarh" }),
  P("p_geeta_organic", "u_geeta", "STORY", "Eight years without chemical inputs. The first two were hard — yields dipped. What helped: cow-dung compost every season, crop rotation with guar, and neem-based sprays only when scouting showed a need. Today my cost per acre is lower than before.", ["OrganicFarming", "Bajra", "FarmerStory"], "organic", 30, { communityId: "c_organic", district: "Jodhpur" }),
  P("p_imran_tip", "u_e_imran", "TIP", "Heat stress in dairy animals: give shade and clean cool water at all times, feed green fodder in the cooler hours, and avoid moving animals at midday. If an animal is panting heavily or off feed, call your veterinarian early.", ["Dairy", "HeatSafety", "AnimalHealth"], "dairy", 36, { communityId: "c_dairy" }),
  P("p_mohan_bajra", "u_mohan", "POST", "Bajra harvest finished: about 6 quintals per acre despite the late rain. Saved the best earheads for seed. Selling through the FPO this year.", ["Bajra", "Sikar", "Harvest"], "bajra", 40, { communityId: "c_bajra", crop: "Bajra", district: "Sikar" }),
  P("p_kailash_drip", "u_kailash", "POST", "Drip with mulch film on tomato: weeds are almost gone and I irrigate in shorter cycles. Clean the filters every week — blocked emitters were my biggest problem in year one.", ["Irrigation", "Vegetables", "Drip"], "irrigation", 44, { communityId: "c_irrigation" }),
  P("p_fpo_shek", "u_f_shekhawati", "ANNOUNCEMENT", "Members: our collective mustard lot (45 qtl) is listed in the marketplace. Add your quantity before 15 Oct so the buyer sees one consolidated lot. Contact the FPO desk through messages.", ["FPO", "Mustard", "Market"], "market", 48, { crop: "Mustard", district: "Churu" }),
  P("p_marudhara_market", "u_b_marudhara", "MARKET", "Requirement: 100 quintal mustard from Churu, clean and dry, delivery window mid to late October. Farmers and FPOs can respond from the marketplace — we will not ask for any advance payment or bank details.", ["Market", "Mustard", "Buyer"], "market", 52, { crop: "Mustard", district: "Churu" }),
  P("p_weather", "u_g_agri", "WEATHER", `${DEMO_TAG} Sample weather-alert card. Real weather alerts will come from a connected weather provider; this entry only shows the layout (heat, rain and wind advisories).`, ["Weather", "Alert", "Demo"], "sunrise", 56),
  P("p_vikram_soil", "u_e_vikram", "TIP", "Before Rabi sowing, get your soil tested. Take samples from 6–8 spots in the field at about 15 cm depth, mix them, dry in shade and send about half a kilo. Fertiliser decisions based on a report save money.", ["Soil", "Rabi", "ExpertTip"], "classroom", 60),
  P("p_laxmi_machine", "u_laxmi", "POST", "Laser levelling before wheat made irrigation uniform and saved water last season. Our combine is available for hire this Rabi — details in the Machinery section.", ["Machinery", "Wheat", "SriGanganagar"], "tractor", 70, { communityId: "c_machinery", crop: "Wheat" }),
  P("p_bhanwar_chickpea", "u_bhanwar", "POST", "Chickpea wilt used to hit one corner of my field every year. Rotation with cereals, treated seed and a tolerant variety have kept it under control for three seasons.", ["Chickpea", "Nagaur", "IPM"], "chickpea", 80, { crop: "Chickpea" }),
  P("p_sunil_ipm", "u_e_sunil", "TIP", "Scout before you spray. Put a few yellow sticky traps at crop height to see when aphids arrive, then look at 10 plants across the field. Spraying on a schedule instead of on evidence wastes money and harms beneficial insects.", ["IPM", "Mustard", "PestManagement"], "mustard", 90),
  P("p_hanuman_q", "u_hanuman", "QUESTION", "Is anyone in Churu planning to sell mustard together this season? I can bring 55 quintal and would like to group up for a better price.", ["Mustard", "Churu", "Market"], "market", 100, { communityId: "c_churu", crop: "Mustard", district: "Churu" }),
  P("p_pushpa_dairy", "u_pushpa", "POST", "Our dairy cooperative started testing milk fat and SNF at the collection point. Members now see their numbers on a printed slip every day. Transparent testing built trust.", ["Dairy", "Cooperative", "Bikaner"], "dairy", 110, { communityId: "c_dairy" }),
  P("p_meenakshi_training", "u_e_meenakshi", "EVENT", "Women farmers' millet processing training at Demo KVK Churu — free registration, limited seats. Bring a friend! (Demo event.)", ["Millets", "Training", "WomenInAgriculture"], "classroom", 120, { linkedEventId: "e_millet_training", district: "Churu" }),
  P("p_univ_edu", "u_g_univ", "ANNOUNCEMENT", `${DEMO_TAG} Sample advisory layout from a university: "Rabi crop planning checklist". Content here is placeholder text and is not an actual advisory.`, ["Rabi", "Advisory", "Demo"], "classroom", 130),
  P("p_ramesh_story", "u_ramesh", "STORY", "Three years ago I started writing down every expense after each crop. Now I know my cost per quintal for mustard and wheat, and I can decide which field to prioritise. Simple records changed how I plan. KaamSetu made it easier.", ["FarmRecords", "Rajasthan", "FarmerStory"], "sunrise", 150, { district: "Churu" }),
  P("p_dinesh_q", "u_dinesh", "QUESTION", "Some mustard leaves in my neighbour's field show pale patches. What are the common causes and what should we check first before spraying anything?", ["Mustard", "Question", "Crop"], "mustard", 160, { communityId: "c_mustard", crop: "Mustard", district: "Alwar" }),
  P("p_laxmi_wheat", "u_laxmi", "POST", "Wheat sowing window opens in November. Plan: seed treatment, drill sowing, first irrigation at crown-root initiation, about 3 weeks after sowing. Write your own dates down and compare with your local KVK advice.", ["Wheat", "Rabi", "Planning"], "wheat", 170, { communityId: "c_wheat", crop: "Wheat" }),
  P("p_kvk_tip", "u_g_kvk", "TIP", `${DEMO_TAG} Sample extension tip: treat seed before sowing and keep the label of every input you buy. Demonstration content.`, ["SeedTreatment", "Demo"], "classroom", 180),
];

// ───────────── Comments & likes & saves ─────────────
const CM = (id: string, post: string, author: string, body: string, hoursAgo: number): Comment => ({
  id,
  targetType: "POST",
  targetId: post,
  authorId: author,
  body,
  createdAt: iso(0, -hoursAgo),
  isDemo: true,
});

export const commentsSeed: Comment[] = [
  CM("cm1", "p_ramesh_mustard", "u_e_anita", "Good timing. Remember to thin at 15–20 days and keep a record of the first irrigation date.", 4),
  CM("cm2", "p_ramesh_mustard", "u_hanuman", "Ramesh ji, which seed did you use this year?", 3),
  CM("cm3", "p_ramesh_mustard", "u_ramesh", "Certified seed treated before sowing. I will post the details in the weekly update.", 2),
  CM("cm4", "p_anita_tip", "u_dinesh", "Very useful, thank you madam.", 7),
  CM("cm5", "p_sunita_dairy", "u_pushpa", "We also weigh feed now. Fat improved in 3 weeks.", 20),
  CM("cm6", "p_geeta_organic", "u_b_aravali", "We are looking for organic bajra — message us if you have stock.", 28),
  CM("cm7", "p_geeta_organic", "u_ramesh", "Inspiring. How much compost per acre do you use?", 27),
  CM("cm8", "p_hanuman_q", "u_ramesh", "Talk to the Shekhawati FPO — they have a collective mustard lot listed.", 90),
  CM("cm9", "p_dinesh_q", "u_e_sunil", "Please share a photo and the crop age. Check humidity, nutrient stress, and pests before spraying. Ask an expert on KaamSetu for a field-specific answer.", 150),
  CM("cm10", "p_laxmi_wheat", "u_ramesh", "Same plan here. Sowing mid-November on the Nahar field.", 160),
  CM("cm11", "p_imran_tip", "u_sunita", "Shade nets helped our buffaloes last summer.", 33),
  CM("cm12", "p_marudhara_market", "u_hanuman", "I can supply 55 quintal. Sent an enquiry.", 50),
];

export function buildLikes(userIds: string[]): Like[] {
  const likes: Like[] = [];
  postsSeed.forEach((p, i) => {
    const n = 3 + ((i * 7) % 9);
    for (let k = 0; k < n; k++) {
      const uid = userIds[(i * 3 + k * 2) % userIds.length]!;
      if (uid === p.authorId || likes.some((l) => l.targetId === p.id && l.userId === uid)) continue;
      likes.push({ userId: uid, targetType: "POST", targetId: p.id, createdAt: iso(0, -i), isDemo: true });
    }
  });
  ["p_anita_tip", "p_geeta_organic", "p_sunil_ipm", "p_fpo_shek"].forEach((id) => {
    if (!likes.some((l) => l.userId === "u_ramesh" && l.targetId === id)) likes.push({ userId: "u_ramesh", targetType: "POST", targetId: id, createdAt: iso(0, -2), isDemo: true });
  });
  reelsSeed.forEach((r, i) => {
    const n = 4 + ((i * 5) % 8);
    for (let k = 0; k < n; k++) {
      const uid = userIds[(i * 2 + k * 3) % userIds.length]!;
      if (uid === r.authorId || likes.some((l) => l.targetId === r.id && l.userId === uid)) continue;
      likes.push({ userId: uid, targetType: "REEL", targetId: r.id, createdAt: iso(0, -i), isDemo: true });
    }
  });
  return likes;
}

export const savedSeed: SavedItem[] = [
  { userId: "u_ramesh", targetType: "POST", targetId: "p_vikram_soil", createdAt: iso(-1), isDemo: true },
  { userId: "u_ramesh", targetType: "POST", targetId: "p_sunil_ipm", createdAt: iso(-1), isDemo: true },
  { userId: "u_ramesh", targetType: "EVENT", targetId: "e_kisanmela", createdAt: iso(-1), isDemo: true },
  { userId: "u_ramesh", targetType: "SCHEME", targetId: "s_microirrigation", createdAt: iso(-2), isDemo: true },
  { userId: "u_ramesh", targetType: "FARMER", targetId: "u_geeta", createdAt: iso(-2), isDemo: true },
];

// ───────────── Follows ─────────────
const F = (a: string, b: string): Follow => ({ followerId: a, followingId: b, createdAt: iso(-60), isDemo: true });
export const followsSeed: Follow[] = [
  ...["u_e_anita", "u_e_sunil", "u_e_vikram", "u_g_kvk", "u_g_agri", "u_f_shekhawati", "u_geeta", "u_laxmi", "u_b_marudhara"].map((t) => F("u_ramesh", t)),
  ...["u_sunita", "u_mohan", "u_hanuman", "u_dinesh", "u_kailash", "u_bhanwar", "u_f_shekhawati"].map((f) => F(f, "u_ramesh")),
  ...["u_ramesh", "u_geeta", "u_mohan"].map((f) => F(f, "u_e_anita")),
  ...["u_ramesh", "u_sunita", "u_dinesh", "u_hanuman", "u_mohan", "u_kailash"].map((f) => F(f, "u_g_kvk")),
  ...["u_b_marudhara", "u_b_annapurna"].map((f) => F(f, "u_f_shekhawati")),
  F("u_b_aravali", "u_geeta"),
  F("u_sunita", "u_pushpa"),
  F("u_pushpa", "u_e_imran"),
  F("u_sunita", "u_e_imran"),
  F("u_hanuman", "u_f_shekhawati"),
  F("u_dinesh", "u_e_anita"),
];

// ───────────── Reels ─────────────
const R = (id: string, authorId: string, caption: string, category: Reel["category"], tags: string[], scene: SceneKind, durationSec: number, hoursAgo: number): Reel => ({
  id,
  authorId,
  caption,
  category,
  tags,
  scene,
  durationSec,
  hidden: false,
  createdAt: iso(0, -hoursAgo),
  isDemo: true,
});

export const reelsSeed: Reel[] = [
  R("r_seed_treatment", "u_ramesh", "Mustard seed treatment in 2 minutes — mix, dry in shade, sow the same day.", "Crop Tips", ["Mustard", "SeedTreatment"], "mustard", 48, 6),
  R("r_combine", "u_laxmi", "Combine harvester pre-season checklist: belts, blades, grain tank and fuel filter.", "Machinery", ["Machinery", "Wheat"], "tractor", 55, 12),
  R("r_scheme_walk", "u_g_kvk", `${DEMO_TAG} How to read a scheme page: eligibility, documents and the official source link. Demo walkthrough.`, "Government", ["GovernmentSchemes", "Demo"], "classroom", 62, 18),
  R("r_expert_check", "u_e_anita", "Before you spray: 3 things to check in your field — crop stage, weather and a quick scouting count.", "Expert Advice", ["IPM", "Mustard"], "mustard", 70, 24),
  R("r_mulch", "u_kailash", "Mulching hack: straw mulch between rows cut my weeding by half.", "Farming Hacks", ["Mulching", "Irrigation"], "vegetables", 38, 30),
  R("r_compost", "u_geeta", "My compost pit: layers of dung, residue and a little soil. Turn every 15 days.", "Organic Farming", ["Compost", "OrganicFarming"], "organic", 66, 36),
  R("r_dairy_day", "u_sunita", "A day in my dairy — from fodder cutting to the milk collection centre.", "Dairy", ["Dairy"], "dairy", 80, 42),
  R("r_bajra_harvest", "u_mohan", "Bajra harvest day in Sikar — earheads, threshing and what I save for seed.", "Farmer Stories", ["Bajra", "Harvest"], "bajra", 72, 48),
  R("r_grading", "u_b_marudhara", "How a mill checks mustard seed: moisture, foreign matter and oil content.", "Market Education", ["Market", "Mustard"], "market", 58, 54),
  R("r_heat", "u_e_imran", "Heat safety for you and your cattle: shade, water, and cooler working hours.", "Healthcare Awareness", ["HeatSafety", "Dairy"], "health", 52, 60),
  R("r_fodder", "u_pushpa", "Chop fodder smaller, waste less. Quick chaff cutter tips.", "Dairy", ["Dairy", "Fodder"], "dairy", 40, 66),
  R("r_soil_sample", "u_e_vikram", "How to take a soil sample properly — 6 to 8 spots, 15 cm depth, mix and dry.", "Expert Advice", ["Soil", "Rabi"], "classroom", 75, 72),
];

// ───────────── Stories (expire automatically) ─────────────
const S = (id: string, kind: StoryItem["kind"], title: string, body: string, authorId: string, link: string, scene: SceneKind, expiresInHours: number): StoryItem => ({
  id,
  kind,
  title,
  body,
  authorId,
  link,
  scene,
  createdAt: iso(0, -3),
  expiresAt: iso(0, expiresInHours),
  isDemo: true,
});

export const storiesSeed: StoryItem[] = [
  S("st_gov", "GOVERNMENT", "Govt alert (demo)", `${DEMO_TAG} Sample alert card — shows how verified departments post urgent notices.`, "u_g_agri", "/schemes?tab=alerts", "sunrise", 20),
  S("st_tip", "TIP", "Expert tip", "Thin mustard 15–20 days after sowing for stronger plants.", "u_e_anita", "/home", "mustard", 30),
  S("st_event", "EVENT", "Kisan Mela soon", "Kisan Mela 2026 (demo) — register and add a reminder.", "u_g_kvk", "/events/e_kisanmela", "sunrise", 40),
  S("st_fpo", "FPO", "FPO notice", "Collective mustard lot closes 15 Oct.", "u_f_shekhawati", "/market/l_fpo_mustard", "market", 36),
  S("st_farmer", "FARMER", "Farmer story", "Geeta Bishnoi: 8 years of organic farming.", "u_geeta", "/farmers/u_geeta", "organic", 44),
  S("st_market", "MARKET", "New requirement", "100 qtl mustard wanted near Churu.", "u_b_marudhara", "/market?tab=requirements", "market", 28),
  S("st_scheme", "GOVERNMENT", "New scheme (demo)", `${DEMO_TAG} Sample micro-irrigation support entry added.`, "u_g_agri", "/schemes/s_microirrigation", "irrigation", 48),
];

// ───────────── Government schemes — ALL DEMO PLACEHOLDERS ─────────────
const DEMO_SOURCE = "https://example.org/official-source-placeholder";
const SC = (
  id: string,
  orgId: string,
  name: string,
  category: GovernmentScheme["category"],
  description: string,
  deadlineDays?: number,
): GovernmentScheme => ({
  id,
  orgId,
  name: `${DEMO_TAG} ${name}`,
  category,
  state: "Rajasthan",
  description: `${description} This is DEMO DATA created to show the page layout. It is not a real scheme.`,
  eligibility: ["Sample criterion 1 — land-holding or tenancy record (demo text)", "Sample criterion 2 — bank account in the applicant's own name (demo text)", "Always confirm the real criteria on the official source."],
  benefits: ["Sample benefit description (demo text)", "Real benefits and amounts must be copied from the official notification."],
  documents: ["Identity proof (placeholder)", "Land record (placeholder)", "Bank passbook copy (placeholder)"],
  applicationMethod: "Placeholder: online portal or nearest agriculture office. Replace with the exact method from the official source.",
  officialSource: DEMO_SOURCE,
  deadline: deadlineDays === undefined ? undefined : iso(deadlineDays),
  hidden: false,
  createdAt: iso(-10),
  isDemo: true,
});

export const schemesSeed: GovernmentScheme[] = [
  SC("s_microirrigation", "org_agri", "Sample Micro-Irrigation Support", "SUBSIDY", "Illustrates a subsidy page for drip and sprinkler systems.", 45),
  SC("s_insurance", "org_agri", "Sample Crop Insurance Programme", "INSURANCE", "Illustrates an insurance scheme page with enrolment windows.", 30),
  SC("s_machinery", "org_agri", "Sample Farm Machinery Support", "SUBSIDY", "Illustrates a machinery subsidy page for tractors and implements.", 60),
  SC("s_credit", "org_agri", "Sample Short-term Farm Credit Facility", "CREDIT", "Illustrates a credit facility page for seasonal inputs.", undefined),
  SC("s_soilcamp", "org_kvk", "Sample Soil Health Camp Notice", "NOTIFICATION", "Illustrates a district-level notice announcing a soil testing camp.", 14),
  SC("s_training", "org_kvk", "Sample Farmer Training Programme", "TRAINING", "Illustrates a training programme listing with seat registration.", 20),
  SC("s_heat", "org_agri", "Sample Heat-wave Advisory", "ALERT", "Illustrates an emergency agricultural alert with safety guidance.", undefined),
];

// ───────────── Events & live ─────────────
const E = (id: string, organizerId: string, name: string, category: AgriEvent["category"], scene: SceneKind, description: string, topics: string[], location: string, district: string, startDays: number, startHour: number, durationH: number): AgriEvent => {
  const start = new Date(Date.now() + startDays * 86_400_000);
  start.setHours(startHour, 0, 0, 0);
  return {
    id,
    organizerId,
    name,
    category,
    description,
    topics,
    location,
    district,
    scene,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + durationH * 3_600_000).toISOString(),
    hidden: false,
    createdAt: iso(-12),
    isDemo: true,
  };
};

export const eventsSeed: AgriEvent[] = [
  E("e_kisanmela", "u_g_kvk", "Kisan Mela 2026 (Demo)", "Kisan Mela", "sunrise", "A day of demonstration plots, machinery display, seed and input stalls, farmer awards and expert Q&A. DEMO EVENT created to show the event page.", ["Demonstration plots", "Machinery display", "Expert Q&A", "FPO stalls"], "Demo KVK Campus, Churu", "Churu", 11, 9, 8),
  E("e_organic_workshop", "u_g_univ", "Organic Farming Workshop (Demo)", "Training", "organic", "A hands-on workshop on compost preparation, bio-inputs and the basics of organic documentation.", ["Compost", "Bio-inputs", "Documentation"], "Demo Agricultural University, Jaipur", "Jaipur", 5, 10, 5),
  E("e_mustard_workshop", "u_e_anita", "Mustard Pest Management Workshop", "Crop Workshop", "mustard", "Scouting, thresholds and safe use of inputs for mustard. Bring your questions and leaf samples.", ["Aphid scouting", "IPM", "Safe spraying"], "Online + Demo KVK Churu", "Churu", 3, 11, 2),
  E("e_soilcamp", "u_g_kvk", "Soil Health Camp (Demo)", "Government Camp", "classroom", "Free demonstration of soil sampling and a sample reading of a soil test report.", ["Soil sampling", "Reading a soil report"], "Demo KVK Churu", "Churu", 7, 10, 4),
  E("e_fpo_meet", "u_f_shekhawati", "FPO General Meeting", "FPO Meeting", "market", "Annual member meeting: accounts, collective marketing plan for Rabi, new members.", ["Accounts", "Collective marketing", "Rabi plan"], "Rajaldesar Community Hall", "Churu", 9, 16, 2),
  E("e_machinery_demo", "u_laxmi", "Machinery Demonstration Day", "Machinery Demo", "tractor", "Seed drill, laser leveller and rotavator demonstrations on a working farm.", ["Seed drill", "Laser levelling", "Rotavator"], "Suratgarh farm", "Sri Ganganagar", 16, 9, 5),
  E("e_expo", "u_g_agri", "State Agriculture Expo (Demo)", "Agriculture Expo", "market", "Exhibition of inputs, machinery, processing and farmer-buyer meetings. DEMO EVENT.", ["Inputs", "Processing", "Farmer–buyer meet"], "Demo Exhibition Ground, Jaipur", "Jaipur", 30, 10, 8),
  E("e_millet_training", "u_e_meenakshi", "Women Farmers' Millet Processing Training", "Training", "bajra", "Value addition for bajra: cleaning, milling, packaging and basic labelling.", ["Bajra", "Value addition", "Packaging"], "Demo KVK Churu", "Churu", 6, 10, 5),
  E("e_rabi_qna", "u_e_anita", "Rabi Crop Planning — Live Q&A", "Crop Workshop", "wheat", "Live session on sowing dates, varieties and irrigation planning for Rabi wheat and mustard.", ["Sowing dates", "Irrigation plan"], "Live on KaamSetu", "Jaipur", 0, new Date().getHours(), 2),
];

export const liveSessionsSeed: LiveSession[] = [
  { id: "live_rabi", eventId: "e_rabi_qna", hostId: "u_e_anita", title: "Rabi Crop Planning — Live Q&A", description: "Dr. Anita Sharma answers farmers' questions on sowing dates, varieties and irrigation planning. Post your question in the Questions tab.", status: "LIVE", scheduledAt: iso(0, -1), viewerCount: 214, scene: "classroom", hidden: false, createdAt: iso(-3), isDemo: true },
  { id: "live_mela", eventId: "e_kisanmela", hostId: "u_g_kvk", title: "Kisan Mela 2026 — Opening Session (Demo)", description: "Streaming of the opening session once the real streaming provider is connected.", status: "SCHEDULED", scheduledAt: iso(11), viewerCount: 0, scene: "sunrise", hidden: false, createdAt: iso(-3), isDemo: true },
  { id: "live_dairy", hostId: "u_e_imran", title: "Dairy Animal Health in Winter", description: "Recorded session: feeding, housing and early signs to call the veterinarian.", status: "ENDED", scheduledAt: iso(-6), viewerCount: 486, scene: "dairy", hidden: false, createdAt: iso(-10), isDemo: true },
];

const LM = (id: string, userId: string, body: string, minsAgo: number, isQuestion = false): LiveMessage => ({
  id,
  sessionId: "live_rabi",
  userId,
  body,
  isQuestion,
  createdAt: iso(0, -minsAgo / 60),
  isDemo: true,
});

export const liveMessagesSeed: LiveMessage[] = [
  LM("lm1", "u_hanuman", "Namaste madam. Is mid-October too early for chickpea in Churu?", 22, true),
  LM("lm2", "u_dinesh", "Joining from Alwar 🙏", 20),
  LM("lm3", "u_sunita", "What irrigation interval do you suggest at CRI stage for wheat?", 14, true),
  LM("lm4", "u_ramesh", "Great session, thank you.", 6),
  LM("lm5", "u_kailash", "Will the recording be available later?", 3, true),
];
