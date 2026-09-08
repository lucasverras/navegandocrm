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
import { pickRelevantCase, describeCase } from "@/lib/cases";
import { looksGeneric, REGENERATE_HINT } from "@/lib/message-quality";
import { categoryLabel } from "@/types/domain";
import type { MessageVariant } from "@/types/domain";
import type { LeadRow, DecisionMakerRow, LeadAnalysisRow, RegionRow } from "@/types/database";

export const maxDuration = 60;

const ROUTING_MESSAGE =
  "Olá! Sou o Lucas, da Navegando MKT. Gostaria de conversar com o proprietário ou com a pessoa responsável pelo marketing sobre uma oportunidade para o restaurante. Com quem consigo falar?";

// Shared voice + Humanizer rules. The single hardest requirement is the specific observation:
// the first line after the greeting must only make sense for THIS restaurant.
const VOICE_RULES = `Você é o Lucas, da Navegando MKT, mandando uma mensagem de WhatsApp para um restaurante. Escreva como uma pessoa real escreve — não como uma IA, não como texto de marketing.

Regras de linguagem (obrigatórias):
- Curto: no máximo 3–4 linhas. Uma ideia por frase.
- Natural e direto, pode ser levemente informal. Nada de perfeição robótica.
- Proibido tom institucional e palavras de marketing vazias ("soluções", "potencializar", "engajamento", "parceria de sucesso", "especialistas em resultados", "alavancar").
- Proibido elogio genérico ("adorei o perfil de vocês", "vocês têm muito potencial").
- Proibido "gostaria de", "venho por meio desta", "espero que esteja tudo bem", "tudo bem?".
- Não prometa faturamento, viralização nem números.
- Nunca invente fatos. Use só o que está no contexto. Sem observação específica possível? Faça uma pergunta honesta em vez de inventar.

A OBSERVAÇÃO ESPECÍFICA é o mais importante: a primeira frase depois da saudação precisa conter algo que só faz sentido para ESTE restaurante (a categoria, a região, o tipo de casa, o que aparece ou falta no conteúdo).
TESTE OBRIGATÓRIO: "Esta primeira observação poderia ser enviada para 20 restaurantes diferentes?" Se a resposta for SIM, reescreva com algo específico e verificável antes de finalizar. A observação precisa citar algo concreto do contexto.
Nível esperado (referência de especificidade, não copie):
- "Vi que vocês mostram muito bem o prato pronto, mas quase não aparecem o preparo e a equipe."
- "A casa de vocês parece ter uma pegada de experiência forte, mas isso aparece pouco no perfil."
PROIBIDO por serem genéricas: "Vi o perfil de vocês e achei que têm potencial." / "Gostei do trabalho de vocês." / "Seu conteúdo é muito interessante." / "Somos especialistas em conteúdo que gera resultados."`;

function variantInstruction(variant: MessageVariant): string {
  switch (variant) {
    case "social_proof":
      return "Conecte com um cliente parecido da Navegando (ver 'Case comparável' no contexto) de forma natural, sem exagero e sem citar números.";
    case "diagnosis":
      return "Abra com uma observação concreta sobre o conteúdo/marketing atual do restaurante.";
    case "question":
      return "Faça uma pergunta genuína e direta sobre como o restaurante cuida do conteúdo hoje.";
    case "expansion":
      return "Mencione como o conteúdo pode atrair público para múltiplas unidades ou horários específicos.";
    case "agency":
      return "O restaurante aparenta ter agência ou equipe de marketing. Seja respeitoso, não desqualifique o trabalho atual, apenas abra espaço para conversa.";
    case "abandoned_instagram":
      return "O Instagram parece pouco ativo. Mencione isso com cuidado, sem soar acusatório.";
    default:
      return "Escreva uma mensagem natural de abordagem inicial.";
  }
}

