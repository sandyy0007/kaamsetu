import { describe, it, expect, beforeEach } from "vitest";
import { call, fresh } from "./helpers";
import { isPrivateOrReservedIp, isPublicEmailDomain } from "@/server/services/verification";
import type { AdminVerificationRow, VerificationStatusDTO, Me } from "@/types/dto";

describe("Account Authenticity & Verification System", () => {
  beforeEach(() => {
    fresh();
  });

  describe("SSRF & Security Validation", () => {
    it("identifies private, loopback, and cloud metadata IPs to prevent SSRF", () => {
      // Loopback
      expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("127.0.1.5")).toBe(true);
      // Private Class A, B, C
      expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
      expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
      // AWS / Cloud Metadata IP
      expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
      // Link local & multicast
      expect(isPrivateOrReservedIp("224.0.0.1")).toBe(true);
      // Public IPs
      expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
      expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
      expect(isPrivateOrReservedIp("142.250.190.46")).toBe(false);
    });

    it("rejects public consumer email domains for organizational challenges", () => {
      expect(isPublicEmailDomain("officer@gmail.com")).toBe(true);
      expect(isPublicEmailDomain("admin@yahoo.com")).toBe(true);
      expect(isPublicEmailDomain("test@hotmail.com")).toBe(true);
      expect(isPublicEmailDomain("director@kvkjaipur.gov.in")).toBe(false);
      expect(isPublicEmailDomain("contact@kisan-fpo.org")).toBe(false);
    });
  });

  describe("Interactive Email Verification Challenge Flow", () => {
    it("fails when attempting email challenge with consumer email domain", async () => {
      const res = await call("POST", "/me/verification/email/start", {
        as: "u_ramesh",
        body: { email: "farmer.ramesh@gmail.com" },
      });
      expect(res.status).toBe(400);
      expect(res.error?.message).toContain("institutional");
    });

    it("issues challenge code and verifies official organizational email", async () => {
      // 1. Start challenge
      const startRes = await call<{ challengeToken: string; maskedEmail: string }>(
        "POST",
        "/me/verification/email/start",
        {
          as: "u_hanuman",
          body: { email: "director@churu-fpo.org" },
        }
      );
      expect(startRes.status).toBe(200);
      expect(startRes.data.challengeToken).toBeDefined();
      const code = startRes.data.challengeToken;

      // 2. Reject incorrect code
      const failRes = await call("POST", "/me/verification/email/verify", {
        as: "u_hanuman",
        body: { token: "000000" },
      });
      expect(failRes.status).toBe(400);

      // 3. Accept valid code
      const successRes = await call<{ ok: boolean; success: boolean }>(
        "POST",
        "/me/verification/email/verify",
        {
          as: "u_hanuman",
          body: { token: code },
        }
      );
      expect(successRes.status).toBe(200);
      expect(successRes.data.success).toBe(true);
    });
  });

  describe("End-to-End Verification Lifecycle & Admin Review", () => {
    it("submits request, reviews by admin with audit trail, and grants badge", async () => {
      // 1. Farmer Hanuman submits verification request
      const submitRes = await call<{ ok: boolean }>("POST", "/me/verification", {
        as: "u_hanuman",
        body: {
          category: "ORGANIZATION",
          legalName: "Churu Krishi Sahakari Samiti",
          website: "https://churu-fpo.org",
          orgEmail: "director@churu-fpo.org",
          note: "Registered agricultural cooperative serving 400+ farmers across Churu district.",
          documentLabels: ["FPO Registration Certificate", "Audit Report 2024"],
        },
      });
      expect(submitRes.status).toBe(200);

      // Check user verification status
      const statusRes = await call<VerificationStatusDTO>("GET", "/me/verification", {
        as: "u_hanuman",
      });
      expect(statusRes.status).toBe(200);
      expect(statusRes.data.verified).toBe(false);
      expect(statusRes.data.request?.status).toBe("PENDING");
      const reqId = statusRes.data.request!.id;

      // 2. Admin retrieves verification requests
      const adminList = await call<AdminVerificationRow[]>("GET", "/admin/verifications", {
        as: "u_admin",
      });
      expect(adminList.status).toBe(200);
      const row = adminList.data.find((r) => r.id === reqId);
      expect(row).toBeDefined();
      expect(row?.legalName).toBe("Churu Krishi Sahakari Samiti");

      // 3. Admin cannot review their own request (self-approval prevention)
      const reviewRes = await call<{ ok: boolean }>(
        "POST",
        `/admin/verifications/${reqId}/review`,
        {
          as: "u_admin",
          body: {
            decision: "APPROVED",
            badgeType: "ORGANIZATION",
            note: "Verified via official cooperative registry documents.",
            expiryDays: 365,
          },
        }
      );
      expect(reviewRes.status).toBe(200);

      // 4. Verify that User Hanuman now has active verification badge
      const meRes = await call<Me>("GET", "/auth/me", { as: "u_hanuman" });
      expect(meRes.status).toBe(200);
      expect(meRes.data.verified).toBe(true);
      expect(meRes.data.verificationBadge?.type).toBe("ORGANIZATION");
      expect(meRes.data.verificationBadge?.label).toContain("Organization");
    });
  });
});

