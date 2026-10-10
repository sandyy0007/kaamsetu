import type {
  BuyerProfile,
  ExpertProfile,
  FarmerProfile,
  Fpo,
  Organization,
  PortfolioItem,
  SceneKind,
  User,
} from "@/types/domain";
import { defaultPrivacy, mkUser } from "./helpers";

type FarmerSeed = Omit<FarmerProfile, "userId" | "isDemo" | "privacy" | "media" | "portfolio" | "certifications" | "achievements"> & {
  privacy?: Partial<FarmerProfile["privacy"]>;
  certs?: [string, string, number][];
  awards?: [string, number, string][];
  portfolio?: Omit<PortfolioItem, "id">[];
  media?: [string, SceneKind, "PHOTO" | "VIDEO"][];
};

const farmerSeeds: { user: User; p: FarmerSeed }[] = [
  {
    user: mkUser("u_ramesh", "FARMER", "Ramesh Kumar Choudhary", "ramesh.choudhary", "10001", 142, {
      verified: true,
      headline: "Mustard & wheat farmer · Rajaldesar, Churu",
      createdDaysAgo: 320,
    }),
    p: {
      village: "Rajaldesar",
      district: "Churu",
      state: "Rajasthan",
      farmingSince: 2004,
      languages: ["Hindi", "Rajasthani", "English"],
      specialization: "Mustard & wheat cultivation in sandy-loam soils",
      methods: ["Integrated (IPM)", "Natural farming"],
      livestock: ["Cows (4)", "Goat"],
      story:
        "I grew up on this land and took over farming from my father in 2004. Churu gets hot summers and little rain, so I rely on a tube-well plus sprinklers and track every irrigation. In the last few years I moved to seed treatment, balanced fertiliser and IPM for mustard. I enjoy teaching younger farmers in my village how to keep simple farm records.",
      skills: ["Mustard cultivation", "Wheat cultivation", "Sprinkler irrigation", "Seed treatment", "Farm record keeping", "Dairy management"],
      interests: ["Mustard", "Wheat", "Irrigation", "GovernmentSchemes", "Machinery"],
      fpoIds: ["fpo_shekhawati"],
      privacy: { locationPrecision: "VILLAGE", phone: "CONNECTIONS" },
      certs: [
        ["Integrated Pest Management training", "Demo KVK Churu", 2022],
        ["Soil Health & Balanced Fertiliser Use", "Demo Agricultural University", 2021],
        ["Sprinkler Irrigation Operator course", "Demo State Agriculture Department", 2019],
      ],
      awards: [
        ["Best Progressive Farmer — Block Level", 2023, "Recognised at a block-level Kisan Divas event for consistent yields and record keeping."],
        ["Community Trainer", 2024, "Trained 40+ farmers on simple crop-expense records."],
      ],
      portfolio: [
        { title: "2025 Mustard Crop", year: 2025, crop: "Mustard", areaAcres: 6, yieldText: "7 qtl/acre · 42 qtl total", method: "Integrated (IPM)", description: "Sowing in the first week of October, two irrigations, aphid monitoring with yellow sticky traps.", scene: "mustard" },
        { title: "2025 Wheat Harvest", year: 2025, crop: "Wheat", areaAcres: 4, yieldText: "18 qtl/acre · 72 qtl total", method: "Conventional", description: "Timely sowing in mid-November with six irrigations at critical stages.", scene: "wheat" },
        { title: "Natural Farming Trial Plot", year: 2026, crop: "Bajra", areaAcres: 1, yieldText: "Trial — results being recorded", method: "Natural farming", description: "One-acre trial with compost and bio-inputs to compare cost against the main plot.", scene: "bajra" },
      ],
      media: [["Mustard in flowering stage", "mustard", "PHOTO"], ["Sprinkler irrigation on wheat", "irrigation", "PHOTO"], ["Farm walk — seed treatment demo", "tractor", "VIDEO"]],
    },
  },
  {
    user: mkUser("u_sunita", "FARMER", "Sunita Devi Jakhar", "sunita.jakhar", "10002", 322, { verified: true, headline: "Wheat grower & dairy farmer · Hanumangarh", language: "hi" }),
    p: {
      village: "Pilibanga",
      district: "Hanumangarh",
      state: "Rajasthan",
      farmingSince: 2010,
      languages: ["Hindi", "Punjabi"],
      specialization: "Canal-irrigated wheat with a small dairy unit",
      methods: ["Conventional"],
      livestock: ["Murrah buffalo (6)", "Cows (3)"],
      story: "Wheat in winter, fodder and milk through the year. I keep milk records every day and sell to a local cooperative.",
      skills: ["Wheat cultivation", "Dairy management", "Fodder management", "Cooperative marketing"],
      interests: ["Wheat", "Dairy", "Irrigation"],
      fpoIds: [],
      certs: [["Dairy Entrepreneurship training", "Demo Agricultural University", 2020]],
      awards: [["Best Milk Producer — Village Cooperative", 2024, "Highest average fat-tested milk quality over the year."]],
      portfolio: [{ title: "2025 Wheat Harvest", year: 2025, crop: "Wheat", areaAcres: 10, yieldText: "19 qtl/acre", method: "Conventional", description: "Canal-fed fields, six irrigations.", scene: "wheat" }],
      media: [["Evening milking", "dairy", "PHOTO"]],
    },
  },
  {
    user: mkUser("u_mohan", "FARMER", "Mohan Lal Jat", "mohan.jat", "10003", 28, { verified: true, headline: "Bajra & moong · Neem Ka Thana, Sikar" }),
    p: {
      village: "Neem Ka Thana",
      district: "Sikar",
      state: "Rajasthan",
      farmingSince: 1998,
      languages: ["Hindi", "Shekhawati"],
      specialization: "Rain-fed bajra and moong",
      methods: ["Conventional", "Integrated (IPM)"],
      livestock: ["Cows (2)"],
      story: "Twenty-eight years of dryland farming. I focus on timely sowing with the first good rain and saving seed of local bajra.",
      skills: ["Bajra cultivation", "Moong cultivation", "Dryland farming", "Seed saving"],
      interests: ["Bajra", "Machinery", "GovernmentSchemes"],
      fpoIds: ["fpo_thar"],
      certs: [["Dryland Farming workshop", "Demo KVK Sikar", 2018]],
      awards: [],
      portfolio: [{ title: "2025 Bajra Crop", year: 2025, crop: "Bajra", areaAcres: 12, yieldText: "6 qtl/acre", method: "Conventional", description: "Sown after the first monsoon rain.", scene: "bajra" }],
      media: [["Bajra earheads at maturity", "bajra", "PHOTO"]],
    },
  },
  {
    user: mkUser("u_kailash", "FARMER", "Kailash Meena", "kailash.meena", "10004", 12, { verified: false, headline: "Vegetable grower with drip irrigation · Chaksu, Jaipur" }),
    p: {
      village: "Chaksu",
      district: "Jaipur",
      state: "Rajasthan",
      farmingSince: 2014,
      languages: ["Hindi", "English"],
      specialization: "Drip-irrigated tomato and onion",
      methods: ["Integrated (IPM)"],
      livestock: [],
      story: "Short-duration vegetables near Jaipur's mandi. Drip and mulching cut my water use and weeds.",
      skills: ["Drip irrigation", "Vegetable cultivation", "Mulching", "Direct marketing"],
      interests: ["Vegetables", "Irrigation", "Market"],
      fpoIds: [],
      certs: [["Protected cultivation basics", "Demo Agricultural University", 2021]],
      awards: [],
      portfolio: [{ title: "Drip Tomato Project", year: 2025, crop: "Tomato", areaAcres: 2, yieldText: "Record sheet available on request", method: "Integrated (IPM)", description: "Drip with fertigation on mulch.", scene: "vegetables" }],
      media: [["Tomato rows on drip", "vegetables", "PHOTO"]],
    },
  },
  {
    user: mkUser("u_geeta", "FARMER", "Geeta Bishnoi", "geeta.bishnoi", "10005", 96, { verified: true, headline: "Organic bajra, guar & cumin · Osian, Jodhpur" }),
    p: {
      village: "Osian",
      district: "Jodhpur",
      state: "Rajasthan",
      farmingSince: 2012,
      languages: ["Hindi", "Marwari"],
      specialization: "Organic millets and cluster beans",
      methods: ["Organic", "Natural farming"],
      livestock: ["Cows (5)"],
      story: "No chemical inputs for eight years — cow-dung compost, crop rotation and neem-based sprays. I sell directly to organic traders.",
      skills: ["Organic farming", "Compost making", "Bajra cultivation", "Guar cultivation", "Direct marketing"],
      interests: ["OrganicFarming", "Bajra", "Market"],
      fpoIds: ["fpo_thar"],
      certs: [["Organic farming certification course", "Demo Agricultural University", 2020], ["Participatory guarantee training", "Demo KVK Jodhpur", 2021]],
      awards: [["Organic Farmer of the Year — District", 2025, "Demo award shown for illustration of the achievements section."]],
      portfolio: [{ title: "Organic Farming Project", year: 2025, crop: "Bajra", areaAcres: 8, yieldText: "5 qtl/acre", method: "Organic", description: "Third-year transition-free organic plot with compost and bio-fertiliser.", scene: "organic" }],
      media: [["Compost pit demonstration", "organic", "PHOTO"]],
    },
  },
  {
    user: mkUser("u_dinesh", "FARMER", "Dinesh Saini", "dinesh.saini", "10006", 200, { verified: false, headline: "Mustard farmer · Rajgarh, Alwar" }),
    p: {
      village: "Rajgarh",
      district: "Alwar",
      state: "Rajasthan",
      farmingSince: 2008,
      languages: ["Hindi"],
      specialization: "Mustard in Alwar's alluvial belt",
      methods: ["Conventional"],
      livestock: ["Buffalo (2)"],
      story: "Mustard is our main Rabi crop. Looking for stable oil-mill buyers.",
      skills: ["Mustard cultivation", "Wheat cultivation"],
      interests: ["Mustard", "Market"],
      fpoIds: [],
      certs: [],
      awards: [],
      portfolio: [],
      media: [],
    },
  },
  {
    user: mkUser("u_bhanwar", "FARMER", "Bhanwar Singh Rathore", "bhanwar.rathore", "10007", 260, { verified: true, headline: "Chickpea & cumin · Merta, Nagaur" }),
    p: {
      village: "Merta",
      district: "Nagaur",
      state: "Rajasthan",
      farmingSince: 2001,
      languages: ["Hindi", "Marwari"],
      specialization: "Rabi pulses and spices",
      methods: ["Integrated (IPM)"],
      livestock: [],
      story: "Chickpea and cumin on tube-well irrigation. Careful with wilt in chickpea — I rotate and treat seed every year.",
      skills: ["Chickpea cultivation", "Cumin cultivation", "Seed treatment"],
      interests: ["Chickpea", "Cumin", "Market"],
      fpoIds: [],
      certs: [["Pulses production training", "Demo KVK Nagaur", 2019]],
      awards: [],
      portfolio: [{ title: "2025 Chickpea Crop", year: 2025, crop: "Chickpea", areaAcres: 7, yieldText: "6 qtl/acre", method: "Integrated (IPM)", description: "Seed treated, two irrigations.", scene: "chickpea" }],
      media: [["Chickpea field at pod stage", "chickpea", "PHOTO"]],
    },
  },
  {
    user: mkUser("u_pushpa", "FARMER", "Pushpa Kanwar", "pushpa.kanwar", "10008", 340, { verified: true, headline: "Dairy farmer · Lunkaransar, Bikaner" }),
    p: {
      village: "Lunkaransar",
      district: "Bikaner",
      state: "Rajasthan",
      farmingSince: 2015,
      languages: ["Hindi", "Rajasthani"],
      specialization: "Dairy with green-fodder cultivation",
      methods: ["Conventional"],
      livestock: ["Rathi cows (8)", "Buffalo (3)"],
      story: "Dairy is my main income; I grow berseem and sorghum for fodder. Active in our dairy cooperative.",
      skills: ["Dairy management", "Fodder cultivation", "Cooperative management"],
      interests: ["Dairy", "Machinery", "Health"],
      fpoIds: ["fpo_dairy"],
      certs: [["Animal husbandry basics", "Demo Agricultural University", 2018]],
      awards: [],
      portfolio: [],
      media: [["Rathi cows at the shed", "dairy", "PHOTO"]],
    },
  },
  {
    user: mkUser("u_hanuman", "FARMER", "Hanuman Prajapat", "hanuman.prajapat", "10009", 60, { verified: false, headline: "Mustard & chickpea · Ratangarh, Churu" }),
    p: {
      village: "Ratangarh",
      district: "Churu",
      state: "Rajasthan",
      farmingSince: 2006,
      languages: ["Hindi", "Rajasthani"],
      specialization: "Mustard and chickpea on sandy soils",
      methods: ["Conventional"],
      livestock: ["Goat (10)"],
      story: "Mustard on 10 acres. Interested in selling together with other Churu farmers to get a better price.",
      skills: ["Mustard cultivation", "Chickpea cultivation"],
      interests: ["Mustard", "Market"],
      fpoIds: ["fpo_shekhawati"],
      certs: [],
      awards: [],
      portfolio: [],
      media: [],
    },
  },
  {
    user: mkUser("u_laxmi", "FARMER", "Laxmi Choudhary", "laxmi.choudhary", "10010", 180, { verified: true, headline: "Wheat & cotton · Suratgarh, Sri Ganganagar" }),
    p: {
      village: "Suratgarh",
      district: "Sri Ganganagar",
      state: "Rajasthan",
      farmingSince: 2005,
      languages: ["Hindi", "Punjabi", "English"],
      specialization: "Large-farm canal-irrigated wheat and cotton",
      methods: ["Conventional", "Integrated (IPM)"],
      livestock: [],
      story: "Mechanised wheat on 40 acres. Happy to share machinery schedules with neighbours.",
      skills: ["Wheat cultivation", "Cotton cultivation", "Farm mechanisation"],
      interests: ["Wheat", "Machinery", "Market"],
      fpoIds: [],
      certs: [["Farm mechanisation training", "Demo Agricultural University", 2022]],
      awards: [],
      portfolio: [{ title: "2025 Wheat Harvest", year: 2025, crop: "Wheat", areaAcres: 40, yieldText: "20 qtl/acre", method: "Conventional", description: "Laser-levelled fields, drill sowing.", scene: "wheat" }],
      media: [["Combine harvesting", "tractor", "VIDEO"]],
    },
  },
];

