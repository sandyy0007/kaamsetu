/**
 * Profession catalog — REFERENCE data (not demo content), so rows are isDemo:false and survive purgeDemoData().
 * Everything profession-specific (suggested skills/services, profile fields, dashboard flavour) is declared here
 * as data. UI and API never hardcode a profession — adding a profession is adding a row (or admin approving a custom one).
 */
import type { AttributeField, Profession, ProfessionCategory, SkillEntry } from "@/types/domain";

export const CATEGORY_IDS = {
  agri: "pc_agri",
  trades: "pc_trades",
  services: "pc_services",
  artisan: "pc_artisan",
  tech: "pc_tech",
  independent: "pc_independent",
  other: "pc_other",
} as const;

export const professionCategoriesSeed: ProfessionCategory[] = [
  { id: CATEGORY_IDS.agri, name: "Agriculture", nameHi: "कृषि", emoji: "🌾", order: 1, isDemo: false },
  { id: CATEGORY_IDS.trades, name: "Skilled Trades", nameHi: "कुशल कारीगर", emoji: "🛠️", order: 2, isDemo: false },
  { id: CATEGORY_IDS.services, name: "Services", nameHi: "सेवाएं", emoji: "🧰", order: 3, isDemo: false },
  { id: CATEGORY_IDS.artisan, name: "Artisan", nameHi: "शिल्पकार", emoji: "🏺", order: 4, isDemo: false },
  { id: CATEGORY_IDS.tech, name: "Technical", nameHi: "तकनीकी", emoji: "🔌", order: 5, isDemo: false },
  { id: CATEGORY_IDS.independent, name: "Independent", nameHi: "स्वतंत्र", emoji: "💼", order: 6, isDemo: false },
  { id: CATEGORY_IDS.other, name: "Other", nameHi: "अन्य", emoji: "✨", order: 7, isDemo: false },
];

const chips = (key: string, label: string, options?: string[], hint?: string): AttributeField => ({ key, label, type: "chips", options, hint });
const select = (key: string, label: string, options: string[]): AttributeField => ({ key, label, type: "select", options });
const num = (key: string, label: string, hint?: string): AttributeField => ({ key, label, type: "number", hint });
const text = (key: string, label: string, placeholder?: string): AttributeField => ({ key, label, type: "text", placeholder });

type P = Omit<Profession, "isDemo" | "status" | "custom" | "createdBy" | "synonyms" | "suggestedServices" | "attributes" | "dashboard" | "farmModules"> &
  Partial<Pick<Profession, "synonyms" | "suggestedServices" | "attributes" | "dashboard" | "farmModules">>;

const TRADE_ATTRS: AttributeField[] = [
  chips("specialties", "Specialties", undefined, "What are you best at?"),
  select("workType", "Usual work", ["Homes", "Shops & offices", "Factories", "All kinds"]),
  select("ownTools", "Own tools", ["Yes — full kit", "Basic tools", "Need tools provided"]),
];

