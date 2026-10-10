import { beforeEach, describe, expect, it } from "vitest";
import type { ApplicationDTO, CatalogDTO, FarmerProfileDTO, Me, MyWorkDTO, Page, ProfessionalCardDTO, ProfessionalProfileDTO, ServiceDTO, ServiceRequestDTO, WorkOpportunityDTO } from "@/types/dto";
import { createUser, registrationPayload } from "@/server/auth";
import { call, fresh } from "./helpers";

beforeEach(() => {
  fresh();
});

let phoneSeq = 9800000000;
async function register(body: Record<string, unknown>) {
  const phone = String(phoneSeq++);
  const start = await call<{ challengeId: string; devCode: string }>("POST", "/auth/register", { body: { name: "Test Person", phone, password: "Strong#123", ...body } });
  expect(start.status, JSON.stringify(start.error)).toBe(200);
  const ok = await call<Me>("POST", "/auth/otp/verify", { body: { challengeId: start.data.challengeId, code: start.data.devCode } });
  expect(ok.status).toBe(200);
  return ok.data;
}

describe("registration keeps the chosen district", () => {
  it("stores a known district (canonical spelling) on the new professional profile", async () => {
    const user = createUser(registrationPayload({ role: "PROFESSIONAL", name: "X Y", phone: "9700000002", professionId: "pr_electrician", district: "jaipur" }));
    const mine = await call<ProfessionalProfileDTO>("GET", "/professionals/me", { as: user.id });
    expect(mine.data.district).toBe("Jaipur");
  });
  it("ignores a district that is not in the known list", () => {
    expect(registrationPayload({ role: "PROFESSIONAL", name: "X Y", phone: "9700000001", professionId: "pr_electrician", district: "Atlantis" }).district).toBeUndefined();
  });
});

describe("existing farmer flow still works (Login → Farmer Profile → Farm → Crop → Produce → Marketplace)", () => {
  it("farmer logs in and keeps farms, crops, produce and market access", async () => {
    const me = await call<Me>("POST", "/auth/demo", { body: { userId: "u_ramesh" } });
    expect(me.data.role).toBe("FARMER");
    expect(me.data.profession?.name).toBe("Farmer");
    const old = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_ramesh" });
    expect(old.status).toBe(200);
    expect(old.data.farms.length).toBeGreaterThan(0);
    expect((await call("GET", "/farms", { as: "u_ramesh" })).status).toBe(200);
    expect((await call("GET", "/crops", { as: "u_ramesh" })).status).toBe(200);
    expect((await call("GET", "/listings", { as: "u_ramesh" })).status).toBe(200);
    expect((await call("GET", "/farm/summary", { as: "u_ramesh" })).status).toBe(200);
  });

  it("the universal profile of a farmer carries the full farming extension", async () => {
    const r = await call<ProfessionalProfileDTO>("GET", "/professionals/u_ramesh", { as: "u_p_anil" });
    expect(r.status).toBe(200);
    expect(r.data.profession.name).toBe("Farmer");
    expect(r.data.farmer?.farms.length).toBeGreaterThan(0);
    expect(r.data.farmer?.crops.length).toBeGreaterThan(0);
    // Same privacy as before: no phone / financials for a stranger.
    expect(r.data.phone).toBeUndefined();
    expect(r.data.farmer?.financialSummary).toBeNull();
    expect(JSON.stringify(r.data)).not.toContain("passwordHash");
  });

  it("farmers show crops and produce on discovery cards", async () => {
    const r = await call<Page<ProfessionalCardDTO>>("GET", "/professionals?profession=pr_farmer", { as: "u_p_anil" });
    expect(r.data.items.length).toBeGreaterThan(3);
    expect(r.data.items.every((c) => c.farmer)).toBe(true);
    expect(r.data.items.some((c) => c.farmer!.crops.length > 0)).toBe(true);
  });

  it("editing the farmer profile keeps the professional profile in sync, and vice-versa", async () => {
    const old = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_ramesh" });
    const patch = await call("PATCH", "/professionals/me", { as: "u_ramesh", body: { about: "Updated story from the new profile screen." } });
    expect(patch.status).toBe(200);
    const back = await call<FarmerProfileDTO>("GET", "/farmers/u_ramesh", { as: "u_ramesh" });
    expect(back.data.story).toBe("Updated story from the new profile screen.");
    expect(back.data.farms.length).toBe(old.data.farms.length);
  });
});

