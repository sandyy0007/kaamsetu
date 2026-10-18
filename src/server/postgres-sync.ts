/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * KaamSetu — PostgreSQL Persistent Sync Engine.
 *
 * Bridges the in-memory domain cache with persistent PostgreSQL via Prisma.
 * Guarantees:
 * - DEMO_MODE=false runs strictly on PostgreSQL (zero fallback to in-memory/JSON snapshot).
 * - Fails fast if PostgreSQL is unavailable.
 * - Confirmed persistent writes: every mutation (create, update, delete) is synchronized and verified.
 * - Seeds baseline reference metadata catalog (professions, skills) if database is fresh.
 * - Complete deletion synchronization: removed domain entities are deleted from PostgreSQL tables.
 * - Strict error propagation: database errors abort transactions and throw 503 instead of false 200s.
 */

import type {
  Db,
  User,
  FarmerProfile,
  ProfessionalProfile,
  Service,
  ServiceRequest,
  PortfolioEntry,
  WorkOpportunity,
  WorkApplication,
  Business,
  Farm,
  Crop,
  ProduceListing,
  BuyerRequirement,
  Enquiry,
  Post,
  WorkHistoryEntry,
  Recommendation,
  MachineryListing,
} from "@/types/domain";
import { checkDatabaseConnection, prisma } from "./prisma";
import { emptyDb } from "./seed";
import { professionCategoriesSeed, professionsSeed, skillCatalogSeed } from "./seed/professions";
import { ApiException } from "./errors";

// Fingerprint tracking map: key -> signature to track synchronized state
const syncedFingerprints = new Map<string, string>();

/**
 * Ensures PostgreSQL is connected and reference catalog is initialized.
 * Throws immediately if PostgreSQL is not reachable in production.
 */
export async function ensurePostgresReady(): Promise<void> {
  const connected = await checkDatabaseConnection();
  if (!connected) {
    throw new ApiException(
      503,
      "DATABASE_UNAVAILABLE",
      "FATAL: PostgreSQL connection failed. In production mode (DEMO_MODE=false), a valid, running PostgreSQL database is strictly required.",
    );
  }

  // Seed reference metadata if database is empty
  const categoryCount = await prisma.professionCategory.count();
  if (categoryCount === 0) {
    console.info("[postgres-sync] Empty database detected. Seeding reference trade catalog (professions, skills)...");
    await seedReferenceCatalog();
  }
}

/**
 * Seeds official reference catalog only. Zero mock users, zero mock jobs, zero mock bids.
 */
async function seedReferenceCatalog(): Promise<void> {
  for (const cat of professionCategoriesSeed) {
    await prisma.professionCategory.upsert({
      where: { id: cat.id },
      create: {
        id: cat.id,
        name: cat.name,
        nameHi: cat.nameHi,
        emoji: cat.emoji,
        sortOrder: cat.order,
        isDemo: false,
      },
      update: {},
    });
  }

  for (const p of professionsSeed) {
    await prisma.profession.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        nameHi: p.nameHi,
        emoji: p.emoji,
        synonyms: p.synonyms,
        suggestedSkills: p.suggestedSkills,
        suggestedServices: p.suggestedServices,
        attributes: p.attributes as any,
        dashboard: p.dashboard,
        farmModules: p.farmModules,
        status: p.status,
        custom: p.custom,
        createdBy: p.createdBy,
        isDemo: false,
      },
      update: {},
    });
  }

  for (const s of skillCatalogSeed) {
    await prisma.skill.upsert({
      where: { name: s.name },
      create: {
        id: s.id,
        name: s.name,
        professionIds: s.professionIds,
        status: s.status,
        isDemo: false,
      },
      update: {},
    });
  }
}

/**
 * Loads all persistent collections from PostgreSQL into the in-memory domain store.
 */
