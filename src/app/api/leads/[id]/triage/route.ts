import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { triageDecisionSchema } from "@/lib/schemas";

// Pure triage decision — zero AI, zero Google Places. Only a human approve/reject/defer
// click. Approving does NOT add the lead to the pipeline and does NOT trigger any
// analysis/message generation — that only happens in Preparação, on explicit action.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = triageDecisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("leads")
    .update({
      triage_status: parsed.data.decision,
      reviewed_at: now,
      reviewed_by: user.id,
      rejection_reason: parsed.data.rejection_reason ?? null,
      approval_notes: parsed.data.approval_notes ?? null,
      last_activity_at: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: id,
    event_type: "triage_decision",
    channel: "system",
    metadata: { decision: parsed.data.decision, reviewed_by: user.id },
  });

  return NextResponse.json({ lead: data });
}
