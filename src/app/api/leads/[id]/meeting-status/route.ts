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
  const update: Record<string, unknown> = {
    meeting_status: parsed.data.meeting_status,
    last_activity_at: new Date().toISOString(),
  };
  if (parsed.data.meeting_status === "scheduled") update.meeting_at = update.meeting_at ?? new Date().toISOString();
  if (parsed.data.meeting_status === "proposal_sent") update.proposal_sent_at = new Date().toISOString();

  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: `meeting_${parsed.data.meeting_status}`,
    channel: "system",
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
