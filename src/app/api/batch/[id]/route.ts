import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiAnalysisResultSchema } from "@/lib/schemas";
import { getOpenAIClient, getDefaultModel, estimateCostUSD, extractOutputText, describeOpenAIError } from "@/lib/openai";
import { logApiUsage } from "@/lib/cost-control";
import type OpenAI from "openai";

interface BatchOutputLine {
  custom_id: string;
  response?: { status_code: number; body: OpenAI.Responses.Response } | null;
  error?: { message: string } | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: batchId } = await params;
  const client = getOpenAIClient();

  let batch;
  try {
    batch = await client.batches.retrieve(batchId);
  } catch (err) {
    const { status, message } = describeOpenAIError(err);
    return NextResponse.json({ error: message }, { status });
  }

  if (batch.status !== "completed") {
    return NextResponse.json({ status: batch.status, counts: batch.request_counts });
  }

  if (!batch.output_file_id) {
    return NextResponse.json({ status: "completed", ingested: 0, counts: batch.request_counts, error: "Lote concluído sem arquivo de saída." });
  }

  const model = (() => {
    try {
      return getDefaultModel();
    } catch {
      return "unknown";
    }
  })();

  const admin = createAdminClient();
  let ingested = 0;
  const failed: string[] = [];

  const fileResponse = await client.files.content(batch.output_file_id);
  const text = await fileResponse.text();
  const lines = text.split("\n").filter(Boolean);

  for (const line of lines) {
    let parsedLine: BatchOutputLine;
    try {
      parsedLine = JSON.parse(line);
    } catch {
      continue;
    }

    const leadId = parsedLine.custom_id;
    if (parsedLine.error || !parsedLine.response || parsedLine.response.status_code !== 200) {
      failed.push(leadId);
      continue;
    }

    const { data: leadRaw } = await admin.from("leads").select("region_id").eq("id", leadId).maybeSingle();
    if (!leadRaw) continue;
    const lead = leadRaw as unknown as { region_id: string | null };

    const rawText = extractOutputText(parsedLine.response.body);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      failed.push(leadId);
      continue;
    }

    const resultParsed = aiAnalysisResultSchema.safeParse(parsedJson);
    if (!resultParsed.success) {
      failed.push(leadId);
      continue;
    }
    const result = resultParsed.data;

    const usage = parsedLine.response.body.usage;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const cost = estimateCostUSD(model, inputTokens, outputTokens);

    await admin.from("lead_analysis").insert({
      lead_id: leadId,
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
      .eq("id", leadId);

    await logApiUsage({
      service: "openai",
      model,
      operation: "haiku_analysis_batch",
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      leadId,
      regionId: lead.region_id,
    });

    ingested += 1;
  }

  return NextResponse.json({ status: "completed", ingested, failed, counts: batch.request_counts });
}
