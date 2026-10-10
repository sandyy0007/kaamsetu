/**
 * Search: natural-language farmer discovery ("Mustard farmers near Churu") and global search.
 * Production: replace the in-memory scan with PostgreSQL full-text / trigram indexes (see README).
 */
import type { SearchResultsDTO, FarmerCardDTO } from "@/types/dto";
import { extractCrop } from "@/lib/intents";
import { districtDistanceKm, findPlaceInText } from "@/lib/geo";
import { formatNumber, unitLabel } from "@/lib/utils";
import { canSee } from "../privacy";
import { businessCard, businessVisible, opportunityVisible, professionOf, searchProfessionals, serviceDTO, serviceVisible, workOpportunityDTO } from "./professionals";
import {
  buyerCard,
  communityDTO,
  courseCard,
  eventDTO,
  expertCard,
  farmerCard,
  listingDTO,
  listingVisible,
  orgCard,
  postDTO,
  reelDTO,
  schemeDTO,
  type View,
} from "../mappers";

const STOP = new Set(["farmers", "farmer", "near", "in", "from", "of", "the", "at", "around", "किसान", "के", "में", "पास", "और", "and", "with", "who", "grow", "growing"]);

export const tokens = (q: string) =>
  q
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));

const hay = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ").toLowerCase();

export interface FarmerSearch {
  q?: string;
  crop?: string;
  district?: string;
  near?: string;
  verified?: boolean;
  fpo?: boolean;
  organic?: boolean;
  minQty?: number;
}

export function searchFarmers(v: View, o: FarmerSearch): FarmerCardDTO[] {
  const { d, viewer } = v;
  const q = o.q?.trim() ?? "";
  const crop = o.crop || (q ? extractCrop(q) : undefined);
  const place = o.near || o.district || (q ? findPlaceInText(q) : null) || undefined;
  const words = tokens(q).filter((t) => !(crop && extractCrop(t)) && !(place && place.toLowerCase().includes(t)));

  const out: { card: FarmerCardDTO; score: number }[] = [];
  for (const p of d.farmerProfiles) {
    if (viewer?.id === p.userId) continue;
    const user = d.users.find((u) => u.id === p.userId);
    if (!user || user.status !== "ACTIVE") continue;
    if (!canSee(d, viewer, p.userId, p.privacy.profile)) continue;
    const card = farmerCard(v, p.userId);
    if (!card) continue;

    const grows = card.crops.some((c) => c.toLowerCase() === crop?.toLowerCase());
    const lots = d.listings.filter((l) => l.ownerId === p.userId && l.status === "AVAILABLE" && !l.hidden && listingVisible(v, l));
    const lot = crop ? lots.find((l) => l.crop.toLowerCase() === crop.toLowerCase()) : undefined;
    if (crop && !grows && !lot) continue;
    if (o.verified && !card.user.verified) continue;
    if (o.fpo && card.fpos.length === 0) continue;
    if (o.organic && !lots.some((l) => l.organic) && !p.methods.includes("Organic")) continue;
    if (o.minQty && !(lot && lot.quantity >= o.minQty)) continue;
    if (o.district && !place) continue;

    let score = 0;
    const reasons: string[] = [];
    if (crop) {
      score += grows ? 50 : 25;
      reasons.push(`Grows ${crop}`);
    }
    if (lot) {
      score += 15;
      reasons.push(`${formatNumber(lot.quantity)} ${unitLabel(lot.unit)} available`);
    }
    if (place) {
      const km = p.district.toLowerCase() === place.toLowerCase() ? 0 : districtDistanceKm(p.district, place);
      card.distanceKm = km;
      if (km === 0) {
        score += 40;
        reasons.push(`In ${place}`);
      } else if (km !== null) {
        score += Math.max(0, 35 - km / 8);
        reasons.push(`~${km} km from ${place}`);
      }
    }
    if (words.length) {
      const text = hay(user.name, p.village, p.district, p.specialization, p.skills.join(" "));
      const hits = words.filter((w) => text.includes(w)).length;
      if (hits === 0 && !crop && !place) continue;
      score += (hits / words.length) * 30;
    }
    if (card.user.verified) score += 10;
    if (card.fpos.length) score += 4;
    if (!crop && !place && !words.length) score += card.followers; // browse mode
    card.matchReason = reasons.join(" · ") || undefined;
    out.push({ card, score });
  }
  return out.sort((a, b) => b.score - a.score).map((x) => x.card);
}

