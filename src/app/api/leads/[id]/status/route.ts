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

  const { error } = await admin.from("leads").update({ commercial_status: parsed.data.status }).eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: `status_${parsed.data.status}`,
    channel: "whatsapp",
    metadata: parsed.data.notes ? { notes: parsed.data.notes } : {},
  });

  return NextResponse.json({ ok: true });
}
