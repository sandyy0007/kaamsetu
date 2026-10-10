/**
 * Tiny typed REST router: controllers register `route(...)` entries, `handleRequest` does the
 * cross-cutting work (auth, CSRF origin check, rate limit, validation errors, ETag, no stack traces).
 */
import { createHash } from "node:crypto";
import { ZodError, type ZodTypeAny, type z } from "zod";
import type { Db, User } from "@/types/domain";
import { userFromRequest } from "../auth";
import { db, ensureDbLoaded, flushPersistence } from "../db";
import { env } from "../env";
import { ApiException, badRequest, forbidden, notFound, tooMany, unauthorized } from "../errors";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface Ctx {
  user: User | null;
  d: Db;
  params: Record<string, string>;
  query: URLSearchParams;
  req: Request;
  /** Parse + validate the JSON body with a shared Zod schema. */
  body<S extends ZodTypeAny>(schema: S): Promise<z.output<S>>;
  setCookie(value: string): void;
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;
interface RouteOpts {
  auth?: "required" | "optional";
  bucket?: "default" | "auth";
}
interface RouteDef extends RouteOpts {
  method: Method;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: RouteDef[] = [];

export function route(method: Method, pattern: string, handler: Handler, opts: RouteOpts = {}) {
  const keys: string[] = [];
  const regex = new RegExp(
    "^" +
      pattern.replace(/:([a-zA-Z]+)/g, (_, k: string) => {
        keys.push(k);
        return "([^/]+)";
      }) +
      "/?$",
  );
  routes.push({ method, regex, keys, handler, auth: opts.auth ?? "required", bucket: opts.bucket ?? "default" });
}

// ───────────── rate limiting (token bucket per IP + bucket) ─────────────
const LIMITS = { default: { max: 240, windowMs: 60_000 }, auth: { max: 12, windowMs: 60_000 } } as const;
const hits = new Map<string, { count: number; reset: number }>();

export function resetRateLimits() {
  hits.clear();
}

function rateLimit(ip: string, bucket: keyof typeof LIMITS) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const lim = LIMITS[bucket];
  const cur = hits.get(key);
  if (!cur || cur.reset < now) {
    hits.set(key, { count: 1, reset: now + lim.windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return;
  }
  cur.count += 1;
  if (cur.count > lim.max) throw tooMany();
}

const MAX_BODY_BYTES = 256 * 1024;

function json(status: number, body: unknown, headers: Record<string, string> = {}, cookies: string[] = []) {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", ...headers });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(JSON.stringify(body), { status, headers: h });
}

export async function handleRequest(req: Request, pathSegments: string[]): Promise<Response> {
  const cookies: string[] = [];
  try {
    const method = req.method.toUpperCase() as Method;
    const path = "/" + pathSegments.join("/");
    const found = routes
      .filter((r) => r.method === method)
      .map((r) => ({ r, m: r.regex.exec(path) }))
      .find((x) => x.m);
    if (!found || !found.m) {
      if (routes.some((r) => r.regex.test(path))) throw new ApiException(405, "METHOD_NOT_ALLOWED", "This action is not supported.");
      throw notFound("Endpoint");
    }
    const { r, m } = found;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    rateLimit(ip, r.bucket ?? "default");

    const origin = req.headers.get("origin");
    const host = req.headers.get("host");

    if (method !== "GET" && origin && host) {
      try {
        const originUrl = new URL(origin);
        const isAllowedCapacitor =
          originUrl.protocol === "capacitor:" ||
          originUrl.hostname === "localhost" ||
          originUrl.hostname === "127.0.0.1";
        const appUrl = env().NEXT_PUBLIC_APP_URL;
        const isConfiguredAppUrl = appUrl ? new URL(appUrl).host === originUrl.host : false;
        if (originUrl.host !== host && !isAllowedCapacitor && !isConfiguredAppUrl) {
          throw forbidden("Cross-site request blocked.");
        }
      } catch (e) {
        if (e instanceof ApiException) throw e;
        throw forbidden("Invalid request origin.");
      }
    }

    const corsHeaders: Record<string, string> = origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        }
      : {};

    await ensureDbLoaded();

    const user = userFromRequest(req);
    if (r.auth === "required" && !user) throw unauthorized();

    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? "")));

    let rawBody: unknown;
    let bodyRead = false;
    const ctx: Ctx = {
      user,
      d: db(),
      params,
      query: new URL(req.url).searchParams,
      req,
      async body(schema) {
        if (!bodyRead) {
          bodyRead = true;
          const len = Number(req.headers.get("content-length") ?? 0);
          if (len > MAX_BODY_BYTES) throw badRequest("Request is too large.");
          const text = await req.text();
          if (text.length > MAX_BODY_BYTES) throw badRequest("Request is too large.");
          try {
            rawBody = text ? JSON.parse(text) : {};
          } catch {
            throw badRequest("Request body is not valid JSON.");
          }
        }
        return schema.parse(rawBody);
      },
      setCookie: (v) => cookies.push(v),
    };

    const data = await r.handler(ctx);

    if (method !== "GET") {
      await flushPersistence();
    }

    if (method === "GET") {
      const payload = JSON.stringify({ data });
      const etag = `W/"${createHash("sha1").update(payload).digest("base64url")}"`;
      const headers = { ETag: etag, "Cache-Control": "private, no-cache", ...corsHeaders };
      if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
      return new Response(payload, { status: 200, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
    }
    return json(200, { data }, { "Cache-Control": "no-store", ...corsHeaders }, cookies);
  } catch (err) {
    const origin = req.headers.get("origin");
    const errCors: Record<string, string> = origin
      ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }
      : {};
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
      return json(400, { error: { code: "VALIDATION", message: Object.values(fields)[0] ?? "Please check the form.", fields } }, errCors, cookies);
    }
    if (err instanceof ApiException) {
      return json(err.status, { error: { code: err.code, message: err.message, fields: err.fields } }, errCors, cookies);
    }
    // Never leak internals to the browser.
    console.error("[api] unhandled error", err);
    return json(500, { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } }, errCors, cookies);
  }
}
