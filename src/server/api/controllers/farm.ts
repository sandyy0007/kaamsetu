import type { CropCycle, CropStatus, Db, StageKey, StageRecord } from "@/types/domain";
import { STAGE_KEYS } from "@/types/domain";
import type { CropDetailDTO, FarmDetailDTO, FarmSummaryDTO } from "@/types/dto";
import { cropSchema, cycleStartSchema, expenseSchema, farmSchema, harvestSchema, stageUpdateSchema } from "@/lib/schemas";
import { computeFarmHealthScore } from "@/lib/farm-calc";
import { newId } from "../../crypto";
import { persist } from "../../db";
import { notFound } from "../../errors";
import { cropDTO, cycleDTO, farmDTO } from "../../mappers";
import { requireCap } from "../../permissions";
import { canSee } from "../../privacy";
import { route } from "../router";

const emptyStages = (): Record<StageKey, StageRecord> => Object.fromEntries(STAGE_KEYS.map((k) => [k, { done: false }])) as Record<StageKey, StageRecord>;

/** Ownership lookups return 404 (not 403) so private records cannot be probed for existence. */
function ownedFarm(d: Db, userId: string, id: string) {
  const f = d.farms.find((x) => x.id === id && x.ownerId === userId);
  if (!f) throw notFound("Farm");
  return f;
}
function ownedCrop(d: Db, userId: string, id: string) {
  const c = d.crops.find((x) => x.id === id && x.ownerId === userId);
  if (!c) throw notFound("Crop");
  return c;
}
function ownedCycle(d: Db, userId: string, id: string) {
  const c = d.cropCycles.find((x) => x.id === id && x.ownerId === userId);
  if (!c) throw notFound("Crop cycle");
  return c;
}

export function deriveStatus(stages: Record<StageKey, StageRecord>): CropStatus {
  if (stages.sale.done) return "SOLD";
  if (stages.harvest.done) return "HARVESTED";
  if (stages.sowing.done) return "GROWING";
  return "PLANNED";
}

/** Crop status mirrors its most recent cycle. */
function syncCropStatus(d: Db, cropId: string) {
  const crop = d.crops.find((c) => c.id === cropId);
  const latest = d.cropCycles.filter((c) => c.cropId === cropId).sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt))[0];
  if (crop && latest) crop.status = latest.status;
}

function healthFor(d: Db, userId: string, farmId?: string) {
  const farms = d.farms.filter((f) => f.ownerId === userId && (!farmId || f.id === farmId));
  const cycles = d.cropCycles.filter((c) => c.ownerId === userId && (!farmId || c.farmId === farmId));
  const ids = new Set(cycles.map((c) => c.id));
  return computeFarmHealthScore({
    farms,
    crops: d.crops.filter((c) => c.ownerId === userId && (!farmId || c.farmId === farmId)),
    cycles,
    expenses: d.expenses.filter((e) => ids.has(e.cycleId)),
    harvests: d.harvests.filter((h) => ids.has(h.cycleId)),
  });
}

// ───────────── farms ─────────────
route("GET", "/farms", (c) => {
  const u = requireCap(c.user, "farm:manage");
  return c.d.farms.filter((f) => f.ownerId === u.id).map((f) => farmDTO(c.d, f));
});

route("POST", "/farms", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const input = await c.body(farmSchema);
  const farm = { id: newId("f"), ownerId: u.id, ...input, scene: "sunrise" as const, history: [], createdAt: new Date().toISOString(), isDemo: false };
  c.d.farms.push(farm);
  persist();
  return farmDTO(c.d, farm);
});

route("GET", "/farms/:id", (c): FarmDetailDTO => {
  const farm = c.d.farms.find((f) => f.id === c.params.id);
  if (!farm) throw notFound("Farm");
  const isOwn = c.user?.id === farm.ownerId;
  if (!isOwn) {
    // Non-owners only see farms of farmers whose profile they may view — and never records.
    const p = c.d.farmerProfiles.find((x) => x.userId === farm.ownerId);
    if (!p || !canSee(c.d, c.user, farm.ownerId, p.privacy.profile)) throw notFound("Farm");
    return { farm: { ...farmDTO(c.d, farm), village: "" }, cycles: [], health: null, isOwn };
  }
  const cycles = c.d.cropCycles.filter((x) => x.farmId === farm.id).sort((a, b) => b.year - a.year).map((x) => cycleDTO(c.d, x));
  return { farm: farmDTO(c.d, farm), cycles, health: healthFor(c.d, farm.ownerId, farm.id), isOwn };
});

