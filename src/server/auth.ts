/**
 * Authentication: signed (HMAC) httpOnly session cookies, scrypt passwords, hashed OTP challenges.
 * No third-party auth dependency — the architecture is small enough to audit, and the
 * OTP delivery step (`deliverOtp`) is the single place to plug in an SMS / email gateway.
 */
import { randomInt } from "node:crypto";
import type { Db, OtpChallenge, Role, User } from "@/types/domain";
import { defaultNotificationPrefs, defaultPrivacy } from "./seed/helpers";
import { hashPassword, hmac, newId, safeEqual, verifyPassword } from "./crypto";
import { db, persist } from "./db";
import { RAJASTHAN_DISTRICTS } from "@/lib/geo";
import { ensureProfessionalProfile, findProfession } from "./migrate";
import { env, sessionSecret } from "./env";
import { badRequest, tooMany, unauthorized } from "./errors";
import { slugify } from "@/lib/utils";
import { getSmsProvider } from "./sms";

export const SESSION_COOKIE = "ks_session";
const SESSION_TTL_MS = 7 * 24 * 3_600_000;

// ───────────── sessions ─────────────
export function signSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
  return `${payload}.${hmac(sessionSecret(), payload)}`;
}

export function readSession(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(hmac(sessionSecret(), payload), sig)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; exp: number };
    return exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  const secure = env().NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}
