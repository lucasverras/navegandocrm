import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { LeadsExplorer } from "@/components/leads/LeadsExplorer";
import type { LeadRow, RegionRow } from "@/types/database";
import { PIPELINE_STAGES, type PipelineStage } from "@/types/domain";

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
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const PAGE_SIZE = 50;
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("leads")
    .select("*, regions(id, neighborhood, city)", { count: "exact" })
    .is("archived_at", null);

  if (params.region) query = query.eq("region_id", params.region);
  if (params.category) query = query.eq("category", params.category);
  if (params.minRating) query = query.gte("google_rating", Number(params.minRating));
  if (params.stage && PIPELINE_STAGES.includes(params.stage as PipelineStage)) {
    query = query.eq("pipeline_stage", params.stage as PipelineStage);
  }
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

  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Leads + regions are independent — run them in parallel instead of a serial waterfall.
  const [{ data: leads, count }, { data: regions }] = await Promise.all([
    query,
    supabase.from("regions").select("id, neighborhood, city").order("neighborhood", { ascending: true }),
  ]);
  const typedLeads = leads as unknown as LeadWithRegion[] | null;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Prospecção" title="Leads" subtitle="Selecione e clique em “Analisar com IA” para transformar dados em oportunidade." />
      <LeadsExplorer leads={typedLeads ?? []} regions={regions ?? []} page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
