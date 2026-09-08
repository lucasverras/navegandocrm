import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const patchSchema = z.object({
  business_status: z.enum(["client", "closed", "not_interested", "in_progress", "new"]).optional(),
  notes: z.string().max(4000).optional(),
  opted_out: z.boolean().optional(),
});

// Compact summary for the side-drawer preview — avoids loading the full lead page.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: lead }, { data: dm }, { data: msg }, { data: analysis }, { data: events }] = await Promise.all([
    admin
      .from("leads")
      .select(
        "id, name, category, phone, website, instagram, instagram_handle, instagram_url, maps_url, google_rating, google_review_count, ai_score, pre_score, pipeline_stage, commercial_status, notes, next_follow_up_at, next_action_type, next_action_at, meeting_at, meeting_link, meeting_note, proposal_value, proposal_note, proposal_sent_at, regions(neighborhood, city)"
      )
      .eq("id", id)
      .maybeSingle(),
    admin.from("decision_makers").select("name, role, confidence").eq("lead_id", id).eq("found", true).order("researched_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("outreach_messages").select("content, variant").eq("lead_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("lead_analysis").select("main_opportunity, opportunity_focus").eq("lead_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("outreach_events").select("id, event_type, metadata, created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  return NextResponse.json({
    lead,
    decisionMaker: dm ?? null,
    latestMessage: msg ?? null,
    analysis: analysis ?? null,
    events: events ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("leads").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.business_status === "not_interested") {
    await admin.from("outreach_events").insert({
      lead_id: id,
      event_type: "lead_discarded",
      channel: "system",
      metadata: {},
    });
  }

  return NextResponse.json({ lead: data });
}
