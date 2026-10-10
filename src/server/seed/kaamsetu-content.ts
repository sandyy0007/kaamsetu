/**
 * KaamSetu demo content beyond farming: profession communities, work/skill/tutorial posts, trade reels,
 * skill & employment government entries, skill camps / job fairs, and profession-tagged courses.
 *
 * EVERYTHING here is DEMO data (isDemo: true). Government entries carry the [DEMO] tag, a placeholder official
 * source and generic criteria — they never claim a real scheme, amount or eligibility rule.
 */
import type {
  AgriEvent,
  Community,
  CommunityMember,
  Course,
  CourseModule,
  Follow,
  GovernmentScheme,
  Post,
  QuizQuestion,
  Reel,
  SceneKind,
  SchemeTopic,
  StoryItem,
} from "@/types/domain";
import { iso } from "./helpers";

const DEMO_TAG = "[DEMO]";

// ───────────── Communities by profession and location ─────────────
const C = (id: string, name: string, kind: Community["kind"], scene: SceneKind, description: string): Community => ({
  id,
  name,
  kind,
  scene,
  description,
  createdBy: "u_admin",
  rules: ["Be respectful and help each other.", "No spam. Never share bank, UPI or OTP details.", "Agree rates and dates in Messages before the work starts."],
  hidden: false,
  createdAt: iso(-120),
  isDemo: true,
});

export const proCommunitiesSeed: Community[] = [
  C("c_pro_electric", "Electricians & Solar Technicians", "PROFESSION", "workshop", "Wiring, panels, inverters and solar — tools, safety and local work."),
  C("c_pro_carpentry", "Carpenters & Woodworkers", "PROFESSION", "carpentry", "Furniture, doors, kitchens and finishing — designs, timber and orders."),
  C("c_pro_drivers", "Drivers & Transporters", "PROFESSION", "road", "Routes, licences, vehicle care and trips for drivers and operators."),
  C("c_pro_tailors", "Tailors & Garment Makers", "PROFESSION", "tailoring", "Stitching, fittings, festival orders and fabric sourcing."),
  C("c_pro_artisans", "Artisans & Craftspeople", "PROFESSION", "pottery", "Pottery, weaving and handicrafts — made-to-order work and exhibitions."),
  C("c_pro_builders", "Masons & Builders", "PROFESSION", "construction", "Construction crews, site safety, estimates and contractors."),
  C("c_pro_farmwork", "Farm Workers & Seasonal Work", "PROFESSION", "tractor", "Harvest, sowing and machine work — find seasonal work and trusted teams."),
  C("c_pro_digital", "Mobile & Computer Technicians", "PROFESSION", "digital", "Repairs, data safety and doorstep service tips."),
  C("c_loc_sikar_work", "Sikar Professionals", "LOCATION", "market", "Local skilled professionals of Sikar — work, referrals and meet-ups."),
  C("c_loc_churu_work", "Churu Work & Services", "LOCATION", "market", "Who is hiring in Churu, which services are needed and where to learn new skills."),
];

const members: Record<string, string[]> = {
  c_pro_electric: ["u_p_anil", "u_p_rakesh", "u_p_dilip", "u_p_ratan"],
  c_pro_carpentry: ["u_p_suresh", "u_p_ratan", "u_p_anil"],
  c_pro_drivers: ["u_p_imran", "u_p_bhura", "u_p_dilip"],
  c_pro_tailors: ["u_p_savitri", "u_p_laxman"],
  c_pro_artisans: ["u_p_gopal", "u_p_laxman", "u_p_savitri"],
  c_pro_builders: ["u_p_ratan", "u_p_anil", "u_p_suresh", "u_p_kamla"],
  c_pro_farmwork: ["u_p_kamla", "u_p_bhura", "u_ramesh", "u_hanuman"],
  c_pro_digital: ["u_p_rakesh", "u_p_pooja"],
  c_loc_sikar_work: ["u_p_suresh", "u_p_pooja", "u_mohan"],
  c_loc_churu_work: ["u_p_anil", "u_p_savitri", "u_p_rakesh", "u_p_kamla", "u_p_bhura", "u_p_ratan", "u_ramesh"],
};