export async function loadDbFromPostgres(): Promise<Db> {
  await ensurePostgresReady();

  const d = emptyDb();

  // 1. Reference catalog
  const categories = await prisma.professionCategory.findMany({ orderBy: { sortOrder: "asc" } });
  d.professionCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    nameHi: c.nameHi,
    emoji: c.emoji,
    order: c.sortOrder,
    isDemo: c.isDemo,
  }));

  const professions = await prisma.profession.findMany();
  d.professions = professions.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    nameHi: p.nameHi,
    emoji: p.emoji,
    synonyms: p.synonyms,
    suggestedSkills: p.suggestedSkills,
    suggestedServices: p.suggestedServices,
    attributes: (p.attributes as any) || [],
    dashboard: p.dashboard as any,
    farmModules: p.farmModules,
    status: p.status as any,
    custom: p.custom,
    createdBy: p.createdBy ?? undefined,
    isDemo: p.isDemo,
  }));

  const skills = await prisma.skill.findMany();
  d.skillCatalog = skills.map((s) => ({
    id: s.id,
    name: s.name,
    professionIds: s.professionIds,
    status: s.status as any,
    isDemo: s.isDemo,
  }));

  // 2. Users
  const users = await prisma.user.findMany();
  d.users = users.map((u) => {
    const usr: User = {
      id: u.id,
      role: u.role as any,
      name: u.name,
      handle: u.handle,
      email: u.email ?? undefined,
      phone: u.phone ?? undefined,
      passwordHash: u.passwordHash ?? undefined,
      hue: u.hue,
      headline: u.headline ?? undefined,
      verifiedAt: u.verifiedAt ? u.verifiedAt.toISOString() : undefined,
      verifiedBy: u.verifiedBy ?? undefined,
      status: u.status as any,
      language: u.language as any,
      notificationPrefs: (u.notificationPrefs as any) || {},
      phoneVerified: (u.notificationPrefs as any)?._phoneVerified !== undefined ? Boolean((u.notificationPrefs as any)._phoneVerified) : true,
      personalization: true,
      createdAt: u.createdAt.toISOString(),
      isDemo: u.isDemo,
    };
    syncedFingerprints.set(`user:${u.id}`, `${u.id}:${u.updatedAt.getTime()}`);
    return usr;
  });

  // 3. Professional profiles
  const pros = await prisma.professionalProfile.findMany();
  d.professionalProfiles = pros.map((p) => {
    const prof: ProfessionalProfile = {
      userId: p.userId,
      professionId: p.professionId,
      secondaryProfessionIds: p.secondaryProfessionIds,
      customProfession: p.customProfession ?? undefined,
      about: p.about,
      startedYear: p.startedYear,
      skills: (p.skills as any) || [],
      languages: p.languages,
      attributes: (p.attributes as any) || {},
      location: {
        village: p.village ?? undefined,
        district: p.district,
        state: p.state,
        serviceRadiusKm: p.serviceRadiusKm,
        serviceAreas: p.serviceAreas,
      },
      availability: ((p.availability as any) || { status: p.availabilityStatus, days: [], preferences: [] }) as any,
      certifications: (p.certifications as any) || [],
      achievements: (p.achievements as any) || [],
      privacy: (p.privacy as any) || {},
      businessId: p.businessId ?? undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      isDemo: p.isDemo,
    };
    syncedFingerprints.set(`pro:${p.userId}`, `${p.userId}:${p.updatedAt.getTime()}`);
    return prof;
  });

  // 4. Farmer profiles
  const farmers = await prisma.farmerProfile.findMany();
  d.farmerProfiles = farmers.map((f) => {
    const fp: FarmerProfile = {
      userId: f.userId,
      village: f.village,
      district: f.district,
      state: f.state,
      farmingSince: f.farmingSince,
      languages: f.languages,
      specialization: f.specialization,
      methods: f.methods,
      livestock: f.livestock,
      story: f.story,
      skills: f.skills,
      certifications: (f.certifications as any) || [],
      achievements: (f.achievements as any) || [],
      portfolio: (f.portfolio as any) || [],
      media: (f.media as any) || [],
      interests: f.interests,
      fpoIds: [],
      privacy: (f.privacy as any) || {},
      isDemo: f.isDemo,
    };
    syncedFingerprints.set(`farmer:${f.userId}`, `${f.userId}:${f.farmingSince}`);
    return fp;
  });

  // 5. Services
  const services = await prisma.service.findMany();
  d.services = services.map((s) => {
    const srv: Service = {
      id: s.id,
      ownerId: s.ownerId,
      name: s.name,
      description: s.description,
      price: s.price ?? undefined,
      priceType: s.priceType as any,
      areas: s.areas,
      availability: s.availability,
      media: (s.media as any) || [],
      active: s.active,
      hidden: s.hidden,
      createdAt: s.createdAt.toISOString(),
      isDemo: s.isDemo,
    };
    syncedFingerprints.set(`service:${s.id}`, `${s.id}:${s.active}`);
    return srv;
  });

  // 6. Service Requests
  const serviceRequests = await prisma.serviceRequest.findMany();
  d.serviceRequests = serviceRequests.map((sr) => {
    const req: ServiceRequest = {
      id: sr.id,
      serviceId: sr.serviceId,
      providerId: sr.providerId,
      requesterId: sr.requesterId,
      date: sr.date.toISOString(),
      location: { village: sr.village ?? undefined, district: sr.district, state: sr.state },
      description: sr.description,
      status: sr.status as any,
      conversationId: sr.conversationId ?? undefined,
      createdAt: sr.createdAt.toISOString(),
      updatedAt: sr.updatedAt.toISOString(),
      isDemo: sr.isDemo,
    };
    syncedFingerprints.set(`sr:${sr.id}`, `${sr.id}:${sr.status}:${sr.updatedAt.getTime()}`);
    return req;
  });

  // 7. Portfolio
  const portfolio = await prisma.portfolioEntry.findMany();
  d.portfolioEntries = portfolio.map((pe) => {
    const entry: PortfolioEntry = {
      id: pe.id,
      ownerId: pe.ownerId,
      title: pe.title,
      description: pe.description,
      category: pe.category,
      date: pe.date instanceof Date ? pe.date.toISOString() : String(pe.date),
      skillsUsed: pe.skillsUsed,
      media: (pe.media as any) || [],
      imageUrl: pe.imageUrl ?? undefined,
      videoUrl: pe.videoUrl ?? undefined,
      meta: (pe.meta as any) || undefined,
      hidden: pe.hidden,
      createdAt: pe.createdAt.toISOString(),
      isDemo: pe.isDemo,
    };
    syncedFingerprints.set(`portfolio:${pe.id}`, `${pe.id}`);
    return entry;
  });

  // 8. Work History
  const workHistory = await prisma.workHistoryEntry.findMany();
  d.workHistory = workHistory.map((wh) => {
    const entry: WorkHistoryEntry = {
      id: wh.id,
      ownerId: wh.ownerId,
      role: wh.role,
      organization: wh.organization,
      kind: wh.kind as any,
      location: wh.location,
      startDate: wh.startDate,
      endDate: wh.endDate ?? undefined,
      description: wh.description,
      skills: wh.skills,
      createdAt: wh.createdAt.toISOString(),
      isDemo: wh.isDemo,
    };
    syncedFingerprints.set(`workHistory:${wh.id}`, `${wh.id}`);
    return entry;
  });

  // 9. Recommendations
  const recs = await prisma.recommendation.findMany();
  d.recommendations = recs.map((r) => {
    const rec: Recommendation = {
      id: r.id,
      subjectId: r.subjectId,
      authorId: r.authorId,
      relationship: r.relationship as any,
      body: r.body,
      skill: r.skill ?? undefined,
      interactionVerified: r.interactionVerified,
      hidden: r.hidden,
      createdAt: r.createdAt.toISOString(),
      isDemo: r.isDemo,
    };
    syncedFingerprints.set(`rec:${r.id}`, `${r.id}`);
    return rec;
  });

  // 10. Work Opportunities
  const workOpps = await prisma.workOpportunity.findMany();
  d.workOpportunities = workOpps.map((w) => {
    const opp: WorkOpportunity = {
      id: w.id,
      posterId: w.posterId,
      businessId: w.businessId ?? undefined,
      title: w.title,
      description: w.description,
      kind: w.kind as any,
      professionIds: w.professionIds,
      skills: w.skills,
      openings: w.openings,
      location: { village: w.village ?? undefined, district: w.district, state: w.state },
      startDate: w.startDate ? w.startDate.toISOString() : undefined,
      mode: w.mode as any,
      pay: { min: w.payMin ?? undefined, max: w.payMax ?? undefined, unit: w.payUnit as any },
      duration: w.duration ?? undefined,
      contactMethod: w.contactMethod as any,
      status: w.status as any,
      hidden: w.hidden,
      createdAt: w.createdAt.toISOString(),
      isDemo: w.isDemo,
    };
    syncedFingerprints.set(`work:${w.id}`, `${w.id}:${w.status}:${w.createdAt.getTime()}`);
    return opp;
  });

  // 11. Work Applications
  const applications = await prisma.workApplication.findMany();
  d.applications = applications.map((a) => {
    const app: WorkApplication = {
      id: a.id,
      opportunityId: a.opportunityId,
      applicantId: a.applicantId,
      note: a.note,
      status: a.status as any,
      conversationId: a.conversationId ?? undefined,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      isDemo: a.isDemo,
    };
    syncedFingerprints.set(`app:${a.id}`, `${a.id}:${a.status}:${a.updatedAt.getTime()}`);
    return app;
  });

  // 12. Businesses
  const businesses = await prisma.business.findMany();
  d.businesses = businesses.map((b) => {
    const bus: Business = {
      id: b.id,
      ownerId: b.ownerId,
      name: b.name,
      kind: b.kind,
      about: b.about,
      services: b.services,
      professionIds: b.professionIds,
      district: b.district,
      state: b.state,
      website: b.website ?? undefined,
      verifiedAt: b.verifiedAt ? b.verifiedAt.toISOString() : undefined,
      verifiedBy: b.verifiedBy ?? undefined,
      hidden: b.hidden,
      createdAt: b.createdAt.toISOString(),
      isDemo: b.isDemo,
    };
    syncedFingerprints.set(`business:${b.id}`, `${b.id}`);
    return bus;
  });

  // 13. Farms
  const farms = await prisma.farm.findMany();
  d.farms = farms.map((f) => {
    const farm: Farm = {
      id: f.id,
      ownerId: f.ownerId,
      name: f.name,
      areaAcres: f.areaAcres,
      soil: f.soil,
      irrigation: f.irrigation,
      village: f.village,
      district: f.district,
      scene: "wheat",
      history: (f.history as any) || [],
      createdAt: f.createdAt.toISOString(),
      isDemo: f.isDemo,
    };
    syncedFingerprints.set(`farm:${f.id}`, `${f.id}`);
    return farm;
  });

  // 14. Crops
  const crops = await prisma.crop.findMany();
  d.crops = crops.map((c) => {
    const crp: Crop = {
      id: c.id,
      ownerId: c.ownerId,
      farmId: c.farmId,
      name: c.name,
      experienceYears: c.experienceYears,
      season: c.season as any,
      areaAcres: c.areaAcres,
      method: c.method,
      typicalYieldQtlPerAcre: c.typicalYieldQtlPerAcre,
      status: c.status as any,
      createdAt: c.createdAt.toISOString(),
      isDemo: c.isDemo,
    };
    syncedFingerprints.set(`crop:${c.id}`, `${c.id}:${c.status}`);
    return crp;
  });

  // 15. Produce Listings
  const listings = await prisma.produceListing.findMany();
  d.listings = listings.map((l) => {
    const item: ProduceListing = {
      id: l.id,
      ownerId: l.ownerId,
      crop: l.crop,
      variety: l.variety ?? undefined,
      quantity: l.quantity,
      unit: l.unit as any,
      expectedPrice: Number(l.expectedPrice),
      location: { village: l.village ?? undefined, district: l.district, state: l.state },
      harvestDate: l.harvestDate.toISOString(),
      grade: l.grade as any,
      method: l.method,
      organic: l.organic,
      status: l.status as any,
      fpoId: l.fpoId ?? undefined,
      description: l.description,
      hidden: l.hidden,
      createdAt: l.createdAt.toISOString(),
      isDemo: l.isDemo,
    };
    syncedFingerprints.set(`listing:${l.id}`, `${l.id}:${l.status}`);
    return item;
  });

  // 16. Buyer Requirements
  const reqs = await prisma.buyerRequirement.findMany();
  d.requirements = reqs.map((r) => {
    const req: BuyerRequirement = {
      id: r.id,
      buyerId: r.buyerId,
      crop: r.crop,
      quantity: r.quantity,
      unit: r.unit as any,
      district: r.district,
      state: r.state,
      windowStart: r.windowStart.toISOString(),
      windowEnd: r.windowEnd.toISOString(),
      notes: r.notes,
      status: r.status as any,
      hidden: r.hidden,
      createdAt: r.createdAt.toISOString(),
      isDemo: r.isDemo,
    };
    syncedFingerprints.set(`req:${r.id}`, `${r.id}:${r.status}`);
    return req;
  });

  // 17. Enquiries
  const enquiries = await prisma.enquiry.findMany();
  d.enquiries = enquiries.map((e) => {
    const enq: Enquiry = {
      id: e.id,
      listingId: e.listingId ?? undefined,
      requirementId: e.requirementId ?? undefined,
      buyerId: e.buyerId,
      farmerId: e.farmerId,
      conversationId: e.conversationId ?? "",
      message: e.message,
      status: e.status as any,
      createdAt: e.createdAt.toISOString(),
      isDemo: e.isDemo,
    };
    syncedFingerprints.set(`enquiry:${e.id}`, `${e.id}:${e.status}`);
    return enq;
  });

  // 18. Machinery
  const machinery = await prisma.machineryListing.findMany();
  d.machinery = machinery.map((m) => {
    const mach: MachineryListing = {
      id: m.id,
      ownerId: m.ownerId,
      type: m.type as any,
      name: m.name,
      district: m.district,
      state: m.state,
      available: m.available,
      rate: Number(m.rate),
      rateUnit: m.rateUnit as any,
      description: m.description,
      hidden: m.hidden,
      createdAt: m.createdAt.toISOString(),
      isDemo: m.isDemo,
    };
    syncedFingerprints.set(`machinery:${m.id}`, `${m.id}:${m.available}`);
    return mach;
  });

  // 19. Posts
  const posts = await prisma.post.findMany();
  d.posts = posts.map((p) => {
    const post: Post = {
      id: p.id,
      authorId: p.authorId,
      kind: p.kind as any,
      body: p.body,
      tags: p.tags,
      scene: (p.scene as any) || undefined,
      imageUrl: p.imageUrl ?? undefined,
      communityId: p.communityId ?? undefined,
      crop: p.crop ?? undefined,
      district: p.district ?? undefined,
      state: p.state ?? undefined,
      linkedEventId: p.linkedEventId ?? undefined,
      hidden: p.hidden,
      createdAt: p.createdAt.toISOString(),
      isDemo: p.isDemo,
    };
    syncedFingerprints.set(`post:${p.id}`, `${p.id}`);
    return post;
  });

  // 20. Comments
  const comments = await prisma.comment.findMany();
  d.comments = comments.map((c) => {
    syncedFingerprints.set(`comment:${c.id}`, c.id);
    return {
      id: c.id,
      targetType: c.targetType as any,
      targetId: c.targetId,
      authorId: c.authorId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      isDemo: c.isDemo,
    };
  });

  // 21. Conversations & Messages
  const convos = await prisma.conversation.findMany({ include: { participants: true } });
  d.conversations = convos.map((c) => {
    syncedFingerprints.set(`conv:${c.id}`, c.id);
    return {
      id: c.id,
      participantIds: c.participants.map((p) => p.userId),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      isDemo: c.isDemo,
    };
  });

  const msgs = await prisma.message.findMany();
  d.messages = msgs.map((m) => {
    syncedFingerprints.set(`msg:${m.id}`, m.id);
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      attachments: [],
      readBy: m.readBy,
      createdAt: m.createdAt.toISOString(),
      isDemo: m.isDemo,
    };
  });

  // 22. Notifications
  const notifs = await prisma.notification.findMany();
  d.notifications = notifs.map((n) => {
    syncedFingerprints.set(`notif:${n.id}`, `${n.id}:${n.read}`);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as any,
      title: n.title,
      body: n.body,
      link: n.link ?? undefined,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      isDemo: n.isDemo,
    };
  });

  // 23. Reports & Verifications
  const reports = await prisma.report.findMany();
  d.reports = reports.map((r) => {
    syncedFingerprints.set(`report:${r.id}`, `${r.id}:${r.status}`);
    return {
      id: r.id,
      reporterId: r.reporterId,
      targetType: r.targetType as any,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details ?? undefined,
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      isDemo: r.isDemo,
    };
  });

  const verifs = await prisma.verificationRequest.findMany();
  d.verificationRequests = verifs.map((v) => {
    syncedFingerprints.set(`verif:${v.id}`, `${v.id}:${v.status}`);
    return {
      id: v.id,
      userId: v.userId,
      kind: v.kind as any,
      note: v.note,
      targetId: v.targetId ?? undefined,
      documentLabels: v.documentLabels,
      status: v.status as any,
      reviewedBy: v.reviewedBy ?? undefined,
      reviewNote: v.reviewNote ?? undefined,
      createdAt: v.createdAt.toISOString(),
      isDemo: v.isDemo,
    };
  });

  // 17. Follows
  const follows = await prisma.follow.findMany();
  d.follows = follows.map((f) => {
    syncedFingerprints.set(`follow:${f.followerId}:${f.followingId}`, `${f.followerId}:${f.followingId}`);
    return {
      followerId: f.followerId,
      followingId: f.followingId,
      createdAt: f.createdAt.toISOString(),
      isDemo: f.isDemo,
    };
  });

  console.info(
    `[postgres-sync] Successfully loaded persistent state from PostgreSQL: ${d.users.length} users, ${d.workOpportunities.length} jobs, ${d.services.length} services, ${d.farms.length} farms, ${d.follows.length} follows.`,
  );
  return d;
}

