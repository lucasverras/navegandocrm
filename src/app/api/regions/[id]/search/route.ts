import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTriggerSchema } from "@/lib/schemas";
import { geocodeRegion, searchNearbyByCategory, dedupePlaces } from "@/lib/google-places";
import { CATEGORIES } from "@/types/domain";
import { calculatePreScore } from "@/lib/prescore";
import { rateLimit } from "@/lib/rate-limit";
import type { RegionRow, SearchRow } from "@/types/database";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limit = rateLimit(`search:${user.id}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Aguarde antes de iniciar outra pesquisa." }, { status: 429 });
  }

  const { id: regionId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = searchTriggerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const categories = parsed.data.categories ?? CATEGORIES;
  const supabase = await createClient();

  const { data: regionRaw, error: regionError } = await supabase
    .from("regions")
    .select("*")
    .eq("id", regionId)
    .single();

  if (regionError || !regionRaw) {
    return NextResponse.json({ error: "Região não encontrada" }, { status: 404 });
  }
  const region = regionRaw as unknown as RegionRow;

  const { data: searchRaw } = await supabase
    .from("searches")
    .insert({ region_id: regionId, status: "running", categories })
    .select()
    .single();
  const search = searchRaw as unknown as SearchRow | null;

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    if (search) {
      await supabase
        .from("searches")
        .update({ status: "failed", error_message: "GOOGLE_MAPS_API_KEY não configurada", finished_at: new Date().toISOString() })
        .eq("id", search.id);
    }
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY não configurada no ambiente. Configure a chave para pesquisar." },
      { status: 503 }
    );
  }

  try {
    const query = `${region.neighborhood}, ${region.city}, ${region.state}`;
    const geo = await geocodeRegion(query);
    if (!geo) {
      throw new Error(`Não foi possível geocodificar "${query}". Verifique o nome da região.`);
    }

    let queriesExecuted = 0;
    const allResults: Awaited<ReturnType<typeof searchNearbyByCategory>> = [];
    const errors: string[] = [];

    for (const category of categories) {
      try {
        const results = await searchNearbyByCategory(geo.lat, geo.lng, region.radius_meters, category);
        allResults.push(...results);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      queriesExecuted += 1;
    }

    const deduped = dedupePlaces(allResults);

    // Which of these place_ids already exist (across any region) — used for dupe counting.
    const { data: existingRaw } = await supabase
      .from("leads")
      .select("place_id")
      .in("place_id", deduped.map((p) => p.placeId));
    const existing = existingRaw as unknown as { place_id: string }[] | null;
    const existingIds = new Set((existing ?? []).map((r) => r.place_id));

    let placesNew = 0;
    for (const place of deduped) {
      const isDuplicate = existingIds.has(place.placeId);
      if (isDuplicate) continue; // already tracked, skip re-insert

      const preScore = calculatePreScore({
        google_review_count: place.reviewCount,
        google_rating: place.rating,
        website: place.website,
        phone: place.phone,
        category: place.category,
        is_duplicate: false,
        commercial_status: "not_contacted",
        business_status: "new",
        estimated_units: 1,
      });

      const { error: insertError } = await supabase.from("leads").insert({
        region_id: regionId,
        place_id: place.placeId,
        name: place.name,
        category: place.category,
        address: place.address,
        phone: place.phone,
        website: place.website,
        maps_url: place.mapsUrl,
        google_rating: place.rating,
        google_review_count: place.reviewCount,
        price_level: place.priceLevel,
        lat: place.lat,
        lng: place.lng,
        pre_score: preScore,
      });

      if (!insertError) placesNew += 1;
    }

    const finishedStatus = errors.length > 0 ? "partial" : "completed";

    if (search) {
      await supabase
        .from("searches")
        .update({
          status: finishedStatus,
          queries_executed: queriesExecuted,
          places_found: deduped.length,
          places_new: placesNew,
          places_duplicate: deduped.length - placesNew,
          error_message: errors.length ? errors.join("; ").slice(0, 500) : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", search.id);
    }

    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("region_id", regionId);

    await supabase
      .from("regions")
      .update({ last_searched_at: new Date().toISOString(), restaurants_found: count ?? 0 })
      .eq("id", regionId);

    return NextResponse.json({
      status: finishedStatus,
      placesFound: deduped.length,
      placesNew,
      placesDuplicate: deduped.length - placesNew,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido na pesquisa";
    if (search) {
      await supabase
        .from("searches")
        .update({ status: "failed", error_message: message.slice(0, 500), finished_at: new Date().toISOString() })
        .eq("id", search.id);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
