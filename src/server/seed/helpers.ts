import { hashPassword } from "../crypto";
import type { Language, NotificationPrefs, NotificationType, PrivacySettings, Role, User } from "@/types/domain";

/** ISO timestamp relative to "now" so demo content always looks current. */
export const iso = (days: number, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();
/** A fixed calendar date (used for historical records). */
export const on = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 6, 30)).toISOString();

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  "GOVERNMENT",
  "EVENT",
  "ENQUIRY",
  "EXPERT",
  "COMMUNITY",
  "CROP",
  "LEARNING",
  "MARKET",
  "WEATHER",
  "FOLLOW",
  "COMMENT",
  "LIKE",
  "AI",
  "SERVICE",
  "WORK",
];

export function defaultNotificationPrefs(): NotificationPrefs {
  return Object.fromEntries(ALL_NOTIFICATION_TYPES.map((t) => [t, true])) as NotificationPrefs;
}

/** Privacy-first defaults: money is private, phone only for connections. */
export function defaultPrivacy(over: Partial<PrivacySettings> = {}): PrivacySettings {
  return {
    profile: "PUBLIC",
    income: "PRIVATE",
    financialRecords: "PRIVATE",
    phone: "CONNECTIONS",
    produce: "PUBLIC",
    farmPhotos: "PUBLIC",
    locationPrecision: "DISTRICT",
    ...over,
  };
}

let cachedDemoHash: string | null = null;
/** One hash reused for all demo accounts (password: Demo@12345). Demo only. */
export function demoPasswordHash() {
  cachedDemoHash ??= hashPassword("Demo@12345");
  return cachedDemoHash;
}

export function mkUser(
  id: string,
  role: Role,
  name: string,
  handle: string,
  phoneTail: string,
  hue: number,
  opts: { verified?: boolean; headline?: string; email?: string; createdDaysAgo?: number; language?: Language } = {},
): User {
  return {
    id,
    role,
    name,
    handle,
    phone: `+91 90000 ${phoneTail}`,
    email: opts.email ?? `${handle}@demo.kisansetu.example`,
    passwordHash: demoPasswordHash(),
    hue,
    headline: opts.headline,
    verifiedAt: opts.verified ? iso(-120) : undefined,
    verifiedBy: opts.verified ? "u_admin" : undefined,
    status: "ACTIVE",
    language: opts.language ?? "en",
    notificationPrefs: defaultNotificationPrefs(),
    personalization: true,
    createdAt: iso(-(opts.createdDaysAgo ?? 200)),
    isDemo: true,
  };
}
