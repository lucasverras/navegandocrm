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
export const PIPELINE_STAGES = ["new", "qualified", "to_approach", "in_contact", "meeting_proposal", "closed"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: "Novos",
  qualified: "Qualificados",
  to_approach: "A abordar",
  in_contact: "Em contato",
  meeting_proposal: "Reunião / Proposta",
  closed: "Fechados",
};

export const MEETING_STATUSES = ["scheduled", "held", "proposal_pending", "proposal_sent", "negotiation"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Reunião marcada",
  held: "Reunião realizada",
  proposal_pending: "Proposta pendente",
  proposal_sent: "Proposta enviada",
  negotiation: "Negociação",
};
