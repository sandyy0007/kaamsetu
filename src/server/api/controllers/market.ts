import { z } from "zod";
import type { Db, ProduceListing, User } from "@/types/domain";
import type { EnquiryDTO, ListingDetailDTO, Page } from "@/types/dto";
import { enquirySchema, listingSchema, machinerySchema, requirementSchema, respondSchema } from "@/lib/schemas";
import { districtDistanceKm } from "@/lib/geo";
import { sanitizeText } from "@/lib/utils";
import { newId } from "../../crypto";
import { persist } from "../../db";
import { badRequest, forbidden, notFound } from "../../errors";
import { farmerCard, listingDTO, listingVisible, machineryDTO, requirementDTO, summaryById, userDistrict, type View } from "../../mappers";
import { requireCap, requireUser } from "../../permissions";
import { isBlockedEitherWay } from "../../privacy";
import { matchesForRequirement, requirementScoreForFarmer } from "../../services/matching";
import { assertSafeText, ensureConversation, sendMessage } from "../../services/messaging";
import { notify } from "../../services/notify";
import { route, type Ctx } from "../router";

const view = (c: Ctx): View => ({ d: c.d, viewer: c.user });

function paginate<T>(items: T[], c: Ctx, limit = 12): Page<T> {
  const start = Number(c.query.get("cursor") ?? 0) || 0;
  const l = Math.min(50, Number(c.query.get("limit") ?? limit) || limit);
  return { items: items.slice(start, start + l), nextCursor: start + l < items.length ? String(start + l) : null, total: items.length };
}

const toQuintal = (qty: number, unit: ProduceListing["unit"]) => (unit === "KG" ? qty / 100 : unit === "TONNE" ? qty * 10 : qty);

// ───────────── produce listings ─────────────
route("GET", "/listings", (c) => {
  const v = view(c);
  const q = c.query;
  const text = (q.get("q") ?? "").toLowerCase();
  const crop = q.get("crop")?.toLowerCase();
  const district = q.get("district")?.toLowerCase();
  const minQty = Number(q.get("minQty") ?? 0);
  const maxPrice = Number(q.get("maxPrice") ?? 0);
  const harvestAfter = q.get("harvestAfter");
  const mine = q.get("mine") === "1";
  const myDistrict = c.user ? userDistrict(c.d, c.user.id) : undefined;

  let rows = c.d.listings.filter((l) => {
    if (!listingVisible(v, l)) return false;
    if (c.user && isBlockedEitherWay(c.d, c.user.id, l.ownerId)) return false;
    if (mine ? l.ownerId !== c.user?.id : l.status !== "AVAILABLE") return false;
    if (crop && l.crop.toLowerCase() !== crop) return false;
    if (district && l.location.district.toLowerCase() !== district) return false;
    if (minQty && toQuintal(l.quantity, l.unit) < minQty) return false;
    if (maxPrice && l.expectedPrice > maxPrice) return false;
    if (harvestAfter && Date.parse(l.harvestDate) < Date.parse(harvestAfter)) return false;
    if (q.get("organic") === "1" && !l.organic) return false;
    if (q.get("fpo") === "1" && !l.fpoId) return false;
    if (q.get("verified") === "1" && !c.d.users.find((u) => u.id === l.ownerId)?.verifiedAt) return false;
    if (text && !`${l.crop} ${l.variety ?? ""} ${l.location.district} ${l.location.village ?? ""} ${l.description} ${l.method}`.toLowerCase().includes(text)) return false;
    return true;
  });

  const sort = q.get("sort") ?? "relevance";
  if (sort === "price_asc") rows = rows.sort((a, b) => a.expectedPrice - b.expectedPrice);
  else if (sort === "price_desc") rows = rows.sort((a, b) => b.expectedPrice - a.expectedPrice);
  else if (sort === "qty") rows = rows.sort((a, b) => toQuintal(b.quantity, b.unit) - toQuintal(a.quantity, a.unit));
  else if (sort === "newest") rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else {
    // relevance: nearby + verified first, then newest
    const dist = (l: ProduceListing) => (myDistrict ? (districtDistanceKm(l.location.district, myDistrict) ?? 500) : 0);
    const trusted = (l: ProduceListing) => (c.d.users.find((u) => u.id === l.ownerId)?.verifiedAt ? 40 : 0);
    rows = rows.sort((a, b) => trusted(b) - dist(b) / 5 - (trusted(a) - dist(a) / 5) || b.createdAt.localeCompare(a.createdAt));
  }
  return paginate(rows.map((l) => listingDTO(v, l)), c, 12);
});

