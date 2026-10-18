import { userFromRequest } from "@/server/auth";
import { getStorage, mimeForKey } from "@/server/storage";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Authorization, Content-Type, Cache-Control",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function HEAD(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return handleMediaRequest(req, await params, true);
}

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return handleMediaRequest(req, await params, false);
}

async function handleMediaRequest(req: Request, { key }: { key: string }, isHead: boolean) {
  // 1. Sanitize key to prevent directory traversal
  if (!key || !/^[a-z0-9_-]{4,80}\.(jpg|png|webp|mp4|webm|pdf)$/i.test(key)) {
    return new Response("Invalid file identifier", { status: 400, headers: CORS_HEADERS });
  }

  // 2. Private document security:
  // If this is a private verification document, enforce strict authentication & ownership
  const isPrivateDoc = key.startsWith("doc_") || key.startsWith("private_");
  if (isPrivateDoc) {
    const user = userFromRequest(req);
    if (!user) {
      return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
    }
    // Only admins or the user who uploaded the document can view private verification files
    const isAdmin = user.role === "ADMIN";
    const ownsDoc =
      isAdmin ||
      key.startsWith(`doc_${user.id}_`) ||
      db().verificationRequests.some(
        (v) => v.userId === user.id && v.documentLabels.some((l) => l.includes(key))
      );
    if (!isAdmin && !ownsDoc) {
      return new Response("Forbidden", { status: 403, headers: CORS_HEADERS });
    }
  }

  // 3. Retrieve file from storage provider
  let data: Buffer | null = null;
  try {
    data = await getStorage().get(key);
  } catch (err) {
    console.error("[files:get] Storage error reading key:", key, err);
    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  }

  if (!data) {
    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  }

  const mime = mimeForKey(key);
  const total = data.length;
  const range = req.headers.get("range");

  // 4. Handle HTTP Range Requests (Essential for video streaming in Android WebView & mobile players)
  if (range && range.startsWith("bytes=")) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

    if (isNaN(start) || isNaN(end) || start >= total || end >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: {
          ...CORS_HEADERS,
          "Content-Range": `bytes */${total}`,
        },
      });
    }

    const chunk = data.subarray(start, end + 1);
    const headers = {
      ...CORS_HEADERS,
      "Content-Type": mime,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunk.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPrivateDoc
        ? "private, no-cache, no-store, must-revalidate"
        : "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    };

    return new Response(isHead ? null : new Uint8Array(chunk), {
      status: 206,
      headers,
    });
  }

  // 5. Full file response
  const headers = {
    ...CORS_HEADERS,
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Content-Length": String(total),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": isPrivateDoc
      ? "private, no-cache, no-store, must-revalidate"
      : "public, max-age=31536000, immutable",
    "Content-Disposition": "inline",
  };

  return new Response(isHead ? null : new Uint8Array(data), {
    status: 200,
    headers,
  });
}