describe("electrician flow: Register → Electrician → Profile → Skills → Service → Portfolio → Find opportunity → Apply", () => {
  it("runs end to end", async () => {
    const cat = await call<CatalogDTO>("GET", "/catalog");
    expect(cat.data.categories.flatMap((c) => c.professions).some((p) => p.id === "pr_electrician")).toBe(true);

    const me = await register({ role: "PROFESSIONAL", professionId: "pr_electrician", name: "Test Electrician", district: "Churu" });
    expect(me.role).toBe("PROFESSIONAL");
    expect(me.profession?.id).toBe("pr_electrician");
    // No farm modules for non-farmers.
    expect((await call("GET", "/farm/summary", { as: me.id })).status).toBe(403);
    expect((await call("GET", "/farms", { as: me.id })).status).toBe(403);

    const prof = await call<ProfessionalProfileDTO>("PATCH", "/professionals/me", {
      as: me.id,
      body: {
        about: "Electrician with five years of experience in houses and shops around Churu.",
        startedYear: new Date().getFullYear() - 5,
        skills: [{ name: "House wiring", level: "EXPERT" }, { name: "MCB / DB panel", level: "INTERMEDIATE" }, { name: "Earthing", level: "INTERMEDIATE" }],
        location: { district: "Churu", state: "Rajasthan", serviceRadiusKm: 30, serviceAreas: ["Churu"] },
        availability: { status: "AVAILABLE", days: ["Mon", "Tue"], preferences: ["CONTRACT"] },
        attributes: { specialties: ["House wiring"], licence: "Yes", hacker: "<script>" },
      },
    });
    expect(prof.status, JSON.stringify(prof.error)).toBe(200);
    expect(prof.data.skills).toHaveLength(3);
    expect(prof.data.skills.every((s) => !s.verified)).toBe(true);
    expect(prof.data.attributes.hacker).toBeUndefined(); // only schema-declared attributes are stored
    expect(prof.data.experienceYears).toBe(5);

    const svc = await call<ServiceDTO>("POST", "/services", { as: me.id, body: { name: "House wiring", description: "Concealed wiring for houses with a written estimate.", priceType: "DAILY", price: 900, areas: ["Churu"], availability: "Mon–Sat" } });
    expect(svc.status, JSON.stringify(svc.error)).toBe(200);
    expect(svc.data.priceLabel).toBe("₹900 / day");

    const pf = await call("POST", "/me/portfolio", { as: me.id, body: { title: "Shop wiring", description: "Wired a 600 sq ft shop with 14 points and a DB.", category: "Installation", date: "2026-05-01", skillsUsed: ["House wiring"] } });
    expect(pf.status, JSON.stringify(pf.error)).toBe(200);

    const found = await call<Page<WorkOpportunityDTO>>("GET", "/work?profession=pr_electrician", { as: me.id });
    const wo = found.data.items.find((w) => w.id === "wo1");
    expect(wo).toBeTruthy();
    expect(wo!.viewer.matchReasons.length).toBeGreaterThan(0); // "Why am I seeing this?"
    expect(wo!.viewer.canApply).toBe(true);

    const apply = await call<WorkOpportunityDTO>("POST", "/work/wo1/apply", { as: me.id, body: { note: "I have wired several houses and can start next week." } });
    expect(apply.status, JSON.stringify(apply.error)).toBe(200);
    expect(apply.data.viewer.applied).toBe(true);
    expect((await call("POST", "/work/wo1/apply", { as: me.id, body: { note: "again" } })).status).toBe(409);

    // The poster sees the applicant, accepts, and a conversation opens.
    const apps = await call<ApplicationDTO[]>("GET", "/work/wo1/applications", { as: "u_p_ratan" });
    const mine = apps.data.find((a) => a.applicantUser.id === me.id)!;
    expect(mine.applicant?.profession.id).toBe("pr_electrician");
    const acc = await call<ApplicationDTO>("PATCH", `/work/applications/${mine.id}`, { as: "u_p_ratan", body: { status: "ACCEPTED", message: "Please come to the site on Monday." } });
    expect(acc.data.status).toBe("ACCEPTED");
    expect(acc.data.conversationId).toBeTruthy();
    const convo = await call<{ messages: { body: string }[] }>("GET", `/conversations/${acc.data.conversationId}`, { as: me.id });
    expect(convo.data.messages.some((m) => m.body.includes("Monday"))).toBe(true);
    const n = await call<{ items: { type: string }[] }>("GET", "/notifications", { as: me.id });
    expect(n.data.items.some((x) => x.type === "WORK")).toBe(true);
  });
});

