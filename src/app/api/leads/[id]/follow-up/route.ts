import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { followUpUpdateSchema } from "@/lib/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = followUpUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("leads")
    .update({ next_follow_up_at: parsed.data.next_follow_up_at, last_activity_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: "follow_up_set",
    channel: "system",
    metadata: { next_follow_up_at: parsed.data.next_follow_up_at },
  });

  return NextResponse.json({ ok: true });
}
