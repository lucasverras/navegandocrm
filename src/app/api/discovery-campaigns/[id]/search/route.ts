import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTriggerSchema } from "@/lib/schemas";
import { geocodeRegion, searchNearbyByCategory, dedupePlaces, type PlaceResult } from "@/lib/google-places";
import { calculatePreScore } from "@/lib/prescore";
import { classifyExclusion, matchesKnownFranchise, type ExclusionReason } from "@/lib/discovery-filters";
import { rateLimit } from "@/lib/rate-limit";
import type { DiscoveryCampaignRow } from "@/types/database";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limit = rateLimit(`discovery-search:${user.id}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Aguarde antes de iniciar outra pesquisa." }, { status: 429 });
  }

  const { id: campaignId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = searchTriggerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const supabase = await createClient();

  const { data: campaignRaw, error: campaignError } = await supabase
    .from("discovery_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaignRaw) {
    return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  }
  const campaign = campaignRaw as unknown as DiscoveryCampaignRow;
  const effectiveCategories = (parsed.data.categories ?? campaign.included_types) as Parameters<
    typeof searchNearbyByCategory
  >[3][];

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY não configurada no ambiente. Configure a chave para pesquisar." },
      { status: 503 }
    );
  }

  const { data: searchRaw } = await supabase
    .from("searches")
    .insert({
      region_id: campaign.source_region_id,
      discovery_campaign_id: campaignId,
      status: "running",
      categories: effectiveCategories,
    })
    .select()
    .single();
  const searchId = (searchRaw as { id: string } | null)?.id;

  try {
    let lat = campaign.lat;
    let lng = campaign.lng;
    if (lat == null || lng == null) {
      const query = `${campaign.neighborhood}, ${campaign.city}, ${campaign.state}`;
      const geo = await geocodeRegion(query);
      if (!geo) throw new Error(`Não foi possível geocodificar "${query}". Verifique o nome da campanha.`);
      lat = geo.lat;
      lng = geo.lng;
      await supabase.from("discovery_campaigns").update({ lat, lng }).eq("id", campaignId);
    }

    const settled = await Promise.allSettled(
      effectiveCategories.map((category) => searchNearbyByCategory(lat!, lng!, campaign.radius_meters, category))
    );

    const allResults: PlaceResult[] = [];
    const errors: string[] = [];
    for (const s of settled) {
      if (s.status === "fulfilled") allResults.push(...s.value);
      else errors.push(s.reason instanceof Error ? s.reason.message : String(s.reason));
    }

    const deduped = dedupePlaces(allResults);

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

    const counts: Record<"found" | "blocked_category" | "blocked_keyword" | "duplicate" | "sent_to_triage", number> = {
      found: deduped.length,
      blocked_category: 0,
      blocked_keyword: 0,
      duplicate: 0,
      sent_to_triage: 0,
    };

    let placesNew = 0;
    for (const place of deduped) {
      const existingLead = existingByPlaceId.get(place.placeId);

      const exclusionReason: ExclusionReason | null = classifyExclusion(
        place,
        {
          excluded_types: campaign.excluded_types,
          blocked_keywords: campaign.blocked_keywords,
          min_rating: campaign.min_rating,
          min_reviews: campaign.min_reviews,
          exclude_franchises: campaign.exclude_franchises,
          exclude_chains: campaign.exclude_chains,
          exclude_no_phone: campaign.exclude_no_phone,
          exclude_no_website: campaign.exclude_no_website,
        },
        {
          isDuplicate: Boolean(existingLead),
          isExistingClient: existingLead?.business_status === "client",
          isAlreadyRejected: existingLead?.triage_status === "rejected",
          isAlreadyProspected: Boolean(existingLead) && existingLead?.triage_status !== "pending_review",
        }
      );

      if (existingLead) {
        counts.duplicate += 1;
        continue; // never re-insert a place we already track — audit trail stays on the original row
      }
      if (exclusionReason === "blocked_category") counts.blocked_category += 1;
      if (exclusionReason === "blocked_keyword") counts.blocked_keyword += 1;

      const preScore = calculatePreScore({
        google_review_count: place.reviewCount,
        google_rating: place.rating,
        website: place.website,
        phone: place.phone,
        price_level: place.priceLevel,
        estimated_units: 1,
        isLikelyIndependent: !matchesKnownFranchise(place.name),
      });

      const { error: insertError } = await supabase.from("leads").insert({
        region_id: campaign.source_region_id,
        discovery_campaign_id: campaignId,
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
        pipeline_stage: null,
        triage_status: exclusionReason ? "auto_filtered" : "pending_review",
        exclusion_reason: exclusionReason,
      });

      if (!insertError) {
        placesNew += 1;
        if (!exclusionReason) counts.sent_to_triage += 1;
      }
    }

    const finishedStatus = errors.length > 0 ? "partial" : "completed";

    if (searchId) {
      await supabase
        .from("searches")
        .update({
          status: finishedStatus,
          queries_executed: effectiveCategories.length,
          places_found: deduped.length,
          places_new: placesNew,
          places_duplicate: counts.duplicate,
          error_message: errors.length ? errors.join("; ").slice(0, 500) : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", searchId);
    }

    await supabase
      .from("discovery_campaigns")
      .update({ last_searched_at: new Date().toISOString() })
      .eq("id", campaignId);

    return NextResponse.json({
      status: finishedStatus,
      placesFound: deduped.length,
      placesNew,
      placesDuplicate: counts.duplicate,
      removedByCategory: counts.blocked_category,
      removedByKeyword: counts.blocked_keyword,
      sentToTriage: counts.sent_to_triage,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido na pesquisa";
    if (searchId) {
      await supabase
        .from("searches")
        .update({ status: "failed", error_message: message.slice(0, 500), finished_at: new Date().toISOString() })
        .eq("id", searchId);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
