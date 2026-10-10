import { beforeEach, describe, expect, it } from "vitest";
import type { Me, ProfessionalProfileDTO, ReputationDTO, ServiceRequestDTO, WorkOpportunityDTO } from "@/types/dto";
import { call, fresh } from "./helpers";

beforeEach(() => {
  fresh();
});

describe("Feature Completion: Auth & Lifecycle", () => {
  it("completes password reset workflow via OTP", async () => {
    // 1. Request reset for an existing user
    const req = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/password/reset-request", {
      body: { identifier: "ramesh.choudhary@demo.kisansetu.example" },
    });
    expect(req.status).toBe(200);
    expect(req.data.challengeId).toBeTruthy();
    expect(req.data.devCode).toBeTruthy();

    // 2. Request reset for non-existent user returns 404
    const notFoundReq = await call("POST", "/auth/password/reset-request", {
      body: { identifier: "nonexistent@demo.example" },
    });
    expect(notFoundReq.status).toBe(404);

    // 3. Confirm reset with wrong code fails
    const badCode = await call("POST", "/auth/password/reset-confirm", {
      body: { challengeId: req.data.challengeId, code: "000000", newPassword: "NewSecurePassword#123" },
    });
    expect(badCode.status).toBe(400);

    // 4. Confirm reset with valid code succeeds and signs user in
    const confirm = await call<Me>("POST", "/auth/password/reset-confirm", {
      body: { challengeId: req.data.challengeId, code: req.data.devCode, newPassword: "NewSecurePassword#123" },
    });
    expect(confirm.status).toBe(200);
    expect(confirm.data.id).toBe("u_ramesh");

    // 5. Old password no longer works
    const oldLogin = await call("POST", "/auth/login", {
      body: { email: "ramesh.choudhary@demo.kisansetu.example", password: "Demo@12345" },
    });
    expect(oldLogin.status).toBe(401);

    // 6. New password works
    const newLogin = await call<Me>("POST", "/auth/login", {
      body: { email: "ramesh.choudhary@demo.kisansetu.example", password: "NewSecurePassword#123" },
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.data.id).toBe("u_ramesh");
  });

  it("changes password for authenticated user", async () => {
    // Wrong current password
    const wrong = await call("POST", "/me/password", {
      as: "u_ramesh",
      body: { currentPassword: "WrongPassword#999", newPassword: "BrandNewPassword#456" },
    });
    expect(wrong.status).toBe(400);

    // Correct current password
    const ok = await call("POST", "/me/password", {
      as: "u_ramesh",
      body: { currentPassword: "Demo@12345", newPassword: "BrandNewPassword#456" },
    });
    expect(ok.status).toBe(200);

    // Verify login with updated password
    const login = await call<Me>("POST", "/auth/login", {
      body: { email: "ramesh.choudhary@demo.kisansetu.example", password: "BrandNewPassword#456" },
    });
    expect(login.status).toBe(200);
  });

  it("deactivates user account and terminates session", async () => {
    const res = await call("POST", "/me/deactivate", { as: "u_ramesh" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("Max-Age=0");

    // Suspended account cannot log in
    const login = await call("POST", "/auth/login", {
      body: { email: "ramesh.choudhary@demo.kisansetu.example", password: "Demo@12345" },
    });
    expect(login.status).toBe(401);
    expect(login.error?.message).toContain("suspended");
  });

  it("deletes user account, anonymizes profile, and terminates session", async () => {
    // Register a fresh test account
    const start = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/register", {
      body: { role: "FARMER", name: "User To Delete", phone: "9876500001", password: "Password#123" },
    });
    const verify = await call<Me>("POST", "/auth/otp/verify", {
      body: { challengeId: start.data.challengeId, code: start.data.devCode },
    });
    const newUserId = verify.data.id;

    // Delete account
    const del = await call("DELETE", "/me", { as: newUserId });
    expect(del.status).toBe(200);
    const cookie = del.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("Max-Age=0");

    // Profile lookup reflects deletion/suspension
    const profile = await call("GET", `/farmers/${newUserId}`, { as: "u_ramesh" });
    expect(profile.status).toBe(404);
  });
});

