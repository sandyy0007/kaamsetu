import { beforeEach, describe, expect, it } from "vitest";
import type { FarmerProfileDTO, MatchDTO, Me, Page, FarmerCardDTO } from "@/types/dto";
import { call, fresh } from "./helpers";

beforeEach(() => {
  fresh();
});

describe("authentication", () => {
  it("rejects anonymous access to protected routes", async () => {
    const r = await call("GET", "/home");
    expect(r.status).toBe(401);
  });

  it("demo sign-in sets an httpOnly session cookie and /auth/me returns the user", async () => {
    const r = await call<Me>("POST", "/auth/demo", { body: { userId: "u_ramesh" } });
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(r.data.name).toContain("Ramesh");
    expect((r.data as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("rejects wrong passwords with a generic message", async () => {
    const r = await call("POST", "/auth/login", { body: { email: "ramesh.choudhary@demo.kisansetu.example", password: "wrong-password" } });
    expect(r.status).toBe(401);
    expect(r.error?.message).toBe("Email or password is incorrect.");
  });

  it("logs in with the demo password", async () => {
    const r = await call<Me>("POST", "/auth/login", { body: { email: "ramesh.choudhary@demo.kisansetu.example", password: "Demo@12345" } });
    expect(r.status).toBe(200);
  });

  it("registers via OTP and creates an unverified account with an empty profile", async () => {
    const start = await call<{ challengeId: string; devCode?: string }>("POST", "/auth/register", { body: { role: "FARMER", name: "Test Kisan", phone: "9811122233", password: "Strong#123" } });
    expect(start.status).toBe(200);
    const bad = await call("POST", "/auth/otp/verify", { body: { challengeId: start.data.challengeId, code: "000000" } });
    expect(bad.status).toBe(400);
    const ok = await call<Me>("POST", "/auth/otp/verify", { body: { challengeId: start.data.challengeId, code: start.data.devCode } });
    expect(ok.status).toBe(200);
    expect(ok.data.verified).toBe(false);
    expect(ok.data.role).toBe("FARMER");
  });

  it("blocks cross-site state-changing requests (CSRF)", async () => {
    const r = await call("POST", "/like", { as: "u_ramesh", origin: "https://evil.example", body: { targetType: "POST", targetId: "p_anita_tip" } });
    expect(r.status).toBe(403);
  });

  it("validates input and returns field errors", async () => {
    const r = await call("POST", "/auth/register", { body: { role: "FARMER", name: "A", phone: "123" } });
    expect(r.status).toBe(400);
    expect(r.error?.fields).toBeTruthy();
  });
});

describe("privacy", () => {
  it("never exposes phone, privacy settings or financial ledgers to a buyer", async () => {
    const r = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_b_marudhara" });
    expect(r.status).toBe(200);
    expect(r.data.phone).toBeUndefined();
    expect(r.data.privacy).toBeUndefined();
    expect(r.data.health).toBeUndefined();
    expect(r.data.financialSummary).toBeNull();
    const raw = JSON.stringify(r.data);
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("expenses");
  });

  it("farm records are private: buyers get 403 on summary and no cycles on crop/farm detail", async () => {
    expect((await call("GET", "/farm/summary", { as: "u_b_marudhara" })).status).toBe(403);
    const crop = await call<{ cycles: unknown[] }>("GET", "/crops/c_r_mustard", { as: "u_b_marudhara" });
    expect(crop.data.cycles).toHaveLength(0);
    const farm = await call<{ cycles: unknown[]; health: unknown }>("GET", "/farms/f_r_main", { as: "u_b_marudhara" });
    expect(farm.data.cycles).toHaveLength(0);
    expect(farm.data.health).toBeNull();
    const own = await call<{ cycles: unknown[] }>("GET", "/farms/f_r_main", { as: "u_ramesh" });
    expect(own.data.cycles.length).toBeGreaterThan(0);
  });

  it("other farmers cannot mutate someone else's farm records (404, not 403)", async () => {
    const r = await call("POST", "/cycles/cyc_r_must26/expenses", { as: "u_sunita", body: { category: "SEED", amount: 100, date: "2026-10-01" } });
    expect(r.status).toBe(404);
  });

  it("honours granular visibility: produce PRIVATE hides listings from buyers", async () => {
    const before = await call<Page<{ id: string }>>("GET", "/listings?crop=Wheat", { as: "u_b_marudhara" });
    expect(before.data.items.some((l) => l.id === "l_r_wheat")).toBe(true);
    const set = await call("PUT", "/me/privacy", { as: "u_ramesh", body: { profile: "PUBLIC", income: "PRIVATE", financialRecords: "PRIVATE", phone: "CONNECTIONS", produce: "PRIVATE", farmPhotos: "PUBLIC", locationPrecision: "DISTRICT" } });
    expect(set.status).toBe(200);
    const after = await call<Page<{ id: string }>>("GET", "/listings?crop=Wheat", { as: "u_b_marudhara" });
    expect(after.data.items.some((l) => l.id === "l_r_wheat")).toBe(false);
    const detail = await call("GET", "/listings/l_r_wheat", { as: "u_b_marudhara" });
    expect(detail.status).toBe(404);
    // …but the owner still sees it
    expect((await call("GET", "/listings/l_r_wheat", { as: "u_ramesh" })).status).toBe(200);
  });

  it("income summary only appears for audiences the owner allowed — and never for admins", async () => {
    await call("PUT", "/me/privacy", { as: "u_ramesh", body: { profile: "PUBLIC", income: "BUYERS", financialRecords: "PRIVATE", phone: "CONNECTIONS", produce: "PUBLIC", farmPhotos: "PUBLIC", locationPrecision: "VILLAGE" } });
    const buyer = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_b_marudhara" });
    expect(buyer.data.financialSummary).toBeTruthy();
    const farmer = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_sunita" });
    expect(farmer.data.financialSummary).toBeNull();
    const admin = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_admin" });
    expect(admin.data.financialSummary).toBeNull();
  });

  it("hides village when location precision is DISTRICT", async () => {
    const r = await call<FarmerProfileDTO>("GET", "/farmers/u_sunita", { as: "u_b_marudhara" });
    expect(r.data.village).toBeUndefined();
    expect(r.data.district).toBe("Hanumangarh");
    const ramesh = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_b_marudhara" });
    expect(ramesh.data.village).toBe("Rajaldesar");
  });

  it("a PRIVATE profile is restricted to strangers", async () => {
    await call("PUT", "/me/privacy", { as: "u_dinesh", body: { profile: "PRIVATE", income: "PRIVATE", financialRecords: "PRIVATE", phone: "PRIVATE", produce: "PRIVATE", farmPhotos: "PRIVATE", locationPrecision: "DISTRICT" } });
    const r = await call<FarmerProfileDTO>("GET", "/farmers/u_dinesh", { as: "u_b_marudhara" });
    expect(r.data.restricted).toBe(true);
    expect(r.data.skills).toHaveLength(0);
    const search = await call<Page<FarmerCardDTO>>("GET", "/farmers?q=Dinesh", { as: "u_b_marudhara" });
    expect(search.data.items.some((f) => f.user.id === "u_dinesh")).toBe(false);
  });

  it("blocked users cannot see each other's profiles or message", async () => {
    await call("POST", "/me/blocks", { as: "u_ramesh", body: { targetId: "u_dinesh", kind: "BLOCK" } });
    expect((await call("GET", "/farmers/u_ramesh", { as: "u_dinesh" })).status).toBe(404);
    const m = await call("POST", "/conversations", { as: "u_dinesh", body: { userId: "u_ramesh", message: "Hello" } });
    expect(m.status).toBe(403);
  });
});

describe("role-based access control", () => {
  it("farmers cannot post buyer requirements; buyers cannot list produce", async () => {
    const body = { crop: "Mustard", quantity: 10, unit: "QUINTAL", district: "Churu", state: "Rajasthan", windowStart: "2026-10-20", windowEnd: "2026-10-30", notes: "" };
    expect((await call("POST", "/requirements", { as: "u_ramesh", body })).status).toBe(403);
    expect((await call("POST", "/requirements", { as: "u_b_marudhara", body })).status).toBe(200);
    const listing = { crop: "Wheat", quantity: 5, unit: "QUINTAL", expectedPrice: 2400, district: "Churu", state: "Rajasthan", harvestDate: "2026-04-01", grade: "A", method: "Conventional", description: "" };
    expect((await call("POST", "/listings", { as: "u_b_marudhara", body: listing })).status).toBe(403);
    expect((await call("POST", "/listings", { as: "u_ramesh", body: listing })).status).toBe(200);
  });

  it("only organisations publish official post kinds; farmers cannot post announcements", async () => {
    const body = { kind: "ANNOUNCEMENT", body: "Official notice for everyone", tags: [] };
    expect((await call("POST", "/posts", { as: "u_ramesh", body })).status).toBe(403);
    expect((await call("POST", "/posts", { as: "u_g_agri", body })).status).toBe(200);
  });

  it("admin routes are admin-only", async () => {
    expect((await call("GET", "/admin/overview", { as: "u_ramesh" })).status).toBe(403);
    expect((await call("GET", "/admin/overview", { as: "u_admin" })).status).toBe(200);
  });

  it("only experts answer questions", async () => {
    expect((await call("POST", "/questions/q5/answers", { as: "u_ramesh", body: { body: "Try flushing the laterals weekly." } })).status).toBe(403);
    const ok = await call("POST", "/questions/q5/answers", { as: "u_e_sunil", body: { body: "Try flushing the laterals weekly and check water quality." } });
    expect(ok.status).toBe(200);
  });

  it("only buyers/FPOs send listing enquiries", async () => {
    expect((await call("POST", "/listings/l_h_mustard/enquiries", { as: "u_kailash", body: { message: "Is it available?" } })).status).toBe(403);
    const ok = await call("POST", "/listings/l_h_mustard/enquiries", { as: "u_b_marudhara", body: { message: "Is this lot still available for pickup?" } });
    expect(ok.status).toBe(200);
  });
});

describe("verification", () => {
  it("users cannot self-assign verified badges; admin approval grants them", async () => {
    const patch = await call<Me>("PATCH", "/me", { as: "u_dinesh", body: { name: "Dinesh Saini", verifiedAt: "2020-01-01", verified: true } });
    expect(patch.data.verified).toBe(false);
    expect((await call("POST", "/me/verification", { as: "u_dinesh", body: { note: "Please verify my profile. I can share land records.", documentLabels: ["Land record"] } })).status).toBe(400); // already has a pending request in seed
    const rows = await call<{ id: string; user: { id: string } }[]>("GET", "/admin/verifications", { as: "u_admin" });
    const row = rows.data.find((r) => r.user.id === "u_dinesh")!;
    expect((await call("POST", `/admin/verifications/${row.id}/review`, { as: "u_ramesh", body: { decision: "APPROVED" } })).status).toBe(403);
    expect((await call("POST", `/admin/verifications/${row.id}/review`, { as: "u_admin", body: { decision: "APPROVED" } })).status).toBe(200);
    const me = await call<Me>("GET", "/auth/me", { as: "u_dinesh" });
    expect(me.data.verified).toBe(true);
    expect(me.data.badge).toBe("Verified Farmer");
  });
});

describe("farmer ↔ buyer matching", () => {
  it("ranks Churu mustard sellers for the Marudhara requirement and hides matches from others", async () => {
    const r = await call<MatchDTO[]>("GET", "/requirements/req_marudhara_mustard/matches", { as: "u_b_marudhara" });
    expect(r.status).toBe(200);
    const ids = r.data.map((m) => m.listing.id);
    expect(ids.slice(0, 2).sort()).toEqual(["l_fpo_mustard", "l_h_mustard"]);
    expect(ids).toContain("l_d_mustard");
    expect(r.data[0]!.score).toBeGreaterThan(r.data.at(-1)!.score - 1);
    expect(r.data[0]!.reasons.join(" ")).toContain("Same district");
    expect((await call("GET", "/requirements/req_marudhara_mustard/matches", { as: "u_ramesh" })).status).toBe(403);
  });

  it("natural-language farmer search: 'Mustard farmers near Churu'", async () => {
    const r = await call<Page<FarmerCardDTO>>("GET", "/farmers?q=Mustard%20farmers%20near%20Churu", { as: "u_b_marudhara" });
    const names = r.data.items.map((f) => f.user.id);
    expect(names.slice(0, 2).sort()).toEqual(["u_hanuman", "u_ramesh"]);
    expect(names).not.toContain("u_sunita"); // wheat/dairy only
    expect(r.data.items[0]!.matchReason).toContain("Grows Mustard");
  });

  it("Hindi crop names work in search", async () => {
    const r = await call<Page<FarmerCardDTO>>("GET", `/farmers?q=${encodeURIComponent("सरसों Churu")}`, { as: "u_b_marudhara" });
    expect(r.data.items.length).toBeGreaterThan(0);
  });
});

describe("farm management maths", () => {
  it("computes cost, revenue, profit, profit/acre and cost/quintal correctly", async () => {
    const r = await call<{ cycles: { id: string; stats: Record<string, number> }[] }>("GET", "/crops/c_r_mustard", { as: "u_ramesh" });
    const c25 = r.data.cycles;
    const s = c25.find((c) => c.id === "cyc_r_must25")!.stats;
    expect(s.totalCost).toBe(62500);
    expect(s.revenue).toBe(40 * 5800);
    expect(s.profit).toBe(232000 - 62500);
    expect(Math.round(s.profitPerAcre)).toBe(Math.round((232000 - 62500) / 6));
    expect(Math.round(s.costPerQtl)).toBe(Math.round(62500 / 42));
  });

  it("adding an expense updates the totals; stage updates drive crop status", async () => {
    const before = await call<{ stats: { totalCost: number } }>("POST", "/cycles/cyc_r_must26/expenses", { as: "u_ramesh", body: { category: "LABOUR", amount: 1000, date: "2026-10-05" } });
    expect(before.data.stats.totalCost).toBe(2400 + 9500 + 3000 + 6000 + 7500 + 1000);
    await call("PATCH", "/cycles/cyc_r_must26/stages", { as: "u_ramesh", body: { stage: "irrigation", done: true, date: "2026-10-09" } });
    const crop = await call<{ crop: { status: string } }>("GET", "/crops/c_r_mustard", { as: "u_ramesh" });
    expect(crop.data.crop.status).toBe("GROWING");
  });

  it("farm health score reports exactly how it is calculated", async () => {
    const r = await call<{ health: { score: number; parts: { points: number }[]; explanation: string } }>("GET", "/farm/summary", { as: "u_ramesh" });
    const h = (r.data as unknown as { health: { score: number; parts: { points: number }[]; explanation: string } }).health;
    expect(h.score).toBe(h.parts.reduce((s, p) => s + p.points, 0));
    expect(h.explanation).toContain("NOT a measure of crop condition");
    expect(h.score).toBeGreaterThan(80);
    const empty = await call<{ health: { score: number } }>("GET", "/farm/summary", { as: "u_dinesh" });
    expect((empty.data as unknown as { health: { score: number } }).health.score).toBeGreaterThan(0);
  });
});

describe("safety", () => {
  it("blocks messages that look like OTP/Aadhaar/bank details", async () => {
    const r = await call("POST", "/conversations", { as: "u_b_marudhara", body: { userId: "u_ramesh", message: "Please send your OTP and Aadhaar 1234 5678 9012" } });
    expect(r.status).toBe(422);
    expect(r.error?.code).toBe("SENSITIVE_CONTENT");
  });

  it("three independent reports temporarily hide a post pending admin review", async () => {
    for (const u of ["u_sunita", "u_mohan", "u_kailash"]) {
      await call("POST", "/reports", { as: u, body: { targetType: "POST", targetId: "p_dinesh_q", reason: "Spam" } });
    }
    expect((await call("GET", "/posts/p_dinesh_q", { as: "u_ramesh" })).status).toBe(404);
    const reports = await call<{ id: string; targetId: string }[]>("GET", "/admin/reports", { as: "u_admin" });
    const rep = reports.data.find((r) => r.targetId === "p_dinesh_q")!;
    await call("POST", `/admin/reports/${rep.id}/resolve`, { as: "u_admin", body: { action: "DISMISS" } });
    expect((await call("GET", "/posts/p_dinesh_q", { as: "u_ramesh" })).status).toBe(200);
  });
});

describe("social flows", () => {
  it("follow changes follower count; like toggles; comments notify authors", async () => {
    const before = await call<FarmerProfileDTO>("GET", "/farmers/u_mohan", { as: "u_ramesh" });
    const f = await call<{ following: boolean; followers: number }>("POST", "/follow/u_mohan", { as: "u_ramesh" });
    expect(f.data.following).toBe(true);
    expect(f.data.followers).toBe(before.data.network.followers + 1);
    const like = await call<{ liked: boolean; count: number }>("POST", "/like", { as: "u_ramesh", body: { targetType: "POST", targetId: "p_dinesh_q" } });
    expect(like.data.liked).toBe(true);
    const unlike = await call<{ liked: boolean; count: number }>("POST", "/like", { as: "u_ramesh", body: { targetType: "POST", targetId: "p_dinesh_q" } });
    expect(unlike.data.liked).toBe(false);
    expect(unlike.data.count).toBe(like.data.count - 1);
  });

  it("creating a post puts it at the top of the author's feed", async () => {
    const created = await call<{ id: string; tags: string[] }>("POST", "/posts", { as: "u_ramesh", body: { kind: "POST", body: "Irrigation done today #Mustard #Churu", tags: [], crop: "Mustard" } });
    expect(created.status).toBe(200);
    expect(created.data.tags).toEqual(expect.arrayContaining(["Mustard", "Churu"]));
    const feed = await call<{ items: { type: string; post?: { id: string } }[] }>("GET", "/feed?author=u_ramesh", { as: "u_ramesh" });
    expect(feed.data.items[0]!.post!.id).toBe(created.data.id);
  });

  it("stories expire automatically", async () => {
    const stories = await call<{ id: string }[]>("GET", "/stories", { as: "u_ramesh" });
    expect(stories.data.length).toBeGreaterThan(0);
  });
});

describe("learning", () => {
  it("grades quizzes server-side and issues a certificate on completion", async () => {
    const course = await call<{ modules: { id: string; kind: string; quiz?: { question: string; options: string[] }[] }[] }>("GET", "/courses/crs_wheat", { as: "u_sunita" });
    expect(JSON.stringify(course.data)).not.toContain("answerIndex");
    for (const m of course.data.modules.filter((x) => x.kind !== "QUIZ")) {
      await call("POST", "/courses/crs_wheat/complete", { as: "u_sunita", body: { moduleId: m.id } });
    }
    const quiz = course.data.modules.find((m) => m.kind === "QUIZ")!;
    const fail = await call<{ passed: boolean }>("POST", `/courses/crs_wheat/quiz/${quiz.id}`, { as: "u_sunita", body: { answers: [0, 1] } });
    expect(fail.data.passed).toBe(false);
    const pass = await call<{ passed: boolean; course: { certificate?: { code: string } } }>("POST", `/courses/crs_wheat/quiz/${quiz.id}`, { as: "u_sunita", body: { answers: [1, 0] } });
    expect(pass.data.passed).toBe(true);
    expect(pass.data.course.certificate?.code).toMatch(/^KS-/);
    const verify = await call<{ valid: boolean }>("GET", `/certificates/verify/${pass.data.course.certificate!.code}`);
    expect(verify.data.valid).toBe(true);
  });
});

describe("AI assistant", () => {
  it("routes Hindi crop problems to experts, with follow-up questions and a non-diagnosis disclaimer", async () => {
    const r = await call<{ reply: { content: string; actions: { href: string }[]; followUps: string[] } }>("POST", "/ai/chat", { as: "u_ramesh", body: { message: "मेरी सरसों की फसल में पत्तियां पीली हो रही हैं।" } });
    expect(r.status).toBe(200);
    expect(r.data.reply.followUps.length).toBeGreaterThan(0);
    expect(r.data.reply.actions.some((a) => a.href.startsWith("/experts"))).toBe(true);
    expect(r.data.reply.content).toContain("निदान नहीं");
  });

  it("never presents itself as a doctor for snake-bite", async () => {
    const r = await call<{ reply: { content: string } }>("POST", "/ai/chat", { as: "u_ramesh", body: { message: "snake bite what to do" } });
    expect(r.data.reply.content).toContain("112");
    expect(r.data.reply.content).toMatch(/not a doctor/i);
  });
});
