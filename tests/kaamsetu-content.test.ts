import { beforeEach, describe, expect, it } from "vitest";
import type { CourseCardDTO, OpportunityDTO, SchemeDTO, SearchResultsDTO } from "@/types/dto";
import { buildDemoDb } from "@/server/seed";
import { detectIntent } from "@/lib/intents";
import { call, fresh } from "./helpers";

beforeEach(() => {
  fresh();
});

describe("global search covers every kind of professional", () => {
  it("finds an electrician, their service and a business by natural words", async () => {
    const r = await call<SearchResultsDTO>("GET", "/search?q=electrician", { as: "u_ramesh" });
    expect(r.status).toBe(200);
    expect(r.data.professionals.some((p) => p.user.id === "u_p_anil")).toBe(true);
    expect(r.data.counts.professionals).toBeGreaterThan(0);

    const wiring = await call<SearchResultsDTO>("GET", "/search?q=wiring", { as: "u_ramesh" });
    expect(wiring.data.services.length).toBeGreaterThan(0);

    const hiring = await call<SearchResultsDTO>("GET", "/search?q=apprentice", { as: "u_p_anil" });
    expect(hiring.data.opportunities.length).toBeGreaterThan(0);
  });

  it("keeps farmers in `farmers` and does not repeat them under `professionals`", async () => {
    const r = await call<SearchResultsDTO>("GET", "/search?q=mustard", { as: "u_p_anil" });
    expect(r.data.farmers.length).toBeGreaterThan(0);
    const farmerIds = new Set(r.data.farmers.map((f) => f.user.id));
    expect(r.data.professionals.some((p) => farmerIds.has(p.user.id))).toBe(false);
  });
});

describe("opportunities are profession-aware", () => {
  it("an electrician sees work and skill programmes, not farm-only items", async () => {
    const r = await call<OpportunityDTO[]>("GET", "/opportunities", { as: "u_p_anil" });
    expect(r.status).toBe(200);
    const kinds = new Set(r.data.map((o) => o.kind));
    expect(kinds.has("WORK")).toBe(true);
    for (const farmOnly of ["BUYER_REQUIREMENT", "MACHINERY", "FPO", "PRODUCE"] as const) expect(kinds.has(farmOnly)).toBe(false);
    const ids = r.data.map((o) => o.id);
    expect(ids).toContain("sch_s_skill_trades");
    expect(ids).not.toContain("sch_s_microirrigation");
    expect(ids).not.toContain("crs_crs_mustard");
    expect(r.data.some((o) => o.id === "crs_crs_pro_electric")).toBe(true);
  });

  it("a farmer keeps the original farming feed", async () => {
    const r = await call<OpportunityDTO[]>("GET", "/opportunities", { as: "u_ramesh" });
    const ids = r.data.map((o) => o.id);
    expect(ids).toContain("sch_s_microirrigation");
    expect(ids.some((i) => i.startsWith("req_"))).toBe(true);
    expect(ids).not.toContain("crs_crs_pro_electric");
    expect(ids).not.toContain("sch_s_skill_trades");
  });
});

describe("government hub is broader than agriculture, and honest about it", () => {
  it("filters by topic and by the signed-in user's profession", async () => {
    const emp = await call<SchemeDTO[]>("GET", "/schemes?topic=Employment", { as: "u_p_anil" });
    expect(emp.data.map((s) => s.id)).toContain("s_employment");
    expect(emp.data.every((s) => s.topic === "Employment")).toBe(true);

    const mine = await call<SchemeDTO[]>("GET", "/schemes?for=me", { as: "u_p_anil" });
    const ids = mine.data.map((s) => s.id);
    expect(ids).toContain("s_skill_trades");
    expect(ids).toContain("s_welfare");
    expect(ids).not.toContain("s_microirrigation");
    expect(ids).not.toContain("s_artisan"); // artisan-only entry

    const potter = await call<SchemeDTO[]>("GET", "/schemes?for=me", { as: "u_p_gopal" });
    expect(potter.data.map((s) => s.id)).toContain("s_artisan");

    const farmer = await call<SchemeDTO[]>("GET", "/schemes?for=me", { as: "u_ramesh" });
    expect(farmer.data.map((s) => s.id)).toContain("s_microirrigation");
    expect(farmer.data.map((s) => s.id)).not.toContain("s_skill_trades");
  });

  it("every new government entry is labelled DEMO and points at a placeholder source", async () => {
    const all = await call<SchemeDTO[]>("GET", "/schemes?topic=Skill%20development", { as: "u_p_anil" });
    expect(all.data.length).toBeGreaterThan(0);
    for (const s of all.data) {
      expect(s.isDemo).toBe(true);
      expect(s.name).toContain("[DEMO]");
      expect(s.officialSource).toContain("example.org");
      expect(s.org.name).toContain("Demo");
    }
  });

  it("the original agriculture entries default to the Agriculture topic and audience", async () => {
    const r = await call<SchemeDTO>("GET", "/schemes/s_microirrigation", { as: "u_ramesh" });
    expect(r.data.topic).toBe("Agriculture");
    expect(r.data.audience).toEqual(["AGRICULTURE"]);
  });
});

