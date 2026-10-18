import { describe, it, expect, beforeEach } from "vitest";
import { GET as getFileRoute } from "@/app/api/files/[key]/route";
import { POST as uploadMainRoute } from "@/app/api/uploads/route";
import { resolveMediaUrl } from "@/lib/api";
import { signSession, SESSION_COOKIE } from "@/server/auth";
import { fresh } from "./helpers";

describe("Media Reliability & Range Streaming", () => {
  beforeEach(() => {
    fresh();
  });

  it("resolves relative media URLs accurately for Android Capacitor environments", () => {
    const originalWindow = global.window;
    try {
      // Mock Capacitor native environment (https://localhost)
      (global as unknown as { window: unknown }).window = {
        location: {
          origin: "https://localhost",
          href: "https://localhost/home",
        },
        Capacitor: { isNativePlatform: () => true },
      };

      const resolved = resolveMediaUrl("/api/files/abc1234567890abcdef12345");
      expect(resolved).toContain("https://kaamsetu-web.onrender.com/api/files/abc1234567890abcdef12345");

      // Full external URLs remain untouched
      expect(resolveMediaUrl("https://images.unsplash.com/photo-1")).toBe("https://images.unsplash.com/photo-1");
    } finally {
      global.window = originalWindow;
    }
  });

  it("supports HTTP 206 Range partial content requests for video streaming", async () => {
    // 1. Upload sample MP4 video buffer
    const videoData = new Uint8Array(2048);
    for (let i = 0; i < videoData.length; i++) videoData[i] = i % 256;
    // Set MP4 'ftyp' magic signature
    videoData[4] = 0x66;
    videoData[5] = 0x74;
    videoData[6] = 0x79;
    videoData[7] = 0x70;

    const formData = new FormData();
    const file = new File([videoData], "test_reel.mp4", { type: "video/mp4" });
    formData.append("file", file);

    const uploadReq = new Request("http://localhost:3000/api/uploads", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${signSession("u_ramesh")}`,
      },
      body: formData,
    });

    const uploadRes = await uploadMainRoute(uploadReq);
    expect(uploadRes.status).toBe(200);
    const body = await uploadRes.json();
    expect(body.url).toMatch(/^\/api\/files\//);
    const key = body.key;

    // 2. Fetch with Range header
    const rangeReq = new Request(`http://localhost:3000/api/files/${key}`, {
      headers: {
        range: "bytes=0-1023",
      },
    });

    const rangeRes = await getFileRoute(rangeReq, { params: Promise.resolve({ key }) });
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get("Accept-Ranges")).toBe("bytes");
    expect(rangeRes.headers.get("Content-Range")).toBe("bytes 0-1023/2048");
    expect(rangeRes.headers.get("Content-Length")).toBe("1024");
    expect(rangeRes.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("secures private verification documents against unauthenticated access", async () => {
    // 1. Upload private doc with user session
    const docData = new Uint8Array(512);
    // Set PNG magic signature
    docData[0] = 0x89;
    docData[1] = 0x50;
    docData[2] = 0x4e;
    docData[3] = 0x47;

    const formData = new FormData();
    const file = new File([docData], "private_land_record.png", { type: "image/png" });
    formData.append("file", file);
    formData.append("isPrivateDoc", "true");

    const uploadReq = new Request("http://localhost:3000/api/uploads", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${signSession("u_ramesh")}`,
      },
      body: formData,
    });

    const uploadRes = await uploadMainRoute(uploadReq);
    expect(uploadRes.status).toBe(200);
    const { key } = await uploadRes.json();
    expect(key.startsWith("doc_")).toBe(true);

    // 2. Unauthenticated request should be 401
    const unauthReq = new Request(`http://localhost:3000/api/files/${key}`);
    const unauthRes = await getFileRoute(unauthReq, { params: Promise.resolve({ key }) });
    expect(unauthRes.status).toBe(401);

    // 3. Unauthorized other user should be 403
    const otherReq = new Request(`http://localhost:3000/api/files/${key}`, {
      headers: {
        cookie: `${SESSION_COOKIE}=${signSession("u_b_marudhara")}`,
      },
    });
    const otherRes = await getFileRoute(otherReq, { params: Promise.resolve({ key }) });
    expect(otherRes.status).toBe(403);

    // 4. Owner should be allowed 200
    const ownerReq = new Request(`http://localhost:3000/api/files/${key}`, {
      headers: {
        cookie: `${SESSION_COOKIE}=${signSession("u_ramesh")}`,
      },
    });
    const ownerRes = await getFileRoute(ownerReq, { params: Promise.resolve({ key }) });
    expect(ownerRes.status).toBe(200);
  });
});

