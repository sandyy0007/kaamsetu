/**
 * Demo professionals — NOT real people. Every row is isDemo:true.
 * Covers the non-farmer personas the product must support (electrician, carpenter, driver, tailor,
 * mechanic, farm workers, artisans, tutor, technician, a mason-contractor with a business) plus
 * services, portfolio, work history, recommendations, service requests, opportunities and applications.
 */
import type {
  Business,
  Conversation,
  MediaItem,
  Message,
  PortfolioEntry,
  ProfessionalProfile,
  ProfessionalSkill,
  Recommendation,
  SceneKind,
  Service,
  ServiceRequest,
  User,
  WorkApplication,
  WorkHistoryEntry,
  WorkKind,
  WorkOpportunity,
} from "@/types/domain";
import { defaultPrivacy, iso, mkUser } from "./helpers";

const YEAR = new Date().getFullYear();
const sk = (name: string, level: ProfessionalSkill["level"] = "INTERMEDIATE", years?: number, verified = false): ProfessionalSkill => ({ name, level, years, verified: verified || undefined });
const media = (id: string, caption: string, scene: SceneKind, kind: "PHOTO" | "VIDEO" = "PHOTO"): MediaItem => ({ id, kind, caption, scene });

interface Seed {
  user: User;
  profile: Omit<ProfessionalProfile, "userId" | "isDemo" | "createdAt" | "updatedAt" | "privacy" | "secondaryProfessionIds" | "certifications" | "achievements" | "languages"> & {
    secondaryProfessionIds?: string[];
    certs?: [string, string, number][];
    awards?: [string, number, string][];
    languages?: string[];
  };
}

const days = (...d: string[]) => d;
const WEEK = days("Mon", "Tue", "Wed", "Thu", "Fri", "Sat");

const pk = (id: string, role: "PROFESSIONAL", name: string, handle: string, tail: string, hue: number, headline: string, verified: boolean, createdDaysAgo = 140) =>
  mkUser(id, role, name, handle, tail, hue, { verified, headline, email: `${handle}@demo.kaamsetu.example`, createdDaysAgo });