route("PATCH", "/farms/:id", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const farm = ownedFarm(c.d, u.id, c.params.id!);
  Object.assign(farm, await c.body(farmSchema));
  persist();
  return farmDTO(c.d, farm);
});

route("DELETE", "/farms/:id", (c) => {
  const u = requireCap(c.user, "farm:manage");
  const farm = ownedFarm(c.d, u.id, c.params.id!);
  const cycleIds = new Set(c.d.cropCycles.filter((x) => x.farmId === farm.id).map((x) => x.id));
  c.d.expenses = c.d.expenses.filter((e) => !cycleIds.has(e.cycleId));
  c.d.harvests = c.d.harvests.filter((h) => !cycleIds.has(h.cycleId));
  c.d.cropCycles = c.d.cropCycles.filter((x) => x.farmId !== farm.id);
  c.d.crops = c.d.crops.filter((x) => x.farmId !== farm.id);
  c.d.farms = c.d.farms.filter((x) => x.id !== farm.id);
  persist();
  return { ok: true };
});

// ───────────── crops ─────────────
route("GET", "/crops", (c) => {
  const u = requireCap(c.user, "farm:manage");
  return c.d.crops.filter((x) => x.ownerId === u.id).map((x) => cropDTO(c.d, x));
});

route("POST", "/crops", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const input = await c.body(cropSchema);
  ownedFarm(c.d, u.id, input.farmId);
  const crop = { id: newId("c"), ownerId: u.id, ...input, status: "PLANNED" as const, createdAt: new Date().toISOString(), isDemo: false };
  c.d.crops.push(crop);
  persist();
  return cropDTO(c.d, crop);
});

route("GET", "/crops/:id", (c): CropDetailDTO => {
  const crop = c.d.crops.find((x) => x.id === c.params.id);
  if (!crop) throw notFound("Crop");
  if (c.user?.id !== crop.ownerId) {
    const p = c.d.farmerProfiles.find((x) => x.userId === crop.ownerId);
    if (!p || !canSee(c.d, c.user, crop.ownerId, p.privacy.profile)) throw notFound("Crop");
    return { crop: cropDTO(c.d, crop), cycles: [], comparison: [] };
  }
  const cycles = c.d.cropCycles.filter((x) => x.cropId === crop.id).sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt)).map((x) => cycleDTO(c.d, x));
  const comparison = cycles
    .filter((x) => x.harvest)
    .map((x) => ({ cycleId: x.id, label: `${x.season} ${x.year}`, year: x.year, cost: x.stats.totalCost, revenue: x.stats.revenue, profit: x.stats.profit, yieldPerAcre: x.stats.yieldPerAcre }))
    .sort((a, b) => a.year - b.year);
  return { crop: cropDTO(c.d, crop), cycles, comparison };
});

route("PATCH", "/crops/:id", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const crop = ownedCrop(c.d, u.id, c.params.id!);
  const input = await c.body(cropSchema);
  ownedFarm(c.d, u.id, input.farmId);
  Object.assign(crop, input);
  persist();
  return cropDTO(c.d, crop);
});

route("DELETE", "/crops/:id", (c) => {
  const u = requireCap(c.user, "farm:manage");
  const crop = ownedCrop(c.d, u.id, c.params.id!);
  const cycleIds = new Set(c.d.cropCycles.filter((x) => x.cropId === crop.id).map((x) => x.id));
  c.d.expenses = c.d.expenses.filter((e) => !cycleIds.has(e.cycleId));
  c.d.harvests = c.d.harvests.filter((h) => !cycleIds.has(h.cycleId));
  c.d.cropCycles = c.d.cropCycles.filter((x) => x.cropId !== crop.id);
  c.d.crops = c.d.crops.filter((x) => x.id !== crop.id);
  persist();
  return { ok: true };
});