describe("carpenter flow: Register → Carpenter → Portfolio → Services → Customer request → Accept → Message", () => {
  it("runs end to end with no payment step", async () => {
    const me = await register({ role: "PROFESSIONAL", professionId: "pr_carpenter", name: "Test Carpenter", district: "Sikar" });
    const svc = await call<ServiceDTO>("POST", "/services", { as: me.id, body: { name: "Door fitting", description: "Frame and shutter fitting with polish.", priceType: "FIXED", price: 1500, areas: ["Sikar"], availability: "Weekdays" } });
    await call("POST", "/me/portfolio", { as: me.id, body: { title: "Teak door", description: "Carved teak door for a two-storey house.", category: "Project", date: "2026-04-01", skillsUsed: ["Wood carving"] } });
    const prof = await call<ProfessionalProfileDTO>("GET", `/professionals/${me.id}`, { as: "u_ramesh" });
    expect(prof.data.viewer.canRequestService).toBe(true);
    expect(prof.data.portfolio).toHaveLength(1);

    const req = await call<ServiceRequestDTO>("POST", "/service-requests", { as: "u_ramesh", body: { serviceId: svc.data.id, date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), district: "Churu", description: "Need one door and one window frame at the dairy shed." } });
    expect(req.status, JSON.stringify(req.error)).toBe(200);
    expect(req.data.status).toBe("PENDING");
    expect((await call("POST", "/service-requests", { as: "u_ramesh", body: { serviceId: svc.data.id, date: "2099-01-01", district: "Churu", description: "Second request while first is open." } })).status).toBe(409);

    const notes = await call<{ items: { type: string; title: string }[] }>("GET", "/notifications", { as: me.id });
    expect(notes.data.items.some((x) => x.type === "SERVICE")).toBe(true);

    const acc = await call<ServiceRequestDTO>("PATCH", `/service-requests/${req.data.id}`, { as: me.id, body: { action: "ACCEPT" } });
    expect(acc.data.status).toBe("ACCEPTED");
    expect(acc.data.conversationId).toBeTruthy();
    const sent = await call("POST", `/conversations/${acc.data.conversationId}/messages`, { as: "u_ramesh", body: { body: "Thank you, which day can you visit?" } });
    expect(sent.status).toBe(200);

    // Completed jobs only count when both sides agree.
    await call("PATCH", `/service-requests/${req.data.id}`, { as: me.id, body: { action: "MARK_DONE" } });
    let rep = await call<ProfessionalProfileDTO>("GET", `/professionals/${me.id}`, { as: "u_ramesh" });
    expect(rep.data.reputation.completedJobs).toBe(0);
    expect((await call("PATCH", `/service-requests/${req.data.id}`, { as: me.id, body: { action: "CONFIRM_DONE" } })).status).toBe(400); // provider can't confirm own job
    await call("PATCH", `/service-requests/${req.data.id}`, { as: "u_ramesh", body: { action: "CONFIRM_DONE" } });
    rep = await call<ProfessionalProfileDTO>("GET", `/professionals/${me.id}`, { as: "u_ramesh" });
    expect(rep.data.reputation.completedJobs).toBe(1);
  });

  it("a rejected request opens no conversation", async () => {
    const r = await call<ServiceRequestDTO>("POST", "/service-requests", { as: "u_sunita", body: { serviceId: "sv_suresh_repair", date: "2099-01-01", district: "Hanumangarh", description: "Repair two almirah doors please." } });
    const rej = await call<ServiceRequestDTO>("PATCH", `/service-requests/${r.data.id}`, { as: "u_p_suresh", body: { action: "REJECT" } });
    expect(rej.data.status).toBe("REJECTED");
    expect(rej.data.conversationId).toBeUndefined();
  });
});

