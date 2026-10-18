/**
 * Object-storage abstraction. `LocalDiskStorage` powers the demo; an S3/GCS/R2 implementation
 * of `StorageProvider` drops in without touching callers (set STORAGE_PROVIDER, see README).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "./env";
import { badRequest } from "./errors";

export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

export class LocalDiskStorage implements StorageProvider {
  private dir = path.resolve(process.cwd(), env().STORAGE_LOCAL_DIR);
  private file(key: string) {
    if (!/^[a-z0-9_-]{4,80}\.(jpg|png|webp|mp4|webm)$/i.test(key)) throw badRequest("Invalid file name.");
    return path.join(this.dir, key); // key is validated: no path separators possible
  }
  async put(key: string, data: Buffer) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(key), data);
  }
  async get(key: string) {
    try {
      return await fs.readFile(this.file(key));
    } catch {
      return null;
    }
  }
}

export class S3StorageProvider implements StorageProvider {
  private endpoint = env().S3_ENDPOINT || "https://s3.amazonaws.com";
  private bucket = env().S3_BUCKET;
  private accessKey = env().S3_ACCESS_KEY;
  private secretKey = env().S3_SECRET_KEY;

  constructor() {
    if (!this.bucket || !this.accessKey || !this.secretKey) {
      console.warn("[storage:s3] BLOCKED BY CREDENTIALS: S3_BUCKET, S3_ACCESS_KEY, or S3_SECRET_KEY not configured.");
    }
  }

  async put(key: string, data: Buffer): Promise<void> {
    if (!this.bucket || !this.accessKey || !this.secretKey) {
      throw new Error("S3 Storage is active but S3_BUCKET, S3_ACCESS_KEY, or S3_SECRET_KEY is missing (BLOCKED BY CREDENTIALS).");
    }
    const url = `${this.endpoint.replace(/\/+$/, "")}/${this.bucket}/${key}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": mimeForKey(key),
        "x-amz-acl": "public-read",
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new Error(`S3 upload failed with HTTP ${res.status}: ${await res.text()}`);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    if (!this.bucket) return null;
    const url = `${this.endpoint.replace(/\/+$/, "")}/${this.bucket}/${key}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch {
      return null;
    }
  }
}

let storage: StorageProvider | null = null;
export const getStorage = () => {
  if (storage) return storage;
  if (env().STORAGE_PROVIDER === "s3") {
    storage = new S3StorageProvider();
  } else {
    storage = new LocalDiskStorage();
  }
  return storage;
};

interface FileKind {
  ext: "jpg" | "png" | "webp" | "mp4" | "webm";
  mime: string;
  maxBytes: number;
  magic: (b: Buffer) => boolean;
}

const KINDS: FileKind[] = [
  { ext: "jpg", mime: "image/jpeg", maxBytes: 5 * 1024 * 1024, magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", maxBytes: 5 * 1024 * 1024, magic: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  { ext: "webp", mime: "image/webp", maxBytes: 5 * 1024 * 1024, magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { ext: "mp4", mime: "video/mp4", maxBytes: 25 * 1024 * 1024, magic: (b) => b.subarray(4, 8).toString() === "ftyp" },
  { ext: "webm", mime: "video/webm", maxBytes: 25 * 1024 * 1024, magic: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
];

export const mimeForKey = (key: string) => KINDS.find((k) => key.endsWith(`.${k.ext}`))?.mime ?? "application/octet-stream";

/** Validates by declared type AND magic bytes (never trusts the filename or Content-Type alone). */
export async function storeUpload(file: File, isPrivate = false, userId?: string): Promise<{ key: string; url: string; mime: string }> {
  const kind = KINDS.find((k) => k.mime === file.type);
  if (!kind) throw badRequest("Only JPG, PNG, WebP images or MP4/WebM videos are allowed.");
  if (file.size > kind.maxBytes) throw badRequest(`File is too large (max ${Math.round(kind.maxBytes / 1024 / 1024)} MB).`);
  const data = Buffer.from(await file.arrayBuffer());
  if (!kind.magic(data)) throw badRequest("This file does not look like a valid " + kind.ext.toUpperCase() + ".");
  const prefix = isPrivate ? (userId ? `doc_${userId}_` : "doc_") : "";
  const key = `${prefix}${randomBytes(12).toString("hex")}.${kind.ext}`;
  await getStorage().put(key, data);
  return { key, url: `/api/files/${key}`, mime: kind.mime };
}