const defs: P[] = [
  // ───── Agriculture ─────
  {
    id: "pr_farmer", categoryId: CATEGORY_IDS.agri, name: "Farmer", nameHi: "किसान", emoji: "🌾", synonyms: ["kisan", "krishak", "agriculture", "kheti"], dashboard: "FARMER", farmModules: true,
    suggestedSkills: ["Wheat farming", "Mustard farming", "Drip irrigation", "Organic farming", "Soil testing", "Dairy", "Vegetable farming", "Seed selection"],
    suggestedServices: ["Custom harvesting", "Seed supply", "Farm advisory"],
    attributes: [],
  },
  {
    id: "pr_farm_worker", categoryId: CATEGORY_IDS.agri, name: "Farm Worker", nameHi: "खेत मजदूर", emoji: "🧑‍🌾", synonyms: ["mazdoor", "majdoor", "labour", "kheti mazdoor", "farm labour"], dashboard: "AGRI_WORK",
    suggestedSkills: ["Harvesting", "Sowing", "Irrigation", "Spraying", "Weeding", "Loading & unloading", "Tractor driving", "Cattle care"],
    suggestedServices: ["Daily farm labour", "Harvest gang work"],
    attributes: [chips("preferredWork", "Preferred work", ["Harvesting", "Sowing", "Irrigation", "Spraying", "Weeding", "Dairy", "Loading"]), select("travel", "Can travel for work", ["Within village", "Within district", "Any district"])],
  },
  {
    id: "pr_dairy_worker", categoryId: CATEGORY_IDS.agri, name: "Dairy Worker", nameHi: "डेयरी कर्मचारी", emoji: "🐄", synonyms: ["dairy", "doodh", "pashupalan", "gwala"], dashboard: "AGRI_WORK",
    suggestedSkills: ["Milking", "Cattle feeding", "Dairy hygiene", "Calf care", "Fodder management", "Artificial insemination (assisting)"],
    suggestedServices: ["Daily dairy work", "Milking service"],
    attributes: [chips("animals", "Animals handled", ["Cow", "Buffalo", "Goat", "Camel", "Sheep"])],
  },
  {
    id: "pr_tractor_operator", categoryId: CATEGORY_IDS.agri, name: "Tractor Operator", nameHi: "ट्रैक्टर चालक", emoji: "🚜", synonyms: ["tractor driver", "tractor chalak"], dashboard: "AGRI_WORK",
    suggestedSkills: ["Ploughing", "Rotavator", "Seed drill", "Harvester operation", "Trolley driving", "Basic repairs"],
    suggestedServices: ["Ploughing", "Rotavator work", "Harvester operation"],
    attributes: [chips("machines", "Machines you operate", ["Tractor", "Harvester", "Rotavator", "Seed drill", "Sprayer", "Thresher"]), select("licence", "Driving licence", ["Yes", "Applied", "No"])],
  },
  {
    id: "pr_agri_technician", categoryId: CATEGORY_IDS.agri, name: "Agricultural Technician", nameHi: "कृषि तकनीशियन", emoji: "🧪", synonyms: ["agri technician", "krishi", "soil testing", "drip technician"], dashboard: "TRADE",
    suggestedSkills: ["Drip installation", "Soil sampling", "Pump repair", "Sprinkler setup", "Greenhouse", "Sensor installation"],
    suggestedServices: ["Drip irrigation installation", "Soil sampling", "Pump repair"],
    attributes: [chips("specialties", "Specialties", ["Drip & sprinkler", "Pumps & motors", "Greenhouse", "Soil testing", "Solar pumps"])],
  },
  {
    id: "pr_agri_expert", categoryId: CATEGORY_IDS.agri, name: "Agriculture Expert", nameHi: "कृषि विशेषज्ञ", emoji: "🎓", synonyms: ["agronomist", "veterinarian", "kvk", "scientist", "vet"], dashboard: "INDEPENDENT",
    suggestedSkills: ["Crop advisory", "Soil health", "Pest management", "Livestock health", "Training"],
    suggestedServices: ["Farm visit & advisory", "Training session"],
    attributes: [text("expertise", "Area of expertise", "e.g. Mustard, Soil health")],
  },

  // ───── Skilled Trades ─────
  {
    id: "pr_electrician", categoryId: CATEGORY_IDS.trades, name: "Electrician", nameHi: "इलेक्ट्रीशियन", emoji: "⚡", synonyms: ["bijli", "wireman", "electric mistri", "wiring"], dashboard: "TRADE",
    suggestedSkills: ["House wiring", "Fan & light fitting", "MCB / DB panel", "Motor winding", "Inverter & battery", "Solar installation", "Earthing", "Fault finding"],
    suggestedServices: ["House wiring", "Fan / light fitting", "Fault repair", "Inverter installation"],
    attributes: [chips("specialties", "Specialties", ["House wiring", "Industrial wiring", "Motor repair", "Solar", "Inverter", "CCTV"]), select("workType", "Usual work", ["Homes", "Shops & offices", "Factories", "All kinds"]), select("licence", "Wireman licence", ["Yes", "Applied", "No"]), select("ownTools", "Own tools", ["Yes — full kit", "Basic tools", "Need tools provided"])],
  },
  {
    id: "pr_plumber", categoryId: CATEGORY_IDS.trades, name: "Plumber", nameHi: "प्लंबर", emoji: "🚰", synonyms: ["nal", "pipe fitter", "pani"], dashboard: "TRADE",
    suggestedSkills: ["Pipe fitting", "Tap & mixer repair", "Water tank", "Borewell pipeline", "Bathroom fitting", "Drain cleaning"],
    suggestedServices: ["Leak repair", "Bathroom fitting", "Tank cleaning"],
    attributes: TRADE_ATTRS,
  },
  {
    id: "pr_carpenter", categoryId: CATEGORY_IDS.trades, name: "Carpenter", nameHi: "बढ़ई", emoji: "🪚", synonyms: ["badhai", "wood", "furniture", "sutar", "mistri"], dashboard: "TRADE",
    suggestedSkills: ["Furniture making", "Door & window frames", "Modular kitchen", "Wood polishing", "Repair work", "Roof framing", "Wood carving"],
    suggestedServices: ["Custom furniture", "Door / window fitting", "Furniture repair", "Kitchen cabinets"],
    attributes: [chips("specialties", "Specialties", ["Furniture", "Doors & windows", "Kitchens", "Wood carving", "Repairs", "Shuttering"]), select("workType", "Usual work", ["Homes", "Shops & offices", "Factories", "All kinds"]), select("ownTools", "Own tools", ["Yes — full kit", "Basic tools", "Need tools provided"])],
  },
  {
    id: "pr_mason", categoryId: CATEGORY_IDS.trades, name: "Mason", nameHi: "राजमिस्त्री", emoji: "🧱", synonyms: ["rajmistri", "raj mistri", "construction", "brick", "plaster"], dashboard: "TRADE",
    suggestedSkills: ["Brick work", "Plastering", "Tile laying", "Concrete & slab", "Foundation", "Stone work", "Reading drawings"],
    suggestedServices: ["House construction", "Plastering", "Tile laying"],
    attributes: TRADE_ATTRS,
  },
  {
    id: "pr_painter", categoryId: CATEGORY_IDS.trades, name: "Painter", nameHi: "पेंटर", emoji: "🎨", synonyms: ["paint", "rangai", "colour"], dashboard: "TRADE",
    suggestedSkills: ["Interior painting", "Exterior painting", "Putty & primer", "Wall design", "Polish", "Waterproofing"],
    suggestedServices: ["Interior painting", "Exterior painting", "Wall design"],
    attributes: TRADE_ATTRS,
  },
  {
    id: "pr_welder", categoryId: CATEGORY_IDS.trades, name: "Welder", nameHi: "वेल्डर", emoji: "🔥", synonyms: ["welding", "lohar", "fabrication", "gate"], dashboard: "TRADE",
    suggestedSkills: ["Arc welding", "Gas cutting", "Gate & grill", "Shed fabrication", "MIG welding", "Pipe welding"],
    suggestedServices: ["Gate & grill fabrication", "Shed fabrication", "Repair welding"],
    attributes: [chips("specialties", "Specialties", ["Arc welding", "MIG", "Gates & grills", "Sheds", "Farm equipment", "Pipework"]), select("ownTools", "Own tools", ["Yes — full kit", "Basic tools", "Need tools provided"])],
  },
  {
    id: "pr_mechanic", categoryId: CATEGORY_IDS.trades, name: "Mechanic", nameHi: "मैकेनिक", emoji: "🔧", synonyms: ["garage", "bike mechanic", "motor mechanic", "gadi"], dashboard: "TRADE",
    suggestedSkills: ["Engine repair", "Tractor repair", "Two-wheeler service", "Four-wheeler service", "Brake & clutch", "Electrical diagnosis", "Tyre & puncture"],
    suggestedServices: ["Vehicle service", "Tractor repair", "Breakdown visit"],
    attributes: [chips("vehicles", "Vehicles you repair", ["Two-wheeler", "Car", "Tractor", "Truck", "Auto", "Pump set"]), select("workshop", "Workshop", ["Own workshop", "Works at a garage", "Doorstep service only"])],
  },

  // ───── Services ─────
  {
    id: "pr_driver", categoryId: CATEGORY_IDS.services, name: "Driver", nameHi: "ड्राइवर", emoji: "🚗", synonyms: ["chalak", "taxi", "truck driver", "car driver", "gadi"], dashboard: "SERVICE",
    suggestedSkills: ["Car driving", "Long-distance driving", "Truck driving", "Tractor-trolley", "Route knowledge", "Basic vehicle care", "Passenger handling"],
    suggestedServices: ["Local trips", "Outstation driving", "Goods transport"],
    attributes: [chips("vehicleTypes", "Vehicle types", ["Car", "Taxi", "Jeep", "Bus", "Truck", "Tractor-trolley", "Pickup", "Auto"]), select("licenceType", "Licence type", ["Two-wheeler", "LMV (car)", "HMV (heavy)", "Transport / commercial"]), num("drivingYears", "Years of driving"), select("ownVehicle", "Own vehicle", ["Yes", "No — drive owner's vehicle"])],
  },
  {
    id: "pr_cook", categoryId: CATEGORY_IDS.services, name: "Cook", nameHi: "रसोइया", emoji: "🍳", synonyms: ["halwai", "chef", "khana", "catering", "bawarchi"], dashboard: "SERVICE",
    suggestedSkills: ["North Indian", "Rajasthani cuisine", "Sweets", "Bulk cooking", "Tandoor", "Tiffin service", "Hygiene"],
    suggestedServices: ["Event catering", "Home cook", "Tiffin service"],
    attributes: [chips("cuisines", "Cuisines", ["North Indian", "Rajasthani", "Sweets", "Snacks", "South Indian", "Chinese"]), num("groupSize", "Largest group cooked for")],
  },
  {
    id: "pr_tailor", categoryId: CATEGORY_IDS.services, name: "Tailor", nameHi: "दर्जी", emoji: "🧵", synonyms: ["darzi", "silai", "stitching", "boutique", "alteration"], dashboard: "SERVICE",
    suggestedSkills: ["Salwar suits", "Blouse stitching", "Gents tailoring", "Alterations", "Embroidery", "School uniforms", "Bridal wear"],
    suggestedServices: ["Blouse stitching", "Suit stitching", "Alteration", "Uniform orders"],
    attributes: [chips("specialties", "Specialties", ["Ladies suits", "Blouses", "Gents wear", "Alterations", "Embroidery", "Uniforms"]), select("setup", "Where you work", ["Own shop", "From home", "Works at a shop"]), select("homePickup", "Pickup & delivery", ["Yes", "No"])],
  },
  {
    id: "pr_barber", categoryId: CATEGORY_IDS.services, name: "Barber", nameHi: "नाई", emoji: "💈", synonyms: ["nai", "haircut", "salon", "hair cutting"], dashboard: "SERVICE",
    suggestedSkills: ["Haircut", "Shaving", "Beard styling", "Head massage", "Hair colour", "Kids haircut"],
    suggestedServices: ["Haircut", "Beard trim", "Home visit grooming"],
    attributes: [select("setup", "Where you work", ["Own shop", "Works at a shop", "Home visits"])],
  },
  {
    id: "pr_beautician", categoryId: CATEGORY_IDS.services, name: "Beautician", nameHi: "ब्यूटीशियन", emoji: "💄", synonyms: ["parlour", "makeup", "mehndi", "beauty"], dashboard: "SERVICE",
    suggestedSkills: ["Facial", "Bridal makeup", "Mehndi", "Hair styling", "Waxing", "Threading"],
    suggestedServices: ["Bridal makeup", "Mehndi design", "Home parlour visit"],
    attributes: [select("setup", "Where you work", ["Own parlour", "Works at a parlour", "Home visits"])],
  },
  {
    id: "pr_cleaner", categoryId: CATEGORY_IDS.services, name: "Cleaner", nameHi: "सफाई कर्मचारी", emoji: "🧹", synonyms: ["safai", "housekeeping", "maid", "cleaning"], dashboard: "SERVICE",
    suggestedSkills: ["Home cleaning", "Deep cleaning", "Office cleaning", "Tank cleaning", "Sofa & carpet cleaning", "Kitchen cleaning"],
    suggestedServices: ["Home deep cleaning", "Office cleaning", "Tank cleaning"],
    attributes: [chips("cleaning", "Cleaning type", ["Home", "Office", "Tanks", "Sofa & carpet", "Post-construction"])],
  },

  // ───── Artisan ─────
  {
    id: "pr_potter", categoryId: CATEGORY_IDS.artisan, name: "Potter", nameHi: "कुम्हार", emoji: "🏺", synonyms: ["kumhar", "pottery", "matka", "clay"], dashboard: "ARTISAN",
    suggestedSkills: ["Wheel throwing", "Clay preparation", "Terracotta", "Glazing", "Kiln firing", "Decorative pots"],
    suggestedServices: ["Custom pottery", "Diya & festival orders", "Workshop"],
    attributes: [text("craftType", "What you make", "e.g. Matkas, diyas, planters"), chips("materials", "Materials", ["Clay", "Terracotta", "Glaze"]), select("madeToOrder", "Made to order", ["Yes", "No"])],
  },
  {
    id: "pr_weaver", categoryId: CATEGORY_IDS.artisan, name: "Weaver", nameHi: "बुनकर", emoji: "🧶", synonyms: ["bunkar", "handloom", "loom", "carpet", "dari"], dashboard: "ARTISAN",
    suggestedSkills: ["Handloom weaving", "Dari weaving", "Carpet weaving", "Natural dyeing", "Warping", "Design pattern"],
    suggestedServices: ["Custom weaving", "Bulk orders", "Weaving workshop"],
    attributes: [text("craftType", "What you make", "e.g. Daris, shawls, sarees"), chips("materials", "Materials", ["Cotton", "Wool", "Silk", "Jute"]), select("madeToOrder", "Made to order", ["Yes", "No"])],
  },
  {
    id: "pr_handicraft", categoryId: CATEGORY_IDS.artisan, name: "Handicraft Worker", nameHi: "हस्तशिल्प कारीगर", emoji: "🎎", synonyms: ["hastshilp", "handicraft", "craft", "kalakar", "embroidery"], dashboard: "ARTISAN",
    suggestedSkills: ["Embroidery", "Block printing", "Wood craft", "Bangle making", "Beadwork", "Painting", "Bamboo & cane"],
    suggestedServices: ["Custom handicrafts", "Gift orders", "Craft workshop"],
    attributes: [text("craftType", "What you make", "e.g. Block-print cloth, bangles"), chips("materials", "Materials", ["Cloth", "Wood", "Metal", "Lac", "Beads", "Cane"]), select("madeToOrder", "Made to order", ["Yes", "No"])],
  },
  {
    id: "pr_leather", categoryId: CATEGORY_IDS.artisan, name: "Leather Worker", nameHi: "चर्मकार", emoji: "👞", synonyms: ["mochi", "jutti", "cobbler", "chappal", "leather"], dashboard: "ARTISAN",
    suggestedSkills: ["Jutti making", "Shoe repair", "Leather bags", "Belt making", "Stitching", "Leather finishing"],
    suggestedServices: ["Custom jutti", "Shoe repair", "Leather goods"],
    attributes: [text("craftType", "What you make", "e.g. Juttis, belts, bags"), select("madeToOrder", "Made to order", ["Yes", "No"])],
  },

  // ───── Technical ─────
  {
    id: "pr_computer_tech", categoryId: CATEGORY_IDS.tech, name: "Computer Technician", nameHi: "कंप्यूटर तकनीशियन", emoji: "💻", synonyms: ["computer repair", "laptop", "printer", "networking"], dashboard: "TECH",
    suggestedSkills: ["Laptop repair", "Windows setup", "Printer repair", "Networking", "CCTV installation", "Data recovery"],
    suggestedServices: ["Laptop repair", "Printer service", "Network setup", "CCTV installation"],
    attributes: [chips("devices", "Devices you fix", ["Laptop", "Desktop", "Printer", "Router", "CCTV"]), select("onsite", "Visits", ["Doorstep visits", "Shop only", "Both"])],
  },
  {
    id: "pr_mobile_tech", categoryId: CATEGORY_IDS.tech, name: "Mobile Repair Technician", nameHi: "मोबाइल रिपेयर", emoji: "📱", synonyms: ["mobile repair", "phone repair", "screen"], dashboard: "TECH",
    suggestedSkills: ["Screen replacement", "Battery replacement", "Charging port repair", "Software flashing", "Water damage repair"],
    suggestedServices: ["Screen replacement", "Battery replacement", "Software repair"],
    attributes: [chips("devices", "Brands", ["Samsung", "Xiaomi", "Vivo", "Oppo", "Realme", "iPhone"]), select("onsite", "Visits", ["Shop only", "Doorstep visits", "Both"])],
  },
  {
    id: "pr_ac_tech", categoryId: CATEGORY_IDS.tech, name: "AC Technician", nameHi: "एसी तकनीशियन", emoji: "❄️", synonyms: ["ac repair", "cooler", "fridge", "refrigerator", "cooling"], dashboard: "TECH",
    suggestedSkills: ["AC installation", "Gas refilling", "AC servicing", "Fridge repair", "Cooler repair", "Washing machine repair"],
    suggestedServices: ["AC installation", "AC service", "Gas refilling", "Fridge repair"],
    attributes: [chips("appliances", "Appliances", ["Split AC", "Window AC", "Refrigerator", "Cooler", "Washing machine"]), select("onsite", "Visits", ["Doorstep visits", "Shop only", "Both"])],
  },
  {
    id: "pr_electronics_tech", categoryId: CATEGORY_IDS.tech, name: "Electronics Technician", nameHi: "इलेक्ट्रॉनिक्स तकनीशियन", emoji: "📺", synonyms: ["tv repair", "electronics", "inverter repair", "appliance"], dashboard: "TECH",
    suggestedSkills: ["TV repair", "Inverter repair", "Circuit repair", "Microwave repair", "Soldering", "Sound system repair"],
    suggestedServices: ["TV repair", "Inverter repair", "Appliance repair"],
    attributes: [chips("devices", "Devices you fix", ["TV", "Inverter", "Microwave", "Sound system", "Mixer / grinder"]), select("onsite", "Visits", ["Doorstep visits", "Shop only", "Both"])],
  },

  // ───── Independent ─────
  {
    id: "pr_freelancer", categoryId: CATEGORY_IDS.independent, name: "Freelancer", nameHi: "फ्रीलांसर", emoji: "🧑‍💻", synonyms: ["freelance", "online work", "typing", "data entry", "designer"], dashboard: "INDEPENDENT",
    suggestedSkills: ["Data entry", "Typing (Hindi & English)", "Graphic design", "Video editing", "Social media", "Translation", "Accounting"],
    suggestedServices: ["Data entry", "Poster / banner design", "Typing work"],
    attributes: [chips("fields", "Fields", ["Design", "Writing", "Data entry", "Video", "Accounts", "Translation"]), select("remote", "Remote work", ["Yes", "Local only", "Both"])],
  },
  {
    id: "pr_photographer", categoryId: CATEGORY_IDS.independent, name: "Photographer", nameHi: "फोटोग्राफर", emoji: "📷", synonyms: ["photo", "video", "wedding photographer", "videographer"], dashboard: "INDEPENDENT",
    suggestedSkills: ["Wedding photography", "Event videography", "Drone shots", "Photo editing", "Product photography", "Album design"],
    suggestedServices: ["Wedding shoot", "Event coverage", "Product photography"],
    attributes: [chips("fields", "Shoots", ["Weddings", "Events", "Portraits", "Products", "Drone"]), select("ownEquipment", "Own equipment", ["Yes — full kit", "Basic", "No"])],
  },
  {
    id: "pr_tutor", categoryId: CATEGORY_IDS.independent, name: "Tutor", nameHi: "शिक्षक / ट्यूटर", emoji: "📚", synonyms: ["teacher", "coaching", "tuition", "shikshak", "padhai"], dashboard: "INDEPENDENT",
    suggestedSkills: ["Maths", "Science", "English speaking", "Computer basics", "Hindi", "Competitive exam prep", "Spoken English"],
    suggestedServices: ["Home tuition", "Group classes", "Spoken English course"],
    attributes: [chips("subjects", "Subjects", ["Maths", "Science", "English", "Hindi", "Computer", "Social Science"]), chips("classes", "Classes", ["1–5", "6–8", "9–10", "11–12", "Adults"]), select("mode", "Teaching mode", ["At student's home", "At my place", "Online", "Any"])],
  },
  {
    id: "pr_consultant", categoryId: CATEGORY_IDS.independent, name: "Consultant", nameHi: "सलाहकार", emoji: "🧭", synonyms: ["advisor", "salahkar", "consulting"], dashboard: "INDEPENDENT",
    suggestedSkills: ["Business advice", "Loan paperwork", "Government schemes help", "Accounting", "Legal paperwork help", "Training"],
    suggestedServices: ["One-to-one advisory", "Scheme application help", "Business planning"],
    attributes: [text("expertise", "Area of expertise")],
  },
  {
    id: "pr_self_employed", categoryId: CATEGORY_IDS.independent, name: "Self-employed", nameHi: "स्वरोजगार", emoji: "🏪", synonyms: ["shopkeeper", "dukaan", "own business", "vyapari", "small business"], dashboard: "INDEPENDENT",
    suggestedSkills: ["Customer handling", "Bookkeeping", "Inventory", "Local sourcing", "Negotiation"],
    suggestedServices: ["Local supply", "Home delivery"],
    attributes: [text("businessType", "What you do", "e.g. Grocery shop, repair stall")],
  },

  // ───── Other (placeholder that custom professions fall back to) ─────
  {
    id: "pr_other", categoryId: CATEGORY_IDS.other, name: "Other", nameHi: "अन्य", emoji: "✨", synonyms: ["other", "kuch aur"], dashboard: "GENERAL",
    suggestedSkills: [], suggestedServices: [], attributes: [text("workDescription", "What work do you do?", "Describe your profession in a few words")],
  },
];

