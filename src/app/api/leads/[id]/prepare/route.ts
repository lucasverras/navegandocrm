import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const prepareSchema = z.object({
  action: z.enum(["mark_ready", "mark_partial"]),
  next_best_action: z.string().max(300).optional(),
});

// Marks a lead's preparation_status once the human confirms enough enrichment
// (decision-maker research + message) exists. No AI call here — this route only
// records the human's confirmation and the next step, zero cost.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = prepareSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("leads")
    .update({
      preparation_status: parsed.data.action === "mark_ready" ? "ready" : "partially_prepared",
      prepared_at: now,
      next_best_action: parsed.data.next_best_action ?? null,
      last_activity_at: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: id,
    event_type: "preparation_status_changed",
    channel: "system",
    metadata: { status: parsed.data.action, by: user.id },
  });

  return NextResponse.json({ lead: data });
}
