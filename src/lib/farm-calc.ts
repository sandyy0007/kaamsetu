import type { Crop, CropCycle, ExpenseCategory, FarmExpense, Harvest } from "@/types/domain";
import { EXPENSE_CATEGORIES } from "@/types/domain";
import type { CycleStats, FarmHealthScore } from "@/types/dto";

/** Per-cycle economics. Revenue counts only quantity actually SOLD — unsold stock is not income. */
export function computeCycleStats(cycle: Pick<CropCycle, "areaAcres">, expenses: Pick<FarmExpense, "category" | "amount">[], harvest?: Pick<Harvest, "quantityQtl" | "soldQtl" | "sellingPricePerQtl">): CycleStats {
  const totalCost = expenses.reduce((s, e) => s + e.amount, 0);
  const revenue = harvest ? harvest.soldQtl * harvest.sellingPricePerQtl : 0;
  const profit = revenue - totalCost;
  const yieldQtl = harvest?.quantityQtl ?? 0;
  const byCat = new Map<ExpenseCategory, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  return {
    totalCost,
    revenue,
    profit,
    profitPerAcre: cycle.areaAcres > 0 ? profit / cycle.areaAcres : 0,
    costPerQtl: yieldQtl > 0 ? totalCost / yieldQtl : null,
    yieldQtl,
    yieldPerAcre: cycle.areaAcres > 0 ? yieldQtl / cycle.areaAcres : 0,
    costByCategory: EXPENSE_CATEGORIES.filter((c) => byCat.has(c)).map((c) => ({ category: c, amount: byCat.get(c)! })),
  };
}

interface HealthInput {
  farms: { soil: string; irrigation: string; areaAcres: number }[];
  crops: Pick<Crop, "id">[];
  cycles: Pick<CropCycle, "id" | "stages">[];
  expenses: Pick<FarmExpense, "cycleId" | "category">[];
  harvests: Pick<Harvest, "cycleId">[];
}

/**
 * Farm Health Score — a record-keeping COMPLETENESS indicator (0–100). It says nothing about
 * crop condition or soil health. Weights are listed in `explanation` so farmers know exactly
 * what to add to improve it.
 */
export function computeFarmHealthScore(i: HealthInput): FarmHealthScore {
  const farmComplete = i.farms.length > 0 && i.farms.every((f) => f.soil && f.irrigation && f.areaAcres > 0);
  const hasCrops = i.crops.length > 0;
  const sowingRecorded = i.cycles.some((c) => c.stages.sowing?.done && c.stages.sowing.date);
  const irrigationRecorded = i.cycles.some((c) => c.stages.irrigation?.done) || i.expenses.some((e) => e.category === "IRRIGATION");
  const categories = new Set(i.expenses.map((e) => e.category)).size;
  const expensePts = Math.round((Math.min(categories, 5) / 5) * 20);
  const harvestCount = new Set(i.harvests.map((h) => h.cycleId)).size;
  const harvestPts = harvestCount >= 3 ? 20 : harvestCount === 2 ? 14 : harvestCount === 1 ? 8 : 0;

  const parts: FarmHealthScore["parts"] = [
    { key: "farm", label: "Farm details (area, soil, irrigation)", points: farmComplete ? 15 : 0, max: 15, done: farmComplete, tip: "Add a farm with soil type and irrigation." },
    { key: "crops", label: "Crops added", points: hasCrops ? 15 : 0, max: 15, done: hasCrops, tip: "Add the crops you grow." },
    { key: "sowing", label: "Sowing date recorded", points: sowingRecorded ? 15 : 0, max: 15, done: sowingRecorded, tip: "Record the sowing date on a crop cycle." },
    { key: "irrigation", label: "Irrigation records", points: irrigationRecorded ? 15 : 0, max: 15, done: irrigationRecorded, tip: "Mark irrigation done or add irrigation expense." },
    { key: "expenses", label: "Expense tracking (up to 5 categories)", points: expensePts, max: 20, done: expensePts >= 20, tip: "Track seed, fertiliser, labour, irrigation and pesticide spend." },
    { key: "harvest", label: "Harvest history (1–3 cycles)", points: harvestPts, max: 20, done: harvestPts >= 20, tip: "Record the harvest and selling price after each season." },
  ];
  const score = parts.reduce((s, p) => s + p.points, 0);
  return {
    score,
    max: 100,
    parts,
    explanation:
      "Farm Health Score shows how complete your farm records are — it is NOT a measure of crop condition, soil quality or anyone's health. Points: farm details 15, crops 15, sowing date 15, irrigation records 15, expense tracking 20 (4 per category, up to 5), harvest history 20 (8 / 14 / 20 for 1 / 2 / 3+ cycles).",
  };
}
