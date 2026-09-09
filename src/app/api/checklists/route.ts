import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  text: z.string().min(1).max(500),
  lead_id: z.string().uuid().nullable().optional(),
  amount: z.number().min(0).nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  type: z.string().max(40).nullable().optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: pending }, { data: done }] = await Promise.all([
    admin
      .from("checklists")
      .select("id, text, lead_id, amount, due_at, type, completed_at, created_at, leads(name)")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("checklists")
      .select("id, text, lead_id, amount, type, completed_at, leads(name)")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({ pending: pending ?? [], done: done ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Texto é obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("checklists")
    .insert({
      user_id: user.id,
      text: parsed.data.text.trim(),
      lead_id: parsed.data.lead_id ?? null,
      amount: parsed.data.amount ?? null,
      due_at: parsed.data.due_at ?? null,
      type: parsed.data.type ?? null,
    })
    .select("id, text, lead_id, amount, due_at, type, completed_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
