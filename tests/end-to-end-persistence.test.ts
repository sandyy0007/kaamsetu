import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { checkDatabaseConnection, prisma } from "../src/server/prisma";
import { emptyDb } from "../src/server/seed";
import { db, resetDb, flushPersistence } from "../src/server/db";
import { loadDbFromPostgres, syncDbToPostgres } from "../src/server/postgres-sync";
import type { Db, User, Farm, Crop, WorkOpportunity, WorkApplication, Service, ServiceRequest, Post, Message } from "../src/types/domain";

describe("Task 3 — End-to-End Workflow & Restart Persistence Verification", () => {
  const timestamp = Date.now();
  const testUserId = `u_e2e_${timestamp}`;
  const testUserHandle = `e2e.user.${timestamp}`;
  const testEmail = `e2e.${timestamp}@kaamsetu.org`;
  const testPhone = `+919900${Math.floor(100000 + Math.random() * 900000)}`;

  let persistedState: Db;

  beforeAll(async () => {
    const isConnected = await checkDatabaseConnection();
    expect(isConnected).toBe(true);
  });

  afterAll(async () => {
    // Clean up test records created during this run
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it("Step 1: Executes complete workflow (User, Farmer, Jobs, Service, Posts, Messages) in memory", async () => {
    const d = resetDb(emptyDb());

    // 1. User registration
    const user: User = {
      id: testUserId,
      role: "PROFESSIONAL",
      name: "E2E Test Professional",
      handle: testUserHandle,
      email: testEmail,
      phone: testPhone,
      hue: 200,
      status: "ACTIVE",
      language: "en",
      notificationPrefs: {
        GOVERNMENT: true, EVENT: true, ENQUIRY: true, EXPERT: true, COMMUNITY: true,
        CROP: true, LEARNING: true, MARKET: true, WEATHER: true, FOLLOW: true,
        COMMENT: true, LIKE: true, AI: true, SERVICE: true, WORK: true,
      },
      personalization: true,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.users.push(user);

    // 2. Professional Profile
    d.professionalProfiles.push({
      userId: testUserId,
      professionId: "pr_electrician",
      secondaryProfessionIds: [],
      about: "E2E Verified Industrial Electrician",
      startedYear: 2018,
      skills: [{ name: "Wiring", level: "EXPERT" }],
      languages: ["English", "Hindi"],
      attributes: { specialties: ["Industrial", "Solar"] },
      location: { district: "Jaipur", state: "Rajasthan", serviceRadiusKm: 30, serviceAreas: ["Sitapura"] },
      availability: { status: "AVAILABLE", days: ["Mon", "Tue", "Wed"], preferences: ["CONTRACT"] },
      certifications: [],
      achievements: [],
      privacy: { profile: "PUBLIC", income: "PRIVATE", financialRecords: "PRIVATE", phone: "PUBLIC", produce: "PUBLIC", farmPhotos: "PUBLIC", locationPrecision: "DISTRICT" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false,
    });

    // 3. Farm & Crop
    const farmId = `farm_e2e_${timestamp}`;
    const farm: Farm = {
      id: farmId,
      ownerId: testUserId,
      name: "E2E Green Acres",
      areaAcres: 12.5,
      soil: "Loamy",
      irrigation: "Drip",
      village: "Chomu",
      district: "Jaipur",
      scene: "wheat",
      history: [],
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.farms.push(farm);

    const cropId = `crop_e2e_${timestamp}`;
    const crop: Crop = {
      id: cropId,
      ownerId: testUserId,
      farmId,
      name: "Organic Mustard",
      experienceYears: 5,
      season: "Rabi",
      areaAcres: 5.0,
      method: "Organic",
      typicalYieldQtlPerAcre: 8.5,
      status: "GROWING",
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.crops.push(crop);

    // 4. Service & Service Request
    const serviceId = `srv_e2e_${timestamp}`;
    const service: Service = {
      id: serviceId,
      ownerId: testUserId,
      name: "Solar Inverter Maintenance",
      description: "Complete testing and panel repair",
      price: 1500,
      priceType: "PER_VISIT",
      areas: ["Jaipur", "Chomu"],
      availability: "Available weekends",
      media: [],
      active: true,
      hidden: false,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.services.push(service);

    const reqId = `sr_e2e_${timestamp}`;
    const serviceReq: ServiceRequest = {
      id: reqId,
      serviceId,
      providerId: testUserId,
      requesterId: testUserId,
      date: new Date().toISOString(),
      location: { district: "Jaipur", state: "Rajasthan" },
      description: "Needs urgent farm solar inspection",
      status: "ACCEPTED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false,
    };
    d.serviceRequests.push(serviceReq);

    // 5. Work Opportunity & Application
    const jobId = `job_e2e_${timestamp}`;
    const job: WorkOpportunity = {
      id: jobId,
      posterId: testUserId,
      title: "Solar Grid Wiring Project",
      description: "Commercial grid connection needed",
      kind: "CONTRACT",
      professionIds: ["pr_electrician"],
      skills: ["Wiring"],
      openings: 2,
      location: { district: "Jaipur", state: "Rajasthan" },
      mode: "ONSITE",
      pay: { min: 800, max: 1200, unit: "DAY" },
      contactMethod: "IN_APP",
      status: "OPEN",
      hidden: false,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.workOpportunities.push(job);

    const appId = `app_e2e_${timestamp}`;
    const app: WorkApplication = {
      id: appId,
      opportunityId: jobId,
      applicantId: testUserId,
      note: "10 years experience with solar grids",
      status: "ACCEPTED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false,
    };
    d.applications.push(app);

    // 6. Social Post
    const postId = `post_e2e_${timestamp}`;
    const post: Post = {
      id: postId,
      authorId: testUserId,
      kind: "POST",
      body: "Testing solar grid maintenance procedures in Jaipur district #SolarPower #Rajasthan",
      tags: ["SolarPower", "Rajasthan"],
      district: "Jaipur",
      state: "Rajasthan",
      hidden: false,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.posts.push(post);

    // 7. Conversation & Message
    const convId = `conv_e2e_${timestamp}`;
    d.conversations.push({
      id: convId,
      participantIds: [testUserId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false,
    });

    const msgId = `msg_e2e_${timestamp}`;
    const msg: Message = {
      id: msgId,
      conversationId: convId,
      senderId: testUserId,
      body: "Solar installation confirmed for tomorrow morning at 9 AM.",
      attachments: [],
      readBy: [testUserId],
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    d.messages.push(msg);

    // Sync state to PostgreSQL
    await syncDbToPostgres(d);

    // Verify row was written to real PostgreSQL database
    const dbUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.handle).toBe(testUserHandle);

    const dbFarm = await prisma.farm.findUnique({ where: { id: farmId } });
    expect(dbFarm).not.toBeNull();
    expect(dbFarm?.name).toBe("E2E Green Acres");

    const dbJob = await prisma.workOpportunity.findUnique({ where: { id: jobId } });
    expect(dbJob).not.toBeNull();
    expect(dbJob?.title).toBe("Solar Grid Wiring Project");
  });

  it("Step 2: Simulates application restart and verifies persistent cold reload", async () => {
    // 1. Wipe in-memory store completely to simulate process termination / restart
    resetDb(emptyDb());
    expect(db().users.find((u) => u.id === testUserId)).toBeUndefined();
    expect(db().farms.find((f) => f.ownerId === testUserId)).toBeUndefined();

    // 2. Perform cold boot reload from PostgreSQL
    persistedState = await loadDbFromPostgres();
    resetDb(persistedState);

    // 3. Verify user restored from PostgreSQL
    const restoredUser = db().users.find((u) => u.id === testUserId);
    expect(restoredUser).toBeDefined();
    expect(restoredUser?.email).toBe(testEmail);
    expect(restoredUser?.handle).toBe(testUserHandle);

    // 4. Verify professional profile restored
    const restoredProfile = db().professionalProfiles.find((p) => p.userId === testUserId);
    expect(restoredProfile).toBeDefined();
    expect(restoredProfile?.professionId).toBe("pr_electrician");
    expect(restoredProfile?.about).toBe("E2E Verified Industrial Electrician");

    // 5. Verify farm and crop restored
    const restoredFarm = db().farms.find((f) => f.ownerId === testUserId);
    expect(restoredFarm).toBeDefined();
    expect(restoredFarm?.name).toBe("E2E Green Acres");

    const restoredCrop = db().crops.find((c) => c.ownerId === testUserId);
    expect(restoredCrop).toBeDefined();
    expect(restoredCrop?.name).toBe("Organic Mustard");

    // 6. Verify service and service request restored
    const restoredService = db().services.find((s) => s.ownerId === testUserId);
    expect(restoredService).toBeDefined();
    expect(restoredService?.price).toBe(1500);

    const restoredRequest = db().serviceRequests.find((sr) => sr.providerId === testUserId);
    expect(restoredRequest).toBeDefined();
    expect(restoredRequest?.status).toBe("ACCEPTED");

    // 7. Verify job and application restored
    const restoredJob = db().workOpportunities.find((w) => w.posterId === testUserId);
    expect(restoredJob).toBeDefined();
    expect(restoredJob?.title).toBe("Solar Grid Wiring Project");

    const restoredApp = db().applications.find((a) => a.applicantId === testUserId);
    expect(restoredApp).toBeDefined();
    expect(restoredApp?.status).toBe("ACCEPTED");

    // 8. Verify post and message restored
    const restoredPost = db().posts.find((p) => p.authorId === testUserId);
    expect(restoredPost).toBeDefined();
    expect(restoredPost?.body).toContain("Testing solar grid maintenance");

    const restoredMsg = db().messages.find((m) => m.senderId === testUserId);
    expect(restoredMsg).toBeDefined();
    expect(restoredMsg?.body).toContain("Solar installation confirmed");
  });

  it("Step 3: Verifies deletion persistence across restart", async () => {
    const d = db();
    const postId = `post_e2e_${timestamp}`;

    // Confirm post is present before deletion
    expect(d.posts.some((p) => p.id === postId)).toBe(true);

    // Delete post in memory
    d.posts = d.posts.filter((p) => p.id !== postId);

    // Persist deletion to PostgreSQL
    await syncDbToPostgres(d);

    // Verify deletion in database
    const dbPost = await prisma.post.findUnique({ where: { id: postId } });
    expect(dbPost).toBeNull();

    // Simulate another server restart
    resetDb(emptyDb());
    const reloaded = await loadDbFromPostgres();
    resetDb(reloaded);

    // Deleted post must NOT reappear after restart
    expect(db().posts.some((p) => p.id === postId)).toBe(false);
  });
});
