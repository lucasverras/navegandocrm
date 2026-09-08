import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Manage a client's contract + commission (Results › Comissões). Actions:
//  - set_rule: freeze commission_type/percent + monthly fees for this client.
//  - first_payment: mark the one-time first monthly as paid (unlocks the one-time commission).
//  - add_legacy_month: +1 to legacy_months_paid (a legacy client paid another month).
//  - register_received: add to commission_received (a partial/total commission payment came in).
const schema = z.object({
  action: z.enum(["set_rule", "first_payment", "add_legacy_month", "register_received"]),
  commission_type: z.enum(["legacy_recurring", "one_time_percentage", "none"]).optional(),
  commission_percent: z.number().min(0).max(100).nullable().optional(),
  initial_monthly_fee: z.number().min(0).nullable().optional(),
  current_monthly_fee: z.number().min(0).nullable().optional(),
  amount: z.number().min(0).optional(),
  paid: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const d = parsed.data;

  if (d.action === "set_rule") {
    const update: Record<string, unknown> = { last_activity_at: now };
    if (d.commission_type) update.commission_type = d.commission_type;
    if ("commission_percent" in d) update.commission_percent = d.commission_percent;
    if ("initial_monthly_fee" in d) update.initial_monthly_fee = d.initial_monthly_fee;
    if ("current_monthly_fee" in d) update.current_monthly_fee = d.current_monthly_fee;
    const { error } = await admin.from("leads").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "first_payment") {
    const paid = d.paid ?? true;
    const { error } = await admin
      .from("leads")
      .update({ first_payment_paid: paid, first_payment_at: paid ? now : null, last_activity_at: now })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Read-modify-write for the incremental actions (untyped admin client, so fetch first).
  const { data: leadRaw } = await admin
    .from("leads")
    .select("legacy_months_paid, commission_received")
    .eq("id", id)
    .maybeSingle();
  if (!leadRaw) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  const lead = leadRaw as { legacy_months_paid: number; commission_received: number };

  if (d.action === "add_legacy_month") {
    const { error } = await admin
      .from("leads")
      .update({ legacy_months_paid: (lead.legacy_months_paid ?? 0) + 1, last_activity_at: now })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "register_received") {
    const { error } = await admin
      .from("leads")
      .update({ commission_received: (lead.commission_received ?? 0) + (d.amount ?? 0), last_activity_at: now })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
