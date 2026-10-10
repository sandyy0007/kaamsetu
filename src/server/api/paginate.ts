import type { Page } from "@/types/dto";
import type { Ctx } from "./router";

/** Offset-cursor pagination shared by the Phase-2 controllers (same response shape as the Phase-1 ones). */
export function paginate<T>(items: T[], c: Ctx, defaultLimit = 12): Page<T> {
  const start = Math.max(0, Number(c.query.get("cursor") ?? 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(c.query.get("limit") ?? defaultLimit) || defaultLimit));
  return { items: items.slice(start, start + limit), nextCursor: start + limit < items.length ? String(start + limit) : null, total: items.length };
}
