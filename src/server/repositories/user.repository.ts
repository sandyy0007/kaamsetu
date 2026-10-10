/**
 * User Repository — abstracts user persistence across Prisma (PostgreSQL) and the in-memory store.
 *
 * In production (DEMO_MODE=false), all operations execute directly on PostgreSQL via Prisma.
 * In demo mode (DEMO_MODE=true), operations execute on the typed in-memory store with JSON persistence.
 */
import type { Role, User, UserStatus } from "@/types/domain";
import { db, persist } from "../db";
import { env } from "../env";
import { prisma } from "../prisma";
import { ApiException } from "../errors";

function isProdDb(): boolean {
  return !env().DEMO_MODE;
}

function toUser(record: unknown): User | null {
  if (!record) return null;
  const r = record as Record<string, unknown>;
  return {
    ...r,
    personalization: (r.personalization as boolean) ?? true,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || new Date().toISOString()),
    verifiedAt: r.verifiedAt instanceof Date ? r.verifiedAt.toISOString() : (r.verifiedAt as string | undefined),
  } as unknown as User;
}

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    if (isProdDb()) {
      try {
        const u = await prisma.user.findUnique({ where: { id } });
        return toUser(u);
      } catch (err) {
        console.error("[user.repo:findById] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }
    return db().users.find((u) => u.id === id) ?? null;
  }

  async findByHandle(handle: string): Promise<User | null> {
    if (isProdDb()) {
      try {
        const u = await prisma.user.findUnique({ where: { handle } });
        return toUser(u);
      } catch (err) {
        console.error("[user.repo:findByHandle] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }
    return db().users.find((u) => u.handle.toLowerCase() === handle.toLowerCase()) ?? null;
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    const raw = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/\D/g, "").slice(-10);

    if (isProdDb()) {
      try {
        const u = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: raw, mode: "insensitive" } },
              { phone: { endsWith: cleanPhone } },
            ],
          },
        });
        return toUser(u);
      } catch (err) {
        console.error("[user.repo:findByIdentifier] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    return (
      db().users.find(
        (u) =>
          (u.email && u.email.toLowerCase() === raw) ||
          (u.phone && u.phone.replace(/\D/g, "").slice(-10) === cleanPhone),
      ) ?? null
    );
  }

  async create(user: User): Promise<User> {
    if (isProdDb()) {
      try {
        const created = await prisma.user.create({
          data: {
            id: user.id,
            role: user.role,
            name: user.name,
            handle: user.handle,
            email: user.email,
            phone: user.phone,
            passwordHash: user.passwordHash,
            headline: user.headline,
            hue: user.hue,
            language: user.language,
            status: user.status,
            isDemo: user.isDemo,
            verifiedAt: user.verifiedAt ? new Date(user.verifiedAt) : undefined,
            verifiedBy: user.verifiedBy,
            notificationPrefs: user.notificationPrefs ?? {},
            createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          },
        });
        return toUser(created)!;
      } catch (err) {
        console.error("[user.repo:create] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().users.push(user);
    persist();
    return user;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    if (isProdDb()) {
      try {
        const updated = await prisma.user.update({
          where: { id },
          data: {
            ...updates,
            verifiedAt: updates.verifiedAt ? new Date(updates.verifiedAt) : undefined,
            createdAt: updates.createdAt ? new Date(updates.createdAt) : undefined,
          },
        });
        return toUser(updated);
      } catch (err) {
        console.error("[user.repo:update] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    const u = db().users.find((x) => x.id === id);
    if (!u) return null;
    Object.assign(u, updates);
    persist();
    return u;
  }

  async list(filters?: { role?: Role; status?: UserStatus; q?: string }): Promise<User[]> {
    if (isProdDb()) {
      try {
        const where: Record<string, unknown> = {};
        if (filters?.role) where.role = filters.role;
        if (filters?.status) where.status = filters.status;
        if (filters?.q) {
          where.OR = [
            { name: { contains: filters.q, mode: "insensitive" } },
            { handle: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
          ];
        }
        const users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" } });
        return users.map((u) => toUser(u)!) as User[];
      } catch (err) {
        console.error("[user.repo:list] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    let list = db().users;
    if (filters?.role) list = list.filter((u) => u.role === filters.role);
    if (filters?.status) list = list.filter((u) => u.status === filters.status);
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)),
      );
    }
    return list;
  }
}

export const userRepository = new UserRepository();
