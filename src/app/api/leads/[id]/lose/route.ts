import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Mark a lead as lost (with a reason) — archives it off the board — or reactivate it back to
// "A abordar". History is preserved (lost_reason + outreach_events).
const schema = z.object({
  reason: z.string().max(120).optional(),
  reactivate: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (parsed.data.reactivate) {
    const { error } = await admin
      .from("leads")
      .update({ lost_reason: null, archived_at: null, pipeline_stage: "ready_to_approach", stage_changed_at: now, last_activity_at: now })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("outreach_events").insert({ lead_id: id, event_type: "reactivated", channel: "system", metadata: { by: user.id } });
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin
    .from("leads")
    .update({ lost_reason: parsed.data.reason ?? "Outro", archived_at: now, last_activity_at: now })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("outreach_events").insert({
    lead_id: id,
    event_type: "lost",
    channel: "system",
    metadata: { reason: parsed.data.reason ?? "Outro", by: user.id },
  });
  return NextResponse.json({ ok: true });
}