export function buildFarmers() {
  const users: User[] = [];
  const profiles: FarmerProfile[] = [];
  for (const { user, p } of farmerSeeds) {
    users.push(user);
    const { certs = [], awards = [], portfolio = [], media = [], privacy, ...rest } = p;
    profiles.push({
      ...rest,
      userId: user.id,
      certifications: certs.map(([title, issuer, year], i) => ({ id: `${user.id}_cert${i}`, title, issuer, year })),
      achievements: awards.map(([title, year, description], i) => ({ id: `${user.id}_ach${i}`, title, year, description })),
      portfolio: portfolio.map((it, i) => ({ ...it, id: `${user.id}_pf${i}` })),
      media: media.map(([caption, scene, kind], i) => ({ id: `${user.id}_m${i}`, caption, scene, kind })),
      privacy: defaultPrivacy(privacy),
      isDemo: true,
    });
  }
  return { users, profiles };
}

export function buildBuyers() {
  const rows: { user: User; p: Omit<BuyerProfile, "userId" | "isDemo"> }[] = [
    {
      user: mkUser("u_b_marudhara", "BUYER", "Marudhara Oil Mills", "marudhara.oil", "20001", 40, { verified: true, headline: "Edible oil manufacturer · Jaipur" }),
      p: { businessName: "Marudhara Oil Mills", industry: "Edible oil processing", district: "Jaipur", state: "Rajasthan", about: "Regional mustard oil processor sourcing directly from farmers and FPOs. Prefers clean, dry seed with documented oil content.", cropsPurchased: ["Mustard"], website: "https://example.org/demo-buyer", contactOptions: ["PLATFORM_MESSAGE"] },
    },
    {
      user: mkUser("u_b_annapurna", "BUYER", "Shree Annapurna Foods", "annapurna.foods", "20002", 20, { verified: true, headline: "Flour & millet products · Jodhpur" }),
      p: { businessName: "Shree Annapurna Foods", industry: "Flour mill & packaged foods", district: "Jodhpur", state: "Rajasthan", about: "Buys wheat and bajra in truck-load quantities for packaged flour. Pays after quality check at the mill.", cropsPurchased: ["Wheat", "Bajra"], contactOptions: ["PLATFORM_MESSAGE", "PHONE_ON_REQUEST"] },
    },
    {
      user: mkUser("u_b_thar", "BUYER", "Thar Agro Exports", "thar.agro", "20003", 300, { verified: true, headline: "Spices & pulses exporter · Bikaner" }),
      p: { businessName: "Thar Agro Exports", industry: "Spices, pulses & export", district: "Bikaner", state: "Rajasthan", about: "Sources cumin, chickpea, moong and guar for domestic and export lots. Quality grading at the warehouse.", cropsPurchased: ["Cumin", "Chickpea", "Moong", "Guar"], contactOptions: ["PLATFORM_MESSAGE"] },
    },
    {
      user: mkUser("u_b_aravali", "BUYER", "Aravali Organic Traders", "aravali.organic", "20004", 110, { verified: false, headline: "Organic grain trading · Jaipur" }),
      p: { businessName: "Aravali Organic Traders", industry: "Organic grains trading", district: "Jaipur", state: "Rajasthan", about: "Looking for certified or transition organic bajra, wheat and pulses for urban retail.", cropsPurchased: ["Bajra", "Wheat", "Moong"], contactOptions: ["PLATFORM_MESSAGE"] },
    },
  ];
  return {
    users: rows.map((r) => r.user),
    profiles: rows.map<BuyerProfile>((r) => ({ ...r.p, userId: r.user.id, isDemo: true })),
  };
}

