import type { PlaceResult } from "@/lib/google-places";

// Pure, deterministic filtering of raw Google Places results before they ever reach a human.
// No AI involved — obvious junk (markets, pharmacies, gas stations...) is removed by code,
// not by prompting a model. Every excluded candidate is still recorded (with a reason),
// never silently dropped, so the exclusion is auditable from the Descobrir screen.

export type ExclusionReason =
  | "blocked_category"
  | "blocked_keyword"
  | "closed"
  | "duplicate"
  | "out_of_radius"
  | "low_reviews"
  | "already_rejected"
  | "existing_client"
  | "already_prospected"
  | "excluded_franchise";

// Google Places (New) types that are never relevant to a restaurant/food-service prospecting tool,
// regardless of what campaign-specific `excluded_types` say.
export const DEFAULT_DENYLIST_TYPES = [
  "supermarket",
  "grocery_store",
  "pharmacy",
  "drugstore",
  "convenience_store",
  "gas_station",
  "shopping_mall",
  "hotel",
  "hospital",
  "department_store",
  "wholesaler",
  "pet_store",
  "clothing_store",
  "gym",
  "beauty_salon",
  "furniture_store",
] as const;

// Portuguese keywords checked against the establishment name (accent/case-insensitive).
// "empório" is special-cased: only blocks when no food-signal word is also present,
// since "Empório Gourmet"/"Empório do Pão" etc are legitimate food businesses.
const KEYWORD_BLOCKLIST: string[] = [
  "mercado",
  "supermercado",
  "farmacia",
  "drogaria",
  "conveniencia",
  "atacado",
  "atacadao",
  "distribuidora",
  "hortifruti",
  "posto",
  "hotel",
  "hospital",
  "loja",
  "pet",
  "suplementos",
];

const FOOD_SIGNAL_WORDS = [
  "gourmet",
  "restaurante",
  "cafe",
  "café",
  "padaria",
  "confeitaria",
  "bar",
  "pizzaria",
  "hamburgueria",
  "churrascaria",
  "cozinha",
  "bistro",
  "trattoria",
  "cantina",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function matchesBlockedKeyword(name: string, extraBlocklist: string[] = []): string | null {
  const normalized = normalize(name);
  const allBlocked = [...KEYWORD_BLOCKLIST, ...extraBlocklist.map(normalize)];

  for (const word of allBlocked) {
    const w = normalize(word);
    if (!normalized.includes(w)) continue;
    if (w === "emporio" && FOOD_SIGNAL_WORDS.some((f) => normalized.includes(normalize(f)))) {
      continue; // "Empório Gourmet" etc — has a food signal, don't block.
    }
    return word;
  }
  return null;
}

export function matchesDenylistType(types: string[], extraExcluded: string[] = []): string | null {
  const denylist = new Set([...DEFAULT_DENYLIST_TYPES, ...extraExcluded]);
  for (const t of types) {
    if (denylist.has(t)) return t;
  }
  return null;
}

// Small, editable starter list — not exhaustive by design (v1). Matched as a substring
// against the normalized name; campaigns can extend via blocked_keywords for local chains.
const KNOWN_FRANCHISE_NAMES = [
  "mcdonald",
  "burger king",
  "subway",
  "habib",
  "china in box",
  "outback",
  "starbucks",
  "spoleto",
  "bob's",
  "kfc",
  "pizza hut",
  "domino",
];

export function matchesKnownFranchise(name: string): boolean {
  const normalized = normalize(name);
  return KNOWN_FRANCHISE_NAMES.some((f) => normalized.includes(normalize(f)));
}

export interface DiscoveryCampaignFilters {
  excluded_types: string[];
  blocked_keywords: string[];
  min_rating: number | null;
  min_reviews: number | null;
  exclude_franchises: boolean;
  exclude_chains: boolean;
  exclude_no_phone: boolean;
  exclude_no_website: boolean;
}

export interface ExistingLeadLookup {
  isDuplicate: boolean;
  isExistingClient: boolean;
  isAlreadyRejected: boolean;
  isAlreadyProspected: boolean;
}

// Order matters: cheapest/most-certain checks first. Returns null when the place passes
// every filter and should go to `pending_review`.
export function classifyExclusion(
  place: PlaceResult,
  campaign: DiscoveryCampaignFilters,
  existing: ExistingLeadLookup
): ExclusionReason | null {
  if (existing.isDuplicate) return "duplicate";
  if (existing.isExistingClient) return "existing_client";
  if (existing.isAlreadyRejected) return "already_rejected";
  if (existing.isAlreadyProspected) return "already_prospected";

  const deniedType = matchesDenylistType(place.types, campaign.excluded_types);
  if (deniedType) return "blocked_category";

  const blockedWord = matchesBlockedKeyword(place.name, campaign.blocked_keywords);
  if (blockedWord) return "blocked_keyword";

  if ((campaign.exclude_franchises || campaign.exclude_chains) && matchesKnownFranchise(place.name)) {
    return "excluded_franchise";
  }

  if (campaign.exclude_no_phone && !place.phone) return "blocked_category";
  if (campaign.exclude_no_website && !place.website) return "blocked_category";

  if (campaign.min_rating != null && (place.rating ?? 0) < campaign.min_rating) return "low_reviews";
  if (campaign.min_reviews != null && (place.reviewCount ?? 0) < campaign.min_reviews) return "low_reviews";

  return null;
}
