import type {
  BuyerRequirement,
  Crop,
  CropCycle,
  CropStatus,
  ExpenseCategory,
  Farm,
  FarmExpense,
  Harvest,
  MachineryListing,
  ProduceListing,
  SceneKind,
  Season,
  StageKey,
  StageRecord,
} from "@/types/domain";
import { STAGE_KEYS } from "@/types/domain";
import { iso, on } from "./helpers";

const addDays = (isoDate: string, d: number) => new Date(new Date(isoDate).getTime() + d * 86_400_000).toISOString();

type Offsets = Partial<Record<StageKey, number>>;
const MUSTARD_OFFSETS: Offsets = { landPrep: -12, seedSelection: -6, sowing: 0, irrigation: 28, fertilization: 32, pestManagement: 70, harvest: 150, sale: 170 };
const WHEAT_OFFSETS: Offsets = { landPrep: -15, seedSelection: -7, sowing: 0, irrigation: 21, fertilization: 25, pestManagement: 70, harvest: 145, sale: 165 };
const BAJRA_OFFSETS: Offsets = { landPrep: -10, seedSelection: -4, sowing: 0, irrigation: 30, fertilization: 25, pestManagement: 45, harvest: 80, sale: 95 };

function completedStages(sowing: string, offsets: Offsets, upTo: StageKey | "sale"): Record<StageKey, StageRecord> {
  const idx = STAGE_KEYS.indexOf(upTo);
  return Object.fromEntries(
    STAGE_KEYS.map((k, i) => [k, i <= idx ? { done: true, date: addDays(sowing, offsets[k] ?? 0) } : { done: false }]),
  ) as Record<StageKey, StageRecord>;
}

const farms: Farm[] = [];
const crops: Crop[] = [];
const cycles: CropCycle[] = [];
const expenses: FarmExpense[] = [];
const harvests: Harvest[] = [];

function farm(id: string, ownerId: string, name: string, areaAcres: number, soil: string, irrigation: string, village: string, district: string, scene: SceneKind, history: Farm["history"]) {
  farms.push({ id, ownerId, name, areaAcres, soil, irrigation, village, district, scene, history, createdAt: iso(-300), isDemo: true });
}

function crop(id: string, ownerId: string, farmId: string, name: string, experienceYears: number, season: Season, areaAcres: number, method: string, yieldPerAcre: number, status: CropStatus) {
  crops.push({ id, ownerId, farmId, name, experienceYears, season, areaAcres, method, typicalYieldQtlPerAcre: yieldPerAcre, status, createdAt: iso(-280), isDemo: true });
}

function cycle(
  id: string,
  cropId: string,
  farmId: string,
  ownerId: string,
  season: Season,
  year: number,
  areaAcres: number,
  seed: string,
  status: CropStatus,
  stages: Record<StageKey, StageRecord>,
) {
  cycles.push({ id, cropId, farmId, ownerId, season, year, areaAcres, seed, status, stages, createdAt: iso(-250), isDemo: true });
}

function spend(cycleId: string, ownerId: string, base: string, rows: [ExpenseCategory, number, number, string?][]) {
  rows.forEach(([category, amount, dayOffset, note], i) =>
    expenses.push({ id: `${cycleId}_e${i}`, cycleId, ownerId, category, amount, date: addDays(base, dayOffset), note, isDemo: true }),
  );
}

function harvest(cycleId: string, ownerId: string, date: string, quantityQtl: number, soldQtl: number, sellingPricePerQtl: number) {
  harvests.push({ id: `${cycleId}_h0`, cycleId, ownerId, date, quantityQtl, soldQtl, sellingPricePerQtl, isDemo: true });
}

// ───────────── Ramesh (main demo farmer) ─────────────
farm("f_r_main", "u_ramesh", "Bada Khet (main field)", 8, "Sandy loam", "Sprinkler", "Rajaldesar", "Churu", "mustard", [
  { year: 2024, crop: "Mustard" },
  { year: 2025, crop: "Mustard" },
  { year: 2026, crop: "Mustard" },
]);
farm("f_r_nahar", "u_ramesh", "Nahar wala khet", 4, "Loamy", "Canal", "Rajaldesar", "Churu", "wheat", [
  { year: 2024, crop: "Wheat" },
  { year: 2025, crop: "Wheat" },
]);

