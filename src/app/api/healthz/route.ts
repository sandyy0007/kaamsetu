import { checkDatabaseConnection } from "@/server/prisma";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startTime = Date.now();

export async function GET() {
  const e = env();
  let dbStatus = "not_applicable";

  if (!e.DEMO_MODE) {
    const isDbConnected = await checkDatabaseConnection();
    dbStatus = isDbConnected ? "connected" : "disconnected";
  } else {
    dbStatus = "in_memory_demo";
  }

  const isHealthy = e.DEMO_MODE || dbStatus === "connected";

  return Response.json(
    {
      status: isHealthy ? "ok" : "degraded",
      service: "kaamsetu-api",
      version: "0.1.0",
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      mode: e.DEMO_MODE ? "demo" : "production",
      database: dbStatus,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