describe("farm worker flow: Register → Farm Worker → Skills → Availability → Find work → Apply", () => {
  it("runs end to end", async () => {
    const me = await register({ role: "PROFESSIONAL", professionId: "pr_farm_worker", name: "Test Worker", district: "Churu" });
    const p = await call<ProfessionalProfileDTO>("PATCH", "/professionals/me", {
      as: me.id,
      body: {
        skills: [{ name: "Harvesting", level: "EXPERT" }, { name: "Weeding", level: "INTERMEDIATE" }],
        availability: { status: "OPEN_TO_WORK", days: ["Mon", "Tue", "Wed"], preferences: ["DAILY", "SEASONAL"], expectedWage: { amount: 450, unit: "DAY" } },
        location: { district: "Churu", state: "Rajasthan", serviceRadiusKm: 30, serviceAreas: ["Churu"] },
        attributes: { preferredWork: ["Harvesting"], travel: "Within district" },
      },
    });
    expect(p.status, JSON.stringify(p.error)).toBe(200);
    const found = await call<Page<WorkOpportunityDTO>>("GET", "/work?profession=pr_farm_worker&district=Churu", { as: me.id });
    expect(found.data.items.map((w) => w.id)).toContain("wo3");
    const ap = await call("POST", "/work/wo3/apply", { as: me.id, body: { note: "I can start on the first day with two others." } });
    expect(ap.status).toBe(200);
    // The farmer who posted it sees the worker and can shortlist.
    const apps = await call<ApplicationDTO[]>("GET", "/work/wo3/applications", { as: "u_ramesh" });
    expect(apps.data.some((a) => a.applicantUser.id === me.id)).toBe(true);
    // Expected wage is not shown to strangers.
    const view = await call<ProfessionalProfileDTO>("GET", `/professionals/${me.id}`, { as: "u_sunita" });
    expect(view.data.availability?.expectedWage).toBeUndefined();
  });
});