route("GET", "/listings/:id", (c): ListingDetailDTO => {
  const v = view(c);
  const l = c.d.listings.find((x) => x.id === c.params.id);
  if (!l || !listingVisible(v, l)) throw notFound("Listing");
  const card = listingDTO(v, l);
  return {
    ...card,
    ownerCard: farmerCard(v, l.ownerId),
    similar: c.d.listings.filter((x) => x.id !== l.id && x.crop === l.crop && x.status === "AVAILABLE" && listingVisible(v, x)).slice(0, 4).map((x) => listingDTO(v, x)),
    enquirySent: !!c.user && c.d.enquiries.some((e) => e.listingId === l.id && e.buyerId === c.user!.id),
  };
});

route("POST", "/listings", async (c) => {
  const u = requireCap(c.user, "listing:create");
  const input = await c.body(listingSchema);
  assertSafeText(`${input.description} ${input.variety ?? ""}`);
  const fpo = u.role === "FPO" ? c.d.fpos.find((f) => f.userId === u.id) : undefined;
  const listing: ProduceListing = {
    id: newId("l"),
    ownerId: u.id,
    crop: input.crop,
    variety: input.variety,
    quantity: input.quantity,
    unit: input.unit,
    expectedPrice: input.expectedPrice,
    location: { village: input.village, district: input.district, state: input.state },
    harvestDate: input.harvestDate,
    grade: input.grade,
    method: input.method,
    organic: /organic/i.test(input.method),
    status: "AVAILABLE",
    fpoId: fpo?.id,
    description: input.description,
    hidden: false,
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  c.d.listings.push(listing);
  // Notify buyers with a matching open requirement — payments/orders will plug in here later.
  for (const r of c.d.requirements.filter((x) => x.status === "OPEN" && !x.hidden && x.crop.toLowerCase() === listing.crop.toLowerCase())) {
    notify(c.d, r.buyerId, "MARKET", `New ${listing.crop} listing`, `${listing.quantity} ${listing.unit.toLowerCase()} in ${listing.location.district} matches your requirement.`, `/market/${listing.id}`);
  }
  persist();
  return listingDTO(view(c), listing);
});

route("PATCH", "/listings/:id", async (c) => {
  const u = requireCap(c.user, "listing:create");
  const l = c.d.listings.find((x) => x.id === c.params.id && x.ownerId === u.id);
  if (!l) throw notFound("Listing");
  const input = await c.body(listingSchema.partial().extend({ status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "CLOSED"]).optional() }));
  if (input.description) assertSafeText(input.description);
  const { village, district, state, status, method, ...rest } = input;
  Object.assign(l, rest);
  if (status) l.status = status;
  if (method) {
    l.method = method;
    l.organic = /organic/i.test(method);
  }
  if (district || state || village !== undefined) l.location = { village: village ?? l.location.village, district: district ?? l.location.district, state: state ?? l.location.state };
  persist();
  return listingDTO(view(c), l);
});

route("DELETE", "/listings/:id", (c) => {
  const u = requireUser(c.user);
  const l = c.d.listings.find((x) => x.id === c.params.id);
  if (!l || (l.ownerId !== u.id && u.role !== "ADMIN")) throw notFound("Listing");
  l.status = "CLOSED";
  persist();
  return { ok: true };
});

// ───────────── enquiries ─────────────
function enquiryDTO(d: Db, viewer: User, e: Db["enquiries"][number]): EnquiryDTO {
  const listing = e.listingId ? d.listings.find((l) => l.id === e.listingId) : undefined;
  const req = e.requirementId ? d.requirements.find((r) => r.id === e.requirementId) : undefined;
  const sent = e.buyerId === viewer.id;
  return {
    id: e.id,
    status: e.status,
    message: e.message,
    createdAt: e.createdAt,
    direction: sent ? "SENT" : "RECEIVED",
    counterpart: summaryById(d, sent ? e.farmerId : e.buyerId),
    listing: listing && { id: listing.id, crop: listing.crop, quantity: listing.quantity, unit: listing.unit },
    requirement: req && { id: req.id, crop: req.crop },
    conversationId: e.conversationId,
  };
}