// Rich, evidence-grounded context — everything the model may use to be specific.
function buildContext(
  lead: LeadRow,
  region: Pick<RegionRow, "neighborhood" | "city"> | null,
  decisionMaker: DecisionMakerRow | null,
  analysis: LeadAnalysisRow | null
): string {
  const igHandle = lead.instagram_url ?? lead.instagram_handle ?? lead.instagram;
  const price = lead.price_level ? "$".repeat(Math.min(4, lead.price_level)) : null;
  const lines: (string | null)[] = [
    `Restaurante: ${lead.name}`,
    `Categoria: ${categoryLabel(lead.category)}`,
    region ? `Região: ${region.neighborhood}${region.city ? `, ${region.city}` : ""}` : null,
    lead.google_rating != null
      ? `Google: nota ${lead.google_rating}${lead.google_review_count != null ? ` (${lead.google_review_count} avaliações)` : ""}`
      : null,
    price ? `Faixa de preço: ${price}` : null,
    (lead.estimated_units ?? 1) > 1 ? `Unidades estimadas: ${lead.estimated_units}` : null,
    lead.website ? `Site: ${lead.website}` : null,
    igHandle ? `Instagram: ${igHandle}${lead.instagram_confirmed ? " (confirmado)" : ""}` : "Instagram: não encontrado",
    decisionMaker?.name
      ? `Decisor confirmado: ${decisionMaker.name}${decisionMaker.role ? ` (${decisionMaker.role})` : ""}`
      : "Decisor: não confirmado",
    analysis?.main_opportunity ? `Diagnóstico — oportunidade principal: ${analysis.main_opportunity}` : null,
    analysis?.opportunity_focus ? `Diagnóstico — foco: ${analysis.opportunity_focus}` : null,
    analysis?.marketing_status ? `Diagnóstico — marketing atual: ${analysis.marketing_status}` : null,
    analysis?.recommended_service ? `Serviço recomendado: ${analysis.recommended_service}` : null,
    `Case comparável da Navegando: ${describeCase(pickRelevantCase(lead.category))}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// Structured output for the 3-strategy mode. The model must first build a LEAD BRIEF (grounding),
// then write the options — each option's observation must be traceable to the brief.
const STRATEGIES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["brief", "options"],
  properties: {
    brief: {
      type: "object",
      additionalProperties: false,
      required: [
        "business_summary",
        "specific_observation",
        "main_opportunity",
        "relevant_case",
        "reason_case_is_relevant",
        "unknowns",
      ],
      properties: {
        business_summary: { type: "string" },
        specific_observation: { type: "string" },
        main_opportunity: { type: "string" },
        relevant_case: { type: "string" },
        reason_case_is_relevant: { type: "string" },
        unknowns: { type: "array", items: { type: "string" } },
      },
    },
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["strategy", "message", "evidence"],
        properties: {
          strategy: { type: "string", enum: ["observacao", "case", "direta"] },
          message: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
  },
} as const;

const STRATEGY_TO_VARIANT: Record<string, MessageVariant> = {
  observacao: "diagnosis",
  case: "social_proof",
  direta: "question",
};

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
  if (lead.triage_status === "rejected" || lead.triage_status === "auto_filtered") {
    return NextResponse.json({ error: "Lead não aprovado na triagem" }, { status: 409 });
  }
  if (lead.opted_out) {
    return NextResponse.json({ error: "Este lead optou por não ser mais contatado (opt-out)." }, { status: 403 });
  }

  // Persist-picked-message mode: store a user-chosen option verbatim, no AI spend.
  if (parsed.data.content) {
    const chosenVariant = parsed.data.variant ?? "diagnosis";
    const { data: message } = await admin
      .from("outreach_messages")
      .insert({
        lead_id: leadId,
        variant: chosenVariant,
        content: parsed.data.content,
        original_content: parsed.data.content,
        model: "picked",
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      })
      .select()
      .single();
    await admin.from("leads").update({ commercial_status: "message_ready" }).eq("id", leadId);
    return NextResponse.json({ message });
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

  const [{ data: analysisRaw }, { data: regionRaw }] = await Promise.all([
    admin.from("lead_analysis").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    lead.region_id
      ? admin.from("regions").select("neighborhood, city").eq("id", lead.region_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const analysis = analysisRaw as unknown as LeadAnalysisRow | null;
  const region = regionRaw as unknown as Pick<RegionRow, "neighborhood" | "city"> | null;

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
  const context = buildContext(lead, region, decisionMaker, analysis);

  // ---- 3-strategy mode: return options, persist nothing until the user picks one. ----
  if (parsed.data.strategies) {
    let response;
    try {
      response = await client.responses.create({
        model,
        instructions: AGENCY_CONTEXT,
        max_output_tokens: 1200,
        ...(isReasoningModel(model) ? { reasoning: { effort: "low" as const } } : {}),
        text: { format: { type: "json_schema", name: "message_options", schema: STRATEGIES_SCHEMA, strict: true } },
        input: `${VOICE_RULES}

Passo 1 — monte um LEAD BRIEF (campo "brief") a partir SÓ do contexto: business_summary, specific_observation (a observação verificável e específica que passa no teste das 20 mensagens), main_opportunity, relevant_case (nome do case do contexto), reason_case_is_relevant, unknowns (o que falta e você NÃO deve inventar).

Passo 2 — escreva 3 versões curtas, cada uma com uma estratégia. Cada versão tem "evidence": a evidência concreta usada (curta), coerente com brief.specific_observation.
Estratégias:
- "observacao": abre com a observação específica do brief.
- "case": conecta de forma natural com relevant_case, sem exagero e sem números.
- "direta": uma pergunta curta e honesta sobre como o restaurante cuida do conteúdo hoje.

Se não houver observação específica possível, diga isso em unknowns e faça a versão "observacao" também virar uma pergunta honesta — nunca invente.

Contexto:
${context}`,
      });
    } catch (err) {
      const { status, message } = describeOpenAIError(err);
      return NextResponse.json({ error: message }, { status });
    }

    const rawText = extractOutputText(response).trim();
    type RawOption = { strategy: string; message: string; evidence: string };
    let options: (RawOption & { variant: MessageVariant })[] = [];
    let brief: Record<string, unknown> | null = null;
    try {
      const json = JSON.parse(rawText) as { options?: RawOption[]; brief?: Record<string, unknown> };
      brief = json.brief ?? null;
      options = (json.options ?? []).map((o) => ({ ...o, variant: STRATEGY_TO_VARIANT[o.strategy] ?? "diagnosis" }));
    } catch {
      return NextResponse.json({ error: "A IA não retornou opções válidas." }, { status: 502 });
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const cost = estimateCostUSD(model, inputTokens, outputTokens);
    await logApiUsage({
      service: "openai",
      model,
      operation: "message_generation",
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      leadId,
      regionId: lead.region_id,
    });

    return NextResponse.json({ brief, options });
  }

  // ---- Single-message mode (default). ----
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

  const refineNote = refine
    ? " Esta é uma versão refinada: capriche mais na naturalidade e na precisão da observação específica."
    : "";

  const buildInput = (extra: string) => `${VOICE_RULES}

Escreva UMA mensagem seguindo: saudação curta → observação específica → o que a Navegando faz (1 frase concreta) → uma pergunta simples.${refineNote} ${variantInstruction(variant)}${extra}

Contexto:
${context}

Responda apenas com o texto da mensagem, sem aspas, sem comentários.`;

  async function generateOnce(extra: string) {
    return client.responses.create({
      model,
      instructions: AGENCY_CONTEXT,
      max_output_tokens: 700,
      ...(isReasoningModel(model) ? { reasoning: { effort: "low" as const } } : {}),
      input: buildInput(extra),
    });
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let content = "";
  try {
    const first = await generateOnce("");
    content = extractOutputText(first).trim();
    inputTokens += first.usage?.input_tokens ?? 0;
    outputTokens += first.usage?.output_tokens ?? 0;

    // "20 restaurantes" validator: if the first attempt reads generic, regenerate ONCE.
    if (content && looksGeneric(content)) {
      const retry = await generateOnce(REGENERATE_HINT);
      const retryContent = extractOutputText(retry).trim();
      inputTokens += retry.usage?.input_tokens ?? 0;
      outputTokens += retry.usage?.output_tokens ?? 0;
      if (retryContent) content = retryContent;
    }
  } catch (err) {
    const { status, message } = describeOpenAIError(err);
    return NextResponse.json({ error: message }, { status });
  }

  if (!content) {
    return NextResponse.json({ error: "A IA não retornou nenhum texto de mensagem." }, { status: 502 });
  }

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
