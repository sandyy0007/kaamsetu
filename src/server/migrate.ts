/**
 * Phase-2 data migration: KisanSetu (farmer-only) → KaamSetu (universal professional platform).
 *
 * Guarantees (all covered by tests/migration.test.ts):
 *   - Idempotent: running it twice changes nothing the second time.
 *   - Non-destructive: it only ADDS rows. FarmerProfile, farms, crops, listings, … are never modified or removed.
 *   - ID-preserving: ProfessionalProfile.userId === User.id === FarmerProfile.userId, so every old link
 *     (/farmers/:id, conversations, follows, enquiries …) keeps pointing at the same person.
 *   - Safe on old snapshots: a DEMO_STORE_FILE written by the pre-Phase-2 build is loaded, then migrated.
 */
import type { Db, ExpertProfile, FarmerProfile, Profession, ProfessionalProfile, ProfessionalSkill, User } from "@/types/domain";
import { newId } from "./crypto";
import { professionCategoriesSeed, professionsSeed, skillCatalogSeed } from "./seed/professions";

export interface MigrationReport {
  catalogAdded: { categories: number; professions: number; skills: number };
  professionalProfilesCreated: number;
  farmersLinked: number;
  expertsLinked: number;
  workHistoryCreated: number;
  businessesCreated: number;
  alreadyMigrated: boolean;
}

const COLLECTIONS = ["professionCategories", "professions", "skillCatalog", "professionalProfiles", "services", "serviceRequests", "portfolioEntries", "workHistory", "recommendations", "workOpportunities", "applications", "businesses"] as const;

/** Old snapshots lack the new collections — add empty ones so nothing downstream sees `undefined`. */
export function ensureCollections(db: Db) {
  const d = db as unknown as Record<string, unknown>;
  for (const k of COLLECTIONS) d[k] ??= [];
}

export function ensureCatalog(db: Db) {
  const added = { categories: 0, professions: 0, skills: 0 };
  const haveC = new Set(db.professionCategories.map((c) => c.id));
  for (const c of professionCategoriesSeed) if (!haveC.has(c.id)) {
    db.professionCategories.push(structuredClone(c));
    added.categories++;
  }
  const haveP = new Set(db.professions.map((p) => p.id));
  for (const p of professionsSeed) if (!haveP.has(p.id)) {
    db.professions.push(structuredClone(p));
    added.professions++;
  }
  const haveS = new Set(db.skillCatalog.map((s) => s.id));
  for (const s of skillCatalogSeed) if (!haveS.has(s.id)) {
    db.skillCatalog.push(structuredClone(s));
    added.skills++;
  }
  return added;
}

const skillsFromNames = (names: string[], years: number): ProfessionalSkill[] =>
  names.map((name) => ({ name, level: years >= 10 ? "EXPERT" : years >= 4 ? "INTERMEDIATE" : "BEGINNER", years: undefined }));

function fromFarmer(u: User, f: FarmerProfile): ProfessionalProfile {
  const years = Math.max(0, new Date().getFullYear() - f.farmingSince);
  return {
    userId: u.id,
    professionId: "pr_farmer",
    secondaryProfessionIds: [],
    about: f.story,
    startedYear: f.farmingSince,
    skills: skillsFromNames(f.skills, years),
    languages: [...f.languages],
    attributes: {},
    location: { village: f.village, district: f.district, state: f.state, serviceRadiusKm: 25, serviceAreas: [f.district] },
    availability: { status: "AVAILABLE", days: [], preferences: [] },
    certifications: structuredClone(f.certifications),
    achievements: structuredClone(f.achievements),
    privacy: structuredClone(f.privacy),
    createdAt: u.createdAt,
    updatedAt: u.createdAt,
    isDemo: u.isDemo,
  };
}

