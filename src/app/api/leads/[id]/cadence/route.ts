import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CADENCE_STEP_DAYS, CONTACT_ROUNDS, type ContactRound } from "@/types/domain";

// Advance the follow-up cadence one step (D+2 → D+5 → D+10 → +10 thereafter) and schedule the
// next follow-up. Never sends a message — it just creates the next demand. A reply cancels the
// cadence (reset via the response route). Base is "no reply after contact".

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const admin = createAdminClient();
  const { data: leadRaw } = await admin
    .from("leads")
    .select("cadence_step, contact_round")
    .eq("id", id)
    .maybeSingle();
  if (!leadRaw) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  const { cadence_step: rawStep, contact_round: currentRound } =
    leadRaw as { cadence_step: number; contact_round: ContactRound | null };
  const step = rawStep ?? 0;

  const days = CADENCE_STEP_DAYS[Math.min(step, CADENCE_STEP_DAYS.length - 1)];
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  const now = new Date().toISOString();

  // Advance contact round: FIRST_CONTACT → FUP_1 → FUP_2 → FUP_3 (stays at 3).
  const roundIdx = currentRound ? CONTACT_ROUNDS.indexOf(currentRound) : -1;
  const nextRound = CONTACT_ROUNDS[Math.min(roundIdx + 1, CONTACT_ROUNDS.length - 1)] ?? "FOLLOW_UP_1";

  const { error } = await admin
    .from("leads")
    .update({
      next_follow_up_at: d.toISOString(),
      next_action_type: "follow_up",
      next_action_at: d.toISOString(),
      cadence_step: step + 1,
      contact_round: nextRound,
      last_activity_at: now,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: id,
    event_type: "cadence_followup",
    channel: "system",
    metadata: { step: step + 1, days, by: user.id },
  });

  return NextResponse.json({ ok: true, days, step: step + 1 });
}
