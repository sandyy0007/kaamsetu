import { describe, expect, it } from "vitest";
import type { Db } from "@/types/domain";
import { migrateToProfessional, verifyMigration } from "@/server/migrate";
import { buildDemoDb } from "@/server/seed";

/** Rebuild what a database written by the pre-KaamSetu (farmer-only) build looked like. */
function legacySnapshot(): Db {
  const db = structuredClone(buildDemoDb()) as unknown as Record<string, unknown>;
  for (const k of ["professionCategories", "professions", "skillCatalog", "professionalProfiles", "services", "serviceRequests", "portfolioEntries", "workHistory", "recommendations", "workOpportunities", "applications", "businesses"]) delete db[k];
  const d = db as unknown as Db;
  const pros = new Set(["u_p_anil", "u_p_suresh", "u_p_imran", "u_p_savitri", "u_p_dilip", "u_p_kamla", "u_p_bhura", "u_p_gopal", "u_p_laxman", "u_p_rakesh", "u_p_pooja", "u_p_ratan"]);
  d.users = d.users.filter((u) => !pros.has(u.id));
  d.conversations = d.conversations.filter((c) => c.id !== "cv_sr4");
  d.messages = d.messages.filter((m) => m.conversationId !== "cv_sr4");
  return d;
}

const FARMER_COLLECTIONS = ["users", "farmerProfiles", "buyerProfiles", "expertProfiles", "farms", "crops", "cropCycles", "expenses", "harvests", "listings", "requirements", "posts", "follows", "conversations", "messages"] as const;

describe("KisanSetu → KaamSetu migration", () => {
  it("links every existing farmer to a professional profile with the SAME id", () => {
    const old = legacySnapshot();
    const farmerIds = old.farmerProfiles.map((f) => f.userId);
    const report = migrateToProfessional(old);
    expect(report.farmersLinked).toBe(farmerIds.length);
    for (const id of farmerIds) {
      const pp = old.professionalProfiles.find((p) => p.userId === id);
      expect(pp, id).toBeTruthy();
      expect(pp!.professionId).toBe("pr_farmer");
      expect(old.users.find((u) => u.id === id)?.id).toBe(id);
    }
  });

  it("never modifies or deletes any existing farmer data", () => {
    const old = legacySnapshot();
    const before = Object.fromEntries(FARMER_COLLECTIONS.map((k) => [k, JSON.stringify(old[k])]));
    migrateToProfessional(old);
    for (const k of FARMER_COLLECTIONS) expect(JSON.stringify(old[k]), `${k} changed`).toBe(before[k]);
  });

  it("is idempotent — a second run adds nothing", () => {
    const old = legacySnapshot();
    migrateToProfessional(old);
    const snap = JSON.stringify(old);
    const again = migrateToProfessional(old);
    expect(again.professionalProfilesCreated).toBe(0);
    expect(again.workHistoryCreated).toBe(0);
    expect(again.businessesCreated).toBe(0);
    expect(again.alreadyMigrated).toBe(true);
    expect(JSON.stringify(old)).toBe(snap);
  });

  it("passes the integrity check (relations, orphans)", () => {
    const old = legacySnapshot();
    migrateToProfessional(old);
    const check = verifyMigration(old);
    expect(check.problems).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it("seeds the full profession catalog, including every category from the spec", () => {
    const old = legacySnapshot();
    migrateToProfessional(old);
    const names = old.professions.map((p) => p.name);
    for (const n of ["Farmer", "Farm Worker", "Dairy Worker", "Tractor Operator", "Agricultural Technician", "Electrician", "Plumber", "Carpenter", "Mason", "Painter", "Welder", "Mechanic", "Driver", "Cook", "Tailor", "Barber", "Beautician", "Cleaner", "Potter", "Weaver", "Handicraft Worker", "Leather Worker", "Computer Technician", "Mobile Repair Technician", "AC Technician", "Electronics Technician", "Freelancer", "Photographer", "Tutor", "Consultant", "Self-employed", "Other"]) expect(names, n).toContain(n);
    expect(old.professionCategories.map((c) => c.name)).toEqual(["Agriculture", "Skilled Trades", "Services", "Artisan", "Technical", "Independent", "Other"]);
    expect(old.professions.find((p) => p.id === "pr_farmer")?.farmModules).toBe(true);
    expect(old.professions.filter((p) => p.farmModules)).toHaveLength(1);
  });

  it("buyers and FPOs become businesses, experts get professional profiles", () => {
    const old = legacySnapshot();
    const r = migrateToProfessional(old);
    expect(r.businessesCreated).toBe(old.buyerProfiles.length + old.fpos.length);
    expect(r.expertsLinked).toBe(old.expertProfiles.length);
    expect(old.businesses.find((b) => b.id === "biz_u_b_marudhara")?.verifiedAt).toBeTruthy();
  });

  it("an empty production database still gets the reference catalog", () => {
    const empty = { ...legacySnapshot(), users: [], farmerProfiles: [], buyerProfiles: [], expertProfiles: [], fpos: [] } as Db;
    migrateToProfessional(empty);
    expect(empty.professions.length).toBeGreaterThan(30);
    expect(empty.professions.every((p) => !p.isDemo)).toBe(true); // reference data survives purgeDemoData()
  });
});
