import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Manually logs "I contacted this lead" — independent from the WhatsApp-send status
// tracked in commercial_status, and from message generation. Pure timestamp bookkeeping.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: currentRaw } = await admin.from("leads").select("first_contacted_at").eq("id", leadId).maybeSingle();
  const current = currentRaw as unknown as { first_contacted_at: string | null } | null;
  if (!current) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const { error } = await admin
    .from("leads")
    .update({
      last_contacted_at: now,
      first_contacted_at: current.first_contacted_at ?? now,
      last_activity_at: now,
    })
    .eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: "contact_registered",
    channel: "system",
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
