import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { meetingStatusUpdateSchema } from "@/lib/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = meetingStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("leads")
    .select("pipeline_stage, meeting_at")
    .eq("id", leadId)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const now = new Date();
  const atNine = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    return date.toISOString();
  };
  const status = parsed.data.meeting_status;
  const update: Record<string, unknown> = {
    meeting_status: status,
    contact_round: null,
    cadence_step: 0,
    last_activity_at: now.toISOString(),
  };
  if (status === "scheduled" || status === "rescheduled") {
    update.next_action_type = "meeting";
    update.next_action_at = current.meeting_at ?? now.toISOString();
    update.pipeline_stage = "meeting";
  } else if (status === "held" || status === "proposal_pending") {
    update.next_action_type = "prepare_proposal";
    update.next_action_at = now.toISOString();
    update.pipeline_stage = "meeting";
  } else if (status === "no_show") {
    update.next_action_type = "follow_up";
    update.next_action_at = atNine(1);
    update.next_follow_up_at = atNine(1);
    update.pipeline_stage = "meeting";
  } else if (status === "cancelled") {
    update.next_action_type = "follow_up";
    update.next_action_at = atNine(7);
    update.next_follow_up_at = atNine(7);
    update.pipeline_stage = "talking_dm";
  } else if (status === "proposal_sent") {
    update.proposal_sent_at = now.toISOString();
    update.proposal_status = "sent";
    update.next_action_type = "chase_proposal";
    update.next_action_at = atNine(3);
    update.next_follow_up_at = atNine(3);
    update.pipeline_stage = "proposal";
  } else if (status === "negotiation") {
    update.next_action_type = "follow_up";
    update.next_action_at = atNine(2);
    update.next_follow_up_at = atNine(2);
    update.pipeline_stage = "negotiation";
  }
  if (current.pipeline_stage !== update.pipeline_stage) update.stage_changed_at = now.toISOString();

  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: `meeting_${status}`,
    channel: "system",
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
