import { describe, expect, it } from "vitest";
import { computeCycleStats, computeFarmHealthScore } from "@/lib/farm-calc";
import { detectIntent } from "@/lib/intents";
import { extractHashtags, sanitizeText } from "@/lib/utils";
import { roleCan } from "@/lib/capabilities";

describe("computeCycleStats", () => {
  const expenses = [
    { category: "SEED", amount: 2000 },
    { category: "LABOUR", amount: 3000 },
    { category: "SEED", amount: 500 },
  ] as const;

  it("sums cost, and only counts SOLD quantity as revenue", () => {
    const s = computeCycleStats({ areaAcres: 5 }, [...expenses], { quantityQtl: 60, soldQtl: 40, sellingPricePerQtl: 6000 });
    expect(s.totalCost).toBe(5500);
    expect(s.revenue).toBe(240000);
    expect(s.profit).toBe(234500);
    expect(s.profitPerAcre).toBe(46900);
    expect(s.costPerQtl).toBeCloseTo(5500 / 60);
    expect(s.yieldPerAcre).toBe(12);
  });

  it("groups cost by category", () => {
    const s = computeCycleStats({ areaAcres: 1 }, [...expenses]);
    expect(s.costByCategory).toEqual(expect.arrayContaining([{ category: "SEED", amount: 2500 }, { category: "LABOUR", amount: 3000 }]));
  });

  it("is safe with no harvest or zero area (no NaN / Infinity)", () => {
    const s = computeCycleStats({ areaAcres: 0 }, [...expenses]);
    expect(s.revenue).toBe(0);
    expect(s.profit).toBe(-5500);
    expect(s.profitPerAcre).toBe(0);
    expect(s.costPerQtl).toBeNull();
    expect(Number.isFinite(s.yieldPerAcre)).toBe(true);
  });
});

describe("computeFarmHealthScore (record completeness only)", () => {
  it("is 0 for a brand-new account", () => {
    const h = computeFarmHealthScore({ farms: [], crops: [], cycles: [], expenses: [], harvests: [] });
    expect(h.score).toBe(0);
    expect(h.explanation).toMatch(/NOT a measure of crop condition/);
  });

  it("awards points per documented rule and never exceeds 100", () => {
    const h = computeFarmHealthScore({
      farms: [{ soil: "Loamy", irrigation: "Drip", areaAcres: 4 }],
      crops: [{ id: "c1" }],
      cycles: [{ id: "cy1", stages: { sowing: { done: true, date: "2026-01-01" }, irrigation: { done: true } } }] as never,
      expenses: ["SEED", "FERTILISER", "LABOUR", "IRRIGATION", "PESTICIDE", "OTHER"].map((category) => ({ cycleId: "cy1", category })) as never,
      harvests: [{ cycleId: "cy1" }, { cycleId: "cy2" }, { cycleId: "cy3" }],
    });
    expect(h.score).toBe(100);
    expect(h.parts.reduce((s, p) => s + p.max, 0)).toBe(100);
  });

  it("scores partial harvest history 8 / 14 / 20", () => {
    const base = { farms: [], crops: [], cycles: [], expenses: [] };
    expect(computeFarmHealthScore({ ...base, harvests: [{ cycleId: "a" }] }).score).toBe(8);
    expect(computeFarmHealthScore({ ...base, harvests: [{ cycleId: "a" }, { cycleId: "b" }] }).score).toBe(14);
  });
});

describe("detectIntent (shared by voice and AI)", () => {
  it("routes selling produce with crop and quantity prefilled", () => {
    const i = detectIntent("मेरे पास 50 क्विंटल सरसों है");
    expect(i.id).toBe("SELL_PRODUCE");
    expect(i.href).toContain("/create?type=produce");
    expect(i.href).toContain("quantity=50");
  });

  it("routes Hinglish crop problems to the expert flow", () => {
    expect(detectIntent("sarson mein peele keede lage hain").id).toBe("CROP_PROBLEM");
  });

  it("routes emergencies and schemes", () => {
    expect(detectIntent("snake bite what to do").id).toBe("HEALTH");
    expect(detectIntent("kisan yojana subsidy").id).toBe("SCHEMES");
  });

  it("falls back to the assistant when nothing matches", () => {
    const i = detectIntent("zzz qqq");
    expect(i.id).toBe("FALLBACK");
    expect(i.href).toBe("/ai-assistant");
  });
});

describe("text helpers", () => {
  it("sanitizeText strips tags and control characters", () => {
    expect(sanitizeText("<script>alert(1)</script>Hello\u0007 world")).toBe("alert(1)Hello world");
  });
  it("extractHashtags dedupes and supports Devanagari", () => {
    expect(extractHashtags("#Mustard #सरसों #Mustard fine")).toEqual(["Mustard", "सरसों"]);
  });
});

describe("RBAC matrix", () => {
  it("only farmers/FPOs manage farms; only buyers post requirements; admins moderate", () => {
    expect(roleCan("FARMER", "farm:manage")).toBe(true);
    expect(roleCan("BUYER", "farm:manage")).toBe(false);
    expect(roleCan("BUYER", "requirement:create")).toBe(true);
    expect(roleCan("FARMER", "requirement:create")).toBe(false);
    expect(roleCan("FARMER", "admin:access")).toBe(false);
    expect(roleCan("ADMIN", "admin:access")).toBe(true);
  });
});
