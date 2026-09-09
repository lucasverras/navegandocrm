import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTriggerSchema } from "@/lib/schemas";
import { geocodeRegion, searchNearbyByCategory, dedupePlaces, type PlaceResult } from "@/lib/google-places";
import { CATEGORIES } from "@/types/domain";
import { calculatePreScore } from "@/lib/prescore";
import {
  classifyExclusion,
  matchesKnownFranchise,
  type DiscoveryCampaignFilters,
  type ExclusionReason,
} from "@/lib/discovery-filters";
import { rateLimit } from "@/lib/rate-limit";
import type { LeadRow, RegionRow, SearchRow } from "@/types/database";

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

  const mutableCategories = [...categories];
  const { data: searchRaw } = await supabase
    .from("searches")
    .insert({ region_id: regionId, status: "running", categories: mutableCategories })
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

    // Parallelize category searches instead of a sequential per-category round-trip.
    const settled = await Promise.allSettled(
      categories.map((category) => searchNearbyByCategory(geo.lat, geo.lng, region.radius_meters, category))
    );

    const allResults: PlaceResult[] = [];
    const errors: string[] = [];
    for (const s of settled) {
      if (s.status === "fulfilled") allResults.push(...s.value);
      else errors.push(s.reason instanceof Error ? s.reason.message : String(s.reason));
    }
    const queriesExecuted = categories.length;

    const deduped = dedupePlaces(allResults);

    // Batch-load existing leads (across any region) to detect dupes and feed the deterministic filter.
    const { data: existingRaw } = await supabase
      .from("leads")
      .select("place_id, business_status, triage_status")
      .in("place_id", deduped.map((p) => p.placeId));
    const existingByPlaceId = new Map(
      ((existingRaw ?? []) as { place_id: string; business_status: string; triage_status: string }[]).map((r) => [
        r.place_id,
        r,
      ])
    );

    // Region searches have no per-campaign filter config, so only the deterministic defaults
    // (denylist types + keyword blocklist) apply. Nothing invented — plain defaults.
    const regionFilters: DiscoveryCampaignFilters = {
      excluded_types: [],
      blocked_keywords: [],
      min_rating: null,
      min_reviews: null,
      exclude_franchises: false,
      exclude_chains: false,
      exclude_no_phone: false,
      exclude_no_website: false,
    };

    const newLeadRows: Partial<LeadRow>[] = [];
    for (const place of deduped) {
      const existingLead = existingByPlaceId.get(place.placeId);
      if (existingLead) continue; // already tracked, skip re-insert

      const exclusionReason: ExclusionReason | null = classifyExclusion(place, regionFilters, {
        isDuplicate: false,
        isExistingClient: false,
        isAlreadyRejected: false,
        isAlreadyProspected: false,
      });

      const preScore = calculatePreScore({
        google_review_count: place.reviewCount,
        google_rating: place.rating,
        website: place.website,
        phone: place.phone,
        price_level: place.priceLevel,
        estimated_units: 1,
        isLikelyIndependent: !matchesKnownFranchise(place.name),
      });

      newLeadRows.push({
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
        photo_name: place.photoName,
        price_level: place.priceLevel,
        lat: place.lat,
        lng: place.lng,
        pre_score: preScore,
        triage_status: exclusionReason ? "auto_filtered" : "pending_review",
        exclusion_reason: exclusionReason,
      });
    }

    // Single bulk insert of all new rows instead of one write per place (N+1).
    let placesNew = 0;
    if (newLeadRows.length > 0) {
      const { error: insertError } = await supabase.from("leads").insert(newLeadRows);
      if (insertError) errors.push(insertError.message);
      else placesNew = newLeadRows.length;
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
