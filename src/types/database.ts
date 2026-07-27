// Hand-written Supabase type definitions matching supabase/migrations/*.sql.
// If the schema changes, update this file (or regenerate via `supabase gen types`).

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface RegionRow {
  id: string;
  neighborhood: string;
  city: string;
  state: string;
  radius_meters: number;
  status: "active" | "archived";
  last_searched_at: string | null;
  restaurants_found: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchRow {
  id: string;
  region_id: string;
  status: "running" | "completed" | "failed" | "partial";
  categories: string[];
  queries_executed: number;
  places_found: number;
  places_new: number;
  places_duplicate: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface LeadRow {
  id: string;
  region_id: string;
  place_id: string;
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  maps_url: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  price_level: number | null;
  estimated_units: number | null;
  lat: number | null;
  lng: number | null;
  pre_score: number;
  ai_score: number | null;
  agency_status: "confirmed" | "probable" | "internal_team_probable" | "no_signs" | "unknown";
  business_status: "client" | "closed" | "not_interested" | "in_progress" | "new";
  commercial_status:
    | "not_contacted"
    | "message_ready"
    | "message_sent"
    | "invalid_number"
    | "chatbot"
    | "reception_answered"
    | "forwarded"
    | "owner_contact_obtained"
    | "awaiting_reply"
    | "no_reply"
    | "not_interested"
    | "meeting_scheduled";
  is_duplicate: boolean;
  is_demo: boolean;
  notes: string | null;
  opted_out: boolean;
  pipeline_stage: "new" | "qualified" | "to_approach" | "in_contact" | "meeting_proposal" | "closed";
  pipeline_position: number;
  previous_stage: string | null;
  stage_changed_at: string;
  assigned_to: string | null;
  next_follow_up_at: string | null;
  last_activity_at: string;
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  meeting_at: string | null;
  meeting_status: "scheduled" | "held" | "proposal_pending" | "proposal_sent" | "negotiation" | null;
  proposal_sent_at: string | null;
  closed_at: string | null;
  closed_service: string | null;
  closed_value: number | null;
  closed_note: string | null;
  lost_reason: string | null;
  archived_at: string | null;
  discovery_campaign_id: string | null;
  triage_status: "pending_review" | "approved" | "rejected" | "review_later" | "auto_filtered";
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  approval_notes: string | null;
  exclusion_reason:
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
    | null;
  preparation_status: "not_prepared" | "preparing" | "partially_prepared" | "ready" | "outdated" | "failed";
  prepared_at: string | null;
  preparation_hash: string | null;
  next_best_action: string | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  instagram_confirmed: boolean;
  instagram_confirmation_method: "manual" | "ai_search" | null;
  instagram_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryCampaignRow {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  radius_meters: number;
  included_types: string[];
  excluded_types: string[];
  blocked_keywords: string[];
  min_rating: number | null;
  min_reviews: number | null;
  exclude_franchises: boolean;
  exclude_chains: boolean;
  exclude_no_phone: boolean;
  exclude_no_website: boolean;
  status: "active" | "paused" | "archived";
  last_searched_at: string | null;
  source_region_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryCampaignStatsRow {
  discovery_campaign_id: string;
  pending_review: number;
  approved: number;
  rejected: number;
  review_later: number;
  auto_filtered: number;
  prepared: number;
  in_pipeline: number;
  total_found: number;
}

export interface LeadSourceRow {
  id: string;
  lead_id: string;
  source_type: string;
  raw_data: Json;
  fetched_at: string;
}

export interface LeadAnalysisRow {
  id: string;
  lead_id: string;
  model: string;
  opportunity_score: number;
  contact_score: number;
  business_strength: "weak" | "medium" | "strong" | "unknown";
  marketing_status: "strong" | "regular" | "weak" | "abandoned" | "unknown";
  agency_status: "confirmed" | "probable" | "internal_team_probable" | "no_signs" | "unknown";
  agency_confidence: number;
  opportunity_focus: string;
  main_opportunity: string;
  evidence: Json;
  recommended_service: string;
  recommended_approach: "social_proof" | "diagnosis" | "question" | "expansion";
  risks: Json;
  should_contact: boolean;
  reason: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  is_refined: boolean;
  created_at: string;
}

export interface DecisionMakerRow {
  id: string;
  lead_id: string;
  name: string | null;
  role: string | null;
  contact_type: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  source_url: string | null;
  source_title: string | null;
  excerpt: string | null;
  confidence: number;
  found: boolean;
  opted_out: boolean;
  researched_at: string;
}

export interface OutreachMessageRow {
  id: string;
  lead_id: string;
  variant: "social_proof" | "diagnosis" | "question" | "expansion" | "routing" | "agency" | "abandoned_instagram";
  content: string;
  original_content: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  edited: boolean;
  refined: boolean;
  created_at: string;
}

export interface OutreachEventRow {
  id: string;
  lead_id: string;
  message_id: string | null;
  event_type: string;
  channel: string;
  metadata: Json;
  created_at: string;
}

export interface CampaignRow {
  id: string;
  name: string;
  variant: "A" | "B" | "C";
  description: string | null;
  created_at: string;
}

export interface CampaignLeadRow {
  id: string;
  campaign_id: string;
  lead_id: string;
  responded: boolean;
  positive_response: boolean;
  meeting_scheduled: boolean;
  proposal_sent: boolean;
  closed_won: boolean;
  created_at: string;
}

export interface ApiUsageRow {
  id: string;
  service: string;
  model: string | null;
  operation: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  lead_id: string | null;
  region_id: string | null;
  created_at: string;
}

export interface SettingsRow {
  key: string;
  value: Json;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      regions: TableDef<RegionRow>;
      discovery_campaigns: TableDef<DiscoveryCampaignRow>;
      searches: TableDef<SearchRow>;
      leads: TableDef<LeadRow>;
      lead_sources: TableDef<LeadSourceRow>;
      lead_analysis: TableDef<LeadAnalysisRow>;
      decision_makers: TableDef<DecisionMakerRow>;
      outreach_messages: TableDef<OutreachMessageRow>;
      outreach_events: TableDef<OutreachEventRow>;
      campaigns: TableDef<CampaignRow>;
      campaign_leads: TableDef<CampaignLeadRow>;
      api_usage: TableDef<ApiUsageRow>;
      settings: TableDef<SettingsRow>;
      profiles: TableDef<ProfileRow>;
    };
    Views: {
      discovery_campaign_stats: { Row: DiscoveryCampaignStatsRow };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
