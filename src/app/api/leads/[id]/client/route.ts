import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Update the financials of a won client (the "Fechados" screen): value received so far,
// the value the deal brought, and the churn date (null = still active, "até hoje").
const schema = z.object({
  received_value: z.number().min(0).nullable().optional(),
  closed_value: z.number().min(0).nullable().optional(),
  churned_at: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const update: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  if ("received_value" in parsed.data) update.received_value = parsed.data.received_value;
  if ("closed_value" in parsed.data) update.closed_value = parsed.data.closed_value;
  if ("churned_at" in parsed.data) update.churned_at = parsed.data.churned_at;

  const admin = createAdminClient();
  const { error } = await admin.from("leads").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