export const proCommunityMembersSeed: CommunityMember[] = Object.entries(members).flatMap(([communityId, userIds], ci) =>
  userIds.map((userId, i) => ({ communityId, userId, role: i === 0 && ci % 2 === 0 ? ("MODERATOR" as const) : ("MEMBER" as const), joinedAt: iso(-100 + i), isDemo: true })),
);

// ───────────── Posts: work, skills, tutorials, services, opportunities ─────────────
const P = (id: string, authorId: string, kind: Post["kind"], body: string, tags: string[], scene: SceneKind, hoursAgo: number, extra: Partial<Post> = {}): Post => ({
  id,
  authorId,
  kind,
  body,
  tags,
  scene,
  hidden: false,
  createdAt: iso(0, -hoursAgo),
  isDemo: true,
  state: "Rajasthan",
  ...extra,
});

export const proPostsSeed: Post[] = [
  P("pp_anil_work", "u_p_anil", "WORK", "Finished a full re-wiring of a two-storey house in Ratangarh: concealed conduit, separate circuits for AC and kitchen, and a new DB with RCCB. Photos in my portfolio.", ["Electrician", "Wiring", "Churu"], "workshop", 8, { district: "Churu", communityId: "c_pro_electric" }),
  P("pp_anil_tip", "u_p_anil", "TUTORIAL", "Three checks before you touch any switchboard: switch off at the main, test with a tester that you have first proved on a known live point, and never work on wet floors. If you are not trained, call a licensed electrician.", ["ElectricalSafety", "Tutorial"], "workshop", 20, { district: "Churu", communityId: "c_pro_electric" }),
  P("pp_suresh_work", "u_p_suresh", "WORK", "Sheesham double bed with box storage delivered in Sikar. Joinery is mortise-and-tenon, finish is two coats of melamine polish. Taking new orders from next week.", ["Carpenter", "Furniture", "Sikar"], "carpentry", 12, { district: "Sikar", communityId: "c_pro_carpentry" }),
  P("pp_suresh_skill", "u_p_suresh", "SKILL", "Measure twice, cut once — and always leave 2 mm for the polish. Small habits that save timber.", ["Carpentry", "SkillTip"], "carpentry", 30, { district: "Sikar", communityId: "c_pro_carpentry" }),
  P("pp_savitri_service", "u_p_savitri", "SERVICE", "Festival stitching slots are open: blouses, suits and alterations. Please send your request 10 days before the date — I confirm the delivery day when I accept.", ["Tailor", "Festival", "Churu"], "tailoring", 10, { district: "Churu", communityId: "c_pro_tailors" }),
  P("pp_imran_work", "u_p_imran", "WORK", "Completed 9 years on Rajasthan highways. Routine I follow on long trips: tyre and oil check at every fuel stop, a rest every 4 hours, no night driving when tired.", ["Driver", "RoadSafety"], "road", 26, { district: "Jhunjhunu", communityId: "c_pro_drivers" }),
  P("pp_gopal_work", "u_p_gopal", "WORK", "Fresh batch of terracotta planters out of the kiln. Each one is thrown on the wheel and fired for 10 hours. Diwali diya orders are open.", ["Pottery", "Handmade", "Osian"], "pottery", 16, { district: "Jodhpur", communityId: "c_pro_artisans" }),
  P("pp_ratan_opp", "u_p_ratan", "OPPORTUNITY", "Looking for 2 helpers and 1 plasterer for a house site in Churu from next week. Daily work, discuss the rate in Messages. Apply on the Opportunities page.", ["Hiring", "Construction", "Churu"], "construction", 7, { district: "Churu", communityId: "c_pro_builders" }),
  P("pp_rakesh_tip", "u_p_rakesh", "TUTORIAL", "Before giving your phone for repair: back up photos, remove the screen lock only when the technician needs it, and ask for a written estimate. Good shops will always tell you the fault first.", ["MobileRepair", "Tutorial"], "digital", 34, { district: "Churu", communityId: "c_pro_digital" }),
  P("pp_kamla_work", "u_p_kamla", "WORK", "Our group of 5 finished the mustard harvest for a farm near Rajaldesar in 3 days. Available again from next week for wheat sowing.", ["FarmWork", "Harvest", "Churu"], "mustard", 22, { district: "Churu", communityId: "c_pro_farmwork" }),
  P("pp_pooja_skill", "u_p_pooja", "SKILL", "Maths trick for class 8: turn word problems into a two-line table first. Students who do this stop making copy mistakes.", ["Tutor", "Maths", "SkillTip"], "classroom", 40, { district: "Sikar" }),
  P("pp_skill_event", "u_g_skill", "EVENT", `${DEMO_TAG} Skill Camp for electricians, carpenters and tailors at the Demo Skill & Employment Office, Jaipur. Register on KaamSetu. (Demo event for illustration.)`, ["SkillCamp", "Training", "Events"], "classroom", 15, { linkedEventId: "e_skill_camp", district: "Jaipur" }),
  P("pp_ramesh_hire", "u_ramesh", "OPPORTUNITY", "Need a tractor operator with rotavator for 3 days of land preparation near Rajaldesar. Please apply with your rate and availability.", ["Hiring", "Tractor", "Churu"], "tractor", 18, { district: "Churu", communityId: "c_pro_farmwork" }),
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

export const proReelsSeed: Reel[] = [
  R("pr_wiring_tidy", "u_p_anil", "Neat concealed wiring in 60 seconds — conduit, bends and clean junction boxes.", "Skill Tutorials", ["Electrician", "Wiring"], "workshop", 60, 5),
  R("pr_elec_safety", "u_p_anil", "Before you start: switch off, test, then work. Three habits that keep you safe.", "Workplace Safety", ["ElectricalSafety", "Safety"], "workshop", 45, 28),
  R("pr_polish", "u_p_suresh", "Two-coat wood polish: sanding grit, coat gap and what to avoid.", "Trade Tips", ["Carpentry", "Polish"], "carpentry", 58, 11),
  R("pr_bed_build", "u_p_suresh", "From planks to a finished bed — a sheesham box bed in one minute.", "Work Showcase", ["Carpentry", "Furniture"], "carpentry", 70, 44),
  R("pr_blouse_cut", "u_p_savitri", "Cutting a blouse from the measurements: the three marks I never skip.", "Skill Tutorials", ["Tailoring", "Blouse"], "tailoring", 64, 14),
  R("pr_truck_check", "u_p_imran", "Pre-trip truck check: tyres, lights, oil and brakes in 2 minutes.", "Workplace Safety", ["Driver", "RoadSafety"], "road", 50, 32),
  R("pr_wheel", "u_p_gopal", "Centering clay on the wheel — the step every beginner struggles with.", "Skill Tutorials", ["Pottery", "Wheel"], "pottery", 72, 20),
  R("pr_mason_tip", "u_p_ratan", "Mixing mortar the right way: ratio, water and when to stop mixing.", "Trade Tips", ["Mason", "Construction"], "construction", 55, 36),
  R("pr_career", "u_p_pooja", "Starting as a freelancer: how to quote, keep records and ask for a recommendation.", "Career Advice", ["Career", "Freelance"], "classroom", 66, 50),
  R("pr_phone_screen", "u_p_rakesh", "Screen replacement, step by step, with the safety tips for the battery.", "Skill Tutorials", ["MobileRepair"], "digital", 62, 40),
];

// ───────────── Government & worker programmes — ALL DEMO PLACEHOLDERS ─────────────
const DEMO_SOURCE = "https://example.org/official-source-placeholder";
const SK = (id: string, name: string, category: GovernmentScheme["category"], topic: SchemeTopic, audience: string[], description: string, deadlineDays?: number): GovernmentScheme => ({
  id,
  orgId: "org_skill",
  name: `${DEMO_TAG} ${name}`,
  category,
  state: "Rajasthan",
  description: `${description} This is DEMO DATA created to show the page layout. It is not a real scheme or programme.`,
  eligibility: ["Sample criterion 1 — age and residence (demo text)", "Sample criterion 2 — work or training background (demo text)", "Always confirm the real criteria on the official source."],
  benefits: ["Sample benefit description (demo text)", "Real benefits and amounts must be copied from the official notification."],
  documents: ["Identity proof (placeholder)", "Address proof (placeholder)", "Bank passbook copy (placeholder)"],
  applicationMethod: "Placeholder: online portal or the nearest skill / employment office. Replace with the exact method from the official source.",
  officialSource: DEMO_SOURCE,
  deadline: deadlineDays === undefined ? undefined : iso(deadlineDays),
  hidden: false,
  createdAt: iso(-8),
  isDemo: true,
  topic,
  audience,
});

export const proSchemesSeed: GovernmentScheme[] = [
  SK("s_skill_dev", "Sample Skill Training for Rural Youth", "TRAINING", "Skill development", ["ALL"], "Illustrates a short-course skill training listing with seat registration and a certificate on completion.", 25),
  SK("s_skill_trades", "Sample Trade Certification Programme", "TRAINING", "Skill development", ["pc_trades", "pc_tech"], "Illustrates a trade-test and certification programme for electricians, fitters, carpenters and technicians.", 40),
  SK("s_employment", "Sample Local Employment Registration Drive", "NOTIFICATION", "Employment", ["ALL"], "Illustrates a district notice about registering for local employment opportunities.", 12),
  SK("s_apprentice", "Sample Apprenticeship Support Programme", "SCHEME", "Apprenticeship", ["pc_trades", "pc_services", "pc_tech", "pc_artisan"], "Illustrates a programme that connects trainees with workshops and employers for on-the-job learning.", 35),
  SK("s_entrepreneur", "Sample Small Business Starter Support", "CREDIT", "Entrepreneurship", ["ALL"], "Illustrates a starter credit and mentoring facility for independent professionals starting a small business.", undefined),
  SK("s_artisan", "Sample Artisan Toolkit & Marketing Support", "SUBSIDY", "Entrepreneurship", ["pc_artisan"], "Illustrates a toolkit and exhibition-stall support page for craftspeople.", 50),
  SK("s_welfare", "Sample Unorganised Worker Welfare Registration", "SCHEME", "Worker welfare", ["ALL"], "Illustrates a worker registration page with accident cover and welfare benefits described generically.", 60),
  SK("s_safety_trades", "Sample Electrical & Construction Site Safety Advisory", "ALERT", "Safety", ["pc_trades", "pc_tech"], "Illustrates a safety advisory for electrical and construction work: protective gear, isolation and training.", undefined),
  SK("s_safety_drivers", "Sample Road Safety Awareness Camp Notice", "NOTIFICATION", "Safety", ["pr_driver", "pr_tractor_operator"], "Illustrates a notice for a road-safety awareness camp for drivers and operators.", 18),
];

// ───────────── Skill camps, job fairs, trade meet-ups ─────────────
const E = (id: string, name: string, category: AgriEvent["category"], scene: SceneKind, description: string, topics: string[], location: string, district: string, startDays: number, startHour: number, durationH: number): AgriEvent => {
  const start = new Date(Date.now() + startDays * 86_400_000);
  start.setHours(startHour, 0, 0, 0);
  return {
    id,
    organizerId: "u_g_skill",
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
    createdAt: iso(-9),
    isDemo: true,
  };
};

export const proEventsSeed: AgriEvent[] = [
  E("e_skill_camp", "Skill Camp for Trades (Demo)", "Skill Camp", "classroom", "A one-day camp with demonstrations and counselling for electricians, carpenters, tailors and technicians. DEMO EVENT created to show the event page.", ["Trade certification", "Tools & safety", "Counselling"], "Demo Skill & Employment Office, Jaipur", "Jaipur", 9, 10, 6),
  E("e_job_fair", "District Job Fair (Demo)", "Job Fair", "market", "Meet local contractors and businesses who are hiring daily, contract and permanent workers. DEMO EVENT; employers listed are placeholders.", ["Local hiring", "Contract work", "Apprenticeships"], "Demo Community Hall, Churu", "Churu", 14, 10, 7),
  E("e_trade_meetup", "Electricians' Trade Meet-up (Demo)", "Trade Meetup", "workshop", "An informal evening for electricians to share tools, solar installation tips and safety practices.", ["Solar", "Earthing", "Safety"], "Demo Community Hall, Ratangarh", "Churu", 6, 17, 3),
  E("e_artisan_fair", "Artisan Exhibition (Demo)", "Trade Meetup", "pottery", "A district exhibition where potters, weavers and craftspeople show and take made-to-order requests.", ["Pottery", "Weaving", "Handicraft"], "Demo Exhibition Ground, Jodhpur", "Jodhpur", 20, 10, 8),
];

// ───────────── Stories ─────────────
const S = (id: string, kind: StoryItem["kind"], title: string, body: string, authorId: string, link: string, scene: SceneKind, expiresInHours: number): StoryItem => ({
  id,
  kind,
  title,
  body,
  authorId,
  link,
  scene,
  createdAt: iso(0, -2),
  expiresAt: iso(0, expiresInHours),
  isDemo: true,
});

export const proStoriesSeed: StoryItem[] = [
  S("st_job_fair", "EVENT", "Job fair soon", "District Job Fair (demo) — see who is hiring.", "u_g_skill", "/events/e_job_fair", "market", 40),
  S("st_skill_scheme", "GOVERNMENT", "Skill training (demo)", `${DEMO_TAG} Sample skill-training listing added.`, "u_g_skill", "/schemes/s_skill_dev", "classroom", 46),
  S("st_hiring", "MARKET", "Hiring in Churu", "Helpers and a plasterer needed for a house site.", "u_p_ratan", "/opportunities", "construction", 30),
];

// ───────────── Follows (professionals follow each other and the skill office) ─────────────
const F = (a: string, b: string): Follow => ({ followerId: a, followingId: b, createdAt: iso(-45), isDemo: true });
export const proFollowsSeed: Follow[] = [
  ...["u_p_anil", "u_p_suresh", "u_p_savitri", "u_p_rakesh", "u_p_ratan", "u_p_kamla", "u_p_bhura"].map((p) => F(p, "u_g_skill")),
  F("u_p_ratan", "u_p_anil"),
  F("u_p_ratan", "u_p_suresh"),
  F("u_p_anil", "u_p_rakesh"),
  F("u_ramesh", "u_p_kamla"),
  F("u_ramesh", "u_p_bhura"),
  F("u_p_savitri", "u_p_laxman"),
];

// ───────────── Profession-aware courses ─────────────
const courses: Course[] = [];
const modules: CourseModule[] = [];
const course = (id: string, title: string, category: string, level: Course["level"], scene: SceneKind, authorId: string, professionIds: string[], description: string, outcomes: string[]) =>
  courses.push({ id, title, category, level, scene, authorId, description, outcomes, hidden: false, createdAt: iso(-60), isDemo: true, professionIds });
const mod = (courseId: string, order: number, title: string, kind: CourseModule["kind"], durationMin: number, body: string, quiz?: QuizQuestion[]) =>
  modules.push({ id: `${courseId}_m${order}`, courseId, order, title, kind, durationMin, body, quiz, isDemo: true });
const q = (id: string, question: string, options: string[], answerIndex: number): QuizQuestion => ({ id, question, options, answerIndex });
const NOTE = " This is general learning material. Follow your trade's safety rules and the guidance of a licensed or trained professional.";

course("crs_pro_electric", "Electrical Safety & Wiring Basics", "Electrical", "Beginner", "workshop", "u_p_anil", ["pr_electrician"], "Core safety habits and tidy wiring practice for house and small-shop work.", ["Isolate and test before work", "Plan circuits for load", "Keep wiring neat and labelled"]);
mod("crs_pro_electric", 1, "Isolate, test, then work", "ARTICLE", 8, "Always switch off at the source, lock or tag the switch if you can, and use a tester you have first proved on a known live point. Wear insulated footwear and keep your hands and the floor dry." + NOTE);
mod("crs_pro_electric", 2, "Planning circuits and loads", "VIDEO", 11, "Give heavy loads such as AC, geyser and kitchen appliances their own circuits. Size the wire and the breaker to the load, and leave spare capacity in the distribution board." + NOTE);
mod("crs_pro_electric", 3, "Earthing and tidy finishing", "ARTICLE", 9, "Good earthing protects people and appliances. Label circuits in the distribution board, keep joints inside proper boxes and never leave bare conductors exposed." + NOTE);
mod("crs_pro_electric", 4, "Quiz: electrical safety", "QUIZ", 5, "Quick quiz.", [
  q("e1", "What should you do before touching a switchboard?", ["Switch off and test it", "Touch to check", "Work with wet hands", "Skip the tester"], 0),
  q("e2", "Heavy loads like AC should have…", ["Their own circuit", "No breaker", "Thin wire", "A shared socket with everything"], 0),
]);

course("crs_pro_carpentry", "Carpentry: Measuring, Joinery & Finishing", "Carpentry", "Beginner", "carpentry", "u_p_suresh", ["pr_carpenter"], "From reading a drawing to a clean polished finish — the basics that every carpenter builds on.", ["Measure and mark accurately", "Make strong joints", "Finish wood evenly"]);
mod("crs_pro_carpentry", 1, "Measuring and marking", "ARTICLE", 8, "Use one tape for the whole job, mark with a sharp pencil or knife and cut on the waste side of the line. Check for square before gluing." + NOTE);
mod("crs_pro_carpentry", 2, "Joints that last", "VIDEO", 12, "Mortise-and-tenon, dowel and half-lap joints each suit different loads. Dry-fit before gluing and clamp evenly until the glue cures." + NOTE);
mod("crs_pro_carpentry", 3, "Sanding and polish", "ARTICLE", 8, "Move from coarse to fine grit, dust off between coats and apply thin coats of polish. Rushing the sanding is the most common cause of a poor finish." + NOTE);

course("crs_pro_tailoring", "Tailoring: Measurements & Fitting", "Tailoring", "Beginner", "tailoring", "u_p_savitri", ["pr_tailor"], "Take accurate measurements, cut with confidence and fit garments well.", ["Record measurements clearly", "Cut with allowances", "Fix common fitting problems"]);
mod("crs_pro_tailoring", 1, "Taking and recording measurements", "ARTICLE", 8, "Record every measurement in a customer card with the date. Measure over light clothing and note the customer's preferred fit." + NOTE);
mod("crs_pro_tailoring", 2, "Cutting with allowances", "VIDEO", 10, "Add seam and hem allowances before cutting and mark the grain line. Check the fabric for shrinkage if it will be washed often." + NOTE);
mod("crs_pro_tailoring", 3, "Fitting and alterations", "ARTICLE", 7, "Ask the customer to move, sit and raise their arms during a trial. Note adjustments on the card before opening a single seam." + NOTE);

course("crs_pro_driving", "Safe Driving & Vehicle Care", "Driving", "Beginner", "road", "u_p_imran", ["pr_driver", "pr_tractor_operator"], "Pre-trip checks, safe long-distance habits and basic vehicle care.", ["Run a pre-trip check", "Manage fatigue", "Carry the right papers"]);
mod("crs_pro_driving", 1, "Pre-trip check", "ARTICLE", 7, "Check tyres, lights, brakes, oil, coolant and fuel before every long trip. Carry your licence and the vehicle's papers." + NOTE);
mod("crs_pro_driving", 2, "Fatigue and night driving", "VIDEO", 9, "Plan a rest at least every four hours and avoid driving when drowsy. Keep to speed limits, especially near villages and on wet roads." + NOTE);
mod("crs_pro_driving", 3, "Quiz: safe driving", "QUIZ", 4, "Quick quiz.", [
  q("d1", "How often should a long-distance driver rest?", ["About every four hours", "Never", "Only at night", "Only when the fuel ends"], 0),
  q("d2", "Which papers should you carry?", ["Licence and vehicle papers", "Neither", "Only a phone number", "Only a photo"], 0),
]);

course("crs_pro_business", "Quote, Record & Win Repeat Customers", "Business skills", "Beginner", "market", "u_g_skill", ["ALL"], "For any independent professional: give a clear quote, keep simple records and build a reputation through completed work.", ["Write a clear estimate", "Keep a simple job record", "Ask for recommendations the right way"]);
mod("crs_pro_business", 1, "A clear estimate", "ARTICLE", 7, "Write what is included, what is not, the price type and the expected dates. Agree changes before you do them." + NOTE);
mod("crs_pro_business", 2, "Keep a simple job record", "ARTICLE", 6, "Note the customer, date, work done and amount in a notebook or on your phone. Records help you quote better and settle misunderstandings." + NOTE);
mod("crs_pro_business", 3, "Earning recommendations", "VIDEO", 8, "Finish the job on the promised date, share before-and-after photos and ask the customer for a recommendation once the work is complete. Never ask people to write something untrue." + NOTE);

export const proCoursesSeed = courses;
export const proCourseModulesSeed = modules;
