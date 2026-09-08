import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIRST_PIPELINE_STAGE } from "@/types/domain";
import { extractInstagramHandle, buildInstagramUrl } from "@/lib/instagram";

const manualLeadSchema = z.object({
  name: z.string().min(2).max(200),
  instagram: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(500).optional(),
  category: z.string().max(60).optional(),
});

// Manually create a prospect (a name the user already has — from an Instagram link, a referral,
// etc.) and drop it straight onto the pipeline. No Google Places, no region.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = manualLeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const { name, phone, website, category } = parsed.data;
  const handle = parsed.data.instagram ? extractInstagramHandle(parsed.data.instagram) : null;
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("leads")
    .insert({
      region_id: null,
      place_id: `manual:${crypto.randomUUID()}`,
      name: name.trim(),
      category: category?.trim() || "restaurant",
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      instagram: handle,
      instagram_handle: handle,
      instagram_url: handle ? buildInstagramUrl(handle) : null,
      instagram_confirmed: !!handle,
      instagram_confirmation_method: handle ? "manual" : null,
      instagram_checked_at: handle ? now : null,
      pre_score: 0,
      triage_status: "approved",
      reviewed_at: now,
      reviewed_by: user.id,
      preparation_status: "not_prepared",
      pipeline_stage: FIRST_PIPELINE_STAGE,
      pipeline_position: 0,
      stage_changed_at: now,
      last_activity_at: now,
    })
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: (data as { id: string }).id,
    event_type: "lead_created_manual",
    channel: "system",
    metadata: { by: user.id },
  });

  return NextResponse.json({ lead: data });
}
