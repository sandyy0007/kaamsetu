import { z } from "zod";
import type { VerificationKind, VerificationStatus } from "@/types/domain";
import type { VerificationStatusDTO } from "@/types/dto";
import { newId } from "../../crypto";
import { sanitizeText } from "@/lib/utils";
import { persist } from "../../db";
import { badRequest } from "../../errors";
import { requireUser } from "../../permissions";
import {
  createDomainChallenge,
  createEmailChallenge,
  getVerificationBadge,
  verifyDomainChallenge,
  verifyEmailChallenge,
} from "../../services/verification";
import { route } from "../router";

const KIND_FOR_ROLE: Record<string, VerificationKind> = {
  FARMER: "FARMER",
  BUYER: "BUYER",
  EXPERT: "EXPERT",
  GOVERNMENT: "ORGANIZATION",
  FPO: "FPO",
  PROFESSIONAL: "PROFESSIONAL",
};

const verificationSubmissionSchema = z.object({
  category: z.enum(["PROFESSIONAL", "BUYER", "EXPERT", "BUSINESS", "ORGANIZATION", "GOVERNMENT"]).optional(),
  governmentCategory: z.enum(["CENTRAL_GOVERNMENT", "STATE_GOVERNMENT", "DEPARTMENT", "DISTRICT_ADMINISTRATION", "MUNICIPAL_LOCAL_BODY", "PUBLIC_INSTITUTION"]).optional(),
  legalName: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
  orgEmail: z.string().email().max(200).optional(),
  registrationNumber: z.string().max(100).optional(),
  note: z.string().min(5, "Please explain why you are requesting verification.").max(2000),
  documentLabels: z.array(z.string().max(100)).default([]),
});

// ───────────── Verification status & request ─────────────
route("GET", "/me/verification", (c): VerificationStatusDTO => {
  const u = requireUser(c.user);
  const req = c.d.verificationRequests
    .filter((r) => r.userId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const badge = getVerificationBadge(u, c.d);

  return {
    verified: !!badge,
    status: (req?.status as VerificationStatus) ?? (badge ? "APPROVED" : "UNVERIFIED"),
    badge,
    request: req && {
      id: req.id,
      kind: req.kind,
      category: req.category,
      governmentCategory: req.governmentCategory,
      legalName: req.legalName,
      website: req.website,
      orgEmail: req.orgEmail,
      registrationNumber: req.registrationNumber,
      status: req.status as VerificationStatus,
      note: req.note,
      reviewNote: req.reviewNote,
      challenges: req.challenges?.map((ch) => ({
        type: ch.type,
        target: ch.target,
        status: ch.status,
        expiresAt: ch.expiresAt,
      })),
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    },
  };
});

route("POST", "/me/verification", async (c) => {
  const u = requireUser(c.user);
  if (u.role === "ADMIN") throw badRequest("Admins do not need verification.");
  if (u.verifiedAt) throw badRequest("You are already verified.");

  // Check for active pending request
  const existingPending = c.d.verificationRequests.find(
    (r) => r.userId === u.id && r.status === "PENDING"
  );
  if (existingPending) {
    throw badRequest("You already have a pending verification request.");
  }

  const input = await c.body(verificationSubmissionSchema);
  const kind = (input.category as VerificationKind) ?? KIND_FOR_ROLE[u.role] ?? "PROFESSIONAL";

  const existingNeedsMoreInfo = c.d.verificationRequests.find(
    (r) => r.userId === u.id && r.status === "NEEDS_MORE_INFORMATION"
  );

  if (existingNeedsMoreInfo) {
    // Update existing request
    existingNeedsMoreInfo.category = input.category;
    existingNeedsMoreInfo.governmentCategory = input.governmentCategory;
    existingNeedsMoreInfo.legalName = input.legalName ? sanitizeText(input.legalName) : undefined;
    existingNeedsMoreInfo.website = input.website ? sanitizeText(input.website) : undefined;
    existingNeedsMoreInfo.orgEmail = input.orgEmail ? input.orgEmail.trim().toLowerCase() : undefined;
    existingNeedsMoreInfo.registrationNumber = input.registrationNumber ? sanitizeText(input.registrationNumber) : undefined;
    existingNeedsMoreInfo.note = sanitizeText(input.note);
    existingNeedsMoreInfo.documentLabels = input.documentLabels.map(sanitizeText);
    existingNeedsMoreInfo.status = "PENDING";
    existingNeedsMoreInfo.updatedAt = new Date().toISOString();

    if (!existingNeedsMoreInfo.auditTrail) existingNeedsMoreInfo.auditTrail = [];
    existingNeedsMoreInfo.auditTrail.push({
      id: newId("audit"),
      action: "REQUESTED",
      actorId: u.id,
      note: "Updated verification request details submitted.",
      timestamp: new Date().toISOString(),
    });

    persist();
    return { ok: true, id: existingNeedsMoreInfo.id, status: existingNeedsMoreInfo.status };
  }

  // Create new request
  const newReq = {
    id: newId("vr"),
    userId: u.id,
    kind,
    category: input.category,
    governmentCategory: input.governmentCategory,
    legalName: input.legalName ? sanitizeText(input.legalName) : undefined,
    website: input.website ? sanitizeText(input.website) : undefined,
    orgEmail: input.orgEmail ? input.orgEmail.trim().toLowerCase() : undefined,
    registrationNumber: input.registrationNumber ? sanitizeText(input.registrationNumber) : undefined,
    note: sanitizeText(input.note),
    documentLabels: input.documentLabels.map(sanitizeText),
    status: "PENDING" as VerificationStatus,
    auditTrail: [
      {
        id: newId("audit"),
        action: "REQUESTED" as const,
        actorId: u.id,
        note: "Initial verification request submitted.",
        timestamp: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDemo: false,
  };

  c.d.verificationRequests.push(newReq);
  persist();

  return { ok: true, id: newReq.id, status: newReq.status };
});

// ───────────── Email Challenge ─────────────
route("POST", "/me/verification/email/start", async (c) => {
  const u = requireUser(c.user);
  const { email } = await c.body(z.object({ email: z.string().email() }));
  const result = createEmailChallenge(c.d, u.id, email);
  return { ok: true, ...result };
});

route("POST", "/me/verification/email/verify", async (c) => {
  const u = requireUser(c.user);
  const { token } = await c.body(z.object({ token: z.string().min(4).max(16) }));
  const result = verifyEmailChallenge(c.d, u.id, token);
  return { ok: true, ...result };
});

// ───────────── Domain Challenge ─────────────
route("POST", "/me/verification/domain/start", async (c) => {
  const u = requireUser(c.user);
  const { website } = await c.body(z.object({ website: z.string().min(3) }));
  const result = createDomainChallenge(c.d, u.id, website);
  return { ok: true, ...result };
});

route("POST", "/me/verification/domain/verify", async (c) => {
  const u = requireUser(c.user);
  const result = await verifyDomainChallenge(c.d, u.id);
  return { ok: true, ...result };
});