export function buildExperts() {
  const rows: { user: User; p: Omit<ExpertProfile, "userId" | "isDemo"> }[] = [
    {
      user: mkUser("u_e_anita", "EXPERT", "Dr. Anita Sharma", "dr.anita.sharma", "30001", 280, { verified: true, headline: "Agronomist · oilseeds & cereals" }),
      p: { category: "Agronomist", qualification: "Ph.D. Agronomy", organization: "Demo Agricultural University", specialization: ["Mustard", "Wheat", "Crop nutrition"], experienceYears: 17, district: "Jaipur", state: "Rajasthan", about: "Works with farmers on oilseed and wheat agronomy; focus on balanced nutrition and timely operations.", languages: ["Hindi", "English"] },
    },
    {
      user: mkUser("u_e_vikram", "EXPERT", "Dr. Vikram Singh Rathore", "dr.vikram.rathore", "30002", 160, { verified: true, headline: "Soil scientist · arid zone soils" }),
      p: { category: "Soil Expert", qualification: "M.Sc., Ph.D. Soil Science", organization: "Demo Agricultural University", specialization: ["Soil health", "Salinity", "Fertiliser planning"], experienceYears: 21, district: "Bikaner", state: "Rajasthan", about: "Helps farmers interpret soil test reports and plan fertiliser use in sandy and saline soils.", languages: ["Hindi", "English"] },
    },
    {
      user: mkUser("u_e_imran", "EXPERT", "Dr. Imran Khan", "dr.imran.khan", "30003", 220, { verified: true, headline: "Veterinarian · dairy animal health" }),
      p: { category: "Veterinarian", qualification: "B.V.Sc. & A.H., M.V.Sc.", organization: "Demo Veterinary Clinic, Bikaner", specialization: ["Dairy health", "Animal nutrition", "Vaccination planning"], experienceYears: 12, district: "Bikaner", state: "Rajasthan", about: "Practising veterinarian supporting dairy farmers with herd health and fodder planning.", languages: ["Hindi", "Urdu"] },
    },
    {
      user: mkUser("u_e_sunil", "EXPERT", "Dr. Sunil Verma", "dr.sunil.verma", "30004", 80, { verified: true, headline: "Plant protection · IPM researcher" }),
      p: { category: "Researcher", qualification: "Ph.D. Entomology", organization: "Demo Agricultural University", specialization: ["Pest management", "IPM", "Biopesticides"], experienceYears: 15, district: "Jaipur", state: "Rajasthan", about: "Researches integrated pest management for Rabi oilseeds and vegetables.", languages: ["Hindi", "English"] },
    },
    {
      user: mkUser("u_e_meenakshi", "EXPERT", "Meenakshi Yadav", "meenakshi.yadav", "30005", 350, { verified: false, headline: "KVK subject-matter specialist · Churu" }),
      p: { category: "KVK Expert", qualification: "M.Sc. Agriculture Extension", organization: "Demo KVK Churu", specialization: ["Extension", "Women in agriculture", "Millets"], experienceYears: 8, district: "Churu", state: "Rajasthan", about: "Runs farmer trainings and field demonstrations across Churu district.", languages: ["Hindi", "Rajasthani"] },
    },
  ];
  return {
    users: rows.map((r) => r.user),
    profiles: rows.map<ExpertProfile>((r) => ({ ...r.p, userId: r.user.id, isDemo: true })),
  };
}

