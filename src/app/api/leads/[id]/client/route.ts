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
  const { data, error } = await admin.from("leads").update(update).eq("id", id).select("id, name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead: data });
}
