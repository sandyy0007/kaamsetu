import { userFromRequest } from "@/server/auth";
import { getStorage, mimeForKey } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!userFromRequest(req)) return new Response("Unauthorized", { status: 401 });
  const { key } = await params;
  let data: Buffer | null = null;
  try {
    data = await getStorage().get(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeForKey(key),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Disposition": "inline",
    },
  });
}
