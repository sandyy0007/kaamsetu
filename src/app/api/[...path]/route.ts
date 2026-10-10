import "@/server/api/controllers";
import { handleRequest } from "@/server/api/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ path: string[] }> };

const handler = async (req: Request, { params }: Params) => handleRequest(req, (await params).path);

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, If-None-Match",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