describe("custom ('Other') professions are moderated", () => {
  it("creates a pending profession, hides it from others, and the admin can approve it", async () => {
    const me = await register({ role: "PROFESSIONAL", customProfession: "Bee Keeper", name: "Test Bee Keeper" });
    const mine = await call<CatalogDTO>("GET", "/catalog", { as: me.id });
    const others = await call<CatalogDTO>("GET", "/catalog", { as: "u_sunita" });
    const find = (c: CatalogDTO) => c.categories.flatMap((x) => x.professions).find((p) => p.name === "Bee Keeper");
    expect(find(mine.data)?.status).toBe("PENDING");
    expect(find(others.data)).toBeUndefined();

    const pending = await call<{ id: string; name: string; status: string }[]>("GET", "/admin/professions?status=PENDING", { as: "u_admin" });
    const row = pending.data.find((p) => p.name === "Bee Keeper")!;
    expect(row).toBeTruthy();
    expect((await call("PATCH", `/admin/professions/${row.id}`, { as: "u_sunita", body: { status: "ACTIVE" } })).status).toBe(403);
    expect((await call("PATCH", `/admin/professions/${row.id}`, { as: "u_admin", body: { status: "ACTIVE" } })).status).toBe(200);
    expect(find((await call<CatalogDTO>("GET", "/catalog", { as: "u_sunita" })).data)?.status).toBe("ACTIVE");
  });

  it("a rejected custom profession leaves the account usable under 'Other'", async () => {
    const me = await register({ role: "PROFESSIONAL", customProfession: "Cloud Whisperer", name: "Test Whisperer" });
    const pending = await call<{ id: string; name: string }[]>("GET", "/admin/professions?status=PENDING", { as: "u_admin" });
    await call("PATCH", `/admin/professions/${pending.data.find((p) => p.name === "Cloud Whisperer")!.id}`, { as: "u_admin", body: { status: "REJECTED" } });
    const p = await call<ProfessionalProfileDTO>("GET", `/professionals/${me.id}`, { as: me.id });
    expect(p.data.profession.id).toBe("pr_other");
    expect(p.data.customProfession).toBe("Cloud Whisperer");
  });
});

