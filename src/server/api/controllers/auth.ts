import { z } from "zod";
import type { Db, User, VerificationKind } from "@/types/domain";
import type { Me, VerificationStatusDTO } from "@/types/dto";
import { identitySchema, loginEmailSchema, loginPhoneSchema, notificationPrefsSchema, otpVerifySchema, privacySchema, professionalPrivacySchema, registerSchema, verificationRequestSchema, blockSchema, passwordResetRequestSchema, passwordResetConfirmSchema, changePasswordSchema } from "@/lib/schemas";
import { clearSessionCookie, consumeOtp, createOtpChallenge, findUserByIdentifier, loginWithPassword, normalizePhone, registrationPayload, sessionCookie, signSession } from "../../auth";
import { hashPassword, newId, verifyPassword } from "../../crypto";
import { persist } from "../../db";
import { env } from "../../env";
import { badRequest, forbidden, notFound } from "../../errors";
import { userSummary } from "../../mappers";
import { requireRole, requireUser } from "../../permissions";
import { sanitizeText } from "@/lib/utils";
import { route } from "../router";

export function buildMe(d: Db, u: User): Me {
  const myConvos = new Set(d.conversations.filter((c) => c.participantIds.includes(u.id)).map((c) => c.id));
  return {
    ...userSummary(d, u),
    email: u.email,
    phone: u.phone,
    phoneVerified: u.phoneVerified !== false,
    language: u.language,
    notificationPrefs: u.notificationPrefs,
    personalization: u.personalization,
    unreadNotifications: d.notifications.filter((n) => n.userId === u.id && !n.read).length,
    unreadMessages: d.messages.filter((m) => myConvos.has(m.conversationId) && m.senderId !== u.id && !m.readBy.includes(u.id)).length,
    profileId: d.organizations.find((o) => o.userId === u.id)?.id ?? d.fpos.find((f) => f.userId === u.id)?.id,
    demoMode: env().DEMO_MODE,
    token: signSession(u.id),
  };
}

const startSession = (ctx: Parameters<Parameters<typeof route>[2]>[0], user: User) => {
  ctx.setCookie(sessionCookie(signSession(user.id)));
  return buildMe(ctx.d, user);
};

route("GET", "/auth/me", (c) => (c.user ? buildMe(c.d, c.user) : null), { auth: "optional" });

route(
  "POST",
  "/auth/register",
  async (c) => {
    const input = await c.body(registerSchema);
    const payload = registrationPayload(input);
    const identifier = payload.phone ?? payload.email!;
    return createOtpChallenge(identifier, payload);
  },
  { auth: "optional", bucket: "auth" },
);

route(
  "POST",
  "/auth/otp/request",
  async (c) => {
    const { phone } = await c.body(loginPhoneSchema);
    return createOtpChallenge(normalizePhone(phone));
  },
  { auth: "optional", bucket: "auth" },
);

route(
  "POST",
  "/auth/otp/verify",
  async (c) => {
    const { challengeId, code } = await c.body(otpVerifySchema);
    const user = consumeOtp(challengeId, code);
    return startSession(c, user);
  },
  { auth: "optional", bucket: "auth" },
);

route(
  "POST",
  "/auth/login",
  async (c) => {
    const { email, password } = await c.body(loginEmailSchema);
    return startSession(c, loginWithPassword(email, password));
  },
  { auth: "optional", bucket: "auth" },
);

route(
  "POST",
  "/auth/password/reset-request",
  async (c) => {
    const { identifier } = await c.body(passwordResetRequestSchema);
    const user = findUserByIdentifier(c.d, identifier);
    if (!user) throw notFound("No account found with this identifier.");
    const target = user.phone ? normalizePhone(user.phone) : user.email!;
    return createOtpChallenge(target);
  },
  { auth: "optional", bucket: "auth" },
);

route(
  "POST",
  "/auth/password/reset-confirm",
  async (c) => {
    const { challengeId, code, newPassword } = await c.body(passwordResetConfirmSchema);
    const user = consumeOtp(challengeId, code);
    user.passwordHash = hashPassword(newPassword);
    persist();
    return startSession(c, user);
  },
  { auth: "optional", bucket: "auth" },
);

route("GET", "/auth/demo-accounts", (c) => {
  if (!env().DEMO_MODE) throw notFound("Endpoint");
  const roles = ["u_ramesh", "u_p_anil", "u_p_suresh", "u_p_kamla", "u_p_savitri", "u_sunita", "u_b_marudhara", "u_e_anita", "u_g_kvk", "u_f_shekhawati", "u_admin"];
  return roles.map((id) => c.d.users.find((u) => u.id === id)).filter((u): u is User => !!u).map((u) => userSummary(c.d, u));
}, { auth: "optional" });

route(
  "POST",
  "/auth/demo",
  async (c) => {
    if (!env().DEMO_MODE) throw forbidden("Demo sign-in is disabled.");
    const { userId } = await c.body(z.object({ userId: z.string() }));
    const user = c.d.users.find((u) => u.id === userId && u.isDemo);
    if (!user) throw notFound("Demo account");
    return startSession(c, user);
  },
  { auth: "optional", bucket: "auth" },
);

route("POST", "/auth/logout", (c) => {
  c.setCookie(clearSessionCookie());
  return { ok: true };
}, { auth: "optional" });

// ───────────── account settings ─────────────
route("PATCH", "/me", async (c) => {
  const u = requireUser(c.user);
  const input = await c.body(identitySchema);
  u.name = input.name;
  u.headline = input.headline;
  if (input.language) u.language = input.language;
  persist();
  return buildMe(c.d, u);
});

