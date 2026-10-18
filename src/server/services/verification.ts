import dns from "node:dns/promises";
import { randomBytes, randomInt } from "node:crypto";
import type { Db, User } from "@/types/domain";
import type { VerificationBadgeDTO } from "@/types/dto";
import { hmac, newId, safeEqual } from "../crypto";
import { sessionSecret } from "../env";
import { badRequest, notFound, tooMany } from "../errors";
import { persist } from "../db";

export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "zoho.com",
  "rediffmail.com",
  "yandex.com",
  "gmx.com",
  "aol.com",
]);

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function isPublicEmailDomain(email: string): boolean {
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return true;
  return PUBLIC_EMAIL_DOMAINS.has(parts[1]!);
}

/**
 * Validates and normalizes domain names, strictly blocking internal/private IP addresses and SSRF targets.
 */
export function sanitizeAndValidateDomain(domainInput: string): string {
  let domain = domainInput.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  domain = domain.replace(/:\d+$/, ""); // Strip port

  // FQDN validation: letters, digits, hyphens, dots
  const fqdnRegex = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(?<!-)(\.[a-z0-9-]+(?<!-))+$/;
  if (!fqdnRegex.test(domain)) {
    throw badRequest("Invalid domain name format. Provide a standard fully-qualified domain name (e.g. rajasthan.gov.in).");
  }

  // Block localhost and standard loopback names
  if (domain === "localhost" || domain.endsWith(".localhost") || domain.endsWith(".local") || domain.endsWith(".internal")) {
    throw badRequest("Internal, local, or private domains cannot be verified.");
  }

  // Block IP address literals
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(domain)) {
    throw badRequest("IP address literals cannot be used as verification domains.");
  }

  return domain;
}

/**
 * Check whether an IP string is private/loopback/link-local/metadata
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (ip === "::1" || ip === "0.0.0.0" || ip.startsWith("0.")) return true;
  // All 127.0.0.0/8 loopback
  if (ip.startsWith("127.")) return true;
  // Link-local / AWS / GCP metadata
  if (ip.startsWith("169.254.")) return true;
  // RFC 1918 private IPv4
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const octet = parseInt(match172[1]!, 10);
    if (octet >= 16 && octet <= 31) return true;
  }
  // Multicast & Reserved (224.0.0.0 - 255.255.255.255)
  const firstOctet = parseInt(ip.split(".")[0]!, 10);
  if (!Number.isNaN(firstOctet) && firstOctet >= 224) return true;

  // IPv6 unique local or link-local
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  return false;
}

/**
 * Perform a secure SSRF-safe DNS resolution check.
 */
async function resolveAndCheckSafeIp(domain: string): Promise<string[]> {
  try {
    const addresses = await dns.resolve4(domain);
    if (!addresses || addresses.length === 0) {
      throw badRequest(`Domain ${domain} does not resolve to an active IPv4 address.`);
    }
    for (const ip of addresses) {
      if (isPrivateOrReservedIp(ip)) {
        throw badRequest(`Security violation: ${domain} resolves to private IP (${ip}). SSRF verification prohibited.`);
      }
    }
    return addresses;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Security violation")) throw err;
    throw badRequest(`Could not resolve DNS for domain ${domain}. Check domain name and try again.`);
  }
}

