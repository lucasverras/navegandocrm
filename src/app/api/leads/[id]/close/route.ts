import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { closeDealSchema } from "@/lib/schemas";

// Confirms closing a deal: moves the lead to the "closed" stage and records
// service/value/date/note. Requires explicit confirmation from the UI (not a plain drag).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = closeDealSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: currentRaw } = await admin.from("leads").select("pipeline_stage").eq("id", leadId).maybeSingle();
  const current = currentRaw as unknown as { pipeline_stage: string } | null;
  if (!current) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const monthly = parsed.data.monthly_fee ?? parsed.data.closed_value ?? null;
  const { error } = await admin
    .from("leads")
    .update({
      pipeline_stage: "closed",
      previous_stage: current.pipeline_stage,
      stage_changed_at: now,
      closed_at: now,
      closed_service: parsed.data.closed_service,
      closed_value: monthly,
      closed_note: parsed.data.closed_note ?? null,
      // Contract + commission — frozen on this client at close time.
      initial_monthly_fee: monthly,
      current_monthly_fee: monthly,
      commission_type: parsed.data.commission_type ?? "one_time_percentage",
      commission_percent: parsed.data.commission_percent ?? null,
      churned_at: null,
      business_status: "client",
      contact_round: null,
      cadence_step: 0,
      // Deal done — no pending demands.
      next_action_type: null,
      next_action_at: null,
      next_follow_up_at: null,
      last_activity_at: now,
    })
    .eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: "closed_won",
    channel: "system",
    metadata: { service: parsed.data.closed_service, value: parsed.data.closed_value ?? null, changed_by: user.id },
  });
  await admin.from("client_finance_events").insert({
    lead_id: leadId,
    event_type: "contract_started",
    amount: monthly,
    effective_at: now,
    created_by: user.id,
    metadata: { service: parsed.data.closed_service },
  });

  return NextResponse.json({ ok: true });
}
