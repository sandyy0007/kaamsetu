/**
 * Opportunity Center: one ranked list of things worth acting on. Every card carries a plain-language
 * `reason` ("Why am I seeing this?") so recommendations are never mysterious, and users can switch
 * personalisation off in Settings (then we rank by recency only).
 */
import type { Db, GovernmentScheme, User } from "@/types/domain";
import type { OpportunityDTO } from "@/types/dto";
import { districtDistanceKm } from "@/lib/geo";
import { formatNumber, unitLabel } from "@/lib/utils";
import { eventStatus, type View } from "../mappers";
import { requirementScoreForFarmer, scoreListing } from "./matching";
import { matchOpportunity, opportunityVisible, payLabel } from "./professionals";

const TRAINING_CATEGORIES = new Set(["Training", "Crop Workshop", "Government Camp", "Skill Camp", "Job Fair"]);
const FARM_EVENT_CATEGORIES = new Set(["Kisan Mela", "Agriculture Expo", "Crop Workshop", "Machinery Demo", "FPO Meeting"]);

/** True when the viewer works with farms (farmer, FPO, buyer, expert or a profession with farm modules). */
export function isFarmViewer(d: Db, viewer: Pick<User, "id" | "role"> | null | undefined): boolean {
  if (!viewer) return true; // anonymous visitors see the original farming content
  if (["FARMER", "FPO", "BUYER", "EXPERT", "ADMIN", "GOVERNMENT"].includes(viewer.role)) return true;
  const pp = d.professionalProfiles.find((p) => p.userId === viewer.id);
  const prof = pp && d.professions.find((x) => x.id === pp.professionId);
  return !!prof?.farmModules || prof?.categoryId === "pc_agri";
}

/**
 * Does a government entry belong to this viewer? "ALL" reaches everyone; agriculture entries (no audience set)
 * reach farm viewers; otherwise the audience lists profession ids or profession category ids.
 */
export function schemeForViewer(d: Db, viewer: Pick<User, "id" | "role"> | null | undefined, s: Pick<GovernmentScheme, "audience">): boolean {
  const aud = s.audience ?? [];
  if (aud.includes("ALL")) return true;
  if (!aud.length) return isFarmViewer(d, viewer);
  const pp = viewer && d.professionalProfiles.find((p) => p.userId === viewer.id);
  if (!pp) return false;
  const prof = d.professions.find((x) => x.id === pp.professionId);
  return aud.some((a) => a === pp.professionId || pp.secondaryProfessionIds.includes(a) || a === prof?.categoryId);
}

/** Courses with no professionIds are general farming content; profession-tagged courses reach that profession (and everyone for "ALL"). */
export function courseForViewer(professionIds: string[] | undefined, myProfessionId: string | undefined, farmViewer: boolean): boolean {
  if (!professionIds?.length) return farmViewer;
  if (professionIds.includes("ALL")) return true;
  return !!myProfessionId && professionIds.includes(myProfessionId);
}