describe("learning is profession-aware", () => {
  it("returns profession courses, and general ones for everyone", async () => {
    const e = await call<CourseCardDTO[]>("GET", "/courses?for=me", { as: "u_p_anil" });
    const ids = e.data.map((c) => c.id);
    expect(ids).toContain("crs_pro_electric");
    expect(ids).toContain("crs_pro_business"); // tagged ALL
    expect(ids).not.toContain("crs_mustard");

    const f = await call<CourseCardDTO[]>("GET", "/courses?for=me", { as: "u_ramesh" });
    expect(f.data.map((c) => c.id)).toContain("crs_mustard");
    expect(f.data.map((c) => c.id)).not.toContain("crs_pro_electric");

    const byProf = await call<CourseCardDTO[]>("GET", "/courses?profession=pr_tailor", { as: "u_ramesh" });
    expect(byProf.data.map((c) => c.id)).toEqual(expect.arrayContaining(["crs_pro_tailoring", "crs_pro_business"]));
  });
});

describe("demo seed", () => {
  it("is idempotent across resets (no duplicated rows in shared seed arrays)", () => {
    const a = buildDemoDb();
    const b = buildDemoDb();
    for (const k of ["posts", "reels", "communities", "schemes", "events", "courses", "courseModules", "conversations", "messages", "follows"] as const) {
      expect(b[k].length).toBe(a[k].length);
      expect(new Set(b[k].map((x: { id?: string }) => x.id)).size).toBe(new Set(a[k].map((x: { id?: string }) => x.id)).size);
    }
  });

  it("adds profession communities and skill events with demo flags", () => {
    const d = buildDemoDb();
    expect(d.communities.filter((c) => c.kind === "PROFESSION").length).toBeGreaterThanOrEqual(8);
    expect(d.events.filter((e) => ["Skill Camp", "Job Fair", "Trade Meetup"].includes(e.category)).every((e) => e.isDemo)).toBe(true);
    expect(d.reels.some((r) => r.category === "Workplace Safety")).toBe(true);
  });
});

describe("assistant & voice intents understand professions (Hindi / Hinglish / English)", () => {
  it("routes find-a-professional requests with the profession and place", () => {
    const a = detectIntent("Churu mein electrician chahiye");
    expect(a.id).toBe("FIND_PROFESSIONAL");
    expect(a.profession).toBe("Electrician");
    expect(decodeURIComponent(a.href)).toContain("Electrician near Churu");
    expect(detectIntent("मुझे बढ़ई चाहिए").id).toBe("FIND_PROFESSIONAL");
    expect(detectIntent("need a plumber near me").profession).toBe("Plumber");
  });

  it("routes work search, posting work, profile and service creation", () => {
    expect(detectIntent("kaam chahiye").id).toBe("FIND_WORK");
    expect(detectIntent("मुझे काम चाहिए").id).toBe("FIND_WORK");
    expect(detectIntent("find work near me").id).toBe("FIND_WORK");
    expect(detectIntent("3 majdoor chahiye kal ke liye").id).toBe("POST_WORK");
    expect(detectIntent("post a job for a carpenter").id).toBe("POST_WORK");
    expect(detectIntent("professional profile banao").id).toBe("CREATE_PROFILE");
    expect(detectIntent("add my service").id).toBe("ADD_SERVICE");
  });

  it("does not break the existing farming routes", () => {
    expect(detectIntent("sarson mein peele keede lage hain").id).toBe("CROP_PROBLEM");
    expect(detectIntent("kisan yojana subsidy").id).toBe("SCHEMES");
    expect(detectIntent("mera tractor kharab hai").id).not.toBe("FIND_PROFESSIONAL");
  });

  it("does not mistake words that merely contain a crop or pest keyword (programmes, training)", () => {
    // Regression: "programmes" contains "gram" (chickpea) and "rog"; "training" contains "rain" (weather).
    expect(detectIntent("Government programmes").id).toBe("SCHEMES");
    expect(detectIntent("Government programmes").crop).toBeUndefined();
    expect(detectIntent("Skill training").id).toBe("LEARN");
    expect(detectIntent("Skill development scheme").id).toBe("SCHEMES");
    expect(detectIntent("Training camp on Sunday").id).toBe("EVENTS");
    expect(detectIntent("Find professionals").id).toBe("FIND_PROFESSIONAL");
    expect(detectIntent("Find professionals").href).toBe("/professionals");
    expect(detectIntent("My service requests").id).toBe("MY_WORK");
    // …while real crop words still work
    expect(detectIntent("mere paas 50 quintal gram").crop).toBe("Chickpea");
    expect(detectIntent("rain tomorrow").id).toBe("WEATHER");
  });

  it("the assistant answers a professional using their own profession and never invents payments", async () => {
    const r = await call<{ reply: { content: string; actions: { href: string }[] } }>("POST", "/ai/chat", { as: "u_p_anil", body: { message: "kaam chahiye" } });
    expect(r.status).toBe(200);
    expect(r.data.reply.content).toContain("Electrician");
    expect(r.data.reply.content.toLowerCase()).toContain("never pay");
    expect(r.data.reply.actions[0]!.href).toContain("/opportunities");

    const home = await call<{ reply: { content: string } }>("POST", "/ai/chat", { as: "u_p_anil", body: { message: "hello" } });
    expect(home.data.reply.content).toContain("Electrician");
    expect(home.data.reply.content).not.toMatch(/crop questions/i);
  });
});

describe("feed relevance", () => {
  it("ranks crop-tagged posts below trade posts for a non-farm professional, but does not hide them", async () => {
    const r = await call<{ items: { id: string; crop?: string }[] }>("GET", "/feed?limit=40", { as: "u_p_anil" });
    expect(r.status).toBe(200);
    const items = r.data.items;
    const firstCrop = items.findIndex((p) => p.crop);
    const lastNonCrop = items.map((p) => !p.crop).lastIndexOf(true);
    expect(items.length).toBeGreaterThan(0);
    if (firstCrop >= 0) expect(firstCrop).toBeGreaterThan(2);
    expect(lastNonCrop).toBeGreaterThanOrEqual(0);
  });
});
