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
  | "excluded_franchise"
  | "not_food"; // passed nothing on the allowlist and the name shows no food signal

// The only Google Places (New) types we actively want. A place must have at least one of these
// (or a food-signal word in its name) to survive — Google mislabels enough that a type NOT on
// the denylist is not, by itself, a reason to trust it. This is the allowlist half of the layered
// filter: DENYLIST → BRAND → KEYWORDS → ALLOWLIST → campaign rules.
export const ALLOWLIST_TYPES = new Set<string>([
  "restaurant",
  "bar",
  "cafe",
  "coffee_shop",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "pizza_restaurant",
  "hamburger_restaurant",
  "sandwich_shop",
  "brazilian_restaurant",
  "italian_restaurant",
  "japanese_restaurant",
  "sushi_restaurant",
  "chinese_restaurant",
  "mexican_restaurant",
  "korean_restaurant",
  "thai_restaurant",
  "indian_restaurant",
  "seafood_restaurant",
  "steak_house",
  "barbecue_restaurant",
  "vegetarian_restaurant",
  "vegan_restaurant",
  "fast_food_restaurant",
  "fine_dining_restaurant",
  "dessert_shop",
  "dessert_restaurant",
  "ice_cream_shop",
  "donut_shop",
  "bagel_shop",
  "juice_shop",
  "wine_bar",
  "pub",
  "diner",
  "cafeteria",
  "food_court",
  "acai_shop",
  "confectionery",
  "tea_house",
  "breakfast_restaurant",
  "brunch_restaurant",
  "food",
]);

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
  "hipermercado",
  "minimercado",
  "mercadinho",
  "sacolao",
  "farmacia",
  "drogaria",
  "drogasil",
  "conveniencia",
  "atacado",
  "atacadao",
  "distribuidora",
  "hortifruti",
  "acougue",
  "posto",
  "petrobras",
  "ipiranga",
  "shell",
  "hotel",
  "hospital",
  "papelaria",
  "loja",
  "petshop",
  "pet shop",
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary match on the accent-stripped name, so "Posto Petrobras" is blocked but
// "Apóstolo"/"Shellfish" (which merely contain the letters) are not.
export function matchesBlockedKeyword(name: string, extraBlocklist: string[] = []): string | null {
  const normalized = normalize(name);
  const hasFoodSignal = FOOD_SIGNAL_WORDS.some((f) => new RegExp(`\\b${escapeRegex(normalize(f))}\\b`).test(normalized));
  const allBlocked = [...KEYWORD_BLOCKLIST, ...extraBlocklist.map(normalize)];

  for (const word of allBlocked) {
    const w = normalize(word);
    if (!new RegExp(`\\b${escapeRegex(w)}\\b`).test(normalized)) continue;
    // "Empório Gourmet"/"Empório do Pão" are legit — only block "empório" without a food signal.
    if (w === "emporio" && hasFoodSignal) continue;
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
  "ragazzo",
  "giraffas",
];

export function matchesKnownFranchise(name: string): boolean {
  const normalized = normalize(name);
  return KNOWN_FRANCHISE_NAMES.some((f) => normalized.includes(normalize(f)));
}

export function matchesAllowlistType(types: string[]): boolean {
  return types.some((t) => ALLOWLIST_TYPES.has(t));
}

function hasFoodSignalWord(name: string): boolean {
  const n = normalize(name);
  return FOOD_SIGNAL_WORDS.some((f) => new RegExp(`\\b${escapeRegex(normalize(f))}\\b`).test(n));
}

// The layered classifier the brief asks for. Considers primary_type + types + name + brand +
// blocked words + allowlist. Order: DENYLIST types → BRAND blacklist → BLOCKED words → ALLOWLIST.
// Known big chains are ALWAYS blocked (they are never a fit for this agency), regardless of the
// campaign's exclude_franchises flag. Returns the reason, or null for a plausible food business.
export function classifyDiscoveredPlace(input: {
  name: string;
  types: string[];
  excludedTypes?: string[];
  blockedKeywords?: string[];
}): ExclusionReason | null {
  if (matchesDenylistType(input.types, input.excludedTypes ?? [])) return "blocked_category";
  if (matchesKnownFranchise(input.name)) return "excluded_franchise";
  if (matchesBlockedKeyword(input.name, input.blockedKeywords ?? [])) return "blocked_keyword";
  // Allowlist gate: must have at least one allowed type OR a food-signal word in the name.
  if (!matchesAllowlistType(input.types) && !hasFoodSignalWord(input.name)) return "not_food";
  return null;
}

// Reclassifies an already-stored lead, which only has a single `category` (Google primary type),
// not the full types array. Same rules, applied to `[category]`.
export function reclassifyByNameCategory(name: string, category: string | null): ExclusionReason | null {
  return classifyDiscoveredPlace({ name, types: category ? [category] : [] });
}

// A place is worth prospecting (and worth a pre-score) only when it survives the layered filter.
export function isEligibleForProspecting(name: string, types: string[]): boolean {
  return classifyDiscoveredPlace({ name, types }) === null;
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

  // Layered type/brand/word/allowlist filter (franchises always blocked). Campaign-specific
  // excluded_types/blocked_keywords are merged in.
  const layered = classifyDiscoveredPlace({
    name: place.name,
    types: place.types,
    excludedTypes: campaign.excluded_types,
    blockedKeywords: campaign.blocked_keywords,
  });
  if (layered) return layered;

  if (campaign.exclude_no_phone && !place.phone) return "blocked_category";
  if (campaign.exclude_no_website && !place.website) return "blocked_category";

  if (campaign.min_rating != null && (place.rating ?? 0) < campaign.min_rating) return "low_reviews";
  if (campaign.min_reviews != null && (place.reviewCount ?? 0) < campaign.min_reviews) return "low_reviews";

  return null;
}