export function opportunitiesFor(v: View): OpportunityDTO[] {
  const { d, viewer } = v;
  if (!viewer) return [];
  const personal = viewer.personalization;
  const farmViewer = isFarmViewer(d, viewer);
  const pro = d.professionalProfiles.find((p) => p.userId === viewer.id);
  const fp = d.farmerProfiles.find((p) => p.userId === viewer.id);
  const bp = d.buyerProfiles.find((p) => p.userId === viewer.id);
  const myDistrict = personal ? (fp?.district ?? bp?.district ?? d.expertProfiles.find((e) => e.userId === viewer.id)?.district ?? pro?.location.district) : undefined;
  const myCrops = personal ? new Set([...d.crops.filter((c) => c.ownerId === viewer.id).map((c) => c.name.toLowerCase()), ...(bp?.cropsPurchased ?? []).map((c) => c.toLowerCase())]) : new Set<string>();
  const interests = personal ? new Set((fp?.interests ?? []).map((i) => i.toLowerCase())) : new Set<string>();
  const out: OpportunityDTO[] = [];

  // 1 · Buyer requirements (farmers / FPOs)
  if (viewer.role === "FARMER" || viewer.role === "FPO") {
    for (const r of d.requirements.filter((x) => x.status === "OPEN" && !x.hidden)) {
      const score = personal ? requirementScoreForFarmer(d, viewer, r) : 20;
      if (score <= 0) continue;
      const buyer = d.buyerProfiles.find((b) => b.userId === r.buyerId);
      const reasons = [d.crops.some((c) => c.ownerId === viewer.id && c.name.toLowerCase() === r.crop.toLowerCase()) ? `You grow ${r.crop}` : null, myDistrict && myDistrict.toLowerCase() === r.district.toLowerCase() ? `Same district (${r.district})` : null].filter(Boolean);
      out.push({ id: `req_${r.id}`, kind: "BUYER_REQUIREMENT", title: `${r.crop} — ${formatNumber(r.quantity)} ${unitLabel(r.unit)}`, subtitle: `${buyer?.businessName ?? "Buyer"} · ${r.district}`, reason: reasons.join(" · ") || "Open buyer requirement", href: `/market?tab=requirements&focus=${r.id}`, scene: "market", badge: "Buyer requirement", deadline: r.windowEnd, score: 60 + score * 0.4, isDemo: r.isDemo });
    }
  }

  // 1b · Matching produce (buyers)
  if (viewer.role === "BUYER") {
    for (const r of d.requirements.filter((x) => x.buyerId === viewer.id && x.status === "OPEN")) {
      const best = d.listings.map((l) => ({ l, s: scoreListing(d, r, l) })).filter((x) => x.s).sort((a, b) => b.s!.score - a.s!.score).slice(0, 2);
      for (const { l, s } of best) {
        out.push({ id: `prod_${l.id}`, kind: "PRODUCE", title: `${l.crop} — ${formatNumber(l.quantity)} ${unitLabel(l.unit)} in ${l.location.district}`, subtitle: `Matches your requirement for ${r.crop}`, reason: s!.reasons.slice(0, 3).join(" · "), href: `/market/${l.id}`, scene: "market", badge: "Matching produce", score: 50 + s!.score * 0.5, isDemo: l.isDemo });
      }
    }
  }

  // 1c · Work opportunities & service requests that match this professional (jobs, daily work, contracts, apprenticeships…)
  if (pro) {
    for (const w of d.workOpportunities.filter((x) => x.status === "OPEN" && x.posterId !== viewer.id && opportunityVisible(v, x))) {
      const m = personal ? matchOpportunity(d, viewer.id, w) : { score: 0, reasons: [] as string[] };
      if (personal && m.score <= 0) continue;
      const done = d.applications.some((a) => a.opportunityId === w.id && a.applicantId === viewer.id && a.status !== "WITHDRAWN");
      out.push({
        id: `work_${w.id}`,
        kind: "WORK",
        title: w.title,
        subtitle: `${w.location.district} · ${payLabel(w.pay)}`,
        reason: m.reasons.join(" · ") || "Open work opportunity",
        href: `/opportunities/${w.id}`,
        scene: "workshop",
        badge: done ? "Applied" : "Work",
        deadline: w.startDate,
        score: 55 + m.score * 0.45 - (done ? 30 : 0),
        isDemo: w.isDemo,
      });
    }
  }

  // 2 · Government schemes (potentially relevant — never claims eligibility)
  for (const s of d.schemes.filter((x) => !x.hidden && ["SCHEME", "SUBSIDY", "INSURANCE", "CREDIT", "TRAINING"].includes(x.category) && schemeForViewer(d, viewer, x))) {
    // The original farmer-training entries are listed under "Training & events" below, not twice.
    if (s.category === "TRAINING" && !s.audience?.length) continue;
    out.push({ id: `sch_${s.id}`, kind: "SCHEME", title: s.name, subtitle: `${s.topic ?? "Agriculture"} · ${s.state}`, reason: "Potentially relevant — check eligibility on the official source", href: `/schemes/${s.id}`, scene: "classroom", badge: s.isDemo ? "Demo scheme" : "Government scheme", deadline: s.deadline, score: 40 + (s.deadline ? 8 : 0), isDemo: s.isDemo });
  }

  // 3 · Training & events (farm-only event types are hidden from other professions)
  for (const e of d.events.filter((x) => !x.hidden && eventStatus(x) !== "ENDED" && (farmViewer || !FARM_EVENT_CATEGORIES.has(x.category)))) {
    const training = TRAINING_CATEGORIES.has(e.category);
    const mySkills = pro ? pro.skills.map((s) => s.name.toLowerCase()) : [];
    const topicHit = [...myCrops, ...interests, ...mySkills].some((t) => `${e.name} ${e.description} ${e.topics.join(" ")}`.toLowerCase().includes(t));
    const km = myDistrict && e.district ? (e.district.toLowerCase() === myDistrict.toLowerCase() ? 0 : districtDistanceKm(e.district, myDistrict)) : null;
    const days = Math.max(0, (Date.parse(e.startsAt) - Date.now()) / 86_400_000);
    const score = 35 + (topicHit ? 20 : 0) + (km === 0 ? 15 : km !== null && km < 150 ? 8 : 0) + Math.max(0, 12 - days);
    out.push({
      id: `evt_${e.id}`,
      kind: training ? "TRAINING" : "EVENT",
      title: e.name,
      subtitle: `${e.category} · ${e.location}`,
      reason: [topicHit ? "Matches your crops or interests" : null, km === 0 ? `In your district (${e.district})` : km !== null && km < 150 ? `${km} km away` : null].filter(Boolean).join(" · ") || "Upcoming near you",
      href: `/events/${e.id}`,
      scene: e.scene,
      badge: training ? "Training" : e.category,
      deadline: e.startsAt,
      score,
      isDemo: e.isDemo,
    });
  }

  // 4 · Machinery nearby
  if (viewer.role === "FARMER" && myDistrict) {
    for (const m of d.machinery.filter((x) => x.available && !x.hidden && x.ownerId !== viewer.id)) {
      const km = m.district.toLowerCase() === myDistrict.toLowerCase() ? 0 : districtDistanceKm(m.district, myDistrict);
      if (km === null || km > 200) continue;
      out.push({ id: `mac_${m.id}`, kind: "MACHINERY", title: `${m.type} available — ${m.name}`, subtitle: `${m.district}`, reason: km === 0 ? "In your district" : `${km} km from you`, href: "/machinery", scene: "tractor", badge: "Machinery", score: 38 + Math.max(0, 14 - km / 15), isDemo: m.isDemo });
    }
  }

  // 5 · FPO opportunities
  if (viewer.role === "FARMER") {
    for (const f of d.fpos) {
      if (fp?.fpoIds.includes(f.id)) continue;
      const cropHit = f.crops.some((c) => myCrops.has(c.toLowerCase()));
      const local = myDistrict && f.district.toLowerCase() === myDistrict.toLowerCase();
      if (!cropHit && !local) continue;
      out.push({ id: `fpo_${f.id}`, kind: "FPO", title: `Join ${f.name}`, subtitle: `${f.district} · ${f.crops.join(", ")}`, reason: [cropHit ? "Collective marketing for your crops" : null, local ? "In your district" : null].filter(Boolean).join(" · "), href: `/orgs/${f.userId}`, scene: "market", badge: "FPO", score: 36 + (cropHit ? 10 : 0), isDemo: f.isDemo });
    }
  }

  // 6 · Courses to continue / start
  for (const c of d.courses.filter((x) => !x.hidden && courseForViewer(x.professionIds, pro?.professionId, farmViewer))) {
    const progress = d.courseProgress.find((p) => p.userId === viewer.id && p.courseId === c.id);
    const mods = d.courseModules.filter((m) => m.courseId === c.id).length;
    const done = progress?.completedModuleIds.length ?? 0;
    if (mods && done >= mods) continue;
    const hit = myCrops.has(c.category.toLowerCase()) || interests.has(c.category.toLowerCase()) || (!!pro && !!c.professionIds?.includes(pro.professionId));
    out.push({ id: `crs_${c.id}`, kind: "COURSE", title: c.title, subtitle: done ? `${done} of ${mods} lessons done` : `${c.level} · ${mods} lessons`, reason: done ? "Continue where you left off" : hit ? "Matches your crops or interests" : "Popular learning course", href: `/learning/${c.id}`, scene: c.scene, badge: "Learning", score: 30 + (done ? 22 : 0) + (hit ? 14 : 0), isDemo: c.isDemo });
  }

  return out.sort((a, b) => b.score - a.score);
}
