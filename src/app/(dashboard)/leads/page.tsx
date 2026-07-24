import { createClient } from "@/lib/supabase/server";
import { LeadsExplorer } from "@/components/leads/LeadsExplorer";
import type { LeadRow, RegionRow } from "@/types/database";

export type LeadWithRegion = LeadRow & { regions: Pick<RegionRow, "id" | "neighborhood" | "city"> | null };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    region?: string;
    category?: string;
    minRating?: string;
    stage?: string;
    assignedTo?: string;
    hasPhone?: string;
    hasMessage?: string;
    notContacted?: string;
    overdueFollowUp?: string;
    stale?: string;
    discoveredDays?: string;
    lastContactDays?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*, regions(id, neighborhood, city)")
    .is("archived_at", null)
    .limit(500);

  if (params.region) query = query.eq("region_id", params.region);
  if (params.category) query = query.eq("category", params.category);
  if (params.minRating) query = query.gte("google_rating", Number(params.minRating));
  if (params.stage) query = query.eq("pipeline_stage", params.stage);
  if (params.assignedTo) query = query.eq("assigned_to", params.assignedTo);
  if (params.hasPhone === "1") query = query.not("phone", "is", null);
  // Simplification: "com mensagem" is approximated via commercial_status !== not_contacted
  // (avoids an extra join against outreach_messages for the list view).
  if (params.hasMessage === "1") query = query.neq("commercial_status", "not_contacted");
  if (params.notContacted === "1") query = query.eq("commercial_status", "not_contacted");
  if (params.overdueFollowUp === "1") {
    query = query
      .lt("next_follow_up_at", new Date().toISOString())
      .neq("pipeline_stage", "closed")
      .not("next_follow_up_at", "is", null);
  }
  if (params.stale === "1") {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 7);
    query = query.lt("last_activity_at", threshold.toISOString());
  }
  if (params.discoveredDays) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - Number(params.discoveredDays));
    query = query.gte("created_at", threshold.toISOString());
  }
  if (params.lastContactDays) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - Number(params.lastContactDays));
    query = query.gte("last_contacted_at", threshold.toISOString());
  }

  switch (params.sort) {
    case "score_desc":
      query = query.order("ai_score", { ascending: false, nullsFirst: false }).order("pre_score", { ascending: false });
      break;
    case "discovered_recent":
      query = query.order("created_at", { ascending: false });
      break;
    case "discovered_oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "follow_up_soonest":
      query = query.order("next_follow_up_at", { ascending: true, nullsFirst: false });
      break;
    case "stale":
      query = query.order("last_activity_at", { ascending: true });
      break;
    case "stage_longest":
      query = query.order("stage_changed_at", { ascending: true });
      break;
    case "reviews_desc":
      query = query.order("google_review_count", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("pre_score", { ascending: false });
  }

  const { data: leads } = await query;
  const typedLeads = leads as unknown as LeadWithRegion[] | null;

  const { data: regions } = await supabase
    .from("regions")
    .select("id, neighborhood, city")
    .order("neighborhood", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted">
          Selecione leads e clique em &quot;Analisar com IA&quot; para gerar a análise.
        </p>
      </div>
      <LeadsExplorer leads={typedLeads ?? []} regions={regions ?? []} />
    </div>
  );
}
