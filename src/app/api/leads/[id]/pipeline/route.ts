import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pipelineStageUpdateSchema } from "@/lib/schemas";

// Moves a lead to a new pipeline stage/position. Never calls OpenAI or Google Places —
// this is a pure data-persistence endpoint for the Kanban drag-and-drop.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = pipelineStageUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();

  const { data: currentRaw } = await admin.from("leads").select("pipeline_stage").eq("id", leadId).maybeSingle();
  const current = currentRaw as unknown as { pipeline_stage: string } | null;
  if (!current) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const now = new Date().toISOString();
  const stageChanged = current.pipeline_stage !== parsed.data.stage;

  const update: Record<string, unknown> = {
    pipeline_stage: parsed.data.stage,
    pipeline_position: parsed.data.position,
    last_activity_at: now,
  };
  if (stageChanged) {
    update.previous_stage = current.pipeline_stage;
    update.stage_changed_at = now;
  }

  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (stageChanged) {
    await admin.from("outreach_events").insert({
      lead_id: leadId,
      event_type: "stage_changed",
      channel: "system",
      metadata: { from: current.pipeline_stage, to: parsed.data.stage, changed_by: user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
