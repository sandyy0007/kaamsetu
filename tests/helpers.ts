import "@/server/api/controllers";
import { handleRequest } from "@/server/api/router";
import { SESSION_COOKIE, signSession } from "@/server/auth";
import { resetDb } from "@/server/db";

export function fresh() {
  return resetDb();
}

interface CallOpts {
  as?: string;
  body?: unknown;
  origin?: string;
}

export async function call<T = unknown>(method: string, path: string, opts: CallOpts = {}) {
  const url = new URL(`http://localhost:3000/api${path}`);
  const headers: Record<string, string> = { host: "localhost:3000", "content-type": "application/json" };
  if (opts.as) headers.cookie = `${SESSION_COOKIE}=${signSession(opts.as)}`;
  if (method !== "GET") headers.origin = opts.origin ?? "http://localhost:3000";
  const req = new Request(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const segments = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const res = await handleRequest(req, segments);
  const json = res.status === 304 ? null : ((await res.json()) as { data?: T; error?: { code: string; message: string; fields?: Record<string, string> } });
  return { status: res.status, data: json?.data as T, error: json?.error, headers: res.headers };
}