describe("security — no access to other people's data by changing IDs", () => {
  it("service requests are visible only to their two participants", async () => {
    const r = await call("PATCH", "/service-requests/sr3", { as: "u_p_suresh", body: { action: "ACCEPT" } });
    expect(r.status).toBe(404);
    expect((await call("PATCH", "/service-requests/sr3", { as: "u_sunita", body: { action: "CANCEL" } })).status).toBe(404);
    const mine = await call<Page<ServiceRequestDTO>>("GET", "/service-requests?box=received", { as: "u_p_suresh" });
    expect(mine.data.items.every((x) => x.provider.id === "u_p_suresh")).toBe(true);
    expect(mine.data.items.find((x) => x.id === "sr3")).toBeUndefined();
  });

  it("only the provider can accept; the requester cannot accept their own request", async () => {
    expect((await call("PATCH", "/service-requests/sr3", { as: "u_ramesh", body: { action: "ACCEPT" } })).status).toBe(400);
    expect((await call<ServiceRequestDTO>("PATCH", "/service-requests/sr3", { as: "u_p_anil", body: { action: "ACCEPT" } })).data.status).toBe("ACCEPTED");
  });

  it("only the owner can edit or delete a service, portfolio item or work history", async () => {
    expect((await call("PATCH", "/services/sv_anil_fan", { as: "u_p_suresh", body: { name: "Hijacked" } })).status).toBe(404);
    expect((await call("DELETE", "/services/sv_anil_fan", { as: "u_p_suresh" })).status).toBe(404);
    expect((await call("PATCH", "/me/portfolio/pf_anil_1", { as: "u_p_suresh", body: { title: "Hijacked" } })).status).toBe(404);
    expect((await call("DELETE", "/me/work-history/wh_anil_1", { as: "u_p_suresh" })).status).toBe(404);
    expect((await call("DELETE", "/services/sv_anil_fan", { as: "u_p_anil" })).status).toBe(200);
  });

  it("applicants are visible only to the poster; applications can't be changed by others", async () => {
    expect((await call("GET", "/work/wo3/applications", { as: "u_p_kamla" })).status).toBe(404);
    expect((await call("GET", "/work/wo3/applications", { as: "u_p_ratan" })).status).toBe(404);
    expect((await call("PATCH", "/work/applications/ap1", { as: "u_p_kamla", body: { status: "ACCEPTED" } })).status).toBe(404);
    expect((await call("PATCH", "/work/wo3", { as: "u_p_ratan", body: {} })).status).toBe(404);
    expect((await call("DELETE", "/work/wo3", { as: "u_p_ratan" })).status).toBe(404);
    expect((await call("GET", "/work/wo3/applications", { as: "u_ramesh" })).status).toBe(200);
  });

  it("the poster's phone number is released only to an accepted applicant", async () => {
    const created = await call<WorkOpportunityDTO>("POST", "/work", { as: "u_p_ratan", body: { title: "Painter for new shop", description: "Two coats on a 400 sq ft shop, material provided.", kind: "CONTRACT", professionIds: ["pr_painter"], skills: [], openings: 1, district: "Churu", payUnit: "DAY", payMin: 800, payMax: 900, contactMethod: "PHONE" } });
    expect(created.status, JSON.stringify(created.error)).toBe(200);
    const id = created.data.id;
    expect((await call<WorkOpportunityDTO>("GET", `/work/${id}`, { as: "u_p_kamla" })).data.contactPhone).toBeUndefined();
    const ap = await call<WorkOpportunityDTO>("POST", `/work/${id}/apply`, { as: "u_p_kamla", body: { note: "Can paint" } });
    expect(ap.data.contactPhone).toBeUndefined();
    const list = await call<ApplicationDTO[]>("GET", `/work/${id}/applications`, { as: "u_p_ratan" });
    await call("PATCH", `/work/applications/${list.data[0]!.id}`, { as: "u_p_ratan", body: { status: "ACCEPTED" } });
    expect((await call<WorkOpportunityDTO>("GET", `/work/${id}`, { as: "u_p_kamla" })).data.contactPhone).toBeTruthy();
    expect(JSON.stringify((await call("GET", "/work", { as: "u_sunita" })).data)).not.toContain("+91 90000 60012");
  });

  it("private profiles are restricted; hidden services and opportunities don't leak", async () => {
    await call("PUT", "/me/privacy", { as: "u_p_savitri", body: { profile: "PRIVATE", phone: "PRIVATE", locationPrecision: "DISTRICT" } });
    const p = await call<ProfessionalProfileDTO>("GET", "/professionals/u_p_savitri", { as: "u_sunita" });
    expect(p.data.restricted).toBe(true);
    expect(p.data.services).toHaveLength(0);
    const search = await call<Page<ProfessionalCardDTO>>("GET", "/professionals?q=tailor", { as: "u_sunita" });
    expect(search.data.items.find((c) => c.user.id === "u_p_savitri")).toBeUndefined();
    const svcs = await call<Page<ServiceDTO>>("GET", "/services?q=blouse", { as: "u_sunita" });
    expect(svcs.data.items.find((s) => s.ownerId === "u_p_savitri")).toBeUndefined();
    // The owner still sees everything.
    expect((await call<ProfessionalProfileDTO>("GET", "/professionals/u_p_savitri", { as: "u_p_savitri" })).data.restricted).toBe(false);
  });

  it("village stays hidden unless the owner chose village precision; phone only for connections", async () => {
    const p = await call<ProfessionalProfileDTO>("GET", "/professionals/u_p_anil", { as: "u_sunita" });
    expect(p.data.village).toBeUndefined();
    expect(p.data.phone).toBeUndefined();
    const own = await call<ProfessionalProfileDTO>("GET", "/professionals/u_p_anil", { as: "u_p_anil" });
    expect(own.data.village).toBe("Ratangarh");
    expect(own.data.privacy).toBeTruthy();
    expect(p.data.privacy).toBeUndefined();
  });

  it("verification can't be self-assigned: not via skills, not via profile edit, not via business edit", async () => {
    const r = await call<ProfessionalProfileDTO>("PATCH", "/professionals/me", { as: "u_p_dilip", body: { skills: [{ name: "Tractor repair", level: "EXPERT", verified: true }, { name: "Brakes", level: "EXPERT", verified: true }] } });
    expect(r.data.skills.every((s) => !s.verified)).toBe(true);
    const me = await call<Me>("GET", "/auth/me", { as: "u_p_dilip" });
    expect(me.data.verified).toBe(false);
    const biz = await call<{ verified: boolean }>("PATCH", "/businesses/biz_anil", { as: "u_p_anil", body: { name: "Anil Electricals", kind: "Contractor", about: "Wiring and solar for homes.", services: ["Wiring"], professionIds: ["pr_electrician"], district: "Churu", state: "Rajasthan", verifiedAt: "2020-01-01" } });
    expect(biz.data.verified).toBe(false);
    expect((await call("POST", "/admin/professionals/u_p_dilip/verify-skill", { as: "u_p_dilip", body: { skill: "Tractor repair", verified: true } })).status).toBe(403);
    expect((await call("POST", "/admin/professionals/u_p_dilip/verify-skill", { as: "u_admin", body: { skill: "Tractor repair", verified: true } })).status).toBe(200);
  });

  it("a professional cannot become a Farmer by editing the profile, and farmers cannot change profession", async () => {
    expect((await call("PATCH", "/professionals/me", { as: "u_p_dilip", body: { professionId: "pr_farmer" } })).status).toBe(400);
    expect((await call("PATCH", "/professionals/me", { as: "u_ramesh", body: { professionId: "pr_electrician" } })).status).toBe(403);
  });

  it("recommendations need a real connection or completed work, and can't be self-written", async () => {
    expect((await call("POST", "/professionals/u_p_anil/recommendations", { as: "u_p_anil", body: { relationship: "OTHER", body: "I am the best electrician in town!!" } })).status).toBe(400);
    expect((await call("POST", "/professionals/u_p_anil/recommendations", { as: "u_p_gopal", body: { relationship: "OTHER", body: "Never met him but he seems great and honest." } })).status).toBe(403);
    const ok = await call("POST", "/professionals/u_p_anil/recommendations", { as: "u_ramesh", body: { relationship: "CUSTOMER", body: "Anil did the fan work properly and explained each step." } });
    expect(ok.status).toBe(200);
    const prof = await call<ProfessionalProfileDTO>("GET", "/professionals/u_p_anil", { as: "u_sunita" });
    expect(prof.data.recommendations.find((r) => r.author.id === "u_ramesh")?.interactionVerified).toBe(true);
    // Reputation exposes only countable facts — no invented rating.
    expect(Object.keys(prof.data.reputation)).not.toContain("rating");
    expect(JSON.stringify(prof.data.reputation)).not.toMatch(/stars|rating/i);
  });

  it("moderators can hide a service/opportunity and it disappears for everyone but the owner", async () => {
    await call("PATCH", "/admin/content/opportunities/wo2", { as: "u_admin", body: { hidden: true } });
    const list = await call<Page<WorkOpportunityDTO>>("GET", "/work?profession=pr_carpenter", { as: "u_p_suresh" });
    expect(list.data.items.find((w) => w.id === "wo2")).toBeUndefined();
    expect((await call("GET", "/work/wo2", { as: "u_p_suresh" })).status).toBe(404);
    expect((await call("GET", "/work/wo2", { as: "u_p_ratan" })).status).toBe(200);
    await call("PATCH", "/admin/content/services/sv_suresh_door", { as: "u_admin", body: { hidden: true } });
    expect((await call("GET", "/services/sv_suresh_door", { as: "u_sunita" })).status).toBe(404);
  });

  it("only roles with the capability can post work or manage services", async () => {
    expect((await call("POST", "/work", { as: "u_e_anita", body: { title: "Some work", description: "Needs a worker for a few days at a farm.", kind: "DAILY", professionIds: ["pr_farm_worker"], skills: [], openings: 1, district: "Churu", payUnit: "NEGOTIABLE" } })).status).toBe(403);
    expect((await call("POST", "/services", { as: "u_b_marudhara", body: { name: "Anything", description: "Not allowed for a buyer account.", priceType: "NEGOTIABLE", areas: [], availability: "" } })).status).toBe(403);
    expect((await call("POST", "/service-requests", { as: "u_admin", body: { serviceId: "sv_anil_fan", date: "2099-01-01", district: "Churu", description: "Admin should not request." } })).status).toBe(403);
  });

  it("safety screening still blocks Aadhaar-like numbers in new free-text fields", async () => {
    const r = await call("POST", "/services", { as: "u_p_anil", body: { name: "Wiring", description: "Send advance to 1234 5678 9012 before I come.", priceType: "NEGOTIABLE", areas: [], availability: "" } });
    expect(r.status).toBe(422);
  });
});