crop("c_r_mustard", "u_ramesh", "f_r_main", "Mustard", 14, "Rabi", 6, "Integrated (IPM)", 7.5, "GROWING");
crop("c_r_wheat", "u_ramesh", "f_r_nahar", "Wheat", 22, "Rabi", 4, "Conventional", 18, "PLANNED");
crop("c_r_bajra", "u_ramesh", "f_r_main", "Bajra", 22, "Kharif", 5, "Natural farming", 6, "HARVESTED");
crop("c_r_chickpea", "u_ramesh", "f_r_main", "Chickpea", 6, "Rabi", 2, "Conventional", 5, "PLANNED");

// Mustard — current (Rabi 2026-27) — sowing relative to today so "next activity" is always fresh
const sow26 = iso(-9);
cycle("cyc_r_must26", "c_r_mustard", "f_r_main", "u_ramesh", "Rabi", new Date().getFullYear(), 6, "Certified mustard seed (treated)", "GROWING", {
  landPrep: { done: true, date: addDays(sow26, -12) },
  seedSelection: { done: true, date: addDays(sow26, -6), note: "Certified seed, treated before sowing" },
  sowing: { done: true, date: sow26 },
  irrigation: { done: false, date: iso(2), note: "Light irrigation after germination (planned)" },
  fertilization: { done: false, date: iso(14), note: "Top dressing as per soil test" },
  pestManagement: { done: false, date: iso(45), note: "Start scouting for aphids" },
  harvest: { done: false },
  sale: { done: false },
});
spend("cyc_r_must26", "u_ramesh", sow26, [
  ["SEED", 2400, -6, "Certified seed 12 kg"],
  ["FERTILIZER", 9500, -4, "Basal dose"],
  ["IRRIGATION", 3000, -10, "Pre-sowing irrigation (diesel/electricity)"],
  ["LABOUR", 6000, 0],
  ["MACHINERY", 7500, -8, "Ploughing and levelling"],
]);

// Wheat — planned
cycle("cyc_r_wheat26", "c_r_wheat", "f_r_nahar", "u_ramesh", "Rabi", new Date().getFullYear(), 4, "To be selected", "PLANNED", {
  landPrep: { done: false, date: iso(25), note: "Plan land preparation after kharif residue removal" },
  seedSelection: { done: false },
  sowing: { done: false, date: iso(40) },
  irrigation: { done: false },
  fertilization: { done: false },
  pestManagement: { done: false },
  harvest: { done: false },
  sale: { done: false },
});

// Historical cycles
const m25 = on(2025, 10, 6);
cycle("cyc_r_must25", "c_r_mustard", "f_r_main", "u_ramesh", "Rabi", 2025, 6, "Certified mustard seed", "SOLD", completedStages(m25, MUSTARD_OFFSETS, "sale"));
spend("cyc_r_must25", "u_ramesh", m25, [["SEED", 2200, -6], ["FERTILIZER", 10500, -3], ["IRRIGATION", 6000, 28], ["LABOUR", 21000, 60], ["PESTICIDE", 3800, 70], ["MACHINERY", 19000, -8]]);
harvest("cyc_r_must25", "u_ramesh", addDays(m25, 150), 42, 40, 5800);

const m24 = on(2024, 10, 8);
cycle("cyc_r_must24", "c_r_mustard", "f_r_main", "u_ramesh", "Rabi", 2024, 6, "Local improved variety", "SOLD", completedStages(m24, MUSTARD_OFFSETS, "sale"));
spend("cyc_r_must24", "u_ramesh", m24, [["SEED", 2000, -6], ["FERTILIZER", 9800, -3], ["IRRIGATION", 5600, 28], ["LABOUR", 19500, 60], ["PESTICIDE", 4200, 70], ["MACHINERY", 17900, -8]]);
harvest("cyc_r_must24", "u_ramesh", addDays(m24, 150), 38, 38, 5500);