route("POST", "/me/password", async (c) => {
  const u = requireUser(c.user);
  const { currentPassword, newPassword } = await c.body(changePasswordSchema);
  if (u.passwordHash) {
    if (!currentPassword || !verifyPassword(currentPassword, u.passwordHash)) {
      throw badRequest("Current password is not correct.", { currentPassword: "Incorrect password" });
    }
  }
  u.passwordHash = hashPassword(newPassword);
  persist();
  return { ok: true };
});

route("POST", "/me/deactivate", (c) => {
  const u = requireUser(c.user);
  if (u.role === "ADMIN") throw badRequest("Admin accounts cannot be deactivated.");
  u.status = "SUSPENDED";
  persist();
  c.setCookie(clearSessionCookie());
  return { ok: true };
});

route("DELETE", "/me", (c) => {
  const u = requireUser(c.user);
  if (u.role === "ADMIN") throw badRequest("Admin accounts cannot be deleted.");
  u.status = "SUSPENDED";
  u.name = "Deleted User";
  u.email = undefined;
  u.phone = undefined;
  u.passwordHash = undefined;
  persist();
  c.setCookie(clearSessionCookie());
  return { ok: true };
});

route("GET", "/me/privacy", (c) => {
  const u = requireUser(c.user);
  return c.d.farmerProfiles.find((p) => p.userId === u.id)?.privacy ?? c.d.professionalProfiles.find((p) => p.userId === u.id)?.privacy ?? null;
});

route("PUT", "/me/privacy", async (c) => {
  const u = requireRole(c.user, "FARMER", "PROFESSIONAL", "EXPERT");
  const pro = c.d.professionalProfiles.find((x) => x.userId === u.id);
  if (u.role === "FARMER") {
    const input = await c.body(privacySchema);
    const p = c.d.farmerProfiles.find((x) => x.userId === u.id);
    if (!p) throw notFound("Profile");
    p.privacy = input;
    if (pro) pro.privacy = { ...input }; // one source of truth for what viewers may see
    persist();
    return p.privacy;
  }
  // Professionals have no farm finances — only profile, phone and location precision are configurable.
  const input = await c.body(professionalPrivacySchema);
  if (!pro) throw notFound("Profile");
  pro.privacy = { ...pro.privacy, ...input };
  persist();
  return pro.privacy;
});

route("PUT", "/me/notification-prefs", async (c) => {
  const u = requireUser(c.user);
  const input = await c.body(notificationPrefsSchema);
  for (const key of Object.keys(u.notificationPrefs) as (keyof typeof u.notificationPrefs)[]) {
    if (key.startsWith("_")) continue;
    if (typeof input[key] === "boolean") u.notificationPrefs[key] = input[key]!;
  }
  persist();
  return u.notificationPrefs;
});

route("PUT", "/me/personalization", async (c) => {
  const u = requireUser(c.user);
  const { enabled } = await c.body(z.object({ enabled: z.boolean() }));
  u.personalization = enabled;
  persist();
  return { enabled };
});

const KIND_FOR_ROLE: Record<string, VerificationKind> = { FARMER: "FARMER", BUYER: "BUYER", EXPERT: "EXPERT", GOVERNMENT: "ORGANIZATION", FPO: "FPO", PROFESSIONAL: "PROFESSIONAL" };

route("GET", "/me/verification", (c): VerificationStatusDTO => {
  const u = requireUser(c.user);
  const req = c.d.verificationRequests.filter((r) => r.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return { verified: !!u.verifiedAt, request: req && { id: req.id, kind: req.kind, status: req.status, note: req.note, reviewNote: req.reviewNote, createdAt: req.createdAt } };
});

route("POST", "/me/verification", async (c) => {
  const u = requireUser(c.user);
  const kind = KIND_FOR_ROLE[u.role];
  if (!kind) throw badRequest("Admins do not need verification.");
  if (u.verifiedAt) throw badRequest("You are already verified.");
  if (c.d.verificationRequests.some((r) => r.userId === u.id && r.status === "PENDING")) throw badRequest("You already have a pending verification request.");
  const input = await c.body(verificationRequestSchema);
  // Users can only REQUEST verification. Badge assignment happens in the admin review flow.
  c.d.verificationRequests.push({ id: newId("vr"), userId: u.id, kind, note: input.note, documentLabels: input.documentLabels.map(sanitizeText), status: "PENDING", createdAt: new Date().toISOString(), isDemo: false });
  persist();
  return { ok: true };
});

route("GET", "/me/blocks", (c) => {
  const u = requireUser(c.user);
  return c.d.blocks.filter((b) => b.userId === u.id).map((b) => ({ kind: b.kind, user: userSummary(c.d, c.d.users.find((x) => x.id === b.targetId)!) })).filter((b) => b.user);
});

route("POST", "/me/blocks", async (c) => {
  const u = requireUser(c.user);
  const { targetId, kind } = await c.body(blockSchema);
  if (targetId === u.id) throw badRequest("You cannot block yourself.");
  if (!c.d.users.some((x) => x.id === targetId)) throw notFound("User");
  c.d.blocks = c.d.blocks.filter((b) => !(b.userId === u.id && b.targetId === targetId));
  c.d.blocks.push({ userId: u.id, targetId, kind, isDemo: false });
  if (kind === "BLOCK") c.d.follows = c.d.follows.filter((f) => !((f.followerId === u.id && f.followingId === targetId) || (f.followerId === targetId && f.followingId === u.id)));
  persist();
  return { ok: true };
});

route("DELETE", "/me/blocks/:id", (c) => {
  const u = requireUser(c.user);
  c.d.blocks = c.d.blocks.filter((b) => !(b.userId === u.id && b.targetId === c.params.id));
  persist();
  return { ok: true };
});