export const professionsSeed: Profession[] = defs.map((d) => ({
  synonyms: [],
  suggestedServices: [],
  attributes: [],
  dashboard: "GENERAL" as const,
  farmModules: false,
  ...d,
  status: "ACTIVE" as const,
  custom: false,
  isDemo: false,
}));

/** General (all-profession) skills plus the per-profession suggestions flattened into the skill catalog. */
const GENERAL_SKILLS = ["Communication", "Time management", "Customer handling", "Team work", "Basic smartphone use", "Reading drawings", "Safety awareness", "Training others"];

export function buildSkillCatalog(): SkillEntry[] {
  const out = new Map<string, SkillEntry>();
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  for (const g of GENERAL_SKILLS) out.set(g.toLowerCase(), { id: `sk_${slug(g)}`, name: g, professionIds: [], status: "ACTIVE", isDemo: false });
  for (const p of professionsSeed) {
    for (const s of p.suggestedSkills) {
      const key = s.toLowerCase();
      const hit = out.get(key);
      if (hit) {
        if (hit.professionIds.length && !hit.professionIds.includes(p.id)) hit.professionIds.push(p.id);
      } else out.set(key, { id: `sk_${slug(s)}`, name: s, professionIds: [p.id], status: "ACTIVE", isDemo: false });
    }
  }
  return [...out.values()];
}

export const skillCatalogSeed: SkillEntry[] = buildSkillCatalog();
