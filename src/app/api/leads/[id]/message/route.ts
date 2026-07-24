import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageGenerateSchema } from "@/lib/schemas";
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
import type { MessageVariant } from "@/types/domain";
import type { LeadRow, DecisionMakerRow, LeadAnalysisRow } from "@/types/database";

export const maxDuration = 60;

const ROUTING_MESSAGE =
  "Olá! Sou o Lucas, da Navegando MKT. Gostaria de conversar com o proprietário ou com a pessoa responsável pelo marketing sobre uma oportunidade para o restaurante. Com quem consigo falar?";

function variantInstruction(variant: MessageVariant): string {
  switch (variant) {
    case "social_proof":
      return "Use prova social: mencione brevemente cases reais (La Braciera, Pecatto, Legado Parrilla) de forma natural, sem exagero.";
    case "diagnosis":
      return "Use uma abordagem de diagnóstico: aponte uma observação concreta sobre o marketing atual do restaurante.";
    case "question":
      return "Use uma pergunta genuína e direta sobre como o restaurante lida com conteúdo/marketing hoje.";
    case "expansion":
      return "Mencione a possibilidade de conteúdo ajudar a atrair público para múltiplas unidades ou horários específicos.";
    case "agency":
      return "O restaurante aparenta ter agência ou equipe de marketing. Seja respeitoso, não desqualifique o trabalho atual, apenas abra espaço para uma conversa eventual.";
    case "abandoned_instagram":
      return "O Instagram parece abandonado ou pouco ativo. Mencione isso com cuidado, sem soar acusatório.";
    default:
      return "Escreva uma mensagem natural de abordagem inicial.";
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = messageGenerateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: leadRaw } = await admin.from("leads").select("*").eq("id", leadId).single();
  if (!leadRaw) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  const lead = leadRaw as unknown as LeadRow;
  if (lead.opted_out) {
    return NextResponse.json({ error: "Este lead optou por não ser mais contatado (opt-out)." }, { status: 403 });
  }

  const { data: decisionMakerRaw } = await admin
    .from("decision_makers")
    .select("*")
    .eq("lead_id", leadId)
    .eq("found", true)
    .order("researched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const decisionMaker = decisionMakerRaw as unknown as DecisionMakerRow | null;

  if (decisionMaker?.opted_out) {
    return NextResponse.json({ error: "O decisor deste lead optou por não ser mais contatado (opt-out)." }, { status: 403 });
  }

  const { data: analysisRaw } = await admin
    .from("lead_analysis")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const analysis = analysisRaw as unknown as LeadAnalysisRow | null;

  const refine = !!parsed.data.refine;
  const usageOperation = refine ? "sonnet_refinement" : "haiku_analysis";
  const usage = await checkUsageLimit(usageOperation);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: refine
          ? `Limite diário de refinamentos atingido (${usage.used}/${usage.limit}).`
          : "Limite diário de uso da IA atingido.",
      },
      { status: 429 }
    );
  }

  let variant: MessageVariant = parsed.data.variant ?? (analysis?.recommended_approach as MessageVariant) ?? "question";
  if (!decisionMaker?.name) variant = "routing";
  else if (analysis?.agency_status === "confirmed" || analysis?.agency_status === "probable") variant = "agency";
  else if (analysis?.marketing_status === "abandoned") variant = "abandoned_instagram";

  if (variant === "routing") {
    const { data: message } = await admin
      .from("outreach_messages")
      .insert({
        lead_id: leadId,
        variant: "routing",
        content: ROUTING_MESSAGE,
        original_content: ROUTING_MESSAGE,
        model: "n/a",
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      })
      .select()
      .single();
    return NextResponse.json({ message });
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

  const client = getOpenAIClient();

  const context = [
    `Restaurante: ${lead.name} (${lead.category})`,
    `Endereço: ${lead.address ?? "unknown"}`,
    decisionMaker?.name ? `Decisor confirmado: ${decisionMaker.name}${decisionMaker.role ? ` (${decisionMaker.role})` : ""}` : "Decisor: não confirmado",
    analysis?.main_opportunity ? `Oportunidade identificada: ${analysis.main_opportunity}` : null,
    analysis?.opportunity_focus ? `Foco: ${analysis.opportunity_focus}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const refineNote = refine
    ? " Esta é uma versão refinada: capriche mais na naturalidade e na precisão da observação específica usada."
    : "";

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: AGENCY_CONTEXT,
      max_output_tokens: 700,
      ...(isReasoningModel(model) ? { reasoning: { effort: "low" as const } } : {}),
      input: `Escreva UMA mensagem comercial curta em português do Brasil para WhatsApp, como se fosse escrita pessoalmente pelo Lucas. Regras: saudação → apresentação curta → observação específica → explicação breve do trabalho → pergunta simples no final. Não invente fatos além dos fornecidos no contexto. Não prometa faturamento ou viralização. Sem linguagem corporativa genérica. Sem múltiplos parágrafos longos.${refineNote} ${variantInstruction(
        variant
      )}\n\nContexto:\n${context}\n\nResponda apenas com o texto da mensagem, sem aspas, sem comentários.`,
    });
  } catch (err) {
    const { status, message } = describeOpenAIError(err);
    return NextResponse.json({ error: message }, { status });
  }

  const content = extractOutputText(response).trim();
  if (!content) {
    return NextResponse.json({ error: "A IA não retornou nenhum texto de mensagem." }, { status: 502 });
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const cost = estimateCostUSD(model, inputTokens, outputTokens);

  const { data: message } = await admin
    .from("outreach_messages")
    .insert({
      lead_id: leadId,
      variant,
      content,
      original_content: content,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: cost,
      refined: refine,
    })
    .select()
    .single();

  await admin.from("leads").update({ commercial_status: "message_ready" }).eq("id", leadId);

  await logApiUsage({
    service: "openai",
    model,
    operation: refine ? "sonnet_refinement" : "message_generation",
    inputTokens,
    outputTokens,
    estimatedCostUsd: cost,
    leadId,
    regionId: lead.region_id,
  });

  return NextResponse.json({ message });
}
