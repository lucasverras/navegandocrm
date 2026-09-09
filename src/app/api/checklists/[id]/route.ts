import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  amount: z.number().min(0).nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  type: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.text !== undefined) update.text = parsed.data.text.trim();
  if (parsed.data.lead_id !== undefined) update.lead_id = parsed.data.lead_id;
  if (parsed.data.amount !== undefined) update.amount = parsed.data.amount;
  if (parsed.data.due_at !== undefined) update.due_at = parsed.data.due_at;
  if (parsed.data.type !== undefined) update.type = parsed.data.type;
  if (parsed.data.completed !== undefined) {
    update.completed_at = parsed.data.completed ? new Date().toISOString() : null;
  }

  const { data, error } = await admin
    .from("checklists")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, text, completed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("checklists").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
