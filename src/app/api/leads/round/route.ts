import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTACT_ROUNDS, type ContactRound } from "@/types/domain";

// Returns leads for a specific contact_round, ready to be worked one-at-a-time.
// Includes the latest message (for WhatsApp prefill) and decision-maker.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const round = req.nextUrl.searchParams.get("round");
  if (!round || !CONTACT_ROUNDS.includes(round as (typeof CONTACT_ROUNDS)[number])) {
    return NextResponse.json({ error: "Rodada inválida" }, { status: 400 });
  }
  const contactRound = round as ContactRound;

  const admin = createAdminClient();

  let leadsQuery = admin
    .from("leads")
    .select(
      "id, name, phone, instagram, instagram_handle, instagram_url, website, maps_url, " +
      "contact_round, next_action_type, next_action_at, commercial_status, " +
      "region:regions(neighborhood)"
    )
    .eq("contact_round", contactRound)
    .is("archived_at", null)
    .or("pipeline_stage.is.null,pipeline_stage.neq.closed");
  if (contactRound !== "FIRST_CONTACT") {
    leadsQuery = leadsQuery.lte("next_action_at", new Date().toISOString());
  }
  const { data: leads, error: leadsError } = await leadsQuery
    .order("last_activity_at", { ascending: true })
    .limit(50);
  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 });

  const ids = (leads ?? []).map((l) => (l as unknown as { id: string }).id);

  const [{ data: messages }, { data: dms }] = await Promise.all([
    ids.length
      ? admin
          .from("outreach_messages")
          .select("lead_id, content, contact_round, created_at")
          .in("lead_id", ids)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin
          .from("decision_makers")
          .select("lead_id, name, role")
          .eq("found", true)
          .in("lead_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const messageMap = new Map<string, string>();
  for (const m of (messages ?? []) as { lead_id: string; content: string; contact_round: string | null }[]) {
    if (m.contact_round === contactRound && !messageMap.has(m.lead_id)) messageMap.set(m.lead_id, m.content);
  }
  for (const m of (messages ?? []) as { lead_id: string; content: string; contact_round: string | null }[]) {
    if (!messageMap.has(m.lead_id)) messageMap.set(m.lead_id, m.content);
  }
  const dmMap = new Map<string, string>();
  for (const d of (dms ?? []) as { lead_id: string; name: string | null; role: string | null }[]) {
    if (!dmMap.has(d.lead_id) && d.name) dmMap.set(d.lead_id, [d.name, d.role].filter(Boolean).join(" · "));
  }

  type Lead = {
    id: string;
    name: string;
    phone: string | null;
    instagram: string | null;
    instagram_handle: string | null;
    instagram_url: string | null;
    website: string | null;
    maps_url: string | null;
    contact_round: string;
    commercial_status: string | null;
    region: { neighborhood: string } | null;
  };

  const enriched = ((leads ?? []) as unknown as Lead[]).map((l) => ({
    ...l,
    message: messageMap.get(l.id) ?? null,
    decisor: dmMap.get(l.id) ?? null,
    regionName: l.region?.neighborhood ?? null,
  }));

  return NextResponse.json({ leads: enriched });
}
