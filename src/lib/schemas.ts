import { z } from "zod";
import { CATEGORIES, PIPELINE_STAGES, MEETING_STATUSES } from "@/types/domain";

export const pipelineStageUpdateSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  position: z.number().int().min(0),
});

export const followUpUpdateSchema = z.object({
  next_follow_up_at: z.string().datetime().nullable(),
});

export const assignUpdateSchema = z.object({
  assigned_to: z.string().uuid().nullable(),
});

export const closeDealSchema = z.object({
  closed_service: z.string().min(1).max(200),
  closed_value: z.number().min(0).nullable().optional(),
  closed_note: z.string().max(2000).optional(),
});

export const meetingStatusUpdateSchema = z.object({
  meeting_status: z.enum(MEETING_STATUSES),
});

export const bulkPipelineActionSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["move_stage", "assign", "follow_up", "archive", "discard"]),
  stage: z.enum(PIPELINE_STAGES).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
});

export const regionCreateSchema = z.object({
  neighborhood: z.string().min(2).max(120),
  city: z.string().min(2).max(120),
  state: z.string().min(2).max(60),
  radius_meters: z.coerce.number().int().min(200).max(20000).default(2000),
});

export const searchTriggerSchema = z.object({
  categories: z.array(z.enum(CATEGORIES)).min(1).optional(),
});

export const discoveryCampaignCreateSchema = z.object({
  name: z.string().min(2).max(160),
  neighborhood: z.string().min(2).max(120),
  city: z.string().min(2).max(120),
  state: z.string().min(2).max(60),
  radius_meters: z.coerce.number().int().min(200).max(20000).default(2000),
  included_types: z.array(z.enum(CATEGORIES)).min(1),
  excluded_types: z.array(z.string()).max(50).default([]),
  blocked_keywords: z.array(z.string().max(60)).max(50).default([]),
  min_rating: z.coerce.number().min(0).max(5).nullable().optional(),
  min_reviews: z.coerce.number().int().min(0).nullable().optional(),
  exclude_franchises: z.boolean().default(false),
  exclude_chains: z.boolean().default(false),
  exclude_no_phone: z.boolean().default(false),
  exclude_no_website: z.boolean().default(false),
  force: z.boolean().default(false),
});

export const discoveryCampaignUpdateSchema = discoveryCampaignCreateSchema.partial().extend({
  status: z.enum(["active", "paused", "archived"]).optional(),
});

export const triageDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "review_later"]),
  rejection_reason: z.string().max(300).optional(),
  approval_notes: z.string().max(1000).optional(),
});

export const bulkTriageActionSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
  decision: z.enum(["approved", "rejected", "review_later"]),
  rejection_reason: z.string().max(300).optional(),
});

export const analyzeLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
  force: z.boolean().optional(),
  confirmedOverLimit: z.boolean().optional(),
});

export const messageGenerateSchema = z.object({
  variant: z
    .enum(["social_proof", "diagnosis", "question", "expansion", "routing", "agency", "abandoned_instagram"])
    .optional(),
  refine: z.boolean().optional(),
});

export const messageEditSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const outreachStatusSchema = z.object({
  status: z.enum([
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
  ]),
  notes: z.string().max(2000).optional(),
});

// Zod schema validating the AI's analysis JSON output before it's trusted/persisted.
// The model can hallucinate or return a malformed shape — never write unvalidated
// AI output straight to the database.
export const aiAnalysisResultSchema = z.object({
  opportunity_score: z.number().int().min(0).max(100),
  contact_score: z.number().int().min(0).max(100),
  business_strength: z.enum(["weak", "medium", "strong", "unknown"]),
  marketing_status: z.enum(["strong", "regular", "weak", "abandoned", "unknown"]),
  agency_status: z.enum(["confirmed", "probable", "internal_team_probable", "no_signs", "unknown"]),
  agency_confidence: z.number().int().min(0).max(100),
  opportunity_focus: z.string(),
  main_opportunity: z.string(),
  evidence: z.array(
    z.object({
      claim: z.string(),
      source: z.string(),
      confidence: z.number().int().min(0).max(100),
    })
  ),
  recommended_service: z.string(),
  recommended_approach: z.enum(["social_proof", "diagnosis", "question", "expansion"]),
  risks: z.array(z.string()),
  should_contact: z.boolean(),
  reason: z.string(),
});

// Zod schema validating the AI's decision-maker research JSON output.
export const decisionMakerResultSchema = z.object({
  found: z.boolean(),
  name: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  contact_type: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  source_title: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  confidence: z.number().int().min(0).max(100).default(0),
});

// Structured JSON schema the AI must return for lead analysis (OpenAI Responses API
// structured output — strict mode requires every property listed in `required`).
export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "opportunity_score",
    "contact_score",
    "business_strength",
    "marketing_status",
    "agency_status",
    "agency_confidence",
    "opportunity_focus",
    "main_opportunity",
    "evidence",
    "recommended_service",
    "recommended_approach",
    "risks",
    "should_contact",
    "reason",
  ],
  properties: {
    opportunity_score: { type: "integer" },
    contact_score: { type: "integer" },
    business_strength: { type: "string", enum: ["weak", "medium", "strong", "unknown"] },
    marketing_status: { type: "string", enum: ["strong", "regular", "weak", "abandoned", "unknown"] },
    agency_status: {
      type: "string",
      enum: ["confirmed", "probable", "internal_team_probable", "no_signs", "unknown"],
    },
    agency_confidence: { type: "integer" },
    opportunity_focus: { type: "string" },
    main_opportunity: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "source", "confidence"],
        properties: {
          claim: { type: "string" },
          source: { type: "string" },
          confidence: { type: "integer" },
        },
      },
    },
    recommended_service: { type: "string" },
    recommended_approach: { type: "string", enum: ["social_proof", "diagnosis", "question", "expansion"] },
    risks: { type: "array", items: { type: "string" } },
    should_contact: { type: "boolean" },
    reason: { type: "string" },
  },
} as const;
