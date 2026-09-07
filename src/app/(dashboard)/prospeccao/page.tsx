import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectionQueue } from "@/components/discovery/SelectionQueue";
import { PrepareQueue } from "@/components/discovery/PrepareQueue";
import { AddToPipelineButton } from "@/components/leads/AddToPipelineButton";
import { categoryLabel } from "@/types/domain";
import { Inbox, CheckCircle2 } from "lucide-react";

type Tab = "encontrados" | "selecionados" | "prontos";

export default async function ProspeccaoPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab = tabRaw === "selecionados" ? "selecionados" : tabRaw === "prontos" ? "prontos" : "encontrados";
  const supabase = await createClient();

  // Live counts for the three tabs.
  const [{ count: encontrados }, { count: selecionados }, { count: prontos }] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("triage_status", "pending_review"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("triage_status", "approved")
      .neq("preparation_status", "ready"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("preparation_status", "ready")
      .is("pipeline_stage", null),
  ]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "encontrados", label: "Encontrados", count: encontrados ?? 0 },
    { key: "selecionados", label: "Selecionados", count: selecionados ?? 0 },
    { key: "prontos", label: "Prontos", count: prontos ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Prospecção" title="Prospecção" />

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/prospeccao?tab=${t.key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === t.key
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label} <span className="text-xs text-muted">({t.count})</span>
          </Link>
        ))}
      </div>

      {tab === "encontrados" && <EncontradosTab />}
      {tab === "selecionados" && <SelecionadosTab />}
      {tab === "prontos" && <ProntosTab />}
    </div>
  );
}

async function EncontradosTab() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, name, category, address, phone, website, google_rating, google_review_count, price_level, maps_url, pre_score, instagram, instagram_handle, instagram_url, discovery_campaign_id"
    )
    .eq("triage_status", "pending_review")
    .order("pre_score", { ascending: false })
    .limit(200);
  return <SelectionQueue leads={data ?? []} />;
}

async function SelecionadosTab() {
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
    leadIds.length ? supabase.from("decision_makers").select("lead_id").in("lead_id", leadIds) : Promise.resolve({ data: [] }),
    leadIds.length ? supabase.from("outreach_messages").select("lead_id").in("lead_id", leadIds) : Promise.resolve({ data: [] }),
  ]);
  const dmSet = new Set((decisionMakers ?? []).map((d) => d.lead_id));
  const msgSet = new Set((messages ?? []).map((m) => m.lead_id));
  const enriched = leads.map((l) => ({ ...l, hasDecisionMaker: dmSet.has(l.id), hasMessage: msgSet.has(l.id) }));

  if (!enriched.length) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-8 w-8" />}
        title="Nada para preparar"
        description="Aprove estabelecimentos em Encontrados para prepará-los aqui."
      />
    );
  }
  return <PrepareQueue leads={enriched} />;
}

async function ProntosTab() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, category, ai_score, pre_score")
    .eq("preparation_status", "ready")
    .is("pipeline_stage", null)
    .order("ai_score", { ascending: false, nullsFirst: false })
    .limit(100);
  const leads = data ?? [];

  if (!leads.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-8 w-8" />}
        title="Nenhum lead pronto"
        description="Prepare leads em Selecionados para vê-los aqui, prontos para o pipeline."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {leads.map((lead) => (
        <div
          key={lead.id}
          className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3"
        >
          <div>
            <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-accent-2">
              {lead.name}
            </Link>
            <div className="text-xs text-muted">
              {categoryLabel(lead.category)} · score {lead.ai_score ?? lead.pre_score}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AddToPipelineButton leadId={lead.id} />
            <Link href={`/leads/${lead.id}`} className="text-xs text-accent-2 hover:underline">
              Abrir
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
