import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  description: z.string().min(1).max(300),
  amount: z.number().min(0),
  lead_id: z.string().uuid().nullable().optional(),
  spent_at: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reimbursements")
    .insert({
      description: parsed.data.description,
      amount: parsed.data.amount,
      lead_id: parsed.data.lead_id ?? null,
      spent_at: parsed.data.spent_at ?? new Date().toISOString(),
      notes: parsed.data.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reimbursement: data });
}