// ───────────── crop cycles (private) ─────────────
route("POST", "/crops/:id/cycles", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const crop = ownedCrop(c.d, u.id, c.params.id!);
  const input = await c.body(cycleStartSchema);
  const cycle: CropCycle = { id: newId("cyc"), cropId: crop.id, farmId: crop.farmId, ownerId: u.id, season: input.season, year: input.year, areaAcres: input.areaAcres, seed: input.seed, stages: emptyStages(), status: "PLANNED", createdAt: new Date().toISOString(), isDemo: false };
  c.d.cropCycles.push(cycle);
  syncCropStatus(c.d, crop.id);
  persist();
  return cycleDTO(c.d, cycle);
});

route("PATCH", "/cycles/:id/stages", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const cycle = ownedCycle(c.d, u.id, c.params.id!);
  const input = await c.body(stageUpdateSchema);
  cycle.stages[input.stage] = { done: input.done, date: input.date, note: input.note };
  cycle.status = deriveStatus(cycle.stages);
  syncCropStatus(c.d, cycle.cropId);
  persist();
  return cycleDTO(c.d, cycle);
});

route("POST", "/cycles/:id/expenses", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const cycle = ownedCycle(c.d, u.id, c.params.id!);
  const input = await c.body(expenseSchema);
  c.d.expenses.push({ id: newId("e"), cycleId: cycle.id, ownerId: u.id, ...input, isDemo: false });
  persist();
  return cycleDTO(c.d, cycle);
});

route("DELETE", "/expenses/:id", (c) => {
  const u = requireCap(c.user, "farm:manage");
  const e = c.d.expenses.find((x) => x.id === c.params.id && x.ownerId === u.id);
  if (!e) throw notFound("Expense");
  c.d.expenses = c.d.expenses.filter((x) => x.id !== e.id);
  persist();
  return cycleDTO(c.d, c.d.cropCycles.find((x) => x.id === e.cycleId)!);
});

route("PUT", "/cycles/:id/harvest", async (c) => {
  const u = requireCap(c.user, "farm:manage");
  const cycle = ownedCycle(c.d, u.id, c.params.id!);
  const input = await c.body(harvestSchema.refine((v) => v.soldQtl <= v.quantityQtl, { message: "Sold quantity cannot exceed harvested quantity", path: ["soldQtl"] }));
  const existing = c.d.harvests.find((h) => h.cycleId === cycle.id);
  if (existing) Object.assign(existing, input);
  else c.d.harvests.push({ id: newId("h"), cycleId: cycle.id, ownerId: u.id, ...input, isDemo: false });
  cycle.stages.harvest = { done: true, date: input.date };
  if (input.soldQtl > 0) cycle.stages.sale = { done: true, date: input.date };
  cycle.status = deriveStatus(cycle.stages);
  syncCropStatus(c.d, cycle.cropId);
  persist();
  return cycleDTO(c.d, cycle);
});

route("GET", "/farm/summary", (c): FarmSummaryDTO => {
  const u = requireCap(c.user, "farm:manage");
  const d = c.d;
  const cycles = d.cropCycles.filter((x) => x.ownerId === u.id).map((x) => cycleDTO(d, x));
  const byYear = new Map<number, { cost: number; revenue: number }>();
  const byCat = new Map<string, number>();
  for (const cy of cycles) {
    const y = byYear.get(cy.year) ?? { cost: 0, revenue: 0 };
    y.cost += cy.stats.totalCost;
    y.revenue += cy.stats.revenue;
    byYear.set(cy.year, y);
    cy.stats.costByCategory.forEach((cc) => byCat.set(cc.category, (byCat.get(cc.category) ?? 0) + cc.amount));
  }
  const cost = cycles.reduce((s, x) => s + x.stats.totalCost, 0);
  const revenue = cycles.reduce((s, x) => s + x.stats.revenue, 0);
  return {
    totals: { cost, revenue, profit: revenue - cost, acres: d.farms.filter((f) => f.ownerId === u.id).reduce((s, f) => s + f.areaAcres, 0) },
    byYear: Array.from(byYear.entries()).sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, cost: v.cost, revenue: v.revenue, profit: v.revenue - v.cost })),
    byCategory: Array.from(byCat.entries()).map(([category, amount]) => ({ category: category as FarmSummaryDTO["byCategory"][number]["category"], amount })),
    health: healthFor(d, u.id),
    farms: d.farms.filter((f) => f.ownerId === u.id).length,
    crops: d.crops.filter((x) => x.ownerId === u.id).length,
  };
});