const seeds: Seed[] = [
  {
    user: pk("u_p_anil", "PROFESSIONAL", "Anil Kumar Prajapat", "anil.electrician", "60001", 48, "Electrician · House wiring & solar · Ratangarh, Churu", true, 210),
    profile: {
      professionId: "pr_electrician",
      about: "I have wired homes, shops and small workshops around Ratangarh for 12 years. I do neat concealed wiring, DB panels, inverter and small solar installations, and fast fault finding. I give a clear estimate before starting and clean up after the job.",
      startedYear: YEAR - 12,
      skills: [sk("House wiring", "EXPERT", 12, true), sk("Fan & light fitting", "EXPERT", 12), sk("MCB / DB panel", "EXPERT", 9), sk("Inverter & battery", "INTERMEDIATE", 6), sk("Solar installation", "INTERMEDIATE", 3), sk("Fault finding", "EXPERT", 10), sk("Earthing", "INTERMEDIATE", 7)],
      languages: ["Hindi", "Rajasthani"],
      attributes: { specialties: ["House wiring", "Inverter", "Solar", "Motor repair"], workType: "All kinds", licence: "Yes", ownTools: "Yes — full kit" },
      location: { village: "Ratangarh", district: "Churu", state: "Rajasthan", serviceRadiusKm: 40, serviceAreas: ["Ratangarh", "Churu", "Sujangarh", "Rajaldesar"] },
      availability: { status: "AVAILABLE", days: WEEK, note: "Emergency calls answered the same day.", preferences: ["CONTRACT", "DAILY"] },
      businessId: "biz_anil",
      certs: [["Wireman licence course", "Demo ITI Churu", 2014], ["Solar PV installer (basic)", "Demo Skill Development Centre", 2022]],
      awards: [["Best apprentice — ITI batch", 2013, "Top of the electrician trade batch."]],
    },
  },
  {
    user: pk("u_p_suresh", "PROFESSIONAL", "Suresh Sharma", "suresh.carpenter", "60002", 28, "Carpenter · Furniture & doors · Sikar", true, 190),
    profile: {
      professionId: "pr_carpenter",
      about: "Third-generation carpenter from Sikar. I make doors, windows, beds, almirahs and modular kitchens in sheesham, teak and engineered wood. I visit the site, measure, share a drawing, and give a written timeline.",
      startedYear: YEAR - 15,
      skills: [sk("Furniture making", "EXPERT", 15, true), sk("Door & window frames", "EXPERT", 14), sk("Modular kitchen", "INTERMEDIATE", 6), sk("Wood polishing", "EXPERT", 12), sk("Wood carving", "INTERMEDIATE", 8), sk("Repair work", "EXPERT", 15)],
      languages: ["Hindi", "Shekhawati"],
      attributes: { specialties: ["Furniture", "Doors & windows", "Kitchens", "Wood carving"], workType: "Homes", ownTools: "Yes — full kit" },
      location: { village: "Fatehpur Road", district: "Sikar", state: "Rajasthan", serviceRadiusKm: 60, serviceAreas: ["Sikar", "Jhunjhunu", "Churu"] },
      availability: { status: "BUSY", days: WEEK, note: "Taking new orders from next week.", preferences: ["CONTRACT", "FREELANCE"] },
      certs: [["Furniture design & joinery", "Demo ITI Sikar", 2011]],
    },
  },
  {
    user: pk("u_p_imran", "PROFESSIONAL", "Imran Qureshi", "imran.driver", "60003", 205, "Driver · Jeep, truck & tractor-trolley · Jhunjhunu", false, 120),
    profile: {
      professionId: "pr_driver",
      about: "Safe, punctual driver with 9 years on Rajasthan highways. I drive trucks, pickups and jeeps, know the Jaipur–Delhi–Bikaner routes well and keep my vehicle papers and licence up to date.",
      startedYear: YEAR - 9,
      skills: [sk("Long-distance driving", "EXPERT", 9), sk("Truck driving", "EXPERT", 7), sk("Route knowledge", "EXPERT", 9), sk("Basic vehicle care", "INTERMEDIATE", 9)],
      languages: ["Hindi", "Urdu", "Punjabi"],
      attributes: { vehicleTypes: ["Jeep", "Truck", "Pickup", "Tractor-trolley"], licenceType: "HMV (heavy)", drivingYears: 9, ownVehicle: "No — drive owner's vehicle" },
      location: { district: "Jhunjhunu", state: "Rajasthan", serviceRadiusKm: 400, serviceAreas: ["Jhunjhunu", "Jaipur", "Bikaner", "Delhi NCR"] },
      availability: { status: "OPEN_TO_WORK", days: WEEK, preferences: ["PERMANENT", "CONTRACT"], expectedWage: { amount: 20000, unit: "MONTH" } },
    },
  },
  {
    user: pk("u_p_savitri", "PROFESSIONAL", "Savitri Devi", "savitri.tailor", "60004", 330, "Tailor · Ladies suits & blouses · Churu", true, 170),
    profile: {
      professionId: "pr_tailor",
      about: "I run a small tailoring unit from home. Blouses, salwar suits, bridal wear and school uniforms. I take measurements at home for ladies, deliver on the promised date and take alteration work too.",
      startedYear: YEAR - 11,
      skills: [sk("Blouse stitching", "EXPERT", 11, true), sk("Salwar suits", "EXPERT", 11), sk("Embroidery", "INTERMEDIATE", 6), sk("Alterations", "EXPERT", 11), sk("School uniforms", "INTERMEDIATE", 4)],
      languages: ["Hindi", "Rajasthani"],
      attributes: { specialties: ["Ladies suits", "Blouses", "Alterations", "Uniforms"], setup: "From home", homePickup: "Yes" },
      location: { village: "Churu city", district: "Churu", state: "Rajasthan", serviceRadiusKm: 15, serviceAreas: ["Churu"] },
      availability: { status: "AVAILABLE", days: WEEK, note: "Festival season: please order 10 days ahead.", preferences: ["FREELANCE", "CONTRACT"] },
      certs: [["Cutting & tailoring certificate", "Demo Mahila Skill Centre", 2015]],
    },
  },
  {
    user: pk("u_p_dilip", "PROFESSIONAL", "Dilip Meghwal", "dilip.mechanic", "60005", 168, "Mechanic · Tractor & two-wheeler repair · Nagaur", false, 110),
    profile: {
      professionId: "pr_mechanic",
      about: "Tractor and two-wheeler mechanic. Engine overhaul, clutch, hydraulic and electrical faults. I can come to the field for breakdowns during sowing and harvest.",
      startedYear: YEAR - 8,
      skills: [sk("Tractor repair", "EXPERT", 8), sk("Engine repair", "INTERMEDIATE", 8), sk("Two-wheeler service", "INTERMEDIATE", 6), sk("Electrical diagnosis", "INTERMEDIATE", 4)],
      languages: ["Hindi", "Marwari"],
      attributes: { vehicles: ["Tractor", "Two-wheeler", "Pump set"], workshop: "Own workshop" },
      location: { village: "Merta City", district: "Nagaur", state: "Rajasthan", serviceRadiusKm: 35, serviceAreas: ["Merta", "Nagaur", "Ajmer"] },
      availability: { status: "AVAILABLE", days: WEEK, preferences: ["CONTRACT", "DAILY"] },
    },
  },
  {
    user: pk("u_p_kamla", "PROFESSIONAL", "Kamla Devi Meghwal", "kamla.farmworker", "60006", 15, "Farm worker · Harvesting & sowing · Churu", false, 60),
    profile: {
      professionId: "pr_farm_worker",
      about: "Experienced in mustard and wheat harvest, sowing, weeding and cotton picking. I work with a group of 5 women and can take a full field together.",
      startedYear: YEAR - 10,
      skills: [sk("Harvesting", "EXPERT", 10), sk("Sowing", "INTERMEDIATE", 8), sk("Weeding", "EXPERT", 10), sk("Cattle care", "INTERMEDIATE", 6)],
      languages: ["Hindi", "Rajasthani"],
      attributes: { preferredWork: ["Harvesting", "Sowing", "Weeding"], travel: "Within district" },
      location: { village: "Rajaldesar", district: "Churu", state: "Rajasthan", serviceRadiusKm: 30, serviceAreas: ["Rajaldesar", "Churu", "Ratangarh"] },
      availability: { status: "OPEN_TO_WORK", days: WEEK, note: "Group of 5 available for harvest season.", preferences: ["DAILY", "SEASONAL"], expectedWage: { amount: 450, unit: "DAY" } },
    },
  },
  {
    user: pk("u_p_bhura", "PROFESSIONAL", "Bhura Ram", "bhura.tractor", "60007", 90, "Tractor operator & farm worker · Churu", false, 50),
    profile: {
      professionId: "pr_tractor_operator",
      secondaryProfessionIds: ["pr_farm_worker"],
      about: "Tractor operator with my own driving licence. Ploughing, rotavator and seed drill work. I also help with harvest.",
      startedYear: YEAR - 7,
      skills: [sk("Ploughing", "EXPERT", 7), sk("Rotavator", "INTERMEDIATE", 5), sk("Seed drill", "INTERMEDIATE", 4), sk("Harvesting", "INTERMEDIATE", 7)],
      languages: ["Hindi", "Rajasthani"],
      attributes: { machines: ["Tractor", "Rotavator", "Seed drill"], licence: "Yes" },
      location: { district: "Churu", state: "Rajasthan", serviceRadiusKm: 45, serviceAreas: ["Churu", "Sujangarh", "Taranagar"] },
      availability: { status: "OPEN_TO_WORK", days: WEEK, preferences: ["SEASONAL", "DAILY"], expectedWage: { amount: 700, unit: "DAY" } },
    },
  },
  {
    user: pk("u_p_gopal", "PROFESSIONAL", "Gopal Prajapat", "gopal.potter", "60008", 22, "Potter · Terracotta & diyas · Osian, Jodhpur", true, 150),
    profile: {
      professionId: "pr_potter",
      about: "Fourth-generation potter. I make matkas, planters, diyas and decorative terracotta, and teach pottery to school groups on request.",
      startedYear: YEAR - 20,
      skills: [sk("Wheel throwing", "EXPERT", 20, true), sk("Terracotta", "EXPERT", 20), sk("Kiln firing", "EXPERT", 18), sk("Decorative pots", "EXPERT", 15)],
      languages: ["Hindi", "Marwari"],
      attributes: { craftType: "Matkas, planters, diyas", materials: ["Clay", "Terracotta"], madeToOrder: "Yes" },
      location: { village: "Osian", district: "Jodhpur", state: "Rajasthan", serviceRadiusKm: 20, serviceAreas: ["Osian", "Jodhpur"] },
      availability: { status: "AVAILABLE", days: WEEK, note: "Diwali orders open.", preferences: ["FREELANCE", "CONTRACT"] },
      awards: [["District craft recognition", 2022, "Recognised at a district handicraft exhibition (demo)."]],
    },
  },
  {
    user: pk("u_p_laxman", "PROFESSIONAL", "Laxman Meghwal", "laxman.weaver", "60009", 305, "Handloom weaver · Daris & shawls · Bikaner", false, 100),
    profile: {
      professionId: "pr_weaver",
      about: "Handloom weaver specialising in cotton daris and woollen shawls in traditional patterns. I take custom size orders.",
      startedYear: YEAR - 14,
      skills: [sk("Dari weaving", "EXPERT", 14), sk("Handloom weaving", "EXPERT", 14), sk("Natural dyeing", "INTERMEDIATE", 6), sk("Design pattern", "INTERMEDIATE", 9)],
      languages: ["Hindi", "Marwari"],
      attributes: { craftType: "Daris, shawls", materials: ["Cotton", "Wool"], madeToOrder: "Yes" },
      location: { village: "Lunkaransar", district: "Bikaner", state: "Rajasthan", serviceRadiusKm: 25, serviceAreas: ["Bikaner"] },
      availability: { status: "AVAILABLE", days: WEEK, preferences: ["FREELANCE"] },
    },
  },
  {
    user: pk("u_p_rakesh", "PROFESSIONAL", "Rakesh Soni", "rakesh.mobile", "60010", 250, "Mobile & computer repair · Churu", false, 90),
    profile: {
      professionId: "pr_mobile_tech",
      secondaryProfessionIds: ["pr_computer_tech"],
      about: "Mobile and laptop repair with doorstep visits. Screen, battery, charging port, software and data recovery. I give a written estimate before opening the device.",
      startedYear: YEAR - 6,
      skills: [sk("Screen replacement", "EXPERT", 6), sk("Battery replacement", "EXPERT", 6), sk("Software flashing", "INTERMEDIATE", 5), sk("Laptop repair", "INTERMEDIATE", 4), sk("Data recovery", "INTERMEDIATE", 3)],
      languages: ["Hindi", "English"],
      attributes: { devices: ["Samsung", "Xiaomi", "Vivo", "Oppo", "Realme"], onsite: "Both" },
      location: { district: "Churu", state: "Rajasthan", serviceRadiusKm: 20, serviceAreas: ["Churu"] },
      availability: { status: "AVAILABLE", days: WEEK, preferences: ["FREELANCE", "CONTRACT"] },
    },
  },
  {
    user: pk("u_p_pooja", "PROFESSIONAL", "Pooja Meena", "pooja.tutor", "60011", 125, "Tutor · Maths, Science & spoken English · Sikar", true, 130),
    profile: {
      professionId: "pr_tutor",
      about: "B.Sc., B.Ed. I teach classes 6–12 Maths and Science and run a small spoken-English batch for adults. Small batches, weekly progress notes for parents.",
      startedYear: YEAR - 5,
      skills: [sk("Maths", "EXPERT", 5), sk("Science", "EXPERT", 5), sk("Spoken English", "INTERMEDIATE", 4), sk("Computer basics", "INTERMEDIATE", 3)],
      languages: ["Hindi", "English"],
      attributes: { subjects: ["Maths", "Science", "English"], classes: ["6–8", "9–10", "11–12", "Adults"], mode: "Any" },
      location: { district: "Sikar", state: "Rajasthan", serviceRadiusKm: 12, serviceAreas: ["Sikar"] },
      availability: { status: "AVAILABLE", days: days("Mon", "Tue", "Wed", "Thu", "Fri"), note: "Evening batches 5–8 pm.", preferences: ["FREELANCE", "PERMANENT"] },
      certs: [["B.Ed.", "Demo University", 2020]],
    },
  },
  {
    user: pk("u_p_ratan", "PROFESSIONAL", "Ratan Lal Gurjar", "ratan.mason", "60012", 8, "Mason & building contractor · Ratan Construction Works · Churu", true, 230),
    profile: {
      professionId: "pr_mason",
      about: "Mason with 18 years of experience, now running a small crew for house construction, slab casting and plastering. I hire electricians, carpenters and painters for my sites.",
      startedYear: YEAR - 18,
      skills: [sk("Brick work", "EXPERT", 18, true), sk("Plastering", "EXPERT", 18), sk("Concrete & slab", "EXPERT", 14), sk("Reading drawings", "INTERMEDIATE", 10), sk("Foundation", "EXPERT", 14)],
      languages: ["Hindi", "Rajasthani"],
      attributes: { specialties: ["House construction", "Slab casting"], workType: "Homes", ownTools: "Yes — full kit" },
      location: { village: "Churu city", district: "Churu", state: "Rajasthan", serviceRadiusKm: 50, serviceAreas: ["Churu", "Ratangarh", "Sardarshahar"] },
      availability: { status: "BUSY", days: WEEK, note: "Booking new sites from next month.", preferences: ["CONTRACT"] },
      businessId: "biz_ratan",
    },
  },
];

