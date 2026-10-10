import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rupee = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const formatINR = (n: number) => `₹${rupee.format(Math.round(n))}`;
export const formatNumber = (n: number) => rupee.format(n);
export const formatCompact = (n: number) => compact.format(n);

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("en-IN", opts ?? { day: "numeric", month: "short", year: "numeric" });
}
export const formatShortDate = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(1, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso, { day: "numeric", month: "short" });
}

export function daysUntil(iso: string, now = Date.now()) {
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export const unitLabel = (u: "QUINTAL" | "KG" | "TONNE") => ({ QUINTAL: "Quintal", KG: "kg", TONNE: "Tonne" })[u];

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Strip HTML tags & control characters from user supplied text (defence in depth; React also escapes). */
export function sanitizeText(input: string) {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function extractHashtags(text: string) {
  const found = text.match(/#[\p{L}\p{M}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(found.map((t) => t.slice(1))));
}
