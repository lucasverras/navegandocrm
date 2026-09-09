import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { outreachStatusSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = outreachStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: current, error: currentError } = await admin
    .from("leads")
    .select("first_contacted_at")
    .eq("id", leadId)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const contactFields = parsed.data.status === "message_sent"
    ? {
        first_contacted_at: current.first_contacted_at ?? now,
        last_contacted_at: now,
        last_activity_at: now,
      }
    : { last_activity_at: now };
  const { error } = await admin
    .from("leads")
    .update({ commercial_status: parsed.data.status, ...contactFields })
    .eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: `status_${parsed.data.status}`,
    channel: "whatsapp",
    metadata: parsed.data.notes ? { notes: parsed.data.notes } : {},
  });

  return NextResponse.json({ ok: true });
}
