import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetDb } from "../src/server/db";
import { env, resetEnvCache } from "../src/server/env";
import { call, fresh } from "./helpers";
import { requireCap } from "../src/server/permissions";
import type { Me } from "../src/types/dto";

describe("Controlled Temporary Auth Testing Mode", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    fresh();
    resetEnvCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCache();
  });

  describe("Safeguards and Default State", () => {
    it("is strictly disabled by default when AUTH_TESTING_MODE is unset", () => {
      delete process.env.AUTH_TESTING_MODE;
      resetEnvCache();
      expect(env().AUTH_TESTING_MODE).toBe(false);
    });

    it("evaluates to false when explicitly set to 'false'", () => {
      process.env.AUTH_TESTING_MODE = "false";
      resetEnvCache();
      expect(env().AUTH_TESTING_MODE).toBe(false);
    });

    it("evaluates to true only when explicitly set to 'true'", () => {
      process.env.AUTH_TESTING_MODE = "true";
      resetEnvCache();
      expect(env().AUTH_TESTING_MODE).toBe(true);
    });

    it("does not leak devCode when testing mode is disabled", async () => {
      process.env.AUTH_TESTING_MODE = "false";
      process.env.OTP_DEV_MODE = "false";
      resetEnvCache();

      const res = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/register", {
        body: {
          role: "FARMER",
          name: "Strict Mode Farmer",
          phone: "9111111111",
          password: "password1234",
          district: "Jaipur",
        },
      });

      // With console provider, challenge is created but devCode is withheld in production/strict mode
      if (res.status === 200) {
        expect(res.data?.devCode).toBeUndefined();
      }
    });
  });

  describe("Registration Under Testing Mode", () => {
    it("allows registration without SMS delivery, returns devCode, and sets phoneVerified: false", async () => {
      process.env.AUTH_TESTING_MODE = "true";
      process.env.OTP_DEV_MODE = "false";
      resetEnvCache();

      // Step 1: Request registration
      const regRes = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/register", {
        body: {
          role: "FARMER",
          name: "Testing Farmer",
          phone: "9222222222",
          password: "testpassword123",
          district: "Churu",
        },
      });

      expect(regRes.status).toBe(200);
      expect(regRes.data?.challengeId).toBeDefined();
      expect(regRes.data?.devCode).toBeDefined();
      const code = regRes.data?.devCode!;

      // Step 2: Cannot verify with wrong or arbitrary code
      const wrongVerify = await call("POST", "/auth/otp/verify", {
        body: {
          challengeId: regRes.data?.challengeId,
          code: "000000",
        },
      });
      expect(wrongVerify.status).toBe(400);

      // Step 3: Verifies with the exact 6-digit challenge code
      const verifyRes = await call<Me>("POST", "/auth/otp/verify", {
        body: {
          challengeId: regRes.data?.challengeId,
          code,
        },
      });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.data?.name).toBe("Testing Farmer");
      expect(verifyRes.data?.phoneVerified).toBe(false);

      // Step 4: Verify /auth/me accurately reflects unverified phone status
      const meRes = await call<Me>("GET", "/auth/me", { as: verifyRes.data?.id });
      expect(meRes.status).toBe(200);
      expect(meRes.data?.phoneVerified).toBe(false);
    });

    it("requires password during registration in testing mode so user can sign in later", async () => {
      process.env.AUTH_TESTING_MODE = "true";
      process.env.OTP_DEV_MODE = "false";
      delete process.env.TEST_ACCOUNT_PHONES;
      resetEnvCache();

      const regRes = await call("POST", "/auth/register", {
        body: {
          role: "FARMER",
          name: "Passwordless User",
          phone: "9333333333",
          district: "Jaipur",
        },
      });

      expect(regRes.status).toBe(400);
      expect(regRes.error?.message).toContain("set a password");
    });
  });

  describe("Subsequent Login Requirements", () => {
    it("allows registered user to sign in using phone and password", async () => {
      process.env.AUTH_TESTING_MODE = "true";
      process.env.OTP_DEV_MODE = "false";
      resetEnvCache();

      // Register account
      const reg = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/register", {
        body: {
          role: "FARMER",
          name: "Login Test Farmer",
          phone: "9444444444",
          password: "securePassword123",
          district: "Sikar",
        },
      });
      await call("POST", "/auth/otp/verify", {
        body: { challengeId: reg.data!.challengeId, code: reg.data!.devCode! },
      });

      // Login using 10-digit phone and password
      const loginRes = await call<Me>("POST", "/auth/login", {
        body: {
          email: "9444444444",
          password: "securePassword123",
        },
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.data?.name).toBe("Login Test Farmer");
      expect(loginRes.data?.phoneVerified).toBe(false);

      // Wrong password fails
      const badLogin = await call("POST", "/auth/login", {
        body: {
          email: "9444444444",
          password: "incorrectPassword",
        },
      });
      expect(badLogin.status).toBe(401);
    });
  });

  describe("Prevention of Unauthorized Access to Existing Accounts", () => {
    it("never returns devCode for existing account OTP request unless explicitly in TEST_ACCOUNT_PHONES", async () => {
      process.env.AUTH_TESTING_MODE = "true";
      process.env.OTP_DEV_MODE = "false";
      delete process.env.TEST_ACCOUNT_PHONES;
      resetEnvCache();

      // Register an existing account
      const reg = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/register", {
        body: {
          role: "FARMER",
          name: "Existing Account Holder",
          phone: "9555555555",
          password: "mySecretPassword123",
          district: "Jaipur",
        },
      });
      await call("POST", "/auth/otp/verify", {
        body: { challengeId: reg.data!.challengeId, code: reg.data!.devCode! },
      });

      // Attacker tries to request OTP for this phone via /auth/otp/request
      const hijackAttempt = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/otp/request", {
        body: { phone: "9555555555" },
      });

      // The devCode MUST NOT be returned!
      expect(hijackAttempt.data?.devCode).toBeUndefined();

      // Attacker cannot register the same phone either
      const dupReg = await call("POST", "/auth/register", {
        body: {
          role: "BUYER",
          name: "Attacker Impersonator",
          phone: "9555555555",
          password: "attackerPassword",
        },
      });
      expect(dupReg.status).toBe(400);
      expect(dupReg.error?.message).toContain("already exists");
    });

    it("allows devCode only for phones explicitly approved in TEST_ACCOUNT_PHONES", async () => {
      process.env.AUTH_TESTING_MODE = "true";
      process.env.OTP_DEV_MODE = "false";
      process.env.TEST_ACCOUNT_PHONES = "+91 9666666666, 9777777777";
      resetEnvCache();

      // Request OTP for an approved test phone
      const approvedRes = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/otp/request", {
        body: { phone: "9666666666" },
      });
      expect(approvedRes.status).toBe(200);
      expect(approvedRes.data?.devCode).toBeDefined();

      // Request OTP for a non-approved phone
      const unapprovedRes = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/otp/request", {
        body: { phone: "9888888888" },
      });
      expect(unapprovedRes.data?.devCode).toBeUndefined();
    });
  });

  describe("Enforcement: Sensitive Features Blocked for Unverified Accounts", () => {
    it("blocks unverified accounts from sensitive commercial capabilities", async () => {
      process.env.AUTH_TESTING_MODE = "true";
      process.env.OTP_DEV_MODE = "false";
      resetEnvCache();

      // Register testing user (phoneVerified: false)
      const reg = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/register", {
        body: {
          role: "FARMER",
          name: "Restricted Testing Farmer",
          phone: "9999911111",
          password: "testPassword123",
          district: "Jaipur",
        },
      });
      const me = (await call<Me>("POST", "/auth/otp/verify", {
        body: { challengeId: reg.data!.challengeId, code: reg.data!.devCode! },
      })).data!;

      const userObj = {
        id: me.id,
        role: me.role,
        name: me.name,
        handle: me.handle,
        status: "ACTIVE" as const,
        language: "hinglish" as const,
        personalization: true,
        notificationPrefs: me.notificationPrefs,
        phoneVerified: false,
        createdAt: new Date().toISOString(),
        hue: 120,
        isDemo: false,
      };

      // Sensitive capabilities for FARMER must throw phone verification required
      expect(() => requireCap(userObj, "listing:create")).toThrow(/Phone verification is required/);
      expect(() => requireCap(userObj, "work:post")).toThrow(/Phone verification is required/);
      expect(() => requireCap(userObj, "machinery:list")).toThrow(/Phone verification is required/);
      expect(() => requireCap(userObj, "service:manage")).toThrow(/Phone verification is required/);

      // Sensitive capabilities for BUYER must also throw phone verification required
      const buyerObj = { ...userObj, role: "BUYER" as const };
      expect(() => requireCap(buyerObj, "requirement:create")).toThrow(/Phone verification is required/);

      // Non-sensitive features are permitted
      expect(() => requireCap(userObj, "portfolio:manage")).not.toThrow();
      expect(() => requireCap(userObj, "question:ask")).not.toThrow();
      expect(() => requireCap(userObj, "learning:take")).not.toThrow();
    });

    it("allows verified accounts to access all assigned capabilities", () => {
      const verifiedUser = {
        id: "u_verified",
        role: "FARMER" as const,
        name: "Verified Farmer",
        handle: "verified.farmer",
        status: "ACTIVE" as const,
        language: "hinglish" as const,
        personalization: true,
        notificationPrefs: {} as any,
        phoneVerified: true,
        createdAt: new Date().toISOString(),
        hue: 120,
        isDemo: false,
      };

      expect(() => requireCap(verifiedUser, "listing:create")).not.toThrow();
      expect(() => requireCap(verifiedUser, "work:post")).not.toThrow();
    });
  });
});
