import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeLeadsSchema, analysisJsonSchema, aiAnalysisResultSchema } from "@/lib/schemas";
import {
  getOpenAIClient,
  getDefaultModel,
  isReasoningModel,
  AGENCY_CONTEXT,
  estimateCostUSD,
  extractOutputText,
  describeOpenAIError,
} from "@/lib/openai";
import { checkUsageLimit, logApiUsage } from "@/lib/cost-control";
import type { LeadRow } from "@/types/database";

export const maxDuration = 120;

// Skip re-analysis if a non-refined analysis exists and is newer than this window,
// unless the caller passes `force: true`.
const STALENESS_WINDOW_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

function buildLeadSummary(lead: {
  name: string;
  category: string;
  address: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  website: string | null;
  phone: string | null;
  instagram: string | null;
  price_level: number | null;
  estimated_units: number | null;
  pre_score: number;
}) {
  return [
    `Nome: ${lead.name}`,
    `Categoria: ${lead.category}`,
    `Endereço: ${lead.address ?? "desconhecido"}`,
    `Nota Google: ${lead.google_rating ?? "unknown"} (${lead.google_review_count ?? 0} avaliações)`,
    `Site: ${lead.website ?? "não encontrado"}`,
    `Telefone: ${lead.phone ?? "não encontrado"}`,
    `Instagram: ${lead.instagram ?? "não encontrado"}`,
    `Faixa de preço: ${lead.price_level ?? "unknown"}`,
    `Unidades estimadas: ${lead.estimated_units ?? 1}`,
    `Pré-score (regra, não IA): ${lead.pre_score}/100`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = analyzeLeadsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { leadIds, force } = parsed.data;

  if (leadIds.length > 50 && !parsed.data.confirmedOverLimit) {
    return NextResponse.json(
      { error: "Confirme a análise em lote de mais de 50 leads antes de continuar.", requiresConfirmation: true },
      { status: 400 }
    );
  }

  const usage = await checkUsageLimit("haiku_analysis");
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Limite diário de análises de IA atingido (${usage.used}/${usage.limit}). Tente novamente amanhã ou ajuste o limite em Configurações.` },
      { status: 429 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada no ambiente." }, { status: 503 });
  }
  let model: string;
  try {
    model = getDefaultModel();
  } catch {
    return NextResponse.json({ error: "OPENAI_MODEL não configurado no ambiente." }, { status: 503 });
  }

  const remainingBudget = usage.limit - usage.used;
  const idsToProcess = leadIds.slice(0, Math.max(0, remainingBudget));

  const admin = createAdminClient();
  const { data: leadsRaw, error } = await admin.from("leads").select("*").in("id", idsToProcess);
  if (error || !leadsRaw) return NextResponse.json({ error: "Erro ao buscar leads" }, { status: 500 });
  const leads = leadsRaw as unknown as LeadRow[];

  const client = getOpenAIClient();
  let analyzed = 0;
  const failed: { leadId: string; reason: string }[] = [];

  for (const lead of leads) {
    try {
      if (!force) {
        const { data: recentRaw } = await admin
          .from("lead_analysis")
          .select("created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const recent = recentRaw as unknown as { created_at: string } | null;
        if (recent && Date.now() - new Date(recent.created_at).getTime() < STALENESS_WINDOW_MS) {
          continue; // reuse recent analysis, skip re-spend
        }
      }

      const summary = buildLeadSummary(lead);
      const response = await client.responses.create({
        model,
        instructions: AGENCY_CONTEXT,
        input: `Analise este restaurante para prospecção comercial da Navegando MKT. Use apenas os dados abaixo (resumo compacto, não a página completa). Responda no formato JSON exigido.\n\n${summary}`,
        max_output_tokens: 1600,
        ...(isReasoningModel(model) ? { reasoning: { effort: "low" as const } } : {}),
        text: {
          format: { type: "json_schema", name: "lead_analysis", schema: analysisJsonSchema, strict: true },
        },
      });

      const rawText = extractOutputText(response);
      if (!rawText) throw new Error("Resposta sem conteúdo de texto");

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        throw new Error("Resposta da IA não é um JSON válido");
      }

      const resultParsed = aiAnalysisResultSchema.safeParse(parsedJson);
      if (!resultParsed.success) {
        throw new Error(`Resposta da IA não corresponde ao schema esperado: ${resultParsed.error.message}`);
      }
      const result = resultParsed.data;

      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;
      const cost = estimateCostUSD(model, inputTokens, outputTokens);

      await admin.from("lead_analysis").insert({
        lead_id: lead.id,
        model,
        opportunity_score: result.opportunity_score,
        contact_score: result.contact_score,
        business_strength: result.business_strength,
        marketing_status: result.marketing_status,
        agency_status: result.agency_status,
        agency_confidence: result.agency_confidence,
        opportunity_focus: result.opportunity_focus,
        main_opportunity: result.main_opportunity,
        evidence: result.evidence,
        recommended_service: result.recommended_service,
        recommended_approach: result.recommended_approach,
        risks: result.risks,
        should_contact: result.should_contact,
        reason: result.reason,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: cost,
      });

      await admin
        .from("leads")
        .update({ ai_score: result.opportunity_score, agency_status: result.agency_status })
        .eq("id", lead.id);

      await logApiUsage({
        service: "openai",
        model,
        operation: "haiku_analysis",
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost,
        leadId: lead.id,
        regionId: lead.region_id,
      });

      analyzed += 1;
    } catch (err) {
      const { message } = describeOpenAIError(err);
      failed.push({ leadId: lead.id, reason: message });
      console.error(`Analysis failed for lead ${lead.id}:`, err);
    }
  }

  return NextResponse.json({ analyzed, failed, skippedForLimit: leadIds.length - idsToProcess.length });
}
