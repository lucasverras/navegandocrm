import { createAdminClient } from "@/lib/supabase/admin";

export interface UsageLimits {
  ai_analyses_per_day: number;
  decision_maker_searches_per_day: number;
  ai_refinements_per_day: number;
}

export const DEFAULT_LIMITS: UsageLimits = {
  ai_analyses_per_day: 100,
  decision_maker_searches_per_day: 20,
  ai_refinements_per_day: 10,
};

export async function getLimits(): Promise<UsageLimits> {
  const admin = createAdminClient();
  const { data: raw } = await admin.from("settings").select("value").eq("key", "usage_limits").maybeSingle();
  const data = raw as unknown as { value: unknown } | null;
  if (!data?.value) return DEFAULT_LIMITS;
  const stored = data.value as Record<string, number>;
  return {
    ...DEFAULT_LIMITS,
    ai_analyses_per_day: stored.ai_analyses_per_day ?? stored.haiku_analyses_per_day ?? DEFAULT_LIMITS.ai_analyses_per_day,
    decision_maker_searches_per_day: stored.decision_maker_searches_per_day ?? DEFAULT_LIMITS.decision_maker_searches_per_day,
    ai_refinements_per_day: stored.ai_refinements_per_day ?? stored.sonnet_refinements_per_day ?? DEFAULT_LIMITS.ai_refinements_per_day,
  };
}

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export type UsageOperation = "ai_analysis" | "decision_maker_search" | "ai_refinement";

const OPERATION_TO_LIMIT_KEY: Record<UsageOperation, keyof UsageLimits> = {
  ai_analysis: "ai_analyses_per_day",
  decision_maker_search: "decision_maker_searches_per_day",
  ai_refinement: "ai_refinements_per_day",
};

const LEGACY_OPERATION_ALIASES: Partial<Record<UsageOperation, string>> = {
  ai_analysis: "haiku_analysis",
  ai_refinement: "sonnet_refinement",
};

export async function checkUsageLimit(
  operation: UsageOperation
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const admin = createAdminClient();
  const limits = await getLimits();
  const limitKey = OPERATION_TO_LIMIT_KEY[operation];
  const limit = limits[limitKey];

  const ops = [operation, LEGACY_OPERATION_ALIASES[operation]].filter(Boolean) as string[];
  const { count } = await admin
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .in("operation", ops)
    .gte("created_at", startOfTodayUTC());

  const used = count ?? 0;
  return { allowed: used < limit, used, limit };
}

export async function logApiUsage(params: {
  service: string;
  model: string | null;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  leadId?: string | null;
  regionId?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("api_usage").insert({
    service: params.service,
    model: params.model,
    operation: params.operation,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    estimated_cost_usd: params.estimatedCostUsd,
    lead_id: params.leadId ?? null,
    region_id: params.regionId ?? null,
  });
}