const w25 = on(2025, 11, 14);
cycle("cyc_r_wheat25", "c_r_wheat", "f_r_nahar", "u_ramesh", "Rabi", 2025, 4, "Certified wheat seed", "HARVESTED", completedStages(w25, WHEAT_OFFSETS, "harvest"));
spend("cyc_r_wheat25", "u_ramesh", w25, [["SEED", 6400, -7], ["FERTILIZER", 14000, 2], ["IRRIGATION", 9000, 21], ["LABOUR", 16000, 60], ["PESTICIDE", 2400, 70], ["MACHINERY", 15000, 140]]);
harvest("cyc_r_wheat25", "u_ramesh", addDays(w25, 145), 72, 60, 2500);

const w24 = on(2024, 11, 16);
cycle("cyc_r_wheat24", "c_r_wheat", "f_r_nahar", "u_ramesh", "Rabi", 2024, 4, "Certified wheat seed", "SOLD", completedStages(w24, WHEAT_OFFSETS, "sale"));
spend("cyc_r_wheat24", "u_ramesh", w24, [["SEED", 6000, -7], ["FERTILIZER", 13200, 2], ["IRRIGATION", 8200, 21], ["LABOUR", 15000, 60], ["PESTICIDE", 2200, 70], ["MACHINERY", 14000, 140]]);
harvest("cyc_r_wheat24", "u_ramesh", addDays(w24, 145), 66, 66, 2350);

const b25 = on(2025, 7, 10);
cycle("cyc_r_bajra25", "c_r_bajra", "f_r_main", "u_ramesh", "Kharif", 2025, 5, "Local bajra seed", "SOLD", completedStages(b25, BAJRA_OFFSETS, "sale"));
spend("cyc_r_bajra25", "u_ramesh", b25, [["SEED", 1200, -4], ["FERTILIZER", 7500, 20], ["LABOUR", 15000, 40], ["MACHINERY", 11000, -10], ["PESTICIDE", 1800, 45]]);
harvest("cyc_r_bajra25", "u_ramesh", addDays(b25, 80), 28, 28, 2300);

const b26 = on(new Date().getFullYear(), 7, 8);
cycle("cyc_r_bajra26", "c_r_bajra", "f_r_main", "u_ramesh", "Kharif", new Date().getFullYear(), 5, "Local bajra seed", "HARVESTED", completedStages(b26, BAJRA_OFFSETS, "harvest"));
spend("cyc_r_bajra26", "u_ramesh", b26, [["SEED", 1300, -4], ["FERTILIZER", 6800, 20, "Compost + small urea dose"], ["LABOUR", 15500, 40], ["MACHINERY", 11500, -10], ["PESTICIDE", 1500, 45]]);
harvest("cyc_r_bajra26", "u_ramesh", addDays(b26, 80), 30, 22, 2350);

// ───────────── Other farmers (farm + crops, one cycle for Sunita) ─────────────
farm("f_s_main", "u_sunita", "Canal farm", 14, "Alluvial", "Canal", "Pilibanga", "Hanumangarh", "wheat", [{ year: 2025, crop: "Wheat" }]);
crop("c_s_wheat", "u_sunita", "f_s_main", "Wheat", 16, "Rabi", 10, "Conventional", 19, "PLANNED");
crop("c_s_fodder", "u_sunita", "f_s_main", "Fodder (berseem)", 10, "Rabi", 3, "Conventional", 0, "GROWING");
const sw25 = on(2025, 11, 10);
cycle("cyc_s_wheat25", "c_s_wheat", "f_s_main", "u_sunita", "Rabi", 2025, 10, "Certified wheat seed", "HARVESTED", completedStages(sw25, WHEAT_OFFSETS, "harvest"));
spend("cyc_s_wheat25", "u_sunita", sw25, [["SEED", 16000, -7], ["FERTILIZER", 34000, 2], ["IRRIGATION", 12000, 21], ["LABOUR", 28000, 60], ["MACHINERY", 36000, 140]]);
harvest("cyc_s_wheat25", "u_sunita", addDays(sw25, 145), 190, 110, 2480);