// In-memory challenge rate limiting
const challengeRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 5, windowMs = 10 * 60_000) {
  const now = Date.now();
  const entry = challengeRateLimits.get(key);
  if (!entry || entry.resetAt < now) {
    challengeRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (entry.count >= limit) {
    throw tooMany(`Too many verification attempts. Please wait ${Math.ceil((entry.resetAt - now) / 60000)} minutes.`);
  }
  entry.count++;
}

/**
 * Generate a single-use token challenge for email verification.
 */
export function createEmailChallenge(d: Db, userId: string, orgEmail: string): { challengeToken: string; maskedEmail: string } {
  const email = orgEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("Invalid email address.");
  }

  // Reject public providers for institutional verification
  if (isPublicEmailDomain(email)) {
    throw badRequest("Public email addresses (like Gmail, Yahoo, Outlook) cannot be used as proof of institutional identity. Please use an official organizational domain email.");
  }

  let req = d.verificationRequests.find((r) => r.userId === userId && (r.status === "PENDING" || r.status === "NEEDS_MORE_INFORMATION"));
  if (!req) {
    const user = d.users.find((u) => u.id === userId);
    if (!user) throw notFound("User");
    req = {
      id: newId("vr"),
      userId,
      kind: "ORGANIZATION",
      note: "Organization verification initiated via official email.",
      documentLabels: [],
      status: "PENDING",
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.verificationRequests.push(req);
  }

  checkRateLimit(`email_req:${userId}`, 3, 10 * 60_000);

  const rawToken = randomInt(100000, 999999).toString();
  const tokenHash = hmac(sessionSecret(), rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

  if (!req.challenges) req.challenges = [];
  req.challenges = req.challenges.filter((c) => c.type !== "EMAIL");
  req.challenges.push({
    type: "EMAIL",
    target: email,
    tokenHash,
    status: "PENDING",
    expiresAt,
    attempts: 0,
  });
  req.orgEmail = email;
  req.updatedAt = new Date().toISOString();

  persist();

  // In production, dispatch via SMTP/SendGrid. For testing/local, deliver challenge token.
  return { challengeToken: rawToken, maskedEmail: maskEmail(email) };
}

/**
 * Verify a single-use email token challenge.
 */
export function verifyEmailChallenge(d: Db, userId: string, token: string): { success: boolean; maskedEmail: string } {
  const req = d.verificationRequests.find((r) => r.userId === userId && (r.status === "PENDING" || r.status === "NEEDS_MORE_INFORMATION"));
  if (!req || !req.challenges) {
    throw badRequest("No pending verification challenge found.");
  }

  const challenge = req.challenges.find((c) => c.type === "EMAIL" && c.status === "PENDING");
  if (!challenge) {
    throw badRequest("No active email challenge pending. Request a new verification code.");
  }

  if (Date.parse(challenge.expiresAt) < Date.now()) {
    challenge.status = "EXPIRED";
    persist();
    throw badRequest("Verification token has expired. Please request a new code.");
  }

  challenge.attempts++;
  if (challenge.attempts > 5) {
    challenge.status = "FAILED";
    persist();
    throw badRequest("Too many incorrect attempts. Challenge invalidated. Please request a new code.");
  }

  const expectedHash = challenge.tokenHash;
  const providedHash = hmac(sessionSecret(), token.trim());

  if (!safeEqual(expectedHash, providedHash)) {
    throw badRequest("Invalid verification code. Please check and try again.");
  }

  challenge.status = "VERIFIED";
  challenge.verifiedAt = new Date().toISOString();

  if (!req.auditTrail) req.auditTrail = [];
  req.auditTrail.push({
    id: newId("audit"),
    action: "EMAIL_CHALLENGE",
    actorId: userId,
    note: `Email ownership confirmed for ${maskEmail(challenge.target)}`,
    timestamp: new Date().toISOString(),
  });

  req.updatedAt = new Date().toISOString();
  persist();

  return { success: true, maskedEmail: maskEmail(challenge.target) };
}

/**
 * Create a domain ownership challenge.
 */
export function createDomainChallenge(d: Db, userId: string, websiteInput: string): { domain: string; challengeToken: string; txtRecordName: string; wellKnownPath: string } {
  const domain = sanitizeAndValidateDomain(websiteInput);

  const req = d.verificationRequests.find((r) => r.userId === userId && (r.status === "PENDING" || r.status === "NEEDS_MORE_INFORMATION"));
  if (!req) {
    throw badRequest("No active verification request found.");
  }

  checkRateLimit(`domain_req:${userId}`, 5, 10 * 60_000);

  const rawToken = randomBytes(16).toString("hex");
  const tokenHash = hmac(sessionSecret(), rawToken);
  const expiresAt = new Date(Date.now() + 48 * 3600_000).toISOString(); // 48 hours

  if (!req.challenges) req.challenges = [];
  req.challenges = req.challenges.filter((c) => c.type !== "DOMAIN");
  req.challenges.push({
    type: "DOMAIN",
    target: domain,
    tokenHash,
    status: "PENDING",
    expiresAt,
    attempts: 0,
  });
  req.website = `https://${domain}`;
  req.updatedAt = new Date().toISOString();

  persist();

  return {
    domain,
    challengeToken: `kaamsetu-verification=${rawToken}`,
    txtRecordName: `_kaamsetu-challenge.${domain}`,
    wellKnownPath: `https://${domain}/.well-known/kaamsetu-verification.txt`,
  };
}

/**
 * Verify a domain control challenge using HTTPS well-known check or DNS TXT record.
 */
export async function verifyDomainChallenge(d: Db, userId: string): Promise<{ success: boolean; domain: string; method: "HTTPS" | "DNS" }> {
  const req = d.verificationRequests.find((r) => r.userId === userId && (r.status === "PENDING" || r.status === "NEEDS_MORE_INFORMATION"));
  if (!req || !req.challenges) {
    throw badRequest("No pending verification challenge found.");
  }

  const challenge = req.challenges.find((c) => c.type === "DOMAIN" && c.status === "PENDING");
  if (!challenge) {
    throw badRequest("No active domain challenge pending.");
  }

  const domain = challenge.target;

  // 1. SSRF check on domain resolution
  await resolveAndCheckSafeIp(domain);

  // 2. Try DNS TXT record first
  let verified = false;
  let method: "HTTPS" | "DNS" = "DNS";

  try {
    const txtRecords = await dns.resolveTxt(`_kaamsetu-challenge.${domain}`).catch(() => []);
    for (const record of txtRecords.flat()) {
      if (record.startsWith("kaamsetu-verification=")) {
        const token = record.replace("kaamsetu-verification=", "").trim();
        if (safeEqual(hmac(sessionSecret(), token), challenge.tokenHash)) {
          verified = true;
          method = "DNS";
          break;
        }
      }
    }
  } catch {
    // DNS TXT check failed, fall back to HTTPS
  }

  // 3. Fall back to HTTPS .well-known/kaamsetu-verification.txt
  if (!verified) {
    const wellKnownUrl = `https://${domain}/.well-known/kaamsetu-verification.txt`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(wellKnownUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "KaamSetu-Verification-Bot/1.0" },
        redirect: "error", // Prevent redirect SSRF
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = (await res.text()).slice(0, 10240); // Max 10 KB
        const lines = text.split("\n").map((l) => l.trim());
        for (const line of lines) {
          if (line.startsWith("kaamsetu-verification=")) {
            const token = line.replace("kaamsetu-verification=", "").trim();
            if (safeEqual(hmac(sessionSecret(), token), challenge.tokenHash)) {
              verified = true;
              method = "HTTPS";
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[verification:domain] HTTPS check error for", domain, e);
    }
  }

  if (!verified) {
    challenge.attempts++;
    persist();
    throw badRequest(`Domain verification failed for ${domain}. Ensure either the DNS TXT record at _kaamsetu-challenge.${domain} or HTTPS file at https://${domain}/.well-known/kaamsetu-verification.txt is present and matches your challenge token.`);
  }

  challenge.status = "VERIFIED";
  challenge.verifiedAt = new Date().toISOString();

  if (!req.auditTrail) req.auditTrail = [];
  req.auditTrail.push({
    id: newId("audit"),
    action: "DOMAIN_CHALLENGE",
    actorId: userId,
    note: `Domain control verified via ${method} for ${domain}`,
    timestamp: new Date().toISOString(),
  });

  req.updatedAt = new Date().toISOString();
  persist();

  return { success: true, domain, method };
}

/**
 * Returns the authoritative verification badge details for a given user.
 */
export function getVerificationBadge(u: User, d: Db): VerificationBadgeDTO | undefined {
  // If user is suspended or revoked, no active badge is displayed
  if (u.status !== "ACTIVE") return undefined;

  // Check expiration if present
  if (u.verificationExpiresAt && Date.parse(u.verificationExpiresAt) < Date.now()) {
    return undefined;
  }

  // Explicitly granted badge type takes precedence
  if (u.verificationBadgeType && u.verifiedAt) {
    const type = u.verificationBadgeType;
    const label =
      type === "ORGANIZATION"
        ? "Official Organization"
        : type === "GOVERNMENT"
        ? "Official Government"
        : type === "BUSINESS"
        ? "Business Verified"
        : type === "PROFESSIONAL"
        ? (u.role === "FARMER" ? "Verified Farmer" : "Verified Professional")
        : type === "EMAIL"
        ? "Email Verified"
        : (u.role === "FARMER" ? "Verified Farmer" : "Phone Verified");
    return {
      type,
      label,
      verifiedAt: u.verifiedAt,
      aboutText: `Official ${label} verification granted by KaamSetu administrators.`,
    };
  }

  // 1. Official Government badge
  if (u.role === "GOVERNMENT" && u.verifiedAt) {
    return {
      type: "GOVERNMENT",
      label: "Official Government",
      category: "Government Body / Department",
      verifiedAt: u.verifiedAt,
      aboutText: "Verified by KaamSetu Trust & Safety as an authorized representative of an official government body.",
    };
  }

  // 2. Official Organization / FPO badge
  if (u.role === "FPO" && u.verifiedAt) {
    return {
      type: "ORGANIZATION",
      label: "Official Organization",
      category: "Co-operative / FPO",
      verifiedAt: u.verifiedAt,
      aboutText: "Verified official Farmers Producer Organisation (FPO) or registered cooperative.",
    };
  }

  // 3. Business Verified
  if (u.role === "BUYER" && u.verifiedAt) {
    return {
      type: "BUSINESS",
      label: "Business Verified",
      category: "Commercial Buyer / Trader",
      verifiedAt: u.verifiedAt,
      aboutText: "Commercial buyer verified with confirmed business registration and domain credentials.",
    };
  }

  // 4. Verified Professional / Expert
  if ((u.role === "PROFESSIONAL" || u.role === "EXPERT") && u.verifiedAt) {
    const pp = d.professionalProfiles.find((p) => p.userId === u.id);
    const prof = pp && d.professions.find((x) => x.id === pp.professionId);
    const tradeName = prof ? (pp?.customProfession || prof.name) : "Professional";
    return {
      type: "PROFESSIONAL",
      label: `Verified ${tradeName}`,
      category: tradeName,
      verifiedAt: u.verifiedAt,
      aboutText: `Verified skilled professional with confirmed trade expertise and positive community track record.`,
    };
  }

  // 5. Farmer Verified
  if (u.role === "FARMER" && u.verifiedAt) {
    return {
      type: "PHONE",
      label: "Verified Farmer",
      verifiedAt: u.verifiedAt,
      aboutText: "Identity verified farmer registered on KaamSetu.",
    };
  }

  // 6. Explicit badge type overrides if assigned
  if (u.verificationBadgeType && u.verifiedAt) {
    return {
      type: u.verificationBadgeType,
      label: `${u.verificationBadgeType.charAt(0) + u.verificationBadgeType.slice(1).toLowerCase()} Verified`,
      verifiedAt: u.verifiedAt,
      aboutText: "Account authenticity confirmed by KaamSetu Trust & Safety.",
    };
  }

  return undefined;
}