export function buildProfessionals() {
  const users = seeds.map((s) => s.user);
  const now = new Date().toISOString();
  const profiles: ProfessionalProfile[] = seeds.map(({ user, profile }) => {
    const { certs, awards, languages, secondaryProfessionIds, ...rest } = profile;
    return {
      userId: user.id,
      secondaryProfessionIds: secondaryProfessionIds ?? [],
      languages: languages ?? ["Hindi"],
      certifications: (certs ?? []).map(([title, issuer, year], i) => ({ id: `${user.id}_cert${i}`, title, issuer, year })),
      achievements: (awards ?? []).map(([title, year, description], i) => ({ id: `${user.id}_aw${i}`, title, year, description })),
      privacy: defaultPrivacy({ phone: "CONNECTIONS", locationPrecision: "DISTRICT" }),
      createdAt: user.createdAt,
      updatedAt: now,
      isDemo: true,
      ...rest,
    };
  });

  const svc = (id: string, ownerId: string, name: string, description: string, priceType: Service["priceType"], price: number | undefined, areas: string[], availability: string, m: MediaItem[] = []): Service => ({
    id, ownerId, name, description, priceType, price, areas, availability, media: m, active: true, hidden: false, createdAt: iso(-60), isDemo: true,
  });
  const services: Service[] = [
    svc("sv_anil_wiring", "u_p_anil", "House wiring", "Concealed or open wiring for new or old houses, with a written material list before starting.", "DAILY", 1000, ["Ratangarh", "Churu", "Sujangarh"], "Mon–Sat, 8 am–6 pm", [media("sm1", "Concealed wiring in a new house", "workshop")]),
    svc("sv_anil_fan", "u_p_anil", "Fan & light fitting", "Ceiling fans, tube lights, LED panels, switch board replacement.", "PER_VISIT", 250, ["Ratangarh", "Churu"], "Same-day on request"),
    svc("sv_anil_inverter", "u_p_anil", "Inverter installation", "Inverter and battery installation with proper earthing and MCB.", "FIXED", 800, ["Ratangarh", "Churu", "Rajaldesar"], "Book 1 day ahead", [media("sm2", "Inverter & battery set-up", "workshop")]),
    svc("sv_anil_fault", "u_p_anil", "Electrical fault repair", "Short circuit, tripping MCB, no-power faults found and fixed.", "PER_VISIT", 300, ["Ratangarh", "Churu"], "Emergency same day"),
    svc("sv_suresh_furn", "u_p_suresh", "Custom furniture", "Beds, almirahs, sofas and tables to your size in sheesham, teak or engineered wood.", "NEGOTIABLE", undefined, ["Sikar", "Jhunjhunu"], "Order lead time 2–3 weeks", [media("sm3", "Sheesham bed with storage", "carpentry")]),
    svc("sv_suresh_door", "u_p_suresh", "Door & window fitting", "Frame, shutter and fitting with finishing. Price per door set.", "FIXED", 1500, ["Sikar", "Churu", "Jhunjhunu"], "Site visit free within Sikar", [media("sm4", "Teak door set", "carpentry")]),
    svc("sv_suresh_repair", "u_p_suresh", "Furniture repair", "Hinges, drawers, polish and joint repair.", "PER_VISIT", 400, ["Sikar"], "Weekdays"),
    svc("sv_imran_local", "u_p_imran", "Jeep with driver", "Local and day trips with a clean jeep. Fuel extra.", "HOURLY", 250, ["Jhunjhunu", "Sikar", "Churu"], "Book a day ahead"),
    svc("sv_imran_goods", "u_p_imran", "Goods transport (pickup)", "Farm produce and household goods up to 1 tonne.", "PER_VISIT", undefined, ["Jhunjhunu", "Jaipur", "Bikaner"], "Daily"),
    svc("sv_sav_blouse", "u_p_savitri", "Blouse stitching", "Perfect-fit blouses, lining included, delivered on the promised date.", "FIXED", 250, ["Churu"], "Normal 5 days · festival 10 days", [media("sm5", "Embroidered blouse", "tailoring")]),
    svc("sv_sav_suit", "u_p_savitri", "Salwar suit stitching", "Three-piece suit stitching with your choice of cut.", "FIXED", 600, ["Churu"], "7–10 days"),
    svc("sv_sav_alter", "u_p_savitri", "Alterations", "Taking in / letting out / hem and sleeve changes.", "FIXED", 80, ["Churu"], "2–3 days"),
    svc("sv_dilip_tractor", "u_p_dilip", "Tractor repair (workshop or field)", "Engine, clutch, hydraulics and electrical faults. Field visits during season.", "PER_VISIT", 500, ["Merta", "Nagaur"], "Daily, 7 am–7 pm"),
    svc("sv_dilip_bike", "u_p_dilip", "Two-wheeler service", "General service, brake and chain.", "FIXED", 350, ["Merta"], "Daily"),
    svc("sv_bhura_plough", "u_p_bhura", "Ploughing & rotavator work", "Operator with tractor-mounted rotavator or plough (tractor provided by the farmer).", "DAILY", 700, ["Churu", "Sujangarh"], "Season: Oct–Nov & Jun–Jul"),
    svc("sv_gopal_custom", "u_p_gopal", "Custom terracotta pottery", "Planters, matkas and garden pieces to your size and design.", "NEGOTIABLE", undefined, ["Jodhpur", "Osian"], "2 weeks lead time", [media("sm6", "Terracotta planters", "pottery")]),
    svc("sv_gopal_diya", "u_p_gopal", "Diya & festival orders", "Hand-turned diyas, bulk orders for shops and events.", "FIXED", 6, ["Jodhpur", "Osian"], "Orders open Sep–Oct"),
    svc("sv_laxman_dari", "u_p_laxman", "Custom dari weaving", "Cotton dari in your chosen size and pattern.", "NEGOTIABLE", undefined, ["Bikaner"], "3 weeks lead time", [media("sm7", "Cotton dari", "tailoring")]),
    svc("sv_rakesh_screen", "u_p_rakesh", "Mobile screen replacement", "Original-grade panels, price depends on model — quoted before work.", "NEGOTIABLE", undefined, ["Churu"], "Same day for most models"),
    svc("sv_rakesh_laptop", "u_p_rakesh", "Laptop service & repair", "Windows setup, cleaning, SSD upgrade, data recovery.", "FIXED", 500, ["Churu"], "1–2 days"),
    svc("sv_pooja_tuition", "u_p_pooja", "Home tuition — Maths & Science", "Small batch (max 5 students), weekly progress notes.", "MONTHLY", 1500, ["Sikar"], "Mon–Fri evenings"),
    svc("sv_pooja_english", "u_p_pooja", "Spoken English for adults", "8-week batch, conversation practice.", "FIXED", 2000, ["Sikar"], "Weekend mornings"),
    svc("sv_ratan_house", "u_p_ratan", "House construction (labour contract)", "Foundation to slab with a trained crew. Site visit and written estimate.", "NEGOTIABLE", undefined, ["Churu", "Ratangarh", "Sardarshahar"], "Booking from next month", [media("sm8", "Two-room house frame", "construction")]),
    svc("sv_ratan_plaster", "u_p_ratan", "Plastering", "Cement plaster, per day per mason.", "DAILY", 900, ["Churu", "Ratangarh"], "Mon–Sat"),
    // A farmer offering a service — farmers are professionals too.
    svc("sv_hanuman_tractor", "u_hanuman", "Tractor ploughing with operator", "Own tractor and rotavator available for hire near Ratangarh.", "DAILY", 2200, ["Ratangarh", "Churu"], "Off-season weekdays"),
  ];

  const pe = (id: string, ownerId: string, title: string, description: string, category: string, monthsAgo: number, skillsUsed: string[], m: MediaItem[], meta?: Record<string, string>): PortfolioEntry => ({
    id, ownerId, title, description, category, date: iso(-30 * monthsAgo).slice(0, 10), skillsUsed, media: m, meta, hidden: false, createdAt: iso(-30 * monthsAgo), isDemo: true,
  });
  const portfolioEntries: PortfolioEntry[] = [
    pe("pf_anil_1", "u_p_anil", "Full-house concealed wiring — Ratangarh", "3-bedroom house, 22 points, 4 DB circuits, concealed conduit. Completed in 11 days with a final earthing check.", "Installation", 5, ["House wiring", "MCB / DB panel", "Earthing"], [media("pm1", "DB panel with labelled circuits", "workshop"), media("pm2", "Conduit before plaster", "workshop")]),
    pe("pf_anil_2", "u_p_anil", "5 kW rooftop solar for a school", "Installed panels, inverter and net-meter paperwork support for a village school.", "Installation", 9, ["Solar installation", "Inverter & battery"], [media("pm3", "Rooftop panels", "workshop")]),
    pe("pf_suresh_1", "u_p_suresh", "Teak door & window set", "Four teak doors and six windows with carved top panels for a 2-storey house.", "Project", 4, ["Door & window frames", "Wood carving"], [media("pm4", "Carved teak door", "carpentry")]),
    pe("pf_suresh_2", "u_p_suresh", "Modular kitchen cabinets", "Ply and laminate kitchen with soft-close drawers and a corner carousel.", "Project", 8, ["Modular kitchen", "Furniture making"], [media("pm5", "Kitchen cabinets", "carpentry")]),
    pe("pf_sav_1", "u_p_savitri", "Bridal lehenga & blouse set", "Hand-embroidered border with fitted blouse, completed in 18 days.", "Craft", 6, ["Embroidery", "Blouse stitching"], [media("pm6", "Bridal set", "tailoring")]),
    pe("pf_sav_2", "u_p_savitri", "School uniforms for 60 students", "Cut, stitched and delivered in 3 weeks for a village school.", "Project", 10, ["School uniforms"], [media("pm7", "Uniform batch", "tailoring")]),
    pe("pf_gopal_1", "u_p_gopal", "Terracotta garden planters", "Set of 12 planters in 3 sizes, wheel-thrown and kiln-fired.", "Craft", 3, ["Wheel throwing", "Kiln firing"], [media("pm8", "Planters", "pottery")]),
    pe("pf_laxman_1", "u_p_laxman", "Cotton dari — 6x9 ft", "Geometric pattern in natural-dyed cotton, 9 days on the loom.", "Craft", 5, ["Dari weaving", "Natural dyeing"], [media("pm9", "Cotton dari", "tailoring")]),
    pe("pf_ratan_1", "u_p_ratan", "Two-room house with slab — Churu", "Foundation, brick work, slab and plaster handled by a 6-person crew in 7 weeks.", "Project", 7, ["Foundation", "Brick work", "Concrete & slab"], [media("pm10", "House at slab stage", "construction")]),
    pe("pf_rakesh_1", "u_p_rakesh", "Recovered data from a crashed laptop drive", "Recovered family photos and school records for a customer, with written consent.", "Repair", 2, ["Data recovery", "Laptop repair"], [media("pm11", "Repair bench", "digital")]),
    pe("pf_pooja_1", "u_p_pooja", "Class 10 batch — maths results", "Eight students; every student improved by at least one grade over the term (based on school marks sheets).", "Training", 4, ["Maths"], [media("pm12", "Classroom", "classroom")]),
    pe("pf_dilip_1", "u_p_dilip", "Tractor clutch & hydraulic overhaul", "Field-side repair completed in a day during sowing season.", "Repair", 3, ["Tractor repair"], [media("pm13", "Tractor repair", "tractor")]),
    pe("pf_imran_1", "u_p_imran", "Jaipur–Delhi regular route", "Regular runs for a transport business for two years with no accident record kept on file.", "Project", 12, ["Long-distance driving", "Route knowledge"], [media("pm14", "Highway", "road")]),
  ];

  const wh = (id: string, ownerId: string, role: string, organization: string, kind: WorkKind, location: string, startDate: string, endDate: string | undefined, description: string, skills: string[]): WorkHistoryEntry => ({
    id, ownerId, role, organization, kind, location, startDate, endDate, description, skills, createdAt: iso(-100), isDemo: true,
  });
  const workHistory: WorkHistoryEntry[] = [
    wh("wh_anil_1", "u_p_anil", "Electrician (own work)", "Anil Electricals", "SELF_EMPLOYED", "Ratangarh, Churu", `${YEAR - 8}-04`, undefined, "House, shop and small workshop wiring. Inverter and solar installs.", ["House wiring", "Solar installation"]),
    wh("wh_anil_2", "u_p_anil", "Electrician helper → electrician", "Sharma Electric Works", "EMPLOYMENT", "Churu", `${YEAR - 12}-06`, `${YEAR - 8}-03`, "Learned panel wiring and motor repair under a senior electrician.", ["MCB / DB panel", "Fault finding"]),
    wh("wh_suresh_1", "u_p_suresh", "Carpenter", "Sharma Wood Works (family)", "FAMILY", "Sikar", `${YEAR - 15}-01`, undefined, "Doors, furniture and kitchens in the family workshop.", ["Furniture making", "Door & window frames"]),
    wh("wh_imran_1", "u_p_imran", "Truck driver", "Jhunjhunu Transport Co.", "EMPLOYMENT", "Jhunjhunu", `${YEAR - 6}-02`, `${YEAR - 1}-12`, "Regular Jaipur–Delhi freight route.", ["Long-distance driving", "Route knowledge"]),
    wh("wh_sav_1", "u_p_savitri", "Tailor", "Savitri Tailoring (home unit)", "SELF_EMPLOYED", "Churu", `${YEAR - 11}-03`, undefined, "Ladies tailoring, uniforms and alterations.", ["Blouse stitching", "Alterations"]),
    wh("wh_kamla_1", "u_p_kamla", "Farm worker (seasonal)", "Various farms, Rajaldesar", "SEASONAL", "Rajaldesar, Churu", `${YEAR - 10}-10`, undefined, "Mustard, wheat and cotton harvest each season.", ["Harvesting", "Weeding"]),
    wh("wh_bhura_1", "u_p_bhura", "Tractor operator", "Contract work", "CONTRACT", "Churu", `${YEAR - 7}-06`, undefined, "Ploughing and sowing for farmers across the tehsil.", ["Ploughing", "Seed drill"]),
    wh("wh_gopal_1", "u_p_gopal", "Potter", "Family pottery", "FAMILY", "Osian", `${YEAR - 20}-01`, undefined, "Wheel-thrown pottery and terracotta.", ["Wheel throwing", "Kiln firing"]),
    wh("wh_pooja_1", "u_p_pooja", "Tutor", "Independent", "INDEPENDENT", "Sikar", `${YEAR - 5}-07`, undefined, "Small-group maths and science tuition.", ["Maths", "Science"]),
    wh("wh_ratan_1", "u_p_ratan", "Mason → contractor", "Ratan Construction Works", "SELF_EMPLOYED", "Churu", `${YEAR - 8}-01`, undefined, "Small crew for houses and slabs.", ["Brick work", "Concrete & slab"]),
    wh("wh_ratan_2", "u_p_ratan", "Mason", "Local contractors", "EMPLOYMENT", "Churu", `${YEAR - 18}-05`, `${YEAR - 9}-12`, "Worked on houses and a school building.", ["Plastering", "Foundation"]),
  ];

  const businesses: Business[] = [
    { id: "biz_anil", ownerId: "u_p_anil", name: "Anil Electricals & Solar", kind: "Electrical contractor", about: "Wiring, inverter and solar installation for homes and small institutions around Churu.", services: ["House wiring", "Inverter installation", "Solar (up to 5 kW)", "Fault repair"], professionIds: ["pr_electrician"], district: "Churu", state: "Rajasthan", hidden: false, createdAt: iso(-150), isDemo: true },
    { id: "biz_ratan", ownerId: "u_p_ratan", name: "Ratan Construction Works", kind: "Building contractor", about: "House construction crew: masons, helpers, and trusted electricians, carpenters and painters on call.", services: ["House construction", "Slab casting", "Plastering"], professionIds: ["pr_mason", "pr_electrician", "pr_carpenter", "pr_painter"], district: "Churu", state: "Rajasthan", verifiedAt: iso(-60), verifiedBy: "u_admin", hidden: false, createdAt: iso(-200), isDemo: true },
  ];

  const rec = (id: string, subjectId: string, authorId: string, relationship: Recommendation["relationship"], body: string, skill: string | undefined, verified: boolean, daysAgo: number): Recommendation => ({
    id, subjectId, authorId, relationship, body, skill, interactionVerified: verified, hidden: false, createdAt: iso(-daysAgo), isDemo: true,
  });
  const recommendations: Recommendation[] = [
    rec("rc1", "u_p_anil", "u_ramesh", "CUSTOMER", "Anil fitted fans and a new switch board at my farmhouse. Came on time, explained what was wrong and charged what he quoted.", "Fan & light fitting", true, 20),
    rec("rc2", "u_p_suresh", "u_kailash", "CUSTOMER", "Suresh fitted the doors in my house. The finishing is very clean and he finished on the day he promised.", "Door & window frames", true, 35),
    rec("rc3", "u_p_ratan", "u_p_suresh", "COLLEAGUE", "I have done carpentry on two of Ratan ji's sites. Payments were on time and the crew was well organised.", "Brick work", false, 50),
    rec("rc4", "u_p_savitri", "u_sunita", "CUSTOMER", "Savitri stitched my daughter's wedding blouses. Fit was perfect and the embroidery was neat.", "Blouse stitching", true, 45),
  ];

  const sr = (id: string, serviceId: string, providerId: string, requesterId: string, daysAhead: number, district: string, description: string, status: ServiceRequest["status"], conversationId?: string): ServiceRequest => ({
    id, serviceId, providerId, requesterId, date: iso(daysAhead).slice(0, 10), location: { district, state: "Rajasthan" }, description, status, conversationId, createdAt: iso(daysAhead - 3), updatedAt: iso(daysAhead - 2), isDemo: true,
  });
  const serviceRequests: ServiceRequest[] = [
    sr("sr1", "sv_anil_fan", "u_p_anil", "u_ramesh", -20, "Churu", "Two ceiling fans and one switch board at the farmhouse.", "COMPLETED"),
    sr("sr2", "sv_suresh_door", "u_p_suresh", "u_kailash", -35, "Jaipur", "Four door sets for a new house.", "COMPLETED"),
    sr("sr3", "sv_anil_inverter", "u_p_anil", "u_ramesh", 3, "Churu", "Install a 1 kVA inverter with battery near the dairy shed.", "PENDING"),
    sr("sr4", "sv_sav_blouse", "u_p_savitri", "u_sunita", 5, "Hanumangarh", "Three blouses before the wedding season — I can send measurements.", "ACCEPTED", "cv_sr4"),
  ];
  const conversations: Conversation[] = [
    { id: "cv_sr4", participantIds: ["u_sunita", "u_p_savitri"], context: { kind: "SERVICE", id: "sr4", title: "Blouse stitching" }, createdAt: iso(-2), updatedAt: iso(0, -3), isDemo: true },
  ];
  const mk = (id: string, sender: string, body: string, h: number, readBy: string[]): Message => ({ id, conversationId: "cv_sr4", senderId: sender, body, attachments: [], readBy, createdAt: iso(0, -h), isDemo: true });
  const messages: Message[] = [
    mk("ms_sr4a", "u_p_savitri", "Namaste Sunita ji, I accepted your request. Please send the fabric by courier or bring it to Churu and I will take measurements.", 30, ["u_p_savitri", "u_sunita"]),
    mk("ms_sr4b", "u_sunita", "Thank you. I will send it by bus on Friday.", 3, ["u_sunita"]),
  ];

  const wo = (id: string, posterId: string, title: string, description: string, kind: WorkOpportunity["kind"], professionIds: string[], skills: string[], openings: number, district: string, startInDays: number | undefined, pay: WorkOpportunity["pay"], duration: string | undefined, extra: Partial<WorkOpportunity> = {}): WorkOpportunity => ({
    id, posterId, title, description, kind, professionIds, skills, openings, location: { district, state: "Rajasthan" }, startDate: startInDays === undefined ? undefined : iso(startInDays).slice(0, 10), mode: "ONSITE", pay, duration, contactMethod: "IN_APP", status: "OPEN", hidden: false, createdAt: iso(-(1 + (id.length % 5))), isDemo: true, ...extra,
  });
  const workOpportunities: WorkOpportunity[] = [
    wo("wo1", "u_p_ratan", "Electrician for 2-storey house wiring", "Concealed wiring for a new 2-storey house in Churu: 38 points, 2 DB boards. Material provided by the owner. Experience with earthing needed.", "CONTRACT", ["pr_electrician"], ["House wiring", "MCB / DB panel", "Earthing"], 1, "Churu", 7, { min: 900, max: 1100, unit: "DAY" }, "About 3 weeks", { businessId: "biz_ratan" }),
    wo("wo2", "u_p_ratan", "Carpenter for door & window frames", "10 doors and 12 window frames, frame and shutter fitting at site. Own basic tools required.", "CONTRACT", ["pr_carpenter"], ["Door & window frames"], 2, "Churu", 14, { min: 850, max: 1000, unit: "DAY" }, "2 weeks", { businessId: "biz_ratan" }),
    wo("wo3", "u_ramesh", "Mustard harvest labour — 8 workers", "Harvest and bundling on 6 acres at Rajaldesar. Water and tea provided. Group applications welcome.", "SEASONAL", ["pr_farm_worker"], ["Harvesting", "Weeding"], 8, "Churu", 20, { min: 450, max: 500, unit: "DAY" }, "10–12 days"),
    wo("wo4", "u_b_marudhara", "HMV driver — Jaipur–Churu oil route", "Regular route for oil delivery trucks. HMV licence and 3 years' experience required. Monthly salary, PF as per rules.", "JOB", ["pr_driver"], ["Truck driving", "Route knowledge"], 2, "Jaipur", 10, { min: 18000, max: 22000, unit: "MONTH" }, "Permanent"),
    wo("wo5", "u_p_savitri", "Apprentice tailor (women)", "Learn ladies' tailoring in a small home unit. Stipend based on skill after the first month.", "APPRENTICESHIP", ["pr_tailor"], ["Salwar suits", "Alterations"], 2, "Churu", 12, { unit: "NEGOTIABLE" }, "6 months"),
    wo("wo6", "u_f_shekhawati", "Tractor operator — custom hiring centre", "Operators for the FPO's custom hiring centre during sowing. Training on seed drill provided.", "SEASONAL", ["pr_tractor_operator"], ["Ploughing", "Seed drill"], 3, "Churu", 25, { min: 700, max: 800, unit: "DAY" }, "Oct–Nov"),
    wo("wo7", "u_g_kvk", "Drip & sprinkler installation training (15 days)", "DEMO — Free skill training for rural youth on drip and sprinkler installation. Always confirm dates and eligibility with the official centre before travelling.", "TRAINING", ["pr_agri_technician", "pr_farm_worker"], ["Drip installation", "Sprinkler setup"], 30, "Churu", 30, { unit: "NEGOTIABLE" }, "15 days"),
    wo("wo8", "u_f_dairy", "Poster & banner design for Kisan Mela stall", "Freelance work: design 3 posters and 2 banners in Hindi. Remote OK.", "FREELANCE", ["pr_freelancer"], ["Graphic design"], 1, "Bikaner", 5, { min: 3000, max: 5000, unit: "PROJECT" }, "1 week", { mode: "REMOTE" }),
  ];

  const ap = (id: string, opportunityId: string, applicantId: string, note: string, status: WorkApplication["status"], daysAgo: number): WorkApplication => ({
    id, opportunityId, applicantId, note, status, createdAt: iso(-daysAgo), updatedAt: iso(-daysAgo), isDemo: true,
  });
  const applications: WorkApplication[] = [
    ap("ap1", "wo3", "u_p_kamla", "I can bring 4 women from my group. Available from the first day.", "SHORTLISTED", 1),
    ap("ap2", "wo3", "u_p_bhura", "Can help with harvest and operate the thresher if needed.", "APPLIED", 1),
    ap("ap3", "wo2", "u_p_suresh", "Can start after 10 days; I will bring two helpers.", "APPLIED", 2),
    ap("ap4", "wo6", "u_p_bhura", "I have a tractor licence and 7 years of experience.", "APPLIED", 1),
  ];

  return { users, profiles, services, portfolioEntries, workHistory, businesses, recommendations, serviceRequests, conversations, messages, workOpportunities, applications };
}