route("POST", "/listings/:id/enquiries", async (c) => {
  const u = requireCap(c.user, "enquiry:send");
  const v = view(c);
  const l = c.d.listings.find((x) => x.id === c.params.id);
  if (!l || !listingVisible(v, l)) throw notFound("Listing");
  if (l.ownerId === u.id) throw badRequest("This is your own listing.");
  const { message } = await c.body(enquirySchema);
  const convo = ensureConversation(c.d, u.id, l.ownerId, { kind: "LISTING", id: l.id, title: `${l.crop} — ${l.quantity} ${l.unit.toLowerCase()}` });
  sendMessage(c.d, convo, u, message);
  let enquiry = c.d.enquiries.find((e) => e.listingId === l.id && e.buyerId === u.id);
  if (!enquiry) {
    enquiry = { id: newId("enq"), listingId: l.id, buyerId: u.id, farmerId: l.ownerId, conversationId: convo.id, message, status: "NEW", createdAt: new Date().toISOString(), isDemo: false };
    c.d.enquiries.push(enquiry);
  }
  persist();
  return enquiryDTO(c.d, u, enquiry);
});

route("GET", "/enquiries", (c) => {
  const u = requireUser(c.user);
  return c.d.enquiries
    .filter((e) => e.buyerId === u.id || e.farmerId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => enquiryDTO(c.d, u, e));
});

route("PATCH", "/enquiries/:id", async (c) => {
  const u = requireUser(c.user);
  const e = c.d.enquiries.find((x) => x.id === c.params.id && (x.farmerId === u.id || x.buyerId === u.id));
  if (!e) throw notFound("Enquiry");
  const { status } = await c.body(z.object({ status: z.enum(["NEW", "REPLIED", "CLOSED"]) }));
  e.status = status;
  persist();
  return enquiryDTO(c.d, u, e);
});

// ───────────── buyer requirements & matching ─────────────
route("GET", "/requirements", (c) => {
  const v = view(c);
  const u = c.user;
  const crop = c.query.get("crop")?.toLowerCase();
  const district = c.query.get("district")?.toLowerCase();
  const mine = c.query.get("mine") === "1";
  let rows = c.d.requirements.filter((r) => (mine ? r.buyerId === u?.id : r.status === "OPEN") && (!r.hidden || r.buyerId === u?.id) && (!crop || r.crop.toLowerCase() === crop) && (!district || r.district.toLowerCase() === district));
  if (u) rows = rows.filter((r) => !isBlockedEitherWay(c.d, u.id, r.buyerId));
  const items = rows.map((r) => {
    const dto = requirementDTO(v, r);
    if (u && (u.role === "FARMER" || u.role === "FPO")) dto.matchScore = Math.round(requirementScoreForFarmer(c.d, u, r));
    return dto;
  });
  items.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0) || b.createdAt.localeCompare(a.createdAt));
  return paginate(items, c, 20);
});

route("POST", "/requirements", async (c) => {
  const u = requireCap(c.user, "requirement:create");
  const input = await c.body(requirementSchema);
  assertSafeText(input.notes);
  const req = { id: newId("req"), buyerId: u.id, ...input, status: "OPEN" as const, hidden: false, createdAt: new Date().toISOString(), isDemo: false };
  c.d.requirements.push(req);
  // Let matching farmers know (respecting their notification preferences).
  for (const l of c.d.listings.filter((x) => x.status === "AVAILABLE" && !x.hidden && x.crop.toLowerCase() === req.crop.toLowerCase())) {
    notify(c.d, l.ownerId, "MARKET", `Buyer needs ${req.crop}`, `${req.quantity} ${req.unit.toLowerCase()} near ${req.district} — you have matching produce.`, "/market?tab=requirements");
  }
  persist();
  return requirementDTO(view(c), req);
});