export function buildOrganizations() {
  const rows: { user: User; o: Omit<Organization, "userId" | "isDemo"> }[] = [
    {
      user: mkUser("u_g_agri", "GOVERNMENT", "Demo State Agriculture Department", "demo.agri.dept", "40001", 150, { verified: true, headline: "Official demo organisation account" }),
      o: { id: "org_agri", name: "Demo State Agriculture Department", department: "Department of Agriculture (DEMO)", website: "https://example.org/demo-agriculture-department", state: "Rajasthan", about: "DEMO ORGANISATION. This account exists only to show how a verified government organisation appears on KaamSetu. It is not a real department." },
    },
    {
      user: mkUser("u_g_kvk", "GOVERNMENT", "Demo KVK Churu", "demo.kvk.churu", "40002", 125, { verified: true, headline: "Krishi Vigyan Kendra (demo account)" }),
      o: { id: "org_kvk", name: "Demo KVK Churu", department: "Krishi Vigyan Kendra (DEMO)", website: "https://example.org/demo-kvk", district: "Churu", state: "Rajasthan", about: "DEMO ORGANISATION. Illustrates a district-level extension centre running trainings and demonstrations." },
    },
    {
      user: mkUser("u_g_univ", "GOVERNMENT", "Demo Agricultural University", "demo.agri.univ", "40003", 235, { verified: true, headline: "State agricultural university (demo account)" }),
      o: { id: "org_univ", name: "Demo Agricultural University", department: "Extension Education (DEMO)", website: "https://example.org/demo-university", district: "Jaipur", state: "Rajasthan", about: "DEMO ORGANISATION. Illustrates a university publishing advisories and learning material." },
    },
    {
      user: mkUser("u_g_skill", "GOVERNMENT", "Demo Skill & Employment Office", "demo.skill.office", "40004", 100, { verified: true, headline: "Skill development & employment (demo account)" }),
      o: { id: "org_skill", name: "Demo Skill & Employment Office", department: "Skill Development & Employment (DEMO)", website: "https://example.org/demo-skill-office", district: "Jaipur", state: "Rajasthan", about: "DEMO ORGANISATION. Illustrates how a verified skill-development, employment or labour office publishes programmes for workers and independent professionals. It is not a real department." },
    },
  ];
  return {
    users: rows.map((r) => r.user),
    orgs: rows.map<Organization>((r) => ({ ...r.o, userId: r.user.id, isDemo: true })),
  };
}

