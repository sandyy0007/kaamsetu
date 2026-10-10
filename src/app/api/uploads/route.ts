import { env } from "@/server/env";
import { userFromRequest } from "@/server/auth";
import { ApiException, badRequest, forbidden, unauthorized } from "@/server/errors";
import { storeUpload } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  const corsHeaders: Record<string, string> = origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }
    : {};

  try {
    const user = userFromRequest(req);
    if (!user) throw unauthorized();
    if (origin && host) {
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
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Choose a file to upload.");
    const stored = await storeUpload(file);
    return Response.json({ data: { url: stored.url, mime: stored.mime } }, { headers: corsHeaders });
  } catch (err) {
    if (err instanceof ApiException) {
      return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status, headers: corsHeaders });
    }
    console.error("[upload] failed", err);
    return Response.json({ error: { code: "INTERNAL", message: "Upload failed. Please try again." } }, { status: 500, headers: corsHeaders });
  }
}
