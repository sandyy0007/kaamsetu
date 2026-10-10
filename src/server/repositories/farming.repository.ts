/**
 * Farming Repository — manages farms, crops, cycles, expenses, and harvests
 * across Prisma (PostgreSQL) and the in-memory store.
 */
import type { Farm, Crop, CropCycle, FarmExpense, Harvest } from "@/types/domain";
import { db, persist } from "../db";
import { env } from "../env";
import { prisma } from "../prisma";
import { ApiException } from "../errors";

function isProdDb(): boolean {
  return !env().DEMO_MODE;
}

export class FarmingRepository {
  async listFarms(ownerId: string): Promise<Farm[]> {
    if (isProdDb()) {
      try {
        const farms = await prisma.farm.findMany({
          where: { ownerId },
          include: { crops: true },
          orderBy: { createdAt: "desc" },
        });
        return farms as unknown as Farm[];
      } catch (err) {
        console.error("[farming.repo:listFarms] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }
    return db().farms.filter((f) => f.ownerId === ownerId);
  }

  async getFarm(id: string, ownerId?: string): Promise<Farm | null> {
    if (isProdDb()) {
      try {
        const where: Record<string, unknown> = { id };
        if (ownerId) where.ownerId = ownerId;
        const farm = await prisma.farm.findFirst({ where, include: { crops: true } });
        return farm as unknown as Farm | null;
      } catch (err) {
        console.error("[farming.repo:getFarm] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }
    return db().farms.find((f) => f.id === id && (!ownerId || f.ownerId === ownerId)) ?? null;
  }

  async createFarm(farm: Farm): Promise<Farm> {
    if (isProdDb()) {
      try {
        const created = await prisma.farm.create({
          data: {
            id: farm.id,
            ownerId: farm.ownerId,
            name: farm.name,
            areaAcres: farm.areaAcres,
            soil: farm.soil,
            irrigation: farm.irrigation,
            village: farm.village,
            district: farm.district,
            history: farm.history as unknown as object,
            isDemo: farm.isDemo,
          },
        });
        return created as unknown as Farm;
      } catch (err) {
        console.error("[farming.repo:createFarm] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().farms.push(farm);
    persist();
    return farm;
  }

  async createCrop(crop: Crop): Promise<Crop> {
    if (isProdDb()) {
      try {
        const created = await prisma.crop.create({
          data: {
            id: crop.id,
            ownerId: crop.ownerId,
            farmId: crop.farmId,
            name: crop.name,
            experienceYears: crop.experienceYears,
            season: crop.season,
            areaAcres: crop.areaAcres,
            method: crop.method,
            typicalYieldQtlPerAcre: crop.typicalYieldQtlPerAcre,
            status: crop.status,
            isDemo: crop.isDemo,
          },
        });
        return created as unknown as Crop;
      } catch (err) {
        console.error("[farming.repo:createCrop] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().crops.push(crop);
    persist();
    return crop;
  }

  async createCropCycle(cycle: CropCycle): Promise<CropCycle> {
    if (isProdDb()) {
      try {
        const created = await prisma.cropCycle.create({
          data: {
            id: cycle.id,
            cropId: cycle.cropId,
            farmId: cycle.farmId,
            ownerId: cycle.ownerId,
            season: cycle.season,
            year: cycle.year,
            areaAcres: cycle.areaAcres,
            seed: cycle.seed,
            stages: cycle.stages as unknown as object,
            status: cycle.status,
            isDemo: cycle.isDemo,
          },
        });
        return created as unknown as CropCycle;
      } catch (err) {
        console.error("[farming.repo:createCropCycle] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().cropCycles.push(cycle);
    persist();
    return cycle;
  }

  async createExpense(expense: FarmExpense): Promise<FarmExpense> {
    if (isProdDb()) {
      try {
        const created = await prisma.farmExpense.create({
          data: {
            id: expense.id,
            cycleId: expense.cycleId,
            ownerId: expense.ownerId,
            category: expense.category,
            amount: expense.amount,
            date: new Date(expense.date),
            note: expense.note,
            isDemo: expense.isDemo,
          },
        });
        return created as unknown as FarmExpense;
      } catch (err) {
        console.error("[farming.repo:createExpense] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().expenses.push(expense);
    persist();
    return expense;
  }

  async createHarvest(harvest: Harvest): Promise<Harvest> {
    if (isProdDb()) {
      try {
        const created = await prisma.harvest.create({
          data: {
            id: harvest.id,
            cycleId: harvest.cycleId,
            ownerId: harvest.ownerId,
            date: new Date(harvest.date),
            quantityQtl: harvest.quantityQtl,
            soldQtl: harvest.soldQtl,
            sellingPricePerQtl: harvest.sellingPricePerQtl,
            isDemo: harvest.isDemo,
          },
        });
        return created as unknown as Harvest;
      } catch (err) {
        console.error("[farming.repo:createHarvest] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().harvests.push(harvest);
    persist();
    return harvest;
  }
}

export const farmingRepository = new FarmingRepository();