farm("f_m_main", "u_mohan", "Dhani khet", 20, "Sandy", "Rain-fed", "Neem Ka Thana", "Sikar", "bajra", [{ year: 2025, crop: "Bajra" }]);
crop("c_m_bajra", "u_mohan", "f_m_main", "Bajra", 28, "Kharif", 12, "Conventional", 6, "HARVESTED");
crop("c_m_moong", "u_mohan", "f_m_main", "Moong", 15, "Kharif", 6, "Integrated (IPM)", 2.5, "HARVESTED");

farm("f_k_main", "u_kailash", "Drip vegetable farm", 5, "Loamy", "Drip", "Chaksu", "Jaipur", "vegetables", [{ year: 2025, crop: "Tomato" }]);
crop("c_k_tomato", "u_kailash", "f_k_main", "Tomato", 10, "Zaid", 2, "Integrated (IPM)", 90, "GROWING");
crop("c_k_onion", "u_kailash", "f_k_main", "Onion", 8, "Rabi", 3, "Conventional", 60, "PLANNED");

farm("f_g_main", "u_geeta", "Organic block", 15, "Sandy loam", "Rain-fed", "Osian", "Jodhpur", "organic", [{ year: 2024, crop: "Guar" }, { year: 2025, crop: "Bajra" }]);
crop("c_g_bajra", "u_geeta", "f_g_main", "Bajra", 14, "Kharif", 8, "Organic", 5, "HARVESTED");
crop("c_g_guar", "u_geeta", "f_g_main", "Guar", 10, "Kharif", 4, "Organic", 3, "HARVESTED");

farm("f_d_main", "u_dinesh", "Rajgarh khet", 9, "Alluvial", "Tube-well", "Rajgarh", "Alwar", "mustard", [{ year: 2025, crop: "Mustard" }]);
crop("c_d_mustard", "u_dinesh", "f_d_main", "Mustard", 18, "Rabi", 9, "Conventional", 8, "SOLD");

farm("f_b_main", "u_bhanwar", "Merta farm", 14, "Sandy loam", "Tube-well", "Merta", "Nagaur", "chickpea", [{ year: 2025, crop: "Chickpea" }]);
crop("c_b_chickpea", "u_bhanwar", "f_b_main", "Chickpea", 22, "Rabi", 7, "Integrated (IPM)", 6, "SOLD");
crop("c_b_cumin", "u_bhanwar", "f_b_main", "Cumin", 12, "Rabi", 3, "Integrated (IPM)", 3, "SOLD");

farm("f_p_main", "u_pushpa", "Fodder & dairy farm", 6, "Sandy loam", "Tube-well", "Lunkaransar", "Bikaner", "dairy", []);
crop("c_p_fodder", "u_pushpa", "f_p_main", "Fodder (sorghum)", 11, "Kharif", 3, "Conventional", 0, "GROWING");

farm("f_h_main", "u_hanuman", "Ratangarh khet", 10, "Sandy", "Tube-well", "Ratangarh", "Churu", "mustard", [{ year: 2025, crop: "Mustard" }]);
crop("c_h_mustard", "u_hanuman", "f_h_main", "Mustard", 18, "Rabi", 10, "Conventional", 7, "SOLD");

farm("f_l_main", "u_laxmi", "Suratgarh mechanised farm", 40, "Alluvial", "Canal", "Suratgarh", "Sri Ganganagar", "wheat", [{ year: 2025, crop: "Wheat" }]);
crop("c_l_wheat", "u_laxmi", "f_l_main", "Wheat", 21, "Rabi", 40, "Conventional", 20, "PLANNED");
crop("c_l_cotton", "u_laxmi", "f_l_main", "Cotton", 15, "Kharif", 20, "Integrated (IPM)", 8, "GROWING");

export const farmingSeed = { farms, crops, cycles, expenses, harvests };

