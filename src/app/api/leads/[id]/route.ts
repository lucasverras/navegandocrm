import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const patchSchema = z.object({
  business_status: z.enum(["client", "closed", "not_interested", "in_progress", "new"]).optional(),
  notes: z.string().max(4000).optional(),
  opted_out: z.boolean().optional(),
});

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
