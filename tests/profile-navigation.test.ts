import { describe, expect, it } from "vitest";
import { call, fresh } from "./helpers";
import type { ProfessionalProfileDTO, FarmerProfileDTO, BuyerProfileDTO, ExpertProfileDTO } from "@/types/dto";

describe("Profile Navigation & Data Isolation Tests", () => {
  it("TEST A: User A authenticated opens User B's profile; assert displayed name/ID belongs to User B", async () => {
    const db = fresh();
    const userA = db.users.find((u) => u.phone === "9800000000" || u.role === "PROFESSIONAL")!;
    const userB = db.users.find((u) => u.id !== userA.id && (u.role === "PROFESSIONAL" || u.role === "FARMER"))!;
    expect(userA).toBeDefined();
    expect(userB).toBeDefined();
    expect(userA.id).not.toBe(userB.id);

    // Call as User A requesting User B's profile
    const res = await call<ProfessionalProfileDTO>("GET", `/professionals/${userB.id}`, { as: userA.id });
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
    expect(res.data.user.id).toBe(userB.id);
    expect(res.data.user.name).toBe(userB.name);
    // Ensure it NEVER returns User A's data
    expect(res.data.user.id).not.toBe(userA.id);
    expect(res.data.viewer.isSelf).toBe(false);
  });

  it("TEST B: Authenticated User A opens own profile; assert correct profile loads", async () => {
    const db = fresh();
    const userA = db.users.find((u) => u.role === "PROFESSIONAL")!;

    // 1. Via /profile/me
    const meRes = await call<{ role: string; professional?: ProfessionalProfileDTO }>("GET", "/profile/me", { as: userA.id });
    expect(meRes.status).toBe(200);
    expect(meRes.data.role).toBe("PROFESSIONAL");
    expect(meRes.data.professional).toBeDefined();
    expect(meRes.data.professional?.user.id).toBe(userA.id);
    expect(meRes.data.professional?.viewer.isSelf).toBe(true);

    // 2. Via /professionals/:id with own ID
    const directRes = await call<ProfessionalProfileDTO>("GET", `/professionals/${userA.id}`, { as: userA.id });
    expect(directRes.status).toBe(200);
    expect(directRes.data.user.id).toBe(userA.id);
    expect(directRes.data.viewer.isSelf).toBe(true);

    // 3. Via /professionals/me alias
    const aliasRes = await call<ProfessionalProfileDTO>("GET", "/professionals/me", { as: userA.id });
    expect(aliasRes.status).toBe(200);
    expect(aliasRes.data.user.id).toBe(userA.id);
    expect(aliasRes.data.viewer.isSelf).toBe(true);
  });

  it("TEST C: Open User B, navigate to User C, return to User B; assert correct data on each navigation", async () => {
    const db = fresh();
    const users = db.users.filter((u) => u.role === "PROFESSIONAL" || u.role === "FARMER");
    expect(users.length).toBeGreaterThanOrEqual(3);
    const [userA, userB, userC] = users;

    // First visit User B
    const resB1 = await call<ProfessionalProfileDTO>("GET", `/professionals/${userB.id}`, { as: userA.id });
    expect(resB1.status).toBe(200);
    expect(resB1.data.user.id).toBe(userB.id);

    // Next visit User C
    const resC = await call<ProfessionalProfileDTO>("GET", `/professionals/${userC.id}`, { as: userA.id });
    expect(resC.status).toBe(200);
    expect(resC.data.user.id).toBe(userC.id);
    expect(resC.data.user.name).toBe(userC.name);

    // Return to User B
    const resB2 = await call<ProfessionalProfileDTO>("GET", `/professionals/${userB.id}`, { as: userA.id });
    expect(resB2.status).toBe(200);
    expect(resB2.data.user.id).toBe(userB.id);
    expect(resB2.data.user.name).toBe(userB.name);
  });

  it("TEST D: Open invalid profile ID; assert proper 404/400 not-found error state, not Home redirect", async () => {
    const db = fresh();
    const userA = db.users[0];

    // Non-existent ID -> 404
    const res404 = await call("GET", "/professionals/non_existent_user_99999", { as: userA.id });
    expect(res404.status).toBe(404);
    expect(res404.error?.code).toBe("NOT_FOUND");

    // Placeholder tokens like _default, index.html -> 400 badRequest
    const resDefault = await call("GET", "/professionals/_default", { as: userA.id });
    expect(resDefault.status).toBe(400);

    const resIndex = await call("GET", "/professionals/index.html", { as: userA.id });
    expect(resIndex.status).toBe(400);
  });

  it("TEST E: Register user whose ProfessionalProfile is missing; assert safe handling/recovery", async () => {
    const db = fresh();
    const baseUser = db.users[0];
    // Create an active user with role PROFESSIONAL but deliberately omit a ProfessionalProfile row
    const newUser = {
      ...baseUser,
      id: "u_fresh_pro_test",
      phone: "+919999888877",
      name: "Fresh Pro Test",
      role: "PROFESSIONAL" as const,
      status: "ACTIVE" as const,
      handle: "fresh.pro.test",
      isDemo: false,
    };
    db.users.push(newUser);

    // Assert no pre-existing professional profile row in DB
    expect(db.professionalProfiles.some((p) => p.userId === newUser.id)).toBe(false);

    // Fetching the profile should auto-provision a default profile record without crashing or 404ing
    const res = await call<ProfessionalProfileDTO>("GET", `/professionals/${newUser.id}`, { as: newUser.id });
    expect(res.status).toBe(200);
    expect(res.data.user.id).toBe(newUser.id);
    expect(res.data.user.name).toBe("Fresh Pro Test");
    expect(res.data.profession).toBeDefined();

    // Verify profile is now persisted in memory db
    expect(db.professionalProfiles.some((p) => p.userId === newUser.id)).toBe(true);
  });

  it("TEST F & G: Follow and unfollow User B as User A; assert persistence", async () => {
    const db = fresh();
    const userA = db.users.find((u) => u.role === "PROFESSIONAL")!;
    const userB = db.users.find((u) => u.id !== userA.id && u.role === "PROFESSIONAL")!;

    // Clean any initial follow
    db.follows = db.follows.filter((f) => !(f.followerId === userA.id && f.followingId === userB.id));

    // Initially isFollowing should be false
    const initRes = await call<ProfessionalProfileDTO>("GET", `/professionals/${userB.id}`, { as: userA.id });
    expect(initRes.status).toBe(200);
    expect(initRes.data.viewer.isFollowing).toBe(false);

    // Follow User B
    const followRes = await call("POST", `/follow/${userB.id}`, { as: userA.id });
    expect(followRes.status).toBe(200);

    // Check User B's profile: isFollowing should now be true
    const followedRes = await call<ProfessionalProfileDTO>("GET", `/professionals/${userB.id}`, { as: userA.id });
    expect(followedRes.status).toBe(200);
    expect(followedRes.data.viewer.isFollowing).toBe(true);

    // Unfollow User B
    const unfollowRes = await call("DELETE", `/follow/${userB.id}`, { as: userA.id });
    expect(unfollowRes.status).toBe(200);

    // Check User B's profile: isFollowing should be false again
    const unfollowedRes = await call<ProfessionalProfileDTO>("GET", `/professionals/${userB.id}`, { as: userA.id });
    expect(unfollowedRes.status).toBe(200);
    expect(unfollowedRes.data.viewer.isFollowing).toBe(false);
  });

  it("TEST H: Profiles with missing optional fields (photo, bio, skills) render safe fallbacks", async () => {
    const db = fresh();
    const baseUser = db.users[0];
    const minimalUser = {
      ...baseUser,
      id: "u_minimal_worker",
      phone: "+919999111222",
      name: "Minimal Worker",
      role: "PROFESSIONAL" as const,
      status: "ACTIVE" as const,
      handle: "minimal.worker",
      isDemo: false,
    };
    db.users.push(minimalUser);

    const baseProfile = db.professionalProfiles[0];
    const minimalProfile = {
      ...baseProfile,
      userId: minimalUser.id,
      professionId: "pr_electrician",
      secondaryProfessionIds: [],
      skills: [],
      languages: [],
      location: { ...baseProfile.location, state: "Rajasthan", district: "Jaipur" },
      availability: { ...baseProfile.availability, status: "AVAILABLE" as const, schedule: "FULL_TIME" as const, preferences: [] },
      privacy: { ...baseProfile.privacy, profile: "PUBLIC" as const, phone: "PRIVATE" as const, locationPrecision: "DISTRICT" as const },
      certifications: [],
      achievements: [],
      attributes: {},
      about: "",
      updatedAt: new Date().toISOString(),
    };
    db.professionalProfiles.push(minimalProfile);

    const res = await call<ProfessionalProfileDTO>("GET", `/professionals/${minimalUser.id}`);
    expect(res.status).toBe(200);
    expect(res.data.user.name).toBe("Minimal Worker");
    expect(res.data.skills).toEqual([]);
    expect(res.data.services).toEqual([]);
    expect(res.data.portfolio).toEqual([]);
    expect(res.data.about).toBe("");
  });

  it("TEST I: Public profile DTO does not leak sensitive information (password, OTP, tokens, private phone)", async () => {
    const db = fresh();
    const user = db.users.find((u) => u.role === "PROFESSIONAL")!;
    const profile = db.professionalProfiles.find((p) => p.userId === user.id)!;
    profile.privacy.phone = "PRIVATE";

    // Request as unauthenticated public viewer
    const res = await call<Record<string, unknown>>("GET", `/professionals/${user.id}`);
    expect(res.status).toBe(200);

    const serialized = JSON.stringify(res.data);

    // Verify secrets are never exposed in JSON
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("otp");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("sessionToken");

    // Phone should NOT be present when phone privacy is PRIVATE
    expect(res.data.phone).toBeUndefined();
  });

  it("TEST J: Expired session / unauthenticated access behavior", async () => {
    const db = fresh();
    const user = db.users.find((u) => u.role === "PROFESSIONAL")!;

    // 1. Public profile route should still succeed with viewer marked as not self and not following
    const resPublic = await call<ProfessionalProfileDTO>("GET", `/professionals/${user.id}`);
    expect(resPublic.status).toBe(200);
    expect(resPublic.data.viewer.isSelf).toBe(false);
    expect(resPublic.data.viewer.isFollowing).toBe(false);
    expect(resPublic.data.viewer.connection).toBe("NONE");

    // 2. /profile/me should return 401 unauthorized
    const resMe = await call("GET", "/profile/me");
    expect(resMe.status).toBe(401);
  });

  it("TEST K: Resolution by handle vs user ID works identically", async () => {
    const db = fresh();
    const user = db.users.find((u) => u.handle && u.role === "PROFESSIONAL");
    if (!user) return;

    // Fetch by ID
    const byId = await call<ProfessionalProfileDTO>("GET", `/professionals/${user.id}`);
    // Fetch by Handle
    const byHandle = await call<ProfessionalProfileDTO>("GET", `/professionals/${user.handle}`);

    expect(byId.status).toBe(200);
    expect(byHandle.status).toBe(200);
    expect(byId.data.user.id).toBe(user.id);
    expect(byHandle.data.user.id).toBe(user.id);
    expect(byId.data.user.name).toBe(byHandle.data.user.name);
  });

  it("TEST L: Organization, Buyer, and Farmer profile routes resolve by ID and handle", async () => {
    const db = fresh();
    const buyer = db.users.find((u) => u.role === "BUYER");
    const farmer = db.users.find((u) => u.role === "FARMER");
    const org = db.users.find((u) => u.role === "FPO" || u.role === "GOVERNMENT");

    if (buyer) {
      const res = await call<BuyerProfileDTO>("GET", `/buyers/${buyer.id}`);
      expect(res.status).toBe(200);
      expect(res.data.user.id).toBe(buyer.id);
    }

    if (farmer) {
      const res = await call<FarmerProfileDTO>("GET", `/farmers/${farmer.id}`);
      expect(res.status).toBe(200);
      expect(res.data.user.id).toBe(farmer.id);
    }

    if (org) {
      const res = await call("GET", `/orgs/${org.id}`);
      expect(res.status).toBe(200);
    }
  });

  it("TEST M: profileHref generates static export compatible URLs across all roles", async () => {
    const { profileHref } = await import("@/lib/links");
    expect(profileHref({ id: "u_worker_1", role: "PROFESSIONAL" })).toBe("/professionals?id=u_worker_1");
    expect(profileHref({ id: "u_farmer_1", role: "FARMER" })).toBe("/professionals?id=u_farmer_1");
    expect(profileHref({ id: "u_buyer_1", role: "BUYER" })).toBe("/buyers?id=u_buyer_1");
    expect(profileHref({ id: "u_expert_1", role: "EXPERT" })).toBe("/experts?id=u_expert_1");
    expect(profileHref({ id: "u_org_1", role: "FPO" })).toBe("/orgs?id=u_org_1");
    expect(profileHref({ id: "u_gov_1", role: "GOVERNMENT" })).toBe("/orgs?id=u_gov_1");
    expect(profileHref(null)).toBe("/professionals");
    expect(profileHref(undefined)).toBe("/professionals");
    expect(profileHref({ role: "PROFESSIONAL" })).toBe("/professionals");
  });
});
