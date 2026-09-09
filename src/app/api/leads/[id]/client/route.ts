import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Full edit of a closed client (V7 §56): name, dates, fee, commission — everything the user
// may need to fix after the fact. The Resultados table has an "Editar" button per row.
const schema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(40).nullable().optional(),
  instagram: z.string().max(300).nullable().optional(),
  region_id: z.string().uuid().nullable().optional(),
  closed_at: z.string().datetime().nullable().optional(),
  churned_at: z.string().datetime().nullable().optional(),
  initial_monthly_fee: z.number().min(0).nullable().optional(),
  current_monthly_fee: z.number().min(0).nullable().optional(),
  commission_type: z.enum(["legacy_recurring", "one_time_percentage", "none"]).optional(),
  commission_percent: z.number().min(0).max(100).nullable().optional(),
  commission_received: z.number().min(0).nullable().optional(),
  first_payment_paid: z.boolean().optional(),
  legacy_months_paid: z.number().min(0).nullable().optional(),
  closed_value: z.number().min(0).nullable().optional(),
  received_value: z.number().min(0).nullable().optional(),
  closed_note: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const update: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) update[key] = value;
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("leads")
    .select("closed_at, churned_at, current_monthly_fee, commission_type, commission_percent, commission_received")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const { data, error } = await admin.from("leads").update(update).eq("id", id).select("id, name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date().toISOString();
  const events: Array<Record<string, unknown>> = [];
  const changed = (key: keyof typeof before) =>
    key in parsed.data && parsed.data[key as keyof typeof parsed.data] !== before[key];
  if (changed("current_monthly_fee")) {
    events.push({
      event_type: "fee_changed",
      amount: parsed.data.current_monthly_fee ?? null,
      effective_at: now,
      metadata: { from: before.current_monthly_fee, to: parsed.data.current_monthly_fee ?? null },
    });
  }
  if (changed("commission_type") || changed("commission_percent")) {
    events.push({
      event_type: "commission_rule_changed",
      amount: null,
      effective_at: now,
      metadata: {
        from: { type: before.commission_type, percent: before.commission_percent },
        to: {
          type: parsed.data.commission_type ?? before.commission_type,
          percent: parsed.data.commission_percent ?? before.commission_percent,
        },
      },
    });
  }
  if (changed("commission_received")) {
    events.push({
      event_type: "adjustment",
      amount: (parsed.data.commission_received ?? 0) - (before.commission_received ?? 0),
      effective_at: now,
      note: "Ajuste manual da comissão recebida",
      metadata: { from: before.commission_received, to: parsed.data.commission_received ?? null },
    });
  }
  if (changed("closed_at") && parsed.data.closed_at) {
    events.push({
      event_type: "contract_started",
      amount: parsed.data.current_monthly_fee ?? before.current_monthly_fee,
      effective_at: parsed.data.closed_at,
      metadata: { corrected: !!before.closed_at },
    });
  }
  if (changed("churned_at")) {
    events.push({
      event_type: parsed.data.churned_at ? "contract_ended" : "contract_reactivated",
      amount: null,
      effective_at: parsed.data.churned_at ?? now,
      metadata: { from: before.churned_at, to: parsed.data.churned_at ?? null },
    });
  }
  if (events.length) {
    await admin.from("client_finance_events").insert(
      events.map((event) => ({ ...event, lead_id: id, created_by: user.id }))
    );
  }
  return NextResponse.json({ ok: true, lead: data });
}
