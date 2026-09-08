import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  status: z.enum(["pendente", "recebido"]).optional(),
  amount_received: z.number().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const update: Record<string, unknown> = { ...parsed.data };
  // Marking "recebido" fills amount_received with the full amount if not given.
  const admin = createAdminClient();
  if (parsed.data.status === "recebido" && parsed.data.amount_received == null) {
    const { data: r } = await admin.from("reimbursements").select("amount").eq("id", id).maybeSingle();
    if (r) update.amount_received = (r as { amount: number }).amount;
  }
  const { error } = await admin.from("reimbursements").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("reimbursements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