route("PATCH", "/requirements/:id", async (c) => {
  const u = requireUser(c.user);
  const r = c.d.requirements.find((x) => x.id === c.params.id && (x.buyerId === u.id || u.role === "ADMIN"));
  if (!r) throw notFound("Requirement");
  const { status } = await c.body(z.object({ status: z.enum(["OPEN", "FULFILLED", "CLOSED"]) }));
  r.status = status;
  persist();
  return requirementDTO(view(c), r);
});

route("GET", "/requirements/:id/matches", (c) => {
  const u = requireUser(c.user);
  const r = c.d.requirements.find((x) => x.id === c.params.id);
  if (!r) throw notFound("Requirement");
  if (r.buyerId !== u.id && u.role !== "ADMIN") throw forbidden("Only the buyer who posted this requirement can see its matches.");
  return matchesForRequirement(view(c), r);
});

route("POST", "/requirements/:id/respond", async (c) => {
  const u = requireUser(c.user);
  if (u.role !== "FARMER" && u.role !== "FPO") throw forbidden("Only farmers and FPOs can respond to requirements.");
  const r = c.d.requirements.find((x) => x.id === c.params.id && x.status === "OPEN" && !x.hidden);
  if (!r) throw notFound("Requirement");
  const { message, listingId } = await c.body(respondSchema);
  if (isBlockedEitherWay(c.d, u.id, r.buyerId)) throw forbidden();
  const convo = ensureConversation(c.d, u.id, r.buyerId, { kind: "REQUIREMENT", id: r.id, title: `${r.crop} — ${r.quantity} ${r.unit.toLowerCase()} near ${r.district}` });
  sendMessage(c.d, convo, u, message);
  if (!c.d.enquiries.some((e) => e.requirementId === r.id && e.farmerId === u.id)) {
    c.d.enquiries.push({ id: newId("enq"), requirementId: r.id, listingId: listingId && c.d.listings.some((l) => l.id === listingId && l.ownerId === u.id) ? listingId : undefined, buyerId: r.buyerId, farmerId: u.id, conversationId: convo.id, message: sanitizeText(message), status: "NEW", createdAt: new Date().toISOString(), isDemo: false });
  }
  persist();
  return { conversationId: convo.id };
});

// ───────────── machinery ─────────────
route("GET", "/machinery", (c) => {
  const v = view(c);
  const type = c.query.get("type");
  const district = c.query.get("district")?.toLowerCase();
  const onlyAvailable = c.query.get("available") === "1";
  const mine = c.query.get("mine") === "1";
  const myDistrict = c.user ? userDistrict(c.d, c.user.id) : undefined;
  const rows = c.d.machinery
    .filter((m) => (!m.hidden || m.ownerId === c.user?.id) && (!mine || m.ownerId === c.user?.id) && (!type || m.type === type) && (!district || m.district.toLowerCase() === district) && (!onlyAvailable || m.available))
    .sort((a, b) => Number(b.available) - Number(a.available) || (myDistrict ? (districtDistanceKm(a.district, myDistrict) ?? 999) - (districtDistanceKm(b.district, myDistrict) ?? 999) : 0));
  return rows.map((m) => machineryDTO(v, m));
});

route("POST", "/machinery", async (c) => {
  const u = requireCap(c.user, "machinery:list");
  const input = await c.body(machinerySchema);
  assertSafeText(input.description);
  const item = { id: newId("mc"), ownerId: u.id, ...input, available: true, hidden: false, createdAt: new Date().toISOString(), isDemo: false };
  c.d.machinery.push(item);
  persist();
  return machineryDTO(view(c), item);
});

route("PATCH", "/machinery/:id", async (c) => {
  const u = requireUser(c.user);
  const m = c.d.machinery.find((x) => x.id === c.params.id && x.ownerId === u.id);
  if (!m) throw notFound("Equipment");
  const input = await c.body(machinerySchema.partial().extend({ available: z.boolean().optional() }));
  Object.assign(m, input);
  persist();
  return machineryDTO(view(c), m);
});

route("DELETE", "/machinery/:id", (c) => {
  const u = requireUser(c.user);
  const m = c.d.machinery.find((x) => x.id === c.params.id && (x.ownerId === u.id || u.role === "ADMIN"));
  if (!m) throw notFound("Equipment");
  c.d.machinery = c.d.machinery.filter((x) => x.id !== m.id);
  persist();
  return { ok: true };
});