export function globalSearch(v: View, q: string): SearchResultsDTO {
  const { d } = v;
  const lim = <T,>(xs: T[], n = 8) => xs.slice(0, n);
  const qTokens = tokens(q);
  // Every query word must appear in the entity text; Hindi crop names match their English equivalent.
  const m = (...f: (string | undefined)[]) => {
    if (!qTokens.length) return false;
    const text = hay(...f);
    return qTokens.every((w) => text.includes(w) || (extractCrop(w) !== undefined && text.includes(extractCrop(w)!.toLowerCase())));
  };

  const farmers = searchFarmers(v, { q });
  const buyers = d.buyerProfiles.filter((b) => m(b.businessName, b.industry, b.district, b.cropsPurchased.join(" "), b.about)).map((b) => buyerCard(v, b.userId)!).filter(Boolean);
  const experts = d.expertProfiles.filter((e) => m(d.users.find((u) => u.id === e.userId)?.name, e.category, e.specialization.join(" "), e.organization, e.district)).map((e) => expertCard(v, e.userId)!).filter(Boolean);
  const orgs = [...d.organizations.map((o) => o.userId), ...d.fpos.map((f) => f.userId)]
    .filter((id) => {
      const o = d.organizations.find((x) => x.userId === id);
      const f = d.fpos.find((x) => x.userId === id);
      return m((o ?? f)?.name, (o ?? f)?.about, o?.department, f?.crops.join(" "));
    })
    .map((id) => orgCard(v, id)!)
    .filter(Boolean);
  const produce = d.listings.filter((l) => listingVisible(v, l) && l.status === "AVAILABLE" && m(l.crop, l.variety, l.location.district, l.description)).map((l) => listingDTO(v, l));
  const posts = d.posts.filter((p) => !p.hidden && m(p.body, p.tags.join(" "), p.crop)).map((p) => postDTO(v, p));
  const reels = d.reels.filter((r) => !r.hidden && m(r.caption, r.tags.join(" "), r.category)).map((r) => reelDTO(v, r));
  const events = d.events.filter((e) => !e.hidden && m(e.name, e.description, e.category, e.topics.join(" "), e.location)).map((e) => eventDTO(v, e));
  const schemes = d.schemes.filter((s) => !s.hidden && m(s.name, s.description, s.category)).map((s) => schemeDTO(v, s));
  const courses = d.courses.filter((c) => !c.hidden && m(c.title, c.category, c.description)).map((c) => courseCard(v, c));
  const communities = d.communities.filter((c) => !c.hidden && m(c.name, c.description, c.kind)).map((c) => communityDTO(v, c));

  // KaamSetu: every other profession, plus services, opportunities and businesses. Farmers already appear in `farmers`.
  const farmerIds = new Set(farmers.map((f) => f.user.id));
  const professionals = searchProfessionals(v, { q }).filter((p) => !farmerIds.has(p.user.id));
  const services = d.services.filter((s) => serviceVisible(v, s) && m(s.name, s.description, s.areas.join(" "), d.users.find((u) => u.id === s.ownerId)?.name)).map((s) => serviceDTO(v, s));
  const opportunities = d.workOpportunities
    .filter((w) => opportunityVisible(v, w) && w.status === "OPEN" && m(w.title, w.description, w.skills.join(" "), w.kind, w.location.district, w.professionIds.map((id) => professionOf(d, id)?.name).join(" ")))
    .map((w) => workOpportunityDTO(v, w));
  const businesses = d.businesses.filter((b) => businessVisible(v, b) && m(b.name, b.kind, b.about, b.services.join(" "), b.district)).map((b) => businessCard(v, b));

  const counts = {
    farmers: farmers.length, buyers: buyers.length, experts: experts.length, orgs: orgs.length, produce: produce.length, posts: posts.length, reels: reels.length,
    events: events.length, schemes: schemes.length, courses: courses.length, communities: communities.length,
    professionals: professionals.length, services: services.length, opportunities: opportunities.length, businesses: businesses.length,
  };
  return {
    q,
    counts,
    professionals: lim(professionals),
    services: lim(services),
    opportunities: lim(opportunities),
    businesses: lim(businesses),
    farmers: lim(farmers),
    buyers: lim(buyers),
    experts: lim(experts),
    orgs: lim(orgs),
    produce: lim(produce),
    posts: lim(posts),
    reels: lim(reels),
    events: lim(events),
    schemes: lim(schemes),
    courses: lim(courses),
    communities: lim(communities),
  };
}

