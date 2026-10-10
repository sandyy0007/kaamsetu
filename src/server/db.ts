/**
 * Data access singleton.
 *
 * Demo build: an in-memory store seeded from src/server/seed (all rows isDemo: true),
 * optionally snapshotted to DEMO_STORE_FILE so runtime changes survive restarts.
 * Production build: replace `getDb()` consumers with Prisma repositories (schema in
 * prisma/schema.prisma mirrors these exact shapes). Services only touch `db()` collections,
 * so the swap is confined to this file + the repository layer.
 */
import fs from "node:fs";
import path from "node:path";
import type { Db } from "@/types/domain";
import { env } from "./env";
import { migrateToProfessional } from "./migrate";
import { buildDemoDb, emptyDb } from "./seed";
import { loadDbFromPostgres, syncDbToPostgres } from "./postgres-sync";

export { newId } from "./crypto";

const g = globalThis as unknown as {
  __ksDb?: Db;
  __ksPersistTimer?: NodeJS.Timeout;
  __ksInitPromise?: Promise<Db>;
};

function load(): Db {
  const e = env();
  const file = e.DEMO_STORE_FILE ? path.resolve(process.cwd(), e.DEMO_STORE_FILE) : null;
  if (file && fs.existsSync(file)) {
    try {
      // A snapshot written by the pre-KaamSetu build has no professional collections — migrate it forward (additive only).
      const loaded = { ...emptyDb(), ...(JSON.parse(fs.readFileSync(file, "utf8")) as Db) };
      migrateToProfessional(loaded);
      return loaded;
    } catch {
      // Corrupt snapshot — fall through to a fresh seed.
    }
  }
  if (e.DEMO_MODE) return buildDemoDb();
  const fresh = emptyDb();
  migrateToProfessional(fresh); // reference catalog (professions, skills) is needed even with zero users
  return fresh;
}

/**
 * Asynchronously guarantees that PostgreSQL persistent state is loaded before serving requests.
 * In DEMO_MODE, loads synchronously from in-memory/JSON snapshot.
 */
export async function ensureDbLoaded(): Promise<Db> {
  if (g.__ksDb) return g.__ksDb;
  const e = env();
  if (e.DEMO_MODE) {
    g.__ksDb = load();
    return g.__ksDb;
  }
  g.__ksInitPromise ??= (async () => {
    try {
      const loaded = await loadDbFromPostgres();
      g.__ksDb = loaded;
      return loaded;
    } catch (err) {
      g.__ksInitPromise = undefined;
      throw err;
    }
  })();
  return g.__ksInitPromise;
}

export function db(): Db {
  g.__ksDb ??= load();
  return g.__ksDb;
}

/** Call after every mutation. Schedules debounced sync if not immediately flushed. */
export function persist() {
  const e = env();
  clearTimeout(g.__ksPersistTimer);
  g.__ksPersistTimer = setTimeout(() => {
    if (!e.DEMO_MODE) {
      syncDbToPostgres(db()).catch((err) => {
        console.error("[persist:postgres] Background sync failed:", err);
      });
      return;
    }
    if (!e.DEMO_STORE_FILE) return;
    try {
      const file = path.resolve(process.cwd(), e.DEMO_STORE_FILE!);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(db()));
    } catch {
      // Snapshot failure must never break a request.
    }
  }, 250);
}

/**
 * Guaranteed persistent write barrier.
 * Flushes all pending mutations directly to PostgreSQL in production (awaiting confirmed write)
 * or to the local snapshot file in demo mode.
 */
export async function flushPersistence(): Promise<void> {
  const e = env();
  clearTimeout(g.__ksPersistTimer);
  if (!e.DEMO_MODE) {
    await syncDbToPostgres(db());
    return;
  }
  if (!e.DEMO_STORE_FILE) return;
  try {
    const file = path.resolve(process.cwd(), e.DEMO_STORE_FILE!);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db()));
  } catch {
    // Snapshot failure
  }
}

/** Test helper: replace the store with a fresh seed. */
export function resetDb(next?: Db) {
  g.__ksDb = next ?? (env().DEMO_MODE ? buildDemoDb() : emptyDb());
  migrateToProfessional(g.__ksDb);
  return g.__ksDb;
}

/** Remove every demo row (isDemo === true) from every collection. */
export function purgeDemoData() {
  const d = db() as unknown as Record<string, unknown[]>;
  let removed = 0;
  for (const key of Object.keys(d)) {
    const rows = d[key] ?? [];
    const kept = rows.filter((r) => !(r as { isDemo?: boolean }).isDemo);
    removed += rows.length - kept.length;
    d[key] = kept;
  }
  persist();
  return removed;
}
