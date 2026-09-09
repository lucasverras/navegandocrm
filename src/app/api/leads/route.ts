import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIRST_PIPELINE_STAGE, PIPELINE_STAGES } from "@/types/domain";
import { extractInstagramHandle, buildInstagramUrl } from "@/lib/instagram";

const manualLeadSchema = z.object({
  name: z.string().min(2).max(200),
  instagram: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(500).optional(),
  category: z.string().max(60).optional(),
  region_id: z.string().uuid().nullable().optional(),
  origin: z.string().max(40).optional(),
  stage: z.enum(PIPELINE_STAGES).nullable().optional(),
  notes: z.string().max(2000).optional(),
  // Manual CLOSED CLIENT (results that already happened — not a lead): create it straight as a
  // won client with its contract + commission, bypassing the pipeline funnel.
  as_client: z.boolean().optional(),
  monthly_fee: z.number().min(0).nullable().optional(),
  commission_type: z.enum(["legacy_recurring", "one_time_percentage", "none"]).optional(),
  commission_percent: z.number().min(0).max(100).nullable().optional(),
  contract_start: z.string().datetime().optional(),
  contract_end: z.string().datetime().nullable().optional(),
  first_payment_paid: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = manualLeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const d = parsed.data;
  const handle = d.instagram ? extractInstagramHandle(d.instagram) : null;
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const row: Record<string, unknown> = {
    region_id: d.region_id ?? null,
    place_id: `manual:${crypto.randomUUID()}`,
    name: d.name.trim(),
    category: d.category?.trim() || "restaurant",
    phone: d.phone?.trim() || null,
    website: d.website?.trim() || null,
    instagram: handle,
    instagram_handle: handle,
    instagram_url: handle ? buildInstagramUrl(handle) : null,
    instagram_confirmed: !!handle,
    instagram_confirmation_method: handle ? "manual" : null,
    instagram_checked_at: handle ? now : null,
    notes: d.notes?.trim() || null,
    lead_origin: d.origin || "manual",
    pre_score: 0,
    triage_status: "approved",
    reviewed_at: now,
    reviewed_by: user.id,
    preparation_status: "not_prepared",
    last_activity_at: now,
    stage_changed_at: now,
  };

  if (d.as_client) {
    const monthly = d.monthly_fee ?? null;
    row.pipeline_stage = "closed";
    row.closed_at = d.contract_start ?? now;
    row.churned_at = d.contract_end ?? null;
    row.closed_value = monthly;
    row.initial_monthly_fee = monthly;
    row.current_monthly_fee = monthly;
    row.commission_type = d.commission_type ?? "one_time_percentage";
    row.commission_percent = d.commission_percent ?? null;
    row.first_payment_paid = d.first_payment_paid ?? false;
    if (d.first_payment_paid) row.first_payment_at = now;
    row.business_status = "client";
  } else {
    row.pipeline_stage = d.stage ?? FIRST_PIPELINE_STAGE;
    row.next_action_type = "first_approach";
    row.contact_round = "FIRST_CONTACT";
  }

  const { data, error } = await admin.from("leads").insert(row).select("id, name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: (data as { id: string }).id,
    event_type: d.as_client ? "client_added_manual" : "lead_created_manual",
    channel: "system",
    metadata: { by: user.id, origin: row.lead_origin },
  });

  return NextResponse.json({ lead: data });
}