export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function parseCookies(header: string | null): Record<string, string> {
  return Object.fromEntries(
    (header ?? "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((p) => p.length >= 2)
      .map(([k, ...v]) => [k!, v.join("=")]),
  );
}

export function userFromRequest(req: Request): User | null {
  const cookieToken = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = cookieToken || bearerToken || undefined;
  const uid = readSession(token);
  if (!uid) return null;
  const user = db().users.find((u) => u.id === uid);
  return user && user.status === "ACTIVE" ? user : null;
}

// ───────────── identifiers ─────────────
export const normalizePhone = (p: string) => {
  const digits = p.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};
const samePhone = (a?: string, b?: string) => !!a && !!b && normalizePhone(a) === normalizePhone(b);

export function findUserByIdentifier(d: Db, identifier: string) {
  const id = identifier.trim().toLowerCase();
  return d.users.find((u) => (u.email && u.email.toLowerCase() === id) || samePhone(u.phone, identifier));
}

function uniqueHandle(d: Db, name: string) {
  const base = slugify(name).replace(/-/g, ".") || "user";
  let handle = base;
  let i = 1;
  while (d.users.some((u) => u.handle === handle)) handle = `${base}.${++i}`;
  return handle;
}

// ───────────── OTP ─────────────
function otpHash(challengeId: string, code: string) {
  return hmac(sessionSecret(), `${challengeId}:${code}`);
}

/**
 * Single integration point for SMS / e-mail delivery.
 * Dev mode logs to the server console and returns the code to the caller.
 */
async function deliverOtp(identifier: string, code: string) {
  if (env().OTP_DEV_MODE) {
    console.info(`[otp] ${identifier} → ${code} (dev mode)`);
    return;
  }
  const provider = getSmsProvider();
  const delivered = await provider.sendOtp(identifier, code);
  if (!delivered) {
    throw new Error(`Failed to deliver OTP via SMS provider "${provider.name}". Check SMS configuration.`);
  }
}

export async function createOtpChallenge(identifier: string, pending?: OtpChallenge["pending"]) {
  const d = db();
  d.otpChallenges = d.otpChallenges.filter((c) => c.expiresAt > Date.now());
  const recent = d.otpChallenges.filter((c) => c.identifier === identifier);
  if (recent.length >= 5) throw tooMany("Too many codes requested. Try again in a few minutes.");
  const id = newId("otp");
  const code = String(randomInt(100000, 1000000));
  d.otpChallenges.push({
    id,
    identifier,
    codeHash: otpHash(id, code),
    expiresAt: Date.now() + env().OTP_TTL_SECONDS * 1000,
    attempts: 0,
    pending,
  });
  await deliverOtp(identifier, code);
  return { challengeId: id, devCode: env().OTP_DEV_MODE ? code : undefined };
}

export function consumeOtp(challengeId: string, code: string): User {
  const d = db();
  const challenge = d.otpChallenges.find((c) => c.id === challengeId);
  if (!challenge || challenge.expiresAt < Date.now()) throw badRequest("This code has expired. Please request a new one.");
  challenge.attempts += 1;
  if (challenge.attempts > 5) {
    d.otpChallenges = d.otpChallenges.filter((c) => c.id !== challengeId);
    throw tooMany("Too many wrong attempts. Please request a new code.");
  }
  if (!safeEqual(challenge.codeHash, otpHash(challenge.id, code))) throw badRequest("That code is not correct.");
  d.otpChallenges = d.otpChallenges.filter((c) => c.id !== challengeId);

  const existing = findUserByIdentifier(d, challenge.identifier);
  if (existing) {
    if (existing.status !== "ACTIVE") throw unauthorized("This account is suspended.");
    return existing;
  }
  if (!challenge.pending) throw badRequest("No account found. Please register first.");
  return createUser(challenge.pending);
}

// ───────────── users ─────────────
export function createUser(p: NonNullable<OtpChallenge["pending"]>): User {
  const d = db();
  const district = p.district ?? "";
  const user: User = {
    id: newId("u"),
    role: p.role,
    name: p.name,
    handle: uniqueHandle(d, p.name),
    email: p.email,
    phone: p.phone,
    passwordHash: p.passwordHash,
    hue: randomInt(0, 360),
    status: "ACTIVE",
    language: "hinglish",
    notificationPrefs: defaultNotificationPrefs(),
    personalization: true,
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  d.users.push(user);
  // Role-specific empty profile so every account has a profile record from day one.
  const stub = { userId: user.id, isDemo: false };
  if (p.role === "FARMER") {
    d.farmerProfiles.push({
      ...stub,
      village: "",
      district,
      state: "Rajasthan",
      farmingSince: new Date().getFullYear(),
      languages: ["Hindi"],
      specialization: "",
      methods: [],
      livestock: [],
      story: "",
      skills: [],
      certifications: [],
      achievements: [],
      portfolio: [],
      media: [],
      interests: [],
      fpoIds: [],
      privacy: defaultPrivacy(),
    });
  } else if (p.role === "BUYER") {
    d.buyerProfiles.push({ ...stub, businessName: p.name, industry: "", district, state: "Rajasthan", about: "", cropsPurchased: [], contactOptions: ["PLATFORM_MESSAGE"] });
  } else if (p.role === "EXPERT") {
    d.expertProfiles.push({ ...stub, category: "Agronomist", qualification: "", organization: "", specialization: [], experienceYears: 0, district, state: "Rajasthan", about: "", languages: ["Hindi"] });
  } else if (p.role === "GOVERNMENT") {
    d.organizations.push({ ...stub, id: newId("org"), name: p.name, department: "", website: "", state: "Rajasthan", about: "" });
  } else if (p.role === "FPO") {
    d.fpos.push({ ...stub, id: newId("fpo"), name: p.name, district, state: "Rajasthan", about: "", crops: [], foundedYear: new Date().getFullYear(), memberIds: [] });
  }
  ensureProfessionalProfile(d, user, { professionId: p.professionId, customProfession: p.customProfession, district: district || undefined });
  persist();
  return user;
}

export function registrationPayload(input: { role: Role; name: string; email?: string; phone?: string; password?: string; district?: string; professionId?: string; customProfession?: string }) {
  const d = db();
  // "Farmer" is a profession, but it maps to the FARMER account type that owns farms, crops and produce.
  let role: Role = input.role;
  if (role === "PROFESSIONAL") {
    if (input.professionId) {
      const prof = findProfession(d, input.professionId);
      if (!prof || prof.status !== "ACTIVE") throw badRequest("Please choose a profession from the list.");
      if (prof.farmModules) role = "FARMER";
    } else if (!input.customProfession) throw badRequest("Choose your profession.");
  }
  if (input.email && findUserByIdentifier(d, input.email)) throw badRequest("An account with this email already exists. Try signing in.");
  if (input.phone && findUserByIdentifier(d, input.phone)) throw badRequest("An account with this phone already exists. Try signing in.");
  return {
    role,
    name: input.name,
    email: input.email?.toLowerCase(),
    phone: input.phone ? normalizePhone(input.phone) : undefined,
    passwordHash: input.password ? hashPassword(input.password) : undefined,
    // Only a known district is kept (canonical spelling), so filters and the approximate map always match.
    district: Object.keys(RAJASTHAN_DISTRICTS).find((k) => k.toLowerCase() === input.district?.trim().toLowerCase()),
    professionId: role === "PROFESSIONAL" ? input.professionId : undefined,
    customProfession: role === "PROFESSIONAL" && !input.professionId ? input.customProfession : undefined,
  };
}

export function loginWithPassword(email: string, password: string): User {
  const user = findUserByIdentifier(db(), email);
  // Always run a verification to keep timing roughly uniform.
  const ok = verifyPassword(password, user?.passwordHash ?? "scrypt$00$00");
  if (!user || !ok) throw unauthorized("Email or password is incorrect.");
  if (user.status !== "ACTIVE") throw unauthorized("This account is suspended.");
  return user;
}
