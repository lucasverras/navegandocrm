import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

// Quick response registration (brief §RESPOSTAS): one tap records what happened in the
// conversation and safely auto-adjusts commercial_status, pipeline stage and follow-up.
// Pipeline advances only when the lead is already on the board (stage not null) and not closed.
type ResponseKind =
  | "respondeu"
  | "interessado"
  | "apresentacao"
  | "agencia"
  | "depois"
  | "reuniao"
  | "contato_errado"
  | "nao_interessado";

const responseSchema = z.object({
  response: z.enum([
    "respondeu",
    "interessado",
    "apresentacao",
    "agencia",
    "depois",
    "reuniao",
    "contato_errado",
    "nao_interessado",
  ]),
  note: z.string().max(2000).optional(),
  decision_maker_name: z.string().max(200).optional(),
  decision_maker_role: z.string().max(120).optional(),
  decision_maker_phone: z.string().max(40).optional(),
});

const RESPONSES: Record<
  ResponseKind,
  { commercial?: string; advanceTo?: string | null; followUpDays?: number | null; lost?: boolean; label: string }
> = {
  respondeu: { commercial: "awaiting_reply", advanceTo: "talking_dm", followUpDays: 2, label: "Respondeu" },
  interessado: { commercial: "owner_contact_obtained", advanceTo: "talking_dm", followUpDays: 1, label: "Interessado" },
  apresentacao: { commercial: "owner_contact_obtained", followUpDays: 1, label: "Mandar apresentação" },
  agencia: { commercial: "reception_answered", followUpDays: 30, label: "Já tem agência" },
  depois: { commercial: "awaiting_reply", followUpDays: 7, label: "Falar depois" },
  reuniao: { commercial: "meeting_scheduled", advanceTo: "meeting", followUpDays: null, label: "Reunião" },
  contato_errado: { commercial: "invalid_number", label: "Contato errado" },
  nao_interessado: { commercial: "not_interested", lost: true, label: "Não interessado" },
};

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const parsed = responseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Resposta inválida" }, { status: 400 });
  const kind = parsed.data.response as ResponseKind;
  const rule = RESPONSES[kind];
  if (!rule) return NextResponse.json({ error: "Resposta inválida" }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("leads")
    .select("pipeline_stage")
    .eq("id", leadId)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const now = new Date().toISOString();
  const stage = (current as { pipeline_stage: string | null }).pipeline_stage;
  // Any registered response cancels the automatic cadence AND exits the round-based flow
  // (the lead engaged or is resolved). Round is set to null because the lead is now in a
  // conversational/commercial state, not a cold-outreach round.
  const update: Record<string, unknown> = { last_activity_at: now, cadence_step: 0, contact_round: null };
  if (rule.commercial) update.commercial_status = rule.commercial;
  if (rule.lost) update.business_status = "not_interested";
  if (rule.followUpDays !== undefined) update.next_follow_up_at = rule.followUpDays == null ? null : daysFromNowIso(rule.followUpDays);

  // Next action ("qual é o próximo passo?") — kept in sync with every registered outcome.
  if (kind === "reuniao") {
    update.next_action_type = "meeting";
    update.next_action_at = now; // remains visible until the meeting time is captured
  } else if (kind === "contato_errado") {
    update.next_action_type = "call_decisor";
    update.next_action_at = now;
  } else if (rule.lost) {
    update.next_action_type = null;
    update.next_action_at = null;
    update.next_follow_up_at = null;
    update.archived_at = now;
  } else if (rule.followUpDays != null) {
    update.next_action_type = "follow_up";
    update.next_action_at = update.next_follow_up_at;
  }
  // Only advance the board when the lead is on it and not already closed.
  if (rule.advanceTo && stage && stage !== "closed") {
    update.pipeline_stage = rule.advanceTo;
    update.previous_stage = stage;
    update.stage_changed_at = now;
  }

  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: `response_${kind}`,
    channel: "whatsapp",
    metadata: { by: user.id, note: parsed.data.note?.trim() || null },
  });

  if (parsed.data.decision_maker_name?.trim()) {
    await admin.from("decision_makers").insert({
      lead_id: leadId,
      name: parsed.data.decision_maker_name.trim(),
      role: parsed.data.decision_maker_role?.trim() || null,
      phone: parsed.data.decision_maker_phone?.trim() || null,
      contact_type: parsed.data.decision_maker_phone ? "phone" : "manual",
      confidence: 1,
      found: true,
      researched_at: now,
    });
  }

  return NextResponse.json({ ok: true });
}
