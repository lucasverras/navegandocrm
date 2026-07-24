import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decisionMakerResultSchema } from "@/lib/schemas";
import { getOpenAIClient, getDefaultModel, AGENCY_CONTEXT, estimateCostUSD, extractOutputText, describeOpenAIError } from "@/lib/openai";
import { checkUsageLimit, logApiUsage } from "@/lib/cost-control";
import type { LeadRow } from "@/types/database";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;

  const usage = await checkUsageLimit("decision_maker_search");
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Limite diário de pesquisas de decisor atingido (${usage.used}/${usage.limit}).` },
      { status: 429 }
    );
  }

  const admin = createAdminClient();
  const { data: leadRaw } = await admin.from("leads").select("*").eq("id", leadId).single();
  if (!leadRaw) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  const lead = leadRaw as unknown as LeadRow;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada no ambiente." }, { status: 503 });
  }
  let model: string;
  try {
    model = getDefaultModel();
  } catch {
    return NextResponse.json({ error: "OPENAI_MODEL não configurado no ambiente." }, { status: 503 });
  }

  const client = getOpenAIClient();

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: AGENCY_CONTEXT,
      tools: [{ type: "web_search" }],
      // OpenAI's web_search tool has no hard call-count cap (unlike some providers),
      // so the "no more than 2 searches" limit is enforced via instruction only.
      input: `Pesquise publicamente quem é o dono, sócio, fundador ou responsável pelo marketing do restaurante "${lead.name}"${
        lead.address ? `, localizado em ${lead.address}` : ""
      }. Use no máximo 2 buscas na web. Priorize site oficial, LinkedIn, entrevistas, matérias de imprensa e páginas institucionais. NUNCA use sites de dados pessoais/broker nem telefones pessoais vazados. Se não encontrar nada confiável, responda found=false. Ao final, responda APENAS com um JSON (sem markdown, sem texto extra) com os campos: found (boolean), name, role, contact_type, email, phone, linkedin, source_url, source_title, excerpt, confidence (0-100). Use null para campos não encontrados.`,
    });
  } catch (err) {
    const { status, message } = describeOpenAIError(err);
    return NextResponse.json({ error: message }, { status });
  }

  const rawText = extractOutputText(response);
  let result: { found: boolean; [key: string]: unknown } = { found: false };

  if (rawText) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const candidate = JSON.parse(jsonMatch[0]);
        const validated = decisionMakerResultSchema.safeParse(candidate);
        if (validated.success) result = validated.data;
      } catch {
        // leave result as { found: false } — never trust unparsable AI output
      }
    }
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const cost = estimateCostUSD(model, inputTokens, outputTokens);

  const { data: decisionMaker } = await admin
    .from("decision_makers")
    .insert({
      lead_id: leadId,
      name: (result.name as string) ?? null,
      role: (result.role as string) ?? null,
      contact_type: (result.contact_type as string) ?? null,
      email: (result.email as string) ?? null,
      phone: (result.phone as string) ?? null,
      linkedin: (result.linkedin as string) ?? null,
      source_url: (result.source_url as string) ?? null,
      source_title: (result.source_title as string) ?? null,
      excerpt: (result.excerpt as string) ?? null,
      confidence: typeof result.confidence === "number" ? result.confidence : 0,
      found: !!result.found,
    })
    .select()
    .single();

  await logApiUsage({
    service: "openai",
    model,
    operation: "decision_maker_search",
    inputTokens,
    outputTokens,
    estimatedCostUsd: cost,
    leadId,
    regionId: lead.region_id,
  });

  return NextResponse.json({ decisionMaker });
}
