import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { discoveryCampaignCreateSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";

// Pure-code overlap check (no AI): same neighborhood/city/state, or center points within
// ~half the smaller radius of each other — used to prompt update/create-new/cancel instead
// of relying only on an exact-match DB constraint like `regions` does.
function findOverlap(
  candidate: { neighborhood: string; city: string; state: string; lat?: number | null; lng?: number | null; radius_meters: number },
  existing: { id: string; neighborhood: string; city: string; state: string; lat: number | null; lng: number | null; radius_meters: number }[]
) {
  const norm = (s: string) => s.trim().toLowerCase();
  return existing.find((e) => {
    const sameLocation =
      norm(e.neighborhood) === norm(candidate.neighborhood) &&
      norm(e.city) === norm(candidate.city) &&
      norm(e.state) === norm(candidate.state);
    if (sameLocation) return true;
    if (candidate.lat == null || candidate.lng == null || e.lat == null || e.lng == null) return false;
    const distMeters =
      Math.sqrt((candidate.lat - e.lat) ** 2 + (candidate.lng - e.lng) ** 2) * 111_000; // rough deg→m
    return distMeters < Math.min(candidate.radius_meters, e.radius_meters) / 2;
  });
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = await createClient();
  const [{ data: campaigns, error }, { data: stats }] = await Promise.all([
    supabase.from("discovery_campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("discovery_campaign_stats").select("*"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: campaigns ?? [], stats: stats ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limit = rateLimit(`discovery-campaigns:create:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = discoveryCampaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();

  if (!parsed.data.force) {
    const { data: existing } = await supabase
      .from("discovery_campaigns")
      .select("id, neighborhood, city, state, lat, lng, radius_meters")
      .neq("status", "archived");
    const overlap = findOverlap(parsed.data, existing ?? []);
    if (overlap) {
      return NextResponse.json(
        { conflict: true, existingCampaignId: overlap.id, message: "Já existe uma campanha para essa região." },
        { status: 409 }
      );
    }
  }

  const insertData = { ...parsed.data };
  delete (insertData as { force?: boolean }).force;
  const { data, error } = await supabase
    .from("discovery_campaigns")
    .insert({ ...insertData, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}
