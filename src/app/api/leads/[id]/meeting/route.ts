import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Simple meeting capture (brief §Reunião): data/hora + Meet link + note. No enterprise calendar.
const schema = z.object({
  meeting_at: z.string().datetime(),
  meeting_link: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Data/hora da reunião é obrigatória" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: cur } = await admin.from("leads").select("pipeline_stage").eq("id", id).maybeSingle();
  const stage = (cur as { pipeline_stage: string | null } | null)?.pipeline_stage;

  const update: Record<string, unknown> = {
    meeting_at: parsed.data.meeting_at,
    meeting_link: parsed.data.meeting_link ?? null,
    meeting_note: parsed.data.note ?? null,
    meeting_status: "scheduled",
    commercial_status: "meeting_scheduled",
    next_action_type: "meeting",
    next_action_at: parsed.data.meeting_at,
    cadence_step: 0,
    contact_round: null,
    last_activity_at: now,
  };
  if (stage && stage !== "closed") {
    update.pipeline_stage = "meeting";
    update.stage_changed_at = now;
  }

  const { error } = await admin.from("leads").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("outreach_events").insert({
    lead_id: id,
    event_type: "meeting_scheduled",
    channel: "system",
    metadata: { meeting_at: parsed.data.meeting_at, by: user.id },
  });
  return NextResponse.json({ ok: true });
}