// ───────────── Marketplace ─────────────
const L = (
  id: string,
  ownerId: string,
  crop: string,
  quantity: number,
  expectedPrice: number,
  district: string,
  village: string,
  harvestDate: string,
  grade: ProduceListing["grade"],
  method: string,
  description: string,
  extra: Partial<ProduceListing> = {},
): ProduceListing => ({
  id,
  ownerId,
  crop,
  quantity,
  unit: "QUINTAL",
  expectedPrice,
  location: { village, district, state: "Rajasthan" },
  harvestDate,
  grade,
  method,
  organic: method === "Organic",
  status: "AVAILABLE",
  description,
  hidden: false,
  createdAt: iso(-Math.floor(Math.random() * 6) - 1),
  isDemo: true,
  ...extra,
});

export const listingsSeed: ProduceListing[] = [
  L("l_r_wheat", "u_ramesh", "Wheat", 12, 2450, "Churu", "Rajaldesar", on(2026, 4, 10), "A", "Conventional", "Cleaned and bagged, moisture-checked. Stored in a dry godown.", { variety: "Sharbati-type" }),
  L("l_r_bajra", "u_ramesh", "Bajra", 8, 2300, "Churu", "Rajaldesar", iso(-12), "A", "Natural farming", "Fresh Kharif harvest, naturally grown on trial plot and main field.", { variety: "Local" }),
  L("l_h_mustard", "u_hanuman", "Mustard", 55, 5900, "Churu", "Ratangarh", on(2026, 3, 18), "A", "Conventional", "Stored seed, clean and dry. Oil content report available on request.", {}),
  L("l_fpo_mustard", "u_f_shekhawati", "Mustard", 45, 5950, "Churu", "Rajaldesar", on(2026, 3, 20), "A", "Conventional", "Collective lot aggregated from member farmers, graded by the FPO.", { fpoId: "fpo_shekhawati" }),
  L("l_d_mustard", "u_dinesh", "Mustard", 80, 5800, "Alwar", "Rajgarh", on(2026, 3, 10), "B", "Conventional", "Good quality seed, available for pickup.", {}),
  L("l_s_wheat", "u_sunita", "Wheat", 80, 2480, "Hanumangarh", "Pilibanga", on(2026, 4, 5), "A", "Conventional", "Canal-irrigated, machine-cleaned.", {}),
  L("l_m_bajra", "u_mohan", "Bajra", 40, 2250, "Sikar", "Neem Ka Thana", iso(-8), "A", "Conventional", "New crop, sun dried.", {}),
  L("l_m_moong", "u_mohan", "Moong", 12, 7200, "Sikar", "Neem Ka Thana", iso(-6), "A", "Integrated (IPM)", "Bold green grains, low damage.", {}),
  L("l_k_tomato", "u_kailash", "Tomato", 30, 1800, "Jaipur", "Chaksu", iso(-1), "A", "Integrated (IPM)", "Drip-grown, graded and crated. Frequent supply available.", { variety: "Hybrid" }),
  L("l_k_onion", "u_kailash", "Onion", 50, 1400, "Jaipur", "Chaksu", on(2026, 4, 25), "B", "Conventional", "Cured onions in storage.", {}),
  L("l_g_bajra", "u_geeta", "Bajra", 25, 3400, "Jodhpur", "Osian", iso(-14), "A", "Organic", "Organic practices for 8 years; documentation available. Verify certification with the farmer before buying.", {}),
  L("l_g_guar", "u_geeta", "Guar", 10, 5600, "Jodhpur", "Osian", iso(-10), "A", "Organic", "Organically grown cluster bean seed.", {}),
  L("l_b_chickpea", "u_bhanwar", "Chickpea", 35, 5600, "Nagaur", "Merta", on(2026, 3, 28), "A", "Integrated (IPM)", "Desi chickpea, bold, treated seed used.", {}),
  L("l_b_cumin", "u_bhanwar", "Cumin", 8, 38000, "Nagaur", "Merta", on(2026, 3, 30), "A", "Integrated (IPM)", "Machine-cleaned cumin, low stem content.", {}),
  L("l_l_wheat", "u_laxmi", "Wheat", 300, 2420, "Sri Ganganagar", "Suratgarh", on(2026, 4, 12), "A", "Conventional", "Truck-load lots available, bulk loading from farm godown.", {}),
  L("l_fpo_bajra", "u_f_thar", "Bajra", 120, 2300, "Jodhpur", "Osian", iso(-9), "A", "Conventional", "Aggregated bajra from 30 members; moisture tested.", { fpoId: "fpo_thar" }),
];

