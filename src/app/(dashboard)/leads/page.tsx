import { createClient } from "@/lib/supabase/server";
import { LeadsCRM } from "@/components/leads/LeadsCRM";
import type { LeadRow, RegionRow } from "@/types/database";

export type LeadWithRegion = LeadRow & { regions: Pick<RegionRow, "id" | "neighborhood" | "city"> | null };

export type CRMView = "all" | "no_action" | "to_approach" | "follow_up" | "meetings" | "proposals" | "lost";

const CRM_SELECT =
  "id, name, phone, instagram, instagram_handle, instagram_url, category, " +
  "region_id, pipeline_stage, contact_round, next_action_type, next_action_at, " +
  "proposal_value, proposal_sent_at, meeting_at, assigned_to, last_contacted_at, " +
  "commercial_status, maps_url, website, notes, archived_at";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; region?: string; stage?: string; sort?: string; page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const view = (params.view ?? "all") as CRMView;

  const PAGE_SIZE = 60;
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase.from("leads").select(CRM_SELECT, { count: "exact" });

  if (view === "lost") {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null).or("pipeline_stage.is.null,pipeline_stage.neq.closed");
  }

  switch (view) {
    case "no_action":
      query = query
        .not("pipeline_stage", "is", null)
        .neq("pipeline_stage", "closed")
        .is("next_action_type", null);
      break;
    case "to_approach":
      query = query.eq("next_action_type", "first_approach");
      break;
    case "follow_up":
      query = query.in("contact_round", ["FOLLOW_UP_1", "FOLLOW_UP_2", "FOLLOW_UP_3"]);
      break;
    case "meetings":
      query = query.eq("next_action_type", "meeting");
      break;
    case "proposals":
      query = query.not("proposal_sent_at", "is", null).neq("pipeline_stage", "closed");
      break;
    case "lost":
      break;
    default:
      break;
  }

  if (params.region) query = query.eq("region_id", params.region);
  if (params.stage) query = query.filter("pipeline_stage", "eq", params.stage);
  if (params.q) {
    const q = params.q.trim();
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,instagram_handle.ilike.%${q}%`);
  }

  switch (params.sort) {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "next_action":
      query = query.order("next_action_at", { ascending: true, nullsFirst: false });
      break;
    case "last_contact":
      query = query.order("last_contacted_at", { ascending: false, nullsFirst: false });
      break;
    case "proposal":
      query = query.order("proposal_value", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("last_contacted_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  }

  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data: leadsRaw, count }, { data: regionsRaw }, { data: viewCountsRaw }] = await Promise.all([
    query,
    supabase.from("regions").select("id, neighborhood").order("neighborhood").limit(100),
    supabase
      .from("leads")
      .select("pipeline_stage, next_action_type, contact_round, proposal_sent_at, archived_at")
      .is("archived_at", null)
      .or("pipeline_stage.is.null,pipeline_stage.neq.closed")
      .limit(5000),
  ]);

  type CRMLeadRow = {
    id: string; name: string; phone: string | null; instagram: string | null;
    instagram_handle: string | null; instagram_url: string | null; category: string;
    region_id: string | null; pipeline_stage: string | null; contact_round: string | null;
    next_action_type: string | null; next_action_at: string | null;
    proposal_value: number | null; proposal_sent_at: string | null;
    meeting_at: string | null; assigned_to: string | null; last_contacted_at: string | null;
    commercial_status: string | null; maps_url: string | null; website: string | null;
    notes: string | null; archived_at: string | null;
  };

  const leads = (leadsRaw ?? []) as unknown as CRMLeadRow[];
  const regions = (regionsRaw ?? []) as Pick<RegionRow, "id" | "neighborhood">[];
  const regionMap: Record<string, string> = {};
  for (const r of regions) regionMap[r.id] = r.neighborhood;

  const allLeads = (viewCountsRaw ?? []) as { pipeline_stage: string | null; next_action_type: string | null; contact_round: string | null; proposal_sent_at: string | null; archived_at: string | null }[];
  const viewCounts = {
    all: allLeads.length,
    no_action: allLeads.filter((l) => l.pipeline_stage && l.pipeline_stage !== "closed" && !l.next_action_type).length,
    to_approach: allLeads.filter((l) => l.next_action_type === "first_approach").length,
    follow_up: allLeads.filter((l) => l.contact_round && l.contact_round !== "FIRST_CONTACT").length,
    meetings: allLeads.filter((l) => l.next_action_type === "meeting").length,
    proposals: allLeads.filter((l) => l.proposal_sent_at && l.pipeline_stage !== "closed").length,
    lost: 0,
  };
  const { count: lostCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).not("archived_at", "is", null);
  viewCounts.lost = lostCount ?? 0;

  const leadIds = leads.map((l) => l.id);
  const { data: dmRaw } = leadIds.length
    ? await supabase.from("decision_makers").select("lead_id, name, role").eq("found", true).in("lead_id", leadIds)
    : { data: [] };
  const dmByLead = new Map<string, { name: string | null; role: string | null }>();
  for (const dm of (dmRaw ?? []) as { lead_id: string; name: string | null; role: string | null }[]) {
    if (!dmByLead.has(dm.lead_id) && dm.name) dmByLead.set(dm.lead_id, dm);
  }

  const enriched = leads.map((l) => ({
    ...l,
    regionName: l.region_id ? regionMap[l.region_id] ?? null : null,
    decisionMaker: dmByLead.get(l.id) ?? null,
  }));

  return (
    <LeadsCRM
      leads={enriched}
      regions={regions}
      view={view}
      viewCounts={viewCounts}
      page={page}
      totalPages={Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))}
      total={count ?? 0}
    />
  );
}
