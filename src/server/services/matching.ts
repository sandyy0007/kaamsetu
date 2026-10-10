/**
 * Farmer ↔ buyer matching. A transparent, additive scoring model (0–100) — each component is
 * reported back as a human-readable reason so users can see WHY something matched.
 * The weights live in one place so they can later be replaced by a learned ranker.
 */
import type { BuyerRequirement, Db, ProduceListing, User } from "@/types/domain";
import type { MatchDTO } from "@/types/dto";
import { districtDistanceKm } from "@/lib/geo";
import { formatNumber, formatShortDate, unitLabel } from "@/lib/utils";
import { farmerCard, listingDTO, listingVisible, type View } from "../mappers";

const sameCrop = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function scoreListing(d: Db, req: BuyerRequirement, l: ProduceListing): { score: number; reasons: string[] } | null {
  if (!sameCrop(l.crop, req.crop) || l.status !== "AVAILABLE" || l.hidden) return null;
  const reasons: string[] = [`Grows ${l.crop}`];
  let score = 20; // crop match

  // Quantity (0–25): how much of the requirement this lot covers.
  const need = req.unit === l.unit ? req.quantity : req.unit === "QUINTAL" && l.unit === "KG" ? req.quantity * 100 : req.unit === "QUINTAL" && l.unit === "TONNE" ? req.quantity / 10 : req.quantity;
  const coverage = Math.min(1, l.quantity / Math.max(need, 1));
  score += Math.round(coverage * 25);
  reasons.push(`${formatNumber(l.quantity)} ${unitLabel(l.unit)} available of ${formatNumber(req.quantity)} needed`);

  // Location (0–25)
  if (l.location.district.toLowerCase() === req.district.toLowerCase()) {
    score += 25;
    reasons.push(`Same district (${req.district})`);
  } else {
    const km = districtDistanceKm(l.location.district, req.district);
    if (km !== null) {
      const pts = km < 100 ? 18 : km < 200 ? 11 : km < 350 ? 5 : 0;
      score += pts;
      reasons.push(`${l.location.district} is ~${km} km from ${req.district}`);
    }
  }

  // Availability vs. purchase window (0–10)
  if (Date.parse(l.harvestDate) <= Date.parse(req.windowEnd)) {
    score += 10;
    reasons.push(`Ready before ${formatShortDate(req.windowEnd)}`);
  }

  // Trust (0–15 + 5)
  const owner = d.users.find((u) => u.id === l.ownerId);
  if (owner?.verifiedAt) {
    score += 15;
    reasons.push("Verified seller");
  }
  if (l.fpoId) {
    score += 5;
    reasons.push("FPO-aggregated lot");
  }
  return { score: Math.min(100, score), reasons };
}

/** Potential sellers for a buyer's requirement, best first. Respects each farmer's produce privacy. */
export function matchesForRequirement(v: View, req: BuyerRequirement): MatchDTO[] {
  const out: MatchDTO[] = [];
  for (const l of v.d.listings) {
    if (!listingVisible(v, l)) continue;
    const s = scoreListing(v.d, req, l);
    if (!s) continue;
    out.push({ listing: listingDTO(v, l), farmer: farmerCard(v, l.ownerId), score: s.score, reasons: s.reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 20);
}

/** How well open requirements fit a farmer's own produce (or, failing that, their crops). */
export function requirementScoreForFarmer(d: Db, user: User, req: BuyerRequirement): number {
  const mine = d.listings.filter((l) => l.ownerId === user.id);
  const best = Math.max(0, ...mine.map((l) => scoreListing(d, req, l)?.score ?? 0));
  if (best > 0) return best;
  const grows = d.crops.some((c) => c.ownerId === user.id && sameCrop(c.name, req.crop));
  if (!grows) return 0;
  const profile = d.farmerProfiles.find((p) => p.userId === user.id);
  const km = profile ? districtDistanceKm(profile.district, req.district) : null;
  return 15 + (km === null ? 0 : km < 100 ? 20 : km < 200 ? 10 : 0);
}