export const requirementsSeed: BuyerRequirement[] = [
  { id: "req_marudhara_mustard", buyerId: "u_b_marudhara", crop: "Mustard", quantity: 100, unit: "QUINTAL", district: "Churu", state: "Rajasthan", windowStart: iso(8), windowEnd: iso(18), notes: "Clean, dry seed. Moisture below 8%. Pickup from farm or FPO godown. Payment after quality check.", status: "OPEN", hidden: false, createdAt: iso(-2), isDemo: true },
  { id: "req_annapurna_bajra", buyerId: "u_b_annapurna", crop: "Bajra", quantity: 200, unit: "QUINTAL", district: "Jodhpur", state: "Rajasthan", windowStart: iso(10), windowEnd: iso(30), notes: "Bulk lots preferred. Samples may be requested.", status: "OPEN", hidden: false, createdAt: iso(-3), isDemo: true },
  { id: "req_thar_chickpea", buyerId: "u_b_thar", crop: "Chickpea", quantity: 50, unit: "QUINTAL", district: "Nagaur", state: "Rajasthan", windowStart: iso(15), windowEnd: iso(40), notes: "Desi chickpea, bold grain.", status: "OPEN", hidden: false, createdAt: iso(-1), isDemo: true },
  { id: "req_aravali_bajra", buyerId: "u_b_aravali", crop: "Bajra", quantity: 30, unit: "QUINTAL", district: "Jodhpur", state: "Rajasthan", windowStart: iso(7), windowEnd: iso(25), notes: "Organic or transition-organic only. Share your practice documentation.", status: "OPEN", hidden: false, createdAt: iso(-4), isDemo: true },
];

const M = (id: string, ownerId: string, type: MachineryListing["type"], name: string, district: string, rate: number, rateUnit: MachineryListing["rateUnit"], description: string, available = true): MachineryListing => ({
  id,
  ownerId,
  type,
  name,
  district,
  state: "Rajasthan",
  available,
  rate,
  rateUnit,
  description,
  hidden: false,
  createdAt: iso(-10),
  isDemo: true,
});

export const machinerySeed: MachineryListing[] = [
  M("mc_r_tractor", "u_ramesh", "Tractor", "45 HP tractor with trolley", "Churu", 700, "HOUR", "Available for ploughing and transport within 25 km. Driver included."),
  M("mc_l_combine", "u_laxmi", "Harvester", "Combine harvester", "Sri Ganganagar", 2200, "ACRE", "Wheat and mustard harvesting; book 5 days ahead in season."),
  M("mc_m_rotavator", "u_mohan", "Rotavator", "7-ft rotavator", "Sikar", 550, "HOUR", "Fits 35+ HP tractors."),
  M("mc_k_sprayer", "u_kailash", "Sprayer", "Boom power sprayer", "Jaipur", 350, "ACRE", "Operator trained in safe pesticide handling; PPE provided."),
  M("mc_h_thresher", "u_hanuman", "Thresher", "Multi-crop thresher", "Churu", 3000, "DAY", "Mustard, wheat and chickpea.", false),
  M("mc_b_seeddrill", "u_bhanwar", "Seed Drill", "9-tyne seed drill", "Nagaur", 400, "ACRE", "Good for chickpea and wheat sowing."),
  M("mc_s_tractor", "u_sunita", "Tractor", "50 HP tractor", "Hanumangarh", 750, "HOUR", "Canal-belt area; transport available."),
  M("mc_p_chaff", "u_pushpa", "Other", "Chaff cutter (motorised)", "Bikaner", 800, "DAY", "For green and dry fodder."),
];
