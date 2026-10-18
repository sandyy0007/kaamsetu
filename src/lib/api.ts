/** Thin typed fetch wrapper around the KaamSetu REST API. Supports cookie sessions and token authorization. */
import type { ApiError } from "@/types/dto";

declare global {
  interface Window {
    KAAMSETU_CONFIG?: {
      serverUrl?: string;
    };
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export const DEFAULT_PROD_API = "https://kaamsetu-web.onrender.com";
const TOKEN_STORAGE_KEY = "ks_session_token";

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage quota/permission issues
  }
}

export function isCapacitorApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.location.protocol === "capacitor:" ||
    (window.location.hostname === "localhost" && window.location.port === "")
  );
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // 1. Runtime config from app-config.js (or user override)
    const runtimeUrl = window.KAAMSETU_CONFIG?.serverUrl;
    if (runtimeUrl && runtimeUrl.trim()) {
      return runtimeUrl.trim().replace(/\/+$/, "");
    }
    // 2. Build-time environment variable
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/+$/, "");
    }
    // 3. Fallback for native Capacitor app
    if (isCapacitorApp()) {
      return DEFAULT_PROD_API;
    }
  }
  // 4. Default for browser: relative URL
  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/api/")) {
    return `${base}${cleanPath}`;
  }
  return `${base}/api${cleanPath}`;
}

/**
 * Resolves a media file path or URL into an accessible URL suitable
 * for rendering in both web browser and Android WebView (Capacitor) environments.
 * Relative paths (like `/api/files/...`) are transformed into fully-qualified
 * backend URLs when running inside Capacitor Android so they never 404 on localhost.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  return apiUrl(trimmed);
}

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
  const url = apiUrl(path);
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "include",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
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

  // If response contains an authentication token (Me DTO), save it for session persistence
  if (json?.data && typeof json.data === "object" && "token" in json.data && typeof (json.data as Record<string, unknown>).token === "string") {
    setStoredSessionToken((json.data as Record<string, unknown>).token as string);
  }
  if (path === "/auth/logout") {
    setStoredSessionToken(null);
  }

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
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(apiUrl("/api/uploads"), {
    method: "POST",
    body: fd,
    credentials: "include",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  const json = (await res.json().catch(() => null)) as { data?: { url: string; mime: string }; error?: ApiError } | null;
  if (!res.ok || !json?.data) throw new ApiClientError(res.status, json?.error ?? { code: "UPLOAD", message: "Upload failed. Try a smaller file." });
  return json.data;
}