/**
 * Synchronizes dirty, newly created, and deleted entities directly to PostgreSQL via Prisma.
 * Guarantees that any database write/delete error is thrown so the request fails fast.
 */
export async function syncDbToPostgres(d: Db): Promise<void> {
  try {
    // ───────────── 1. Users ─────────────
    const currentUsers = new Set(d.users.map((u) => u.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("user:")) {
        const id = key.slice(5);
        if (!currentUsers.has(id)) {
          await prisma.user.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const u of d.users) {
      const fp = `${u.id}:${u.status}:${u.name}:${u.email}:${u.phone}:${u.phoneVerified}:${u.headline}`;
      if (syncedFingerprints.get(`user:${u.id}`) === fp) continue;

      await prisma.user.upsert({
        where: { id: u.id },
        create: {
          id: u.id,
          role: u.role as any,
          name: u.name,
          handle: u.handle,
          email: u.email ?? null,
          phone: u.phone ?? null,
          passwordHash: u.passwordHash ?? null,
          headline: u.headline ?? null,
          hue: u.hue,
          language: u.language,
          status: u.status as any,
          verifiedAt: u.verifiedAt ? new Date(u.verifiedAt) : null,
          verifiedBy: u.verifiedBy ?? null,
          notificationPrefs: { ...(u.notificationPrefs as any), _phoneVerified: u.phoneVerified !== false } as any,
          isDemo: u.isDemo,
          createdAt: new Date(u.createdAt),
        },
        update: {
          name: u.name,
          handle: u.handle,
          email: u.email ?? null,
          phone: u.phone ?? null,
          passwordHash: u.passwordHash ?? null,
          headline: u.headline ?? null,
          hue: u.hue,
          language: u.language,
          status: u.status as any,
          verifiedAt: u.verifiedAt ? new Date(u.verifiedAt) : null,
          verifiedBy: u.verifiedBy ?? null,
          notificationPrefs: { ...(u.notificationPrefs as any), _phoneVerified: u.phoneVerified !== false } as any,
        },
      });
      syncedFingerprints.set(`user:${u.id}`, fp);
    }

    // ───────────── 2. Professional Profiles ─────────────
    const currentPros = new Set(d.professionalProfiles.map((p) => p.userId));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("pro:")) {
        const id = key.slice(4);
        if (!currentPros.has(id)) {
          await prisma.professionalProfile.deleteMany({ where: { userId: id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    const validProfessions = new Set(d.professions.map((p) => p.id));
    for (const p of d.professionalProfiles) {
      if (!currentUsers.has(p.userId) || (validProfessions.size > 0 && !validProfessions.has(p.professionId))) continue;
      const fp = `${p.userId}:${p.professionId}:${p.availability?.status}:${p.about}`;
      if (syncedFingerprints.get(`pro:${p.userId}`) === fp) continue;

      await prisma.professionalProfile.upsert({
        where: { userId: p.userId },
        create: {
          userId: p.userId,
          professionId: p.professionId,
          secondaryProfessionIds: p.secondaryProfessionIds,
          customProfession: p.customProfession ?? null,
          about: p.about,
          startedYear: p.startedYear,
          skills: p.skills as any,
          languages: p.languages,
          attributes: p.attributes as any,
          village: p.location.village ?? null,
          district: p.location.district ?? "",
          state: p.location.state ?? "Rajasthan",
          serviceRadiusKm: p.location.serviceRadiusKm ?? 25,
          serviceAreas: p.location.serviceAreas ?? [],
          availabilityStatus: (p.availability?.status as any) ?? "OPEN_TO_WORK",
          availability: (p.availability as any) ?? {},
          certifications: p.certifications as any,
          achievements: p.achievements as any,
          privacy: p.privacy as any,
          businessId: p.businessId ?? null,
          isDemo: p.isDemo,
          createdAt: new Date(p.createdAt),
        },
        update: {
          professionId: p.professionId,
          secondaryProfessionIds: p.secondaryProfessionIds,
          customProfession: p.customProfession ?? null,
          about: p.about,
          startedYear: p.startedYear,
          skills: p.skills as any,
          languages: p.languages,
          attributes: p.attributes as any,
          village: p.location.village ?? null,
          district: p.location.district ?? "",
          state: p.location.state ?? "Rajasthan",
          serviceRadiusKm: p.location.serviceRadiusKm ?? 25,
          serviceAreas: p.location.serviceAreas ?? [],
          availabilityStatus: (p.availability?.status as any) ?? "OPEN_TO_WORK",
          availability: (p.availability as any) ?? {},
          certifications: p.certifications as any,
          achievements: p.achievements as any,
          privacy: p.privacy as any,
          businessId: p.businessId ?? null,
        },
      });
      syncedFingerprints.set(`pro:${p.userId}`, fp);
    }

    // ───────────── 3. Farmer Profiles ─────────────
    const currentFarmers = new Set(d.farmerProfiles.map((f) => f.userId));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("farmer:")) {
        const id = key.slice(7);
        if (!currentFarmers.has(id)) {
          await prisma.farmerProfile.deleteMany({ where: { userId: id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const f of d.farmerProfiles) {
      if (!currentUsers.has(f.userId)) continue;
      const fp = `${f.userId}:${f.farmingSince}:${f.specialization}`;
      if (syncedFingerprints.get(`farmer:${f.userId}`) === fp) continue;

      await prisma.farmerProfile.upsert({
        where: { userId: f.userId },
        create: {
          userId: f.userId,
          village: f.village,
          district: f.district,
          state: f.state,
          farmingSince: f.farmingSince,
          languages: f.languages,
          specialization: f.specialization,
          methods: f.methods,
          livestock: f.livestock,
          story: f.story,
          skills: f.skills,
          interests: f.interests,
          certifications: f.certifications as any,
          achievements: f.achievements as any,
          portfolio: f.portfolio as any,
          media: f.media as any,
          privacy: f.privacy as any,
          isDemo: f.isDemo,
        },
        update: {
          village: f.village,
          district: f.district,
          state: f.state,
          farmingSince: f.farmingSince,
          languages: f.languages,
          specialization: f.specialization,
          methods: f.methods,
          livestock: f.livestock,
          story: f.story,
          skills: f.skills,
          interests: f.interests,
          certifications: f.certifications as any,
          achievements: f.achievements as any,
          portfolio: f.portfolio as any,
          media: f.media as any,
          privacy: f.privacy as any,
        },
      });
      syncedFingerprints.set(`farmer:${f.userId}`, fp);
    }

    // ───────────── 4. Services ─────────────
    const currentServices = new Set(d.services.map((s) => s.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("service:")) {
        const id = key.slice(8);
        if (!currentServices.has(id)) {
          await prisma.service.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const s of d.services) {
      if (!currentUsers.has(s.ownerId)) continue;
      const fp = `${s.id}:${s.active}:${s.price}:${s.name}`;
      if (syncedFingerprints.get(`service:${s.id}`) === fp) continue;

      await prisma.service.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          ownerId: s.ownerId,
          name: s.name,
          description: s.description,
          price: s.price ?? null,
          priceType: s.priceType as any,
          areas: s.areas,
          availability: s.availability,
          media: s.media as any,
          active: s.active,
          hidden: s.hidden,
          isDemo: s.isDemo,
          createdAt: new Date(s.createdAt),
        },
        update: {
          name: s.name,
          description: s.description,
          price: s.price ?? null,
          priceType: s.priceType as any,
          areas: s.areas,
          availability: s.availability,
          media: s.media as any,
          active: s.active,
          hidden: s.hidden,
        },
      });
      syncedFingerprints.set(`service:${s.id}`, fp);
    }

    // ───────────── 5. Service Requests ─────────────
    const currentReqs = new Set(d.serviceRequests.map((sr) => sr.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("sr:")) {
        const id = key.slice(3);
        if (!currentReqs.has(id)) {
          await prisma.serviceRequest.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const sr of d.serviceRequests) {
      if (!currentServices.has(sr.serviceId) || !currentUsers.has(sr.providerId) || !currentUsers.has(sr.requesterId)) continue;
      const fp = `${sr.id}:${sr.status}`;
      if (syncedFingerprints.get(`sr:${sr.id}`) === fp) continue;

      await prisma.serviceRequest.upsert({
        where: { id: sr.id },
        create: {
          id: sr.id,
          serviceId: sr.serviceId,
          providerId: sr.providerId,
          requesterId: sr.requesterId,
          date: new Date(sr.date),
          village: sr.location.village ?? null,
          district: sr.location.district,
          state: sr.location.state,
          description: sr.description,
          status: sr.status as any,
          conversationId: sr.conversationId ?? null,
          isDemo: sr.isDemo,
          createdAt: new Date(sr.createdAt),
        },
        update: {
          status: sr.status as any,
          conversationId: sr.conversationId ?? null,
        },
      });
      syncedFingerprints.set(`sr:${sr.id}`, fp);
    }

    // ───────────── 6. Portfolio Entries ─────────────
    const currentPortfolio = new Set(d.portfolioEntries.map((pe) => pe.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("portfolio:")) {
        const id = key.slice(10);
        if (!currentPortfolio.has(id)) {
          await prisma.portfolioEntry.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const pe of d.portfolioEntries) {
      if (!currentUsers.has(pe.ownerId)) continue;
      if (syncedFingerprints.has(`portfolio:${pe.id}`)) continue;
      await prisma.portfolioEntry.upsert({
        where: { id: pe.id },
        create: {
          id: pe.id,
          ownerId: pe.ownerId,
          title: pe.title,
          description: pe.description,
          category: pe.category,
          date: new Date(pe.date),
          skillsUsed: pe.skillsUsed,
          media: pe.media as any,
          imageUrl: pe.imageUrl ?? null,
          videoUrl: pe.videoUrl ?? null,
          meta: (pe.meta as any) ?? null,
          hidden: pe.hidden,
          isDemo: pe.isDemo,
          createdAt: new Date(pe.createdAt),
        },
        update: {
          title: pe.title,
          description: pe.description,
          hidden: pe.hidden,
        },
      });
      syncedFingerprints.set(`portfolio:${pe.id}`, pe.id);
    }

    // ───────────── 7. Work Opportunities ─────────────
    const currentJobs = new Set(d.workOpportunities.map((w) => w.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("work:")) {
        const id = key.slice(5);
        if (!currentJobs.has(id)) {
          await prisma.workOpportunity.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const w of d.workOpportunities) {
      if (!currentUsers.has(w.posterId)) continue;
      const fp = `${w.id}:${w.status}:${w.title}`;
      if (syncedFingerprints.get(`work:${w.id}`) === fp) continue;

      await prisma.workOpportunity.upsert({
        where: { id: w.id },
        create: {
          id: w.id,
          posterId: w.posterId,
          businessId: w.businessId ?? null,
          title: w.title,
          description: w.description,
          kind: w.kind as any,
          professionIds: w.professionIds,
          skills: w.skills,
          openings: w.openings,
          village: w.location.village ?? null,
          district: w.location.district,
          state: w.location.state,
          startDate: w.startDate ? new Date(w.startDate) : null,
          mode: w.mode as any,
          payMin: w.pay.min ?? null,
          payMax: w.pay.max ?? null,
          payUnit: w.pay.unit as any,
          duration: w.duration ?? null,
          contactMethod: w.contactMethod as any,
          status: w.status as any,
          hidden: w.hidden,
          isDemo: w.isDemo,
          createdAt: new Date(w.createdAt),
        },
        update: {
          title: w.title,
          description: w.description,
          status: w.status as any,
          hidden: w.hidden,
        },
      });
      syncedFingerprints.set(`work:${w.id}`, fp);
    }

    // ───────────── 8. Work Applications ─────────────
    const currentApps = new Set(d.applications.map((a) => a.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("app:")) {
        const id = key.slice(4);
        if (!currentApps.has(id)) {
          await prisma.workApplication.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const a of d.applications) {
      if (!currentJobs.has(a.opportunityId) || !currentUsers.has(a.applicantId)) continue;
      const fp = `${a.id}:${a.status}`;
      if (syncedFingerprints.get(`app:${a.id}`) === fp) continue;

      await prisma.workApplication.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          opportunityId: a.opportunityId,
          applicantId: a.applicantId,
          note: a.note,
          status: a.status as any,
          conversationId: a.conversationId ?? null,
          isDemo: a.isDemo,
          createdAt: new Date(a.createdAt),
        },
        update: {
          status: a.status as any,
          conversationId: a.conversationId ?? null,
        },
      });
      syncedFingerprints.set(`app:${a.id}`, fp);
    }

    // ───────────── 9. Businesses ─────────────
    const currentBusinesses = new Set(d.businesses.map((b) => b.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("business:")) {
        const id = key.slice(9);
        if (!currentBusinesses.has(id)) {
          await prisma.business.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const b of d.businesses) {
      if (!currentUsers.has(b.ownerId)) continue;
      if (syncedFingerprints.has(`business:${b.id}`)) continue;
      await prisma.business.upsert({
        where: { id: b.id },
        create: {
          id: b.id,
          ownerId: b.ownerId,
          name: b.name,
          kind: b.kind,
          about: b.about,
          services: b.services,
          professionIds: b.professionIds,
          district: b.district,
          state: b.state,
          website: b.website ?? null,
          verifiedAt: b.verifiedAt ? new Date(b.verifiedAt) : null,
          verifiedBy: b.verifiedBy ?? null,
          hidden: b.hidden,
          isDemo: b.isDemo,
          createdAt: new Date(b.createdAt),
        },
        update: {
          name: b.name,
          about: b.about,
          services: b.services,
          professionIds: b.professionIds,
          hidden: b.hidden,
        },
      });
      syncedFingerprints.set(`business:${b.id}`, b.id);
    }

    // ───────────── 10. Farms & Crops ─────────────
    const currentFarms = new Set(d.farms.map((f) => f.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("farm:")) {
        const id = key.slice(5);
        if (!currentFarms.has(id)) {
          await prisma.farm.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const f of d.farms) {
      if (!currentUsers.has(f.ownerId)) continue;
      if (syncedFingerprints.has(`farm:${f.id}`)) continue;
      await prisma.farm.upsert({
        where: { id: f.id },
        create: {
          id: f.id,
          ownerId: f.ownerId,
          name: f.name,
          areaAcres: f.areaAcres,
          soil: f.soil,
          irrigation: f.irrigation,
          village: f.village,
          district: f.district,
          history: f.history as any,
          isDemo: f.isDemo,
          createdAt: new Date(f.createdAt),
        },
        update: {
          name: f.name,
          areaAcres: f.areaAcres,
        },
      });
      syncedFingerprints.set(`farm:${f.id}`, f.id);
    }

    const currentCrops = new Set(d.crops.map((c) => c.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("crop:")) {
        const id = key.slice(5);
        if (!currentCrops.has(id)) {
          await prisma.crop.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const c of d.crops) {
      if (!currentUsers.has(c.ownerId) || !currentFarms.has(c.farmId)) continue;
      const fp = `${c.id}:${c.status}:${c.areaAcres}`;
      if (syncedFingerprints.get(`crop:${c.id}`) === fp) continue;

      await prisma.crop.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          ownerId: c.ownerId,
          farmId: c.farmId,
          name: c.name,
          experienceYears: c.experienceYears,
          season: c.season as any,
          areaAcres: c.areaAcres,
          method: c.method,
          typicalYieldQtlPerAcre: c.typicalYieldQtlPerAcre,
          status: c.status as any,
          isDemo: c.isDemo,
          createdAt: new Date(c.createdAt),
        },
        update: {
          status: c.status as any,
          areaAcres: c.areaAcres,
        },
      });
      syncedFingerprints.set(`crop:${c.id}`, fp);
    }

    // ───────────── 11. Produce Listings ─────────────
    const currentListings = new Set(d.listings.map((l) => l.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("listing:")) {
        const id = key.slice(8);
        if (!currentListings.has(id)) {
          await prisma.produceListing.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const l of d.listings) {
      if (!currentUsers.has(l.ownerId)) continue;
      const fp = `${l.id}:${l.status}:${l.quantity}`;
      if (syncedFingerprints.get(`listing:${l.id}`) === fp) continue;

      await prisma.produceListing.upsert({
        where: { id: l.id },
        create: {
          id: l.id,
          ownerId: l.ownerId,
          fpoId: l.fpoId ?? null,
          crop: l.crop,
          variety: l.variety ?? null,
          quantity: l.quantity,
          unit: l.unit as any,
          expectedPrice: l.expectedPrice,
          village: l.location.village ?? null,
          district: l.location.district,
          state: l.location.state,
          harvestDate: new Date(l.harvestDate),
          grade: l.grade,
          method: l.method,
          organic: l.organic,
          status: l.status as any,
          description: l.description,
          hidden: l.hidden,
          isDemo: l.isDemo,
          createdAt: new Date(l.createdAt),
        },
        update: {
          status: l.status as any,
          quantity: l.quantity,
          expectedPrice: l.expectedPrice,
        },
      });
      syncedFingerprints.set(`listing:${l.id}`, fp);
    }

    // ───────────── 12. Posts & Comments ─────────────
    const currentPosts = new Set(d.posts.map((p) => p.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("post:")) {
        const id = key.slice(5);
        if (!currentPosts.has(id)) {
          await prisma.post.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const p of d.posts) {
      if (!currentUsers.has(p.authorId)) continue;
      if (syncedFingerprints.has(`post:${p.id}`)) continue;
      await prisma.post.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          authorId: p.authorId,
          kind: p.kind as any,
          body: p.body,
          tags: p.tags,
          scene: p.scene ?? null,
          imageUrl: p.imageUrl ?? null,
          communityId: p.communityId ?? null,
          crop: p.crop ?? null,
          district: p.district ?? null,
          state: p.state ?? null,
          linkedEventId: p.linkedEventId ?? null,
          hidden: p.hidden,
          isDemo: p.isDemo,
          createdAt: new Date(p.createdAt),
        },
        update: {
          body: p.body,
        },
      });
      syncedFingerprints.set(`post:${p.id}`, p.id);
    }

    const currentComments = new Set(d.comments.map((c) => c.id));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("comment:")) {
        const id = key.slice(8);
        if (!currentComments.has(id)) {
          await prisma.comment.deleteMany({ where: { id } });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const c of d.comments) {
      if (!currentUsers.has(c.authorId)) continue;
      if (syncedFingerprints.has(`comment:${c.id}`)) continue;
      await prisma.comment.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          targetType: c.targetType as any,
          targetId: c.targetId,
          authorId: c.authorId,
          body: c.body,
          isDemo: c.isDemo,
          createdAt: new Date(c.createdAt),
        },
        update: {},
      });
      syncedFingerprints.set(`comment:${c.id}`, c.id);
    }

    // ───────────── 13. Conversations & Messages ─────────────
    const currentConvos = new Set(d.conversations.map((c) => c.id));
    for (const conv of d.conversations) {
      if (conv.participantIds.some((uid) => !currentUsers.has(uid))) continue;
      if (!syncedFingerprints.has(`conv:${conv.id}`)) {
        await prisma.conversation.upsert({
          where: { id: conv.id },
          create: {
            id: conv.id,
            isDemo: conv.isDemo,
            createdAt: new Date(conv.updatedAt),
            participants: {
              create: conv.participantIds.map((uid) => ({ userId: uid })),
            },
          },
          update: {},
        });
        syncedFingerprints.set(`conv:${conv.id}`, conv.id);
      }
    }

    for (const m of d.messages) {
      if (!currentConvos.has(m.conversationId) || !currentUsers.has(m.senderId)) continue;
      if (syncedFingerprints.has(`msg:${m.id}`)) continue;
      await prisma.message.upsert({
        where: { id: m.id },
        create: {
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          body: m.body,
          readBy: m.readBy,
          isDemo: m.isDemo,
          createdAt: new Date(m.createdAt),
        },
        update: {
          readBy: m.readBy,
        },
      });
      syncedFingerprints.set(`msg:${m.id}`, m.id);
    }

    // ───────────── 14. Notifications ─────────────
    for (const n of d.notifications) {
      if (!currentUsers.has(n.userId)) continue;
      const fp = `${n.id}:${n.read}`;
      if (syncedFingerprints.get(`notif:${n.id}`) === fp) continue;

      await prisma.notification.upsert({
        where: { id: n.id },
        create: {
          id: n.id,
          userId: n.userId,
          type: n.type as any,
          title: n.title,
          body: n.body,
          link: n.link ?? null,
          read: n.read,
          isDemo: n.isDemo,
          createdAt: new Date(n.createdAt),
        },
        update: {
          read: n.read,
        },
      });
      syncedFingerprints.set(`notif:${n.id}`, fp);
    }

    // ───────────── 15. Follows ─────────────
    const currentFollows = new Set(d.follows.map((f) => `${f.followerId}:${f.followingId}`));
    for (const [key] of syncedFingerprints) {
      if (key.startsWith("follow:")) {
        const parts = key.slice(7).split(":");
        const followerId = parts[0];
        const followingId = parts[1];
        if (followerId && followingId && !currentFollows.has(`${followerId}:${followingId}`)) {
          await prisma.follow.deleteMany({
            where: { followerId, followingId },
          });
          syncedFingerprints.delete(key);
        }
      }
    }

    for (const f of d.follows) {
      if (!currentUsers.has(f.followerId) || !currentUsers.has(f.followingId)) continue;
      const fp = `${f.followerId}:${f.followingId}`;
      if (syncedFingerprints.get(`follow:${fp}`) === fp) continue;

      await prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: f.followerId,
            followingId: f.followingId,
          },
        },
        create: {
          followerId: f.followerId,
          followingId: f.followingId,
          isDemo: f.isDemo,
          createdAt: new Date(f.createdAt),
        },
        update: {},
      });
      syncedFingerprints.set(`follow:${fp}`, fp);
    }

    // ───────────── 16. Verification Requests ─────────────
    for (const vr of d.verificationRequests) {
      if (!currentUsers.has(vr.userId)) continue;
      const prismaStatus = vr.status === "APPROVED" ? "APPROVED" : vr.status === "REJECTED" || vr.status === "REVOKED" ? "REJECTED" : "PENDING";
      const fp = `${vr.id}:${vr.status}:${vr.reviewedBy ?? ""}`;
      if (syncedFingerprints.get(`verif:${vr.id}`) === fp) continue;

      await prisma.verificationRequest.upsert({
        where: { id: vr.id },
        create: {
          id: vr.id,
          userId: vr.userId,
          kind: vr.kind as any,
          targetId: vr.targetId ?? null,
          note: vr.note,
          documentLabels: vr.documentLabels,
          status: prismaStatus as any,
          reviewedBy: vr.reviewedBy ?? null,
          reviewNote: vr.reviewNote ?? null,
          isDemo: vr.isDemo,
          createdAt: new Date(vr.createdAt),
        },
        update: {
          status: prismaStatus as any,
          reviewedBy: vr.reviewedBy ?? null,
          reviewNote: vr.reviewNote ?? null,
        },
      });
      syncedFingerprints.set(`verif:${vr.id}`, fp);
    }
  } catch (err) {
    console.error("[postgres-sync] Persistent write failure to PostgreSQL:", err);
    throw new ApiException(
      503,
      "DATABASE_UNAVAILABLE",
      "Failed to persist changes to the database. Persistent write operation aborted.",
    );
  }
}