describe("discovery, map and home", () => {
  it("finds professionals by natural language, profession and distance", async () => {
    const r = await call<Page<ProfessionalCardDTO>>("GET", "/professionals?q=electrician near Churu", { as: "u_ramesh" });
    expect(r.data.items[0]?.user.id).toBe("u_p_anil");
    expect(r.data.items[0]?.matchReason).toBeTruthy();
    const hinglish = await call<Page<ProfessionalCardDTO>>("GET", "/professionals?q=bijli mistri", { as: "u_ramesh" });
    expect(hinglish.data.items.map((c) => c.user.id)).toContain("u_p_anil");
    const filtered = await call<Page<ProfessionalCardDTO>>("GET", "/professionals?profession=pr_driver&verified=1", { as: "u_ramesh" });
    expect(filtered.data.items).toHaveLength(0); // the demo driver is not verified
    const exp = await call<Page<ProfessionalCardDTO>>("GET", "/professionals?minExperience=14&category=pc_trades", { as: "u_ramesh" });
    expect(exp.data.items.every((c) => c.experienceYears >= 14)).toBe(true);
  });

  it("map points are approximate: shared offsets, no private data", async () => {
    const r = await call<{ id: string; lat: number; lng: number; area: string; title: string }[]>("GET", "/map/points?types=PROFESSIONAL,OPPORTUNITY", { as: "u_sunita" });
    expect(r.data.length).toBeGreaterThan(5);
    const anil = r.data.find((p) => p.id === "mp_u_p_anil")!;
    // Churu centroid is (28.30, 74.96); the point must be within ~7 km and never the exact Ratangarh coordinates.
    expect(Math.abs(anil.lat - 28.3)).toBeLessThan(0.07);
    expect(Object.keys(anil)).not.toContain("village");
    const raw = JSON.stringify(r.data);
    expect(raw).not.toContain("Ratangarh");
    expect(raw).not.toContain("phone");
  });

  it("each profession gets a matching adaptive dashboard payload", async () => {
    const e = await call<{ profession: { id: string; dashboard: string }; nearbyWork: unknown[]; pendingRequests: unknown[]; completeness: { percent: number } }>("GET", "/home/professional", { as: "u_p_anil" });
    expect(e.data.profession.dashboard).toBe("TRADE");
    expect(e.data.pendingRequests.length).toBeGreaterThan(0);
    expect(e.data.completeness.percent).toBeGreaterThan(50);
    const f = await call<{ profession: { dashboard: string } }>("GET", "/home/professional", { as: "u_ramesh" });
    expect(f.data.profession.dashboard).toBe("FARMER");
    const w = await call<{ profession: { dashboard: string } }>("GET", "/home/professional", { as: "u_p_kamla" });
    expect(w.data.profession.dashboard).toBe("AGRI_WORK");
  });

  it("my-work hub lists only my own rows", async () => {
    const mw = await call<MyWorkDTO>("GET", "/my/work", { as: "u_p_anil" });
    expect(mw.data.services.every((s) => s.ownerId === "u_p_anil")).toBe(true);
    expect(mw.data.requestsReceived.every((r) => r.provider.id === "u_p_anil")).toBe(true);
    expect(mw.data.opportunities).toHaveLength(0);
    const ratan = await call<MyWorkDTO>("GET", "/my/work", { as: "u_p_ratan" });
    expect(ratan.data.opportunities.length).toBe(2);
  });
});
