import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeLeadsSchema, analysisJsonSchema } from "@/lib/schemas";
import { getOpenAIClient, getDefaultModel, isReasoningModel, AGENCY_CONTEXT, describeOpenAIError } from "@/lib/openai";
import { checkUsageLimit } from "@/lib/cost-control";
import type { LeadRow } from "@/types/database";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = analyzeLeadsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const usage = await checkUsageLimit("haiku_analysis");
  if (!usage.allowed) {
    return NextResponse.json({ error: "Limite diário de análises atingido." }, { status: 429 });
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

  const admin = createAdminClient();
  const { data: leadsRaw } = await admin.from("leads").select("*").in("id", parsed.data.leadIds);
  if (!leadsRaw?.length) return NextResponse.json({ error: "Nenhum lead encontrado" }, { status: 404 });
  const leads = leadsRaw as unknown as LeadRow[];

  const client = getOpenAIClient();

  const jsonlLines = leads.map((lead) => {
    const body: Record<string, unknown> = {
      model,
      instructions: AGENCY_CONTEXT,
      input: `Analise este restaurante para prospecção comercial da Navegando MKT. Responda no formato JSON exigido.\n\nNome: ${lead.name}\nCategoria: ${lead.category}\nEndereço: ${lead.address ?? "desconhecido"}\nNota Google: ${lead.google_rating ?? "unknown"} (${lead.google_review_count ?? 0} avaliações)\nSite: ${lead.website ?? "não encontrado"}\nTelefone: ${lead.phone ?? "não encontrado"}\nPré-score: ${lead.pre_score}/100`,
      max_output_tokens: 1600,
      text: { format: { type: "json_schema", name: "lead_analysis", schema: analysisJsonSchema, strict: true } },
    };
    if (isReasoningModel(model)) body.reasoning = { effort: "low" };
    return JSON.stringify({ custom_id: lead.id, method: "POST", url: "/v1/responses", body });
  });

  try {
    const file = await client.files.create({
      file: new File([jsonlLines.join("\n")], "batch-input.jsonl", { type: "application/jsonl" }),
      purpose: "batch",
    });

    const batch = await client.batches.create({
      input_file_id: file.id,
      endpoint: "/v1/responses",
      completion_window: "24h",
    });

    await admin.from("outreach_events").insert(
      leads.map((lead) => ({
        lead_id: lead.id,
        event_type: "batch_analysis_queued",
        channel: "system",
        metadata: { batch_id: batch.id },
      }))
    );

    return NextResponse.json({ batchId: batch.id, status: batch.status });
  } catch (err) {
    const { status, message } = describeOpenAIError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