export function buildFpos() {
  const rows: { user: User; f: Omit<Fpo, "userId" | "isDemo"> }[] = [
    {
      user: mkUser("u_f_shekhawati", "FPO", "Shekhawati Kisan Producer Company", "shekhawati.fpo", "50001", 130, { verified: true, headline: "Farmer producer company · Churu & Sikar" }),
      f: { id: "fpo_shekhawati", name: "Shekhawati Kisan Producer Company", district: "Churu", state: "Rajasthan", about: "Collective marketing of mustard, chickpea and wheat for small farmers in the Shekhawati region.", crops: ["Mustard", "Chickpea", "Wheat"], foundedYear: 2019, memberIds: ["u_ramesh", "u_hanuman"] },
    },
    {
      user: mkUser("u_f_thar", "FPO", "Thar Bajra Producers FPO", "thar.bajra.fpo", "50002", 45, { verified: true, headline: "Millet FPO · Jodhpur & Sikar" }),
      f: { id: "fpo_thar", name: "Thar Bajra Producers FPO", district: "Jodhpur", state: "Rajasthan", about: "Aggregates bajra, guar and moong; supports organic transition through group training.", crops: ["Bajra", "Guar", "Moong"], foundedYear: 2020, memberIds: ["u_mohan", "u_geeta"] },
    },
    {
      user: mkUser("u_f_dairy", "FPO", "Lunkaransar Dairy Cooperative", "lunkaransar.dairy", "50003", 330, { verified: false, headline: "Milk cooperative · Bikaner" }),
      f: { id: "fpo_dairy", name: "Lunkaransar Dairy Cooperative", district: "Bikaner", state: "Rajasthan", about: "Village milk collection, chilling and quality testing for member dairy farmers.", crops: ["Milk"], foundedYear: 2016, memberIds: ["u_pushpa"] },
    },
  ];
  return {
    users: rows.map((r) => r.user),
    fpos: rows.map<Fpo>((r) => ({ ...r.f, userId: r.user.id, isDemo: true })),
  };
}

export function buildAdmin(): User {
  return mkUser("u_admin", "ADMIN", "KaamSetu Admin", "admin", "99999", 0, { verified: true, headline: "Platform administration" });
}
