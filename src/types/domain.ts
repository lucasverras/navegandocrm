export const CATEGORIES = [
  "restaurant",
  "bar",
  "cafe",
  "bakery",
  "meal_takeaway",
  "steak_house",
  "hamburger_restaurant",
  "pizza_restaurant",
  "brazilian_restaurant",
  "italian_restaurant",
  "japanese_restaurant",
  "seafood_restaurant",
  "dessert_shop",
  "ice_cream_shop",
  "coffee_shop",
  "sandwich_shop",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Human, Portuguese labels for Google Places types. Single source of truth — reused by the
// leads table, cards, triage, detail and filters so raw English types (meal_takeaway, ...) are
// never shown to the operator. Google can return types outside CATEGORIES, so `categoryLabel`
// falls back to a de-slugged version rather than the raw token.
export const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurante",
  bar: "Bar",
  cafe: "Cafeteria",
  bakery: "Padaria",
  meal_takeaway: "Delivery / Retirada",
  steak_house: "Churrascaria",
  hamburger_restaurant: "Hamburgueria",
  pizza_restaurant: "Pizzaria",
  brazilian_restaurant: "Comida brasileira",
  italian_restaurant: "Comida italiana",
  japanese_restaurant: "Comida japonesa",
  seafood_restaurant: "Frutos do mar",
  dessert_shop: "Doceria",
  ice_cream_shop: "Sorveteria",
  coffee_shop: "Café",
  sandwich_shop: "Sanduicheria",
  // Common extra types Google occasionally returns:
  food: "Alimentação",
  point_of_interest: "Estabelecimento",
  establishment: "Estabelecimento",
  fast_food_restaurant: "Fast-food",
  fine_dining_restaurant: "Alta gastronomia",
  sushi_restaurant: "Japonês / Sushi",
  vegetarian_restaurant: "Vegetariano",
  wine_bar: "Wine bar",
  pub: "Pub",
};

export function categoryLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const known = CATEGORY_LABELS[raw];
  if (known) return known;
  // De-slug unknown Google types: "korean_restaurant" -> "Korean restaurant".
  const cleaned = raw.replace(/_/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export const COMMERCIAL_STATUSES = [
  "not_contacted",
  "message_ready",
  "message_sent",
  "invalid_number",
  "chatbot",
  "reception_answered",
  "forwarded",
  "owner_contact_obtained",
  "awaiting_reply",
  "no_reply",
  "not_interested",
  "meeting_scheduled",
] as const;

export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

export const AGENCY_STATUSES = [
  "confirmed",
  "probable",
  "internal_team_probable",
  "no_signs",
  "unknown",
] as const;
export type AgencyStatus = (typeof AGENCY_STATUSES)[number];

export const MARKETING_STATUSES = ["strong", "regular", "weak", "abandoned", "unknown"] as const;
export type MarketingStatus = (typeof MARKETING_STATUSES)[number];

export interface AnalysisEvidence {
  claim: string;
  source: string;
  confidence: number;
}

export interface AiAnalysisResult {
  opportunity_score: number;
  contact_score: number;
  business_strength: "weak" | "medium" | "strong" | "unknown";
  marketing_status: MarketingStatus;
  agency_status: AgencyStatus;
  agency_confidence: number;
  opportunity_focus: string;
  main_opportunity: string;
  evidence: AnalysisEvidence[];
  recommended_service: string;
  recommended_approach: "social_proof" | "diagnosis" | "question" | "expansion";
  risks: string[];
  should_contact: boolean;
  reason: string;
}

export const MESSAGE_VARIANTS = [
  "social_proof",
  "diagnosis",
  "question",
  "expansion",
  "routing",
  "agency",
  "abandoned_instagram",
] as const;
export type MessageVariant = (typeof MESSAGE_VARIANTS)[number];

// Commercial pipeline (Kanban stages) — separate concern from business_status/commercial_status,
// which track outreach/relationship status, not deal position.
export const PIPELINE_STAGES = [
  "ready_to_approach",
  "first_contact",
  "reaching_dm",
  "talking_dm",
  "meeting",
  "proposal",
  "negotiation",
  "closed",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  ready_to_approach: "A abordar",
  first_contact: "Contato feito",
  reaching_dm: "Tentando decisor",
  talking_dm: "Falando com decisor",
  meeting: "Reunião",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed: "Fechado",
};

// The first stage a lead lands on when consciously added to the pipeline.
export const FIRST_PIPELINE_STAGE: PipelineStage = "ready_to_approach";

// Follow-up cadence (Odoo activity-plan pattern, manual send): D+2 → D+5 → D+10.
// The system creates demands; it never sends messages automatically.
export const CADENCE_STEP_DAYS = [2, 5, 10] as const;

// Next action — every active commercial lead answers "qual é o próximo passo?"
// (SuiteCRM "Next Step" + Odoo activity). Hoje is built entirely from these.
export const NEXT_ACTION_TYPES = [
  "first_approach",
  "follow_up",
  "respond",
  "call_decisor",
  "meeting",
  "chase_proposal",
] as const;
export type NextActionType = (typeof NEXT_ACTION_TYPES)[number];

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  first_approach: "Primeira abordagem",
  follow_up: "Follow-up",
  respond: "Responder",
  call_decisor: "Chamar decisor",
  meeting: "Reunião",
  chase_proposal: "Cobrar proposta",
};

export function nextActionLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return NEXT_ACTION_LABELS[raw as NextActionType] ?? raw.replace(/_/g, " ");
}

export const MEETING_STATUSES = ["scheduled", "held", "proposal_pending", "proposal_sent", "negotiation"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Reunião marcada",
  held: "Reunião realizada",
  proposal_pending: "Proposta pendente",
  proposal_sent: "Proposta enviada",
  negotiation: "Negociação",
};