describe("Feature Completion: Service Requests, Completion & Reputation", () => {
  it("executes complete service request flow from request to confirmed completion and reputation update", async () => {
    const providerId = "u_p_anil"; // Anil Sharma, Electrician
    const requesterId = "u_ramesh"; // Ramesh Choudhary, Farmer

    // 1. Initial reputation of provider
    const initProfile = await call<ProfessionalProfileDTO>("GET", `/professionals/${providerId}`, { as: requesterId });
    expect(initProfile.status).toBe(200);
    const initialCompleted = initProfile.data?.reputation.completedJobs ?? 0;

    // 2. Ramesh creates a service request for Anil's service
    const service = initProfile.data?.services[0];
    expect(service).toBeDefined();

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const req = await call<ServiceRequestDTO>("POST", "/service-requests", {
      as: requesterId,
      body: {
        serviceId: service!.id,
        date: tomorrow,
        village: "Rajaldesar",
        district: "Churu",
        state: "Rajasthan",
        description: "Need solar pump wiring inspection and motor terminal repair.",
      },
    });
    expect(req.status).toBe(200);
    expect(req.data.status).toBe("PENDING");
    const requestId = req.data.id;

    // 3. Provider accepts the request
    const accept = await call<ServiceRequestDTO>(`PATCH`, `/service-requests/${requestId}`, {
      as: providerId,
      body: { action: "ACCEPT", message: "Accepted. I will visit tomorrow at 10 AM." },
    });
    expect(accept.status).toBe(200);
    expect(accept.data.status).toBe("ACCEPTED");
    expect(accept.data.conversationId).toBeTruthy();

    // 4. Provider marks the work as done
    const markDone = await call<ServiceRequestDTO>(`PATCH`, `/service-requests/${requestId}`, {
      as: providerId,
      body: { action: "MARK_DONE" },
    });
    expect(markDone.status).toBe(200);
    expect(markDone.data.status).toBe("AWAITING_CONFIRMATION");

    // 5. Customer confirms work is done
    const confirmDone = await call<ServiceRequestDTO>(`PATCH`, `/service-requests/${requestId}`, {
      as: requesterId,
      body: { action: "CONFIRM_DONE" },
    });
    expect(confirmDone.status).toBe(200);
    expect(confirmDone.data.status).toBe("COMPLETED");

    // 6. Verify provider's completedJobs in reputation increased by 1
    const updatedProfile = await call<ProfessionalProfileDTO>("GET", `/professionals/${providerId}`, { as: requesterId });
    expect(updatedProfile.data?.reputation.completedJobs).toBe(initialCompleted + 1);

    // 7. Requester can now leave a verified recommendation
    const rec = await call("POST", `/professionals/${providerId}/recommendations`, {
      as: requesterId,
      body: {
        relationship: "CUSTOMER",
        body: "Excellent solar pump wiring service, arrived right on time and very knowledgeable.",
        skill: "Solar Pump Wiring",
      },
    });
    expect(rec.status).toBe(200);
  });

  it("allows cancelling service requests before work is done", async () => {
    const providerId = "u_p_anil";
    const requesterId = "u_sunita";

    const profile = await call<ProfessionalProfileDTO>("GET", `/professionals/${providerId}`, { as: requesterId });
    const service = profile.data?.services[0];
    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const req = await call<ServiceRequestDTO>("POST", "/service-requests", {
      as: requesterId,
      body: {
        serviceId: service!.id,
        date: nextWeek,
        district: "Hanumangarh",
        description: "Need wiring check for tube well motor.",
      },
    });
    expect(req.status).toBe(200);
    const requestId = req.data.id;

    // Customer cancels
    const cancel = await call<ServiceRequestDTO>(`PATCH`, `/service-requests/${requestId}`, {
      as: requesterId,
      body: { action: "CANCEL" },
    });
    expect(cancel.status).toBe(200);
    expect(cancel.data.status).toBe("CANCELLED");
  });
});

describe("Feature Completion: Work Opportunities & Applications", () => {
  it("allows professionals to apply, withdraw, and employers to accept applications", async () => {
    // u_b_marudhara posts a work opportunity
    const opp = await call<WorkOpportunityDTO>("POST", "/work", {
      as: "u_b_marudhara",
      body: {
        title: "Cold Storage Electrical Maintenance Technician",
        description: "Requires experienced electrician for preventive maintenance of cold storage facility in Bikaner.",
        kind: "CONTRACT",
        professionIds: ["pr_electrician"],
        skills: ["Motor Rewinding", "Panel Wiring"],
        openings: 2,
        district: "Bikaner",
        payMin: 25000,
        payMax: 30000,
        payUnit: "MONTH",
      },
    });
    expect(opp.status).toBe(200);
    const oppId = opp.data.id;

    // u_p_anil (Electrician) applies
    const apply = await call<WorkOpportunityDTO>(`POST`, `/work/${oppId}/apply`, {
      as: "u_p_anil",
      body: { note: "10+ years electrical maintenance experience with industrial refrigeration units." },
    });
    expect(apply.status).toBe(200);

    // Anil withdraws application
    const withdraw = await call(`DELETE`, `/work/${oppId}/apply`, { as: "u_p_anil" });
    expect(withdraw.status).toBe(200);

    // Anil re-applies
    const reapply = await call<WorkOpportunityDTO>(`POST`, `/work/${oppId}/apply`, {
      as: "u_p_anil",
      body: { note: "Re-applying with updated availability." },
    });
    expect(reapply.status).toBe(200);

    // Poster lists applications
    const apps = await call<any[]>(`GET`, `/work/${oppId}/applications`, { as: "u_b_marudhara" });
    expect(apps.status).toBe(200);
    expect(apps.data.length).toBe(1);
    const appId = apps.data[0].id;

    // Poster accepts the application
    const acceptApp = await call(`PATCH`, `/work/applications/${appId}`, {
      as: "u_b_marudhara",
      body: { status: "ACCEPTED", message: "Welcome to the team! Let's connect." },
    });
    expect(acceptApp.status).toBe(200);
  });
});

