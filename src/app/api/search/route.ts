import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Fast global search for the command palette (⌘K). Matches leads by name or phone.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Strip characters that would break PostgREST's .or()/ilike filter grammar.
  const q = raw.replace(/[,()%*\\]/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const admin = createAdminClient();
  const { data } = await admin
    .from("leads")
    .select("id, name, phone, category, instagram, instagram_handle, instagram_url, maps_url, website, pipeline_stage")
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .is("archived_at", null)
    .order("ai_score", { ascending: false, nullsFirst: false })
    .limit(8);

  return NextResponse.json({ results: data ?? [] });
}
