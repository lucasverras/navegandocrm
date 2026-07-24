import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bulkPipelineActionSchema } from "@/lib/schemas";

// Bulk lead operations from the Leads list — never sends messages, never calls
// OpenAI or Google Places. Each affected lead gets an outreach_events entry.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bulkPipelineActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { leadIds, action } = parsed.data;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  let update: Record<string, unknown> | null = null;
  let eventType = "";
  let metadata: Record<string, unknown> = {};

  switch (action) {
    case "move_stage":
      if (!parsed.data.stage) return NextResponse.json({ error: "Etapa não informada" }, { status: 400 });
      update = { pipeline_stage: parsed.data.stage, stage_changed_at: now, last_activity_at: now };
      eventType = "stage_changed";
      metadata = { to: parsed.data.stage, bulk: true, changed_by: user.id };
      break;
    case "assign":
      update = { assigned_to: parsed.data.assigned_to ?? null, last_activity_at: now };
      eventType = "assigned";
      metadata = { assigned_to: parsed.data.assigned_to ?? null, bulk: true };
      break;
    case "follow_up":
      update = { next_follow_up_at: parsed.data.next_follow_up_at ?? null, last_activity_at: now };
      eventType = "follow_up_set";
      metadata = { next_follow_up_at: parsed.data.next_follow_up_at ?? null, bulk: true };
      break;
    case "archive":
      update = { archived_at: now, last_activity_at: now };
      eventType = "archived";
      break;
    case "discard":
      update = { business_status: "not_interested", last_activity_at: now };
      eventType = "lead_discarded";
      break;
  }

  if (!update) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  const { error } = await admin.from("leads").update(update).in("id", leadIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert(
    leadIds.map((leadId) => ({ lead_id: leadId, event_type: eventType, channel: "system", metadata }))
  );

  return NextResponse.json({ ok: true, updated: leadIds.length });
}
