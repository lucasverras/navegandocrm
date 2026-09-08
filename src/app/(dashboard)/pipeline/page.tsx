import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineAddLead } from "@/components/pipeline/PipelineAddLead";
import type { LeadRow, RegionRow } from "@/types/database";

export default async function PipelinePage() {
  const supabase = await createClient();

  const [{ data: leads }, { data: archived }, { data: regions }] = await Promise.all([
    supabase
      .from("leads")
      // Only leads consciously added to the pipeline (pipeline_stage set). Raw discovery/triage
      // rows have a null stage and must never appear on the board.
      .select("*")
      .is("archived_at", null)
      .not("pipeline_stage", "is", null)
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
      <div className="flex items-start justify-between gap-4">
        <PageHeading eyebrow="Funil comercial" title="Pipeline" />
        <PipelineAddLead />
      </div>
      {typedLeads.length === 0 && (
        <p className="text-sm text-muted">
          Nenhum lead no pipeline ainda. Adicione a partir de{" "}
          <Link href="/leads" className="text-accent-2 hover:underline">
            Leads
          </Link>{" "}
          ou de{" "}
          <Link href="/prospeccao?tab=prontos" className="text-accent-2 hover:underline">
            Prospecção › Prontos
          </Link>
          .
        </p>
      )}
      <PipelineBoard initialLeads={typedLeads} archivedLeads={typedArchived} regionMap={regionMap} />
    </div>
  );
}
