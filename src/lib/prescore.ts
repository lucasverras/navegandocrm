import type { LeadRow } from "@/types/database";

// Pure, deterministic pre-score (0-100). No AI involved.
// Weights are defaults; can be overridden via the `settings` table (key = "prescore_weights").
export interface PreScoreWeights {
  reviewCount: number;
  rating: number;
  hasWebsite: number;
  hasPhone: number;
  categoryMatch: number;
  appearsActive: number;
  notDuplicate: number;
  notContacted: number;
  notClient: number;
  notClosed: number;
  multiUnit: number;
}

export const DEFAULT_PRESCORE_WEIGHTS: PreScoreWeights = {
  reviewCount: 20,
  rating: 15,
  hasWebsite: 10,
  hasPhone: 10,
  categoryMatch: 10,
  appearsActive: 15,
  notDuplicate: 5,
  notContacted: 10,
  notClient: 5,
  notClosed: 5,
  multiUnit: 5,
};

type PreScoreInput = Pick<
  LeadRow,
  | "google_review_count"
  | "google_rating"
  | "website"
  | "phone"
  | "category"
  | "is_duplicate"
  | "commercial_status"
  | "business_status"
  | "estimated_units"
>;

export function calculatePreScore(
  lead: PreScoreInput,
  weights: PreScoreWeights = DEFAULT_PRESCORE_WEIGHTS
): number {
  let score = 0;

  // Review count: logarithmic scale, saturates around 300 reviews.
  const reviews = lead.google_review_count ?? 0;
  const reviewFactor = Math.min(1, Math.log10(reviews + 1) / Math.log10(300));
  score += reviewFactor * weights.reviewCount;

  // Rating: normalized 0-5.
  const rating = lead.google_rating ?? 0;
  score += (rating / 5) * weights.rating;

  if (lead.website) score += weights.hasWebsite;
  if (lead.phone) score += weights.hasPhone;

  // Category compatibility: all tracked categories count as compatible.
  if (lead.category) score += weights.categoryMatch;

  // "Appears active" heuristic: has recent-enough signal (reviews + rating present).
  const appearsActive = reviews > 0 && rating > 0;
  if (appearsActive) score += weights.appearsActive;

  if (!lead.is_duplicate) score += weights.notDuplicate;
  if (lead.commercial_status === "not_contacted") score += weights.notContacted;
  if (lead.business_status !== "client") score += weights.notClient;
  if (lead.business_status !== "closed") score += weights.notClosed;
  if ((lead.estimated_units ?? 1) > 1) score += weights.multiUnit;

  return Math.round(Math.max(0, Math.min(100, score)));
}
