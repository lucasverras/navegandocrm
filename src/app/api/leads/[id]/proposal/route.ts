import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Simple proposal capture (brief §Proposta): valor mensal enviado + observação + data. No PDF.
const schema = z.object({
  value: z.number().min(0).nullable().optional(),
  note: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: cur } = await admin.from("leads").select("pipeline_stage").eq("id", id).maybeSingle();
  const stage = (cur as { pipeline_stage: string | null } | null)?.pipeline_stage;

  // Default demand after sending a proposal: chase it in 3 days at 09:00.
  const chase = new Date();
  chase.setDate(chase.getDate() + 3);
  chase.setHours(9, 0, 0, 0);

  const update: Record<string, unknown> = {
    proposal_value: parsed.data.value ?? null,
    proposal_note: parsed.data.note ?? null,
    proposal_sent_at: now,
    next_action_type: "chase_proposal",
    next_action_at: chase.toISOString(),
    next_follow_up_at: chase.toISOString(),
    cadence_step: 0,
    last_activity_at: now,
  };
  if (stage && stage !== "closed") {
    update.pipeline_stage = "proposal";
    update.stage_changed_at = now;
  }

  const { error } = await admin.from("leads").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("outreach_events").insert({
    lead_id: id,
    event_type: "proposal_sent",
    channel: "system",
    metadata: { value: parsed.data.value ?? null, by: user.id },
  });
  return NextResponse.json({ ok: true });
}
