import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bulkTriageActionSchema } from "@/lib/schemas";

// Bulk triage from the Selecionar table mode — never calls OpenAI or Google Places.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bulkTriageActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { leadIds, decision, rejection_reason } = parsed.data;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("leads")
    .update({
      triage_status: decision,
      reviewed_at: now,
      reviewed_by: user.id,
      rejection_reason: rejection_reason ?? null,
      last_activity_at: now,
    })
    .in("id", leadIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert(
    leadIds.map((leadId) => ({
      lead_id: leadId,
      event_type: "triage_decision",
      channel: "system",
      metadata: { decision, bulk: true, reviewed_by: user.id },
    }))
  );

  return NextResponse.json({ ok: true, updated: leadIds.length });
}
