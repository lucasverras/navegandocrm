import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { PrepareQueue } from "@/components/discovery/PrepareQueue";

export default async function PrepararPage() {
  const supabase = await createClient();
  const { data: leadsRaw } = await supabase
    .from("leads")
    .select("id, name, category, preparation_status, instagram, ai_score, pre_score")
    .eq("triage_status", "approved")
    .neq("preparation_status", "ready")
    .order("pre_score", { ascending: false })
    .limit(50);

  const leads = leadsRaw ?? [];
  const leadIds = leads.map((l) => l.id);

  const [{ data: decisionMakers }, { data: messages }] = await Promise.all([
    leadIds.length
      ? supabase.from("decision_makers").select("lead_id").in("lead_id", leadIds)
      : Promise.resolve({ data: [] }),
    leadIds.length
      ? supabase.from("outreach_messages").select("lead_id").in("lead_id", leadIds)
      : Promise.resolve({ data: [] }),
  ]);

  const decisionMakerLeadIds = new Set((decisionMakers ?? []).map((d) => d.lead_id));
  const messageLeadIds = new Set((messages ?? []).map((m) => m.lead_id));

  const enriched = leads.map((l) => ({
    ...l,
    hasDecisionMaker: decisionMakerLeadIds.has(l.id),
    hasMessage: messageLeadIds.has(l.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Preparação"
        title="Preparar"
        subtitle="Pesquise decisor, analise e gere a mensagem antes de marcar o lead como pronto para o pipeline."
      />
      <PrepareQueue leads={enriched} />
    </div>
  );
}
