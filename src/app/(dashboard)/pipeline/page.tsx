import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import type { LeadRow, RegionRow } from "@/types/database";

export default async function PipelinePage() {
  const supabase = await createClient();

  const [{ data: leads }, { data: archived }, { data: regions }] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .is("archived_at", null)
      .order("pipeline_stage", { ascending: true })
      .order("pipeline_position", { ascending: true })
      .limit(500),
    supabase
      .from("leads")
      .select("*")
      .not("archived_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.from("regions").select("id, neighborhood"),
  ]);

  const typedLeads = (leads as unknown as LeadRow[] | null) ?? [];
  const typedArchived = (archived as unknown as LeadRow[] | null) ?? [];
  const typedRegions = (regions as unknown as Pick<RegionRow, "id" | "neighborhood">[] | null) ?? [];

  const regionMap: Record<string, string> = {};
  for (const r of typedRegions) regionMap[r.id] = r.neighborhood;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-muted">
          Arraste os leads entre as etapas ou use o menu &quot;Mover para&quot; em cada card.
        </p>
      </div>
      <PipelineBoard initialLeads={typedLeads} archivedLeads={typedArchived} regionMap={regionMap} />
    </div>
  );
}