function fromExpert(u: User, e: ExpertProfile, privacy: ProfessionalProfile["privacy"]): ProfessionalProfile {
  return {
    userId: u.id,
    professionId: "pr_agri_expert",
    secondaryProfessionIds: [],
    about: e.about,
    startedYear: new Date().getFullYear() - e.experienceYears,
    skills: skillsFromNames(e.specialization, e.experienceYears),
    languages: [...e.languages],
    attributes: { expertise: e.specialization.join(", ") },
    location: { district: e.district, state: e.state, serviceRadiusKm: 50, serviceAreas: [e.district] },
    availability: { status: "AVAILABLE", days: [], preferences: ["FREELANCE"] },
    certifications: [],
    achievements: [],
    privacy,
    createdAt: u.createdAt,
    updatedAt: u.createdAt,
    isDemo: u.isDemo,
  };
}

export function migrateToProfessional(db: Db): MigrationReport {
  ensureCollections(db);
  const before = JSON.stringify([db.professionalProfiles.length, db.workHistory.length, db.businesses.length]);
  const catalogAdded = ensureCatalog(db);
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const have = new Set(db.professionalProfiles.map((p) => p.userId));
  let farmersLinked = 0;
  let expertsLinked = 0;
  let workHistoryCreated = 0;
  let businessesCreated = 0;

  for (const f of db.farmerProfiles) {
    const u = userById.get(f.userId);
    if (!u || have.has(u.id)) continue;
    db.professionalProfiles.push(fromFarmer(u, f));
    have.add(u.id);
    farmersLinked++;
  }
  for (const e of db.expertProfiles) {
    const u = userById.get(e.userId);
    if (!u || have.has(u.id)) continue;
    const privacy = { profile: "PUBLIC", income: "PRIVATE", financialRecords: "PRIVATE", phone: "CONNECTIONS", produce: "PUBLIC", farmPhotos: "PUBLIC", locationPrecision: "DISTRICT" } as const;
    db.professionalProfiles.push(fromExpert(u, e, { ...privacy }));
    have.add(u.id);
    expertsLinked++;
  }

  // Farmers get a work-history line derived from data they already gave us (farmingSince) — nothing invented.
  const haveWh = new Set(db.workHistory.map((w) => w.id));
  for (const f of db.farmerProfiles) {
    const id = `wh_mig_${f.userId}`;
    const u = userById.get(f.userId);
    if (!u || haveWh.has(id)) continue;
    db.workHistory.push({
      id,
      ownerId: f.userId,
      role: "Farmer",
      organization: "Own / family farm",
      kind: "SELF_EMPLOYED",
      location: [f.village, f.district].filter(Boolean).join(", "),
      startDate: `${f.farmingSince}-01`,
      description: f.specialization,
      skills: f.skills.slice(0, 6),
      createdAt: u.createdAt,
      isDemo: u.isDemo,
    });
    workHistoryCreated++;
  }

  // Buyers and FPOs are businesses on the new platform (same owner id; nothing removed from their old profiles).
  const haveBiz = new Set(db.businesses.map((b) => b.id));
  for (const b of db.buyerProfiles) {
    const u = userById.get(b.userId);
    const id = `biz_${b.userId}`;
    if (!u || haveBiz.has(id)) continue;
    db.businesses.push({
      id,
      ownerId: b.userId,
      name: b.businessName,
      kind: "Buyer / trader",
      about: b.about,
      services: b.cropsPurchased.map((c) => `Buys ${c}`),
      professionIds: [],
      district: b.district,
      state: b.state,
      website: b.website,
      verifiedAt: u.verifiedAt,
      verifiedBy: u.verifiedBy,
      hidden: false,
      createdAt: u.createdAt,
      isDemo: u.isDemo,
    });
    businessesCreated++;
  }
  for (const f of db.fpos) {
    const u = userById.get(f.userId);
    const id = `biz_${f.userId}`;
    if (!u || haveBiz.has(id)) continue;
    db.businesses.push({
      id,
      ownerId: f.userId,
      name: f.name,
      kind: "FPO / cooperative",
      about: f.about,
      services: f.crops.map((c) => `Collective marketing: ${c}`),
      professionIds: [],
      district: f.district,
      state: f.state,
      verifiedAt: u.verifiedAt,
      verifiedBy: u.verifiedBy,
      hidden: false,
      createdAt: u.createdAt,
      isDemo: u.isDemo,
    });
    businessesCreated++;
  }

  const after = JSON.stringify([db.professionalProfiles.length, db.workHistory.length, db.businesses.length]);
  return {
    catalogAdded,
    professionalProfilesCreated: farmersLinked + expertsLinked,
    farmersLinked,
    expertsLinked,
    workHistoryCreated,
    businessesCreated,
    alreadyMigrated: before === after && catalogAdded.professions === 0,
  };
}

