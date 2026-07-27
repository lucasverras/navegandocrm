import type { LeadRow } from "@/types/database";

// Pure, deterministic pre-score (0-100). No AI involved.
// Reformulated (fase 1): removed the four "status" bonuses that were always-true at
// insertion time (notDuplicate/notContacted/notClient/notClosed — every new lead starts
// not-duplicate/not-contacted/not-a-client/not-closed, so they were a flat +25 baked into
// every score, not a real differentiator). Removed `categoryMatch` as a no-op (every
// searched category always "matched"). Points redistributed into objective, verifiable
// signals. This score must never claim financial capacity, marketing quality, agency
// presence, purchase intent, or revenue — it only reflects what Google Places tells us.
export interface PreScoreWeights {
  reviewCount: number;
  rating: number;
  hasWebsite: number;
  hasPhone: number;
  priceLevelFound: number;
  appearsActive: number;
  likelyIndependentBusiness: number;
  multiUnit: number;
  instagramFound: number;
}

export const DEFAULT_PRESCORE_WEIGHTS: PreScoreWeights = {
  reviewCount: 25,
  rating: 20,
  hasWebsite: 10,
  hasPhone: 5,
  priceLevelFound: 5,
  appearsActive: 15,
  likelyIndependentBusiness: 10,
  multiUnit: 5,
  instagramFound: 5,
};

export type PreScoreBucket = "weak" | "review" | "interesting" | "strong" | "exceptional";

export function getPreScoreBucket(score: number): PreScoreBucket {
  if (score < 40) return "weak";
  if (score < 60) return "review";
  if (score < 75) return "interesting";
  if (score < 90) return "strong";
  return "exceptional";
}

export const PRE_SCORE_BUCKET_LABELS: Record<PreScoreBucket, string> = {
  weak: "Fraco",
  review: "Revisar",
  interesting: "Interessante",
  strong: "Forte",
  exceptional: "Excepcional",
};

type PreScoreInput = Pick<
  LeadRow,
  "google_review_count" | "google_rating" | "website" | "phone" | "price_level" | "estimated_units"
> & {
  isLikelyIndependent?: boolean;
  instagramFound?: boolean;
};

// Computed at insertion time (Discovery). `instagramFound` is only ever true after
// Preparation — when preparation_status transitions to `ready`, the caller recomputes
// this score once more with instagramFound set, folding in that later-known signal.
// This is a deliberate, documented exception to "computed once and never touched again."
export function calculatePreScore(
  lead: PreScoreInput,
  weights: PreScoreWeights = DEFAULT_PRESCORE_WEIGHTS
): number {
  let score = 0;

  // Review count: logarithmic scale, saturates around 300 reviews — avoids a handful of
  // reviews scoring nearly as high as an established, well-reviewed place.
  const reviews = lead.google_review_count ?? 0;
  const reviewFactor = Math.min(1, Math.log10(reviews + 1) / Math.log10(300));
  score += reviewFactor * weights.reviewCount;

  // Rating: normalized 0-5, but only counted once there's enough review volume to trust it
  // (a single 5-star review shouldn't score like a well-established 4.5).
  const rating = lead.google_rating ?? 0;
  const ratingTrust = Math.min(1, reviews / 10);
  score += (rating / 5) * weights.rating * ratingTrust;

  if (lead.website) score += weights.hasWebsite;
  if (lead.phone) score += weights.hasPhone;
  if (lead.price_level != null) score += weights.priceLevelFound;

  const appearsActive = reviews > 0 && rating > 0;
  if (appearsActive) score += weights.appearsActive;

  if (lead.isLikelyIndependent) score += weights.likelyIndependentBusiness;
  if ((lead.estimated_units ?? 1) > 1) score += weights.multiUnit;
  if (lead.instagramFound) score += weights.instagramFound;

  return Math.round(Math.max(0, Math.min(100, score)));
}
