/** Thin typed fetch wrapper around the KaamSetu REST API. Cookies carry the session (httpOnly). */
import type { ApiError } from "@/types/dto";

export class ApiClientError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, err: ApiError) {
    super(err.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = err.code;
    this.fields = err.fields;
  }
}

export async function api<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, { code: "NETWORK", message: "Could not reach the server. Check your connection and try again." });
  }
  let json: { data?: T; error?: ApiError } | null = null;
  try {
    json = (await res.json()) as { data?: T; error?: ApiError };
  } catch {
    json = null;
  }
  if (!res.ok) throw new ApiClientError(res.status, json?.error ?? { code: "ERROR", message: "Something went wrong. Please try again." });
  return json?.data as T;
}

export const apiGet = <T,>(path: string, signal?: AbortSignal) => api<T>("GET", path, undefined, signal);

/** Build "/path?a=1&b=2", skipping empty values. */
export function withQuery(path: string, params: Record<string, string | number | boolean | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Upload an image/video to the storage abstraction. Returns the public file URL. */
export async function uploadFile(file: File): Promise<{ url: string; mime: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "same-origin" });
  const json = (await res.json().catch(() => null)) as { data?: { url: string; mime: string }; error?: ApiError } | null;
  if (!res.ok || !json?.data) throw new ApiClientError(res.status, json?.error ?? { code: "UPLOAD", message: "Upload failed. Try a smaller file." });
  return json.data;
}