export interface MigrationCheck {
  ok: boolean;
  problems: string[];
}

/** Post-migration integrity check: relations, IDs and farmer data all intact. */
export function verifyMigration(db: Db): MigrationCheck {
  const problems: string[] = [];
  const users = new Set(db.users.map((u) => u.id));
  const pros = new Map(db.professionalProfiles.map((p) => [p.userId, p]));
  const professions = new Set(db.professions.map((p) => p.id));
  for (const f of db.farmerProfiles) {
    const pp = pros.get(f.userId);
    if (!users.has(f.userId)) problems.push(`farmer profile ${f.userId} has no user`);
    if (!pp) problems.push(`farmer ${f.userId} has no professional profile`);
    else if (pp.professionId !== "pr_farmer") problems.push(`farmer ${f.userId} linked to ${pp.professionId}`);
  }
  for (const p of db.professionalProfiles) {
    if (!users.has(p.userId)) problems.push(`professional ${p.userId} has no user`);
    if (!professions.has(p.professionId)) problems.push(`professional ${p.userId} has unknown profession ${p.professionId}`);
  }
  for (const farm of db.farms) if (!db.farmerProfiles.some((f) => f.userId === farm.ownerId)) problems.push(`farm ${farm.id} orphaned`);
  for (const crop of db.crops) if (!db.farms.some((f) => f.id === crop.farmId)) problems.push(`crop ${crop.id} orphaned`);
  for (const l of db.listings) if (!users.has(l.ownerId)) problems.push(`listing ${l.id} orphaned`);
  return { ok: problems.length === 0, problems };
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime helpers used by sign-up and the admin catalog tools
// ─────────────────────────────────────────────────────────────────────────────
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** Find a profession by id, exact name, Hindi name or synonym (case-insensitive). */
export function findProfession(d: Db, idOrName: string): Profession | undefined {
  const k = norm(idOrName);
  return d.professions.find((p) => p.id === idOrName) ?? d.professions.find((p) => norm(p.name) === k || norm(p.nameHi) === k || p.synonyms.some((s) => norm(s) === k));
}

/**
 * "Other" profession typed by a user. Reuses an existing profession when the name matches (so we don't breed duplicates);
 * otherwise creates a PENDING one that an admin approves, merges or rejects. The user is never blocked meanwhile.
 */
export function resolveCustomProfession(d: Db, name: string, userId: string): Profession {
  const hit = findProfession(d, name);
  if (hit && hit.status !== "REJECTED") return hit;
  const base = d.professions.find((p) => p.id === "pr_other")!;
  const prof: Profession = {
    id: newId("pr_custom"),
    categoryId: base.categoryId,
    name: name.trim().slice(0, 60),
    nameHi: "",
    emoji: "✨",
    synonyms: [],
    suggestedSkills: [],
    suggestedServices: [],
    attributes: base.attributes,
    dashboard: "GENERAL",
    farmModules: false,
    status: "PENDING",
    custom: true,
    createdBy: userId,
    isDemo: false,
  };
  d.professions.push(prof);
  return prof;
}

export function ensureProfessionalProfile(d: Db, user: User, opts: { professionId?: string; customProfession?: string; district?: string } = {}): ProfessionalProfile | undefined {
  const existing = d.professionalProfiles.find((p) => p.userId === user.id);
  if (existing) return existing;
  let created: ProfessionalProfile | undefined;
  const farmer = d.farmerProfiles.find((f) => f.userId === user.id);
  const expert = d.expertProfiles.find((e) => e.userId === user.id);
  if (farmer) created = fromFarmer(user, farmer);
  else if (expert) created = fromExpert(user, expert, { profile: "PUBLIC", income: "PRIVATE", financialRecords: "PRIVATE", phone: "CONNECTIONS", produce: "PUBLIC", farmPhotos: "PUBLIC", locationPrecision: "DISTRICT" });
  else if (user.role === "PROFESSIONAL") {
    const prof = (opts.professionId && findProfession(d, opts.professionId)) || (opts.customProfession ? resolveCustomProfession(d, opts.customProfession, user.id) : d.professions.find((p) => p.id === "pr_other")!);
    created = {
      userId: user.id,
      professionId: prof.id,
      secondaryProfessionIds: [],
      about: "",
      startedYear: new Date().getFullYear(),
      skills: [],
      languages: ["Hindi"],
      attributes: {},
      location: { district: opts.district ?? "", state: "Rajasthan", serviceRadiusKm: 25, serviceAreas: opts.district ? [opts.district] : [] },
      availability: { status: "OPEN_TO_WORK", days: [], preferences: [] },
      certifications: [],
      achievements: [],
      privacy: { profile: "PUBLIC", income: "PRIVATE", financialRecords: "PRIVATE", phone: "CONNECTIONS", produce: "PUBLIC", farmPhotos: "PUBLIC", locationPrecision: "DISTRICT" },
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
      isDemo: user.isDemo,
    };
  }
  if (created) d.professionalProfiles.push(created);
  return created;
}

// ─────────────────────────────────────────────────────────────────────────────
// Farmer ↔ professional field sync. FarmerProfile stays the source for farm modules, and the professional
// profile mirrors the shared identity fields so neither screen ever shows stale data.
// ─────────────────────────────────────────────────────────────────────────────
export function syncFarmerToProfessional(d: Db, userId: string) {
  const f = d.farmerProfiles.find((x) => x.userId === userId);
  const p = d.professionalProfiles.find((x) => x.userId === userId);
  if (!f || !p) return;
  const keep = new Map(p.skills.map((s) => [s.name.toLowerCase(), s]));
  const years = Math.max(0, new Date().getFullYear() - f.farmingSince);
  p.skills = f.skills.map((n) => keep.get(n.toLowerCase()) ?? ({ name: n, level: years >= 10 ? "EXPERT" : years >= 4 ? "INTERMEDIATE" : "BEGINNER" } as ProfessionalSkill));
  p.about = f.story;
  p.startedYear = f.farmingSince;
  p.languages = [...f.languages];
  p.location = { ...p.location, village: f.village, district: f.district, state: f.state, serviceAreas: p.location.serviceAreas.length ? p.location.serviceAreas : [f.district] };
  p.certifications = structuredClone(f.certifications);
  p.achievements = structuredClone(f.achievements);
  p.privacy = structuredClone(f.privacy);
  p.updatedAt = new Date().toISOString();
}

export function syncProfessionalToFarmer(d: Db, userId: string) {
  const f = d.farmerProfiles.find((x) => x.userId === userId);
  const p = d.professionalProfiles.find((x) => x.userId === userId);
  if (!f || !p) return;
  f.skills = p.skills.map((s) => s.name);
  f.story = p.about;
  f.farmingSince = p.startedYear;
  f.languages = [...p.languages];
  f.village = p.location.village ?? f.village;
  f.district = p.location.district || f.district;
  f.state = p.location.state || f.state;
  f.certifications = structuredClone(p.certifications);
  f.achievements = structuredClone(p.achievements);
}

export function syncProfessionalToExpert(d: Db, userId: string) {
  const e = d.expertProfiles.find((x) => x.userId === userId);
  const p = d.professionalProfiles.find((x) => x.userId === userId);
  if (!e || !p) return;
  e.about = p.about || e.about;
  e.languages = [...p.languages];
  e.district = p.location.district || e.district;
  e.state = p.location.state || e.state;
  e.experienceYears = Math.max(0, new Date().getFullYear() - p.startedYear);
}
