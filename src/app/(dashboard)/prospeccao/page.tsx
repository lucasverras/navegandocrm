import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectionQueue } from "@/components/discovery/SelectionQueue";
import { PrepareQueue } from "@/components/discovery/PrepareQueue";
import { AddToPipelineButton } from "@/components/leads/AddToPipelineButton";
import { WhatsAppButton } from "@/components/leads/WhatsAppButton";
import { LeadDrawerLink } from "@/components/leads/LeadDrawer";
import { categoryLabel } from "@/types/domain";
import { Inbox, CheckCircle2, ChevronRight, MapPin } from "lucide-react";

type Tab = "encontrados" | "selecionados" | "prontos";
type Counts = { total: number; pending: number; approved: number; ready: number };

export default async function ProspeccaoPage({ searchParams }: { searchParams: Promise<{ tab?: string; region?: string }> }) {
  const { tab: tabRaw, region } = await searchParams;
  const tab: Tab = tabRaw === "selecionados" ? "selecionados" : tabRaw === "prontos" ? "prontos" : "encontrados";
  const supabase = await createClient();

  // First level: no region selected → show the regions with their funnel counts.
  if (!region) {
    const [{ data: regionsRaw }, { data: rollupRaw }] = await Promise.all([
      supabase.from("regions").select("id, neighborhood, city").order("neighborhood", { ascending: true }),
      supabase.from("leads").select("region_id, triage_status, preparation_status, pipeline_stage").is("archived_at", null),
    ]);
    const regions = (regionsRaw ?? []) as { id: string; neighborhood: string; city: string }[];
    const rollup = (rollupRaw ?? []) as { region_id: string | null; triage_status: string; preparation_status: string; pipeline_stage: string | null }[];

    const byRegion = new Map<string, Counts>();
    const bump = (key: string, f: (c: Counts) => void) => {
      const c = byRegion.get(key) ?? { total: 0, pending: 0, approved: 0, ready: 0 };
      f(c);
      byRegion.set(key, c);
    };
    for (const l of rollup) {
      const key = l.region_id ?? "none";
      bump(key, (c) => {
        c.total += 1;
        if (l.triage_status === "pending_review") c.pending += 1;
        if (l.triage_status === "approved") c.approved += 1;
        if (l.preparation_status === "ready" && l.pipeline_stage == null) c.ready += 1;
      });
    }

    const rows = regions.map((r) => ({ ...r, counts: byRegion.get(r.id) ?? { total: 0, pending: 0, approved: 0, ready: 0 } }));
    const semRegiao = byRegion.get("none");

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <PageHeading eyebrow="Prospecção" title="Prospecção" />
          <Link href="/descobrir" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-2">
            + Nova região
          </Link>
        </div>

        {rows.length === 0 && !semRegiao ? (
          <EmptyState icon={<MapPin className="h-8 w-8" />} title="Nenhuma região" description="Crie uma campanha em Descobrir para começar a prospectar." />
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            <Link href="/prospeccao?region=all&tab=encontrados" className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
              <span className="font-medium text-foreground">Todas as regiões</span>
              <ChevronRight className="h-4 w-4 text-muted" />
            </Link>
            {rows.map((r) => (
              <Link key={r.id} href={`/prospeccao?region=${r.id}&tab=encontrados`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{r.neighborhood}</div>
                  <div className="text-xs text-muted">{r.city}</div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums text-muted">
                  <Count n={r.counts.total} label="encontrados" />
                  <Count n={r.counts.pending} label="a revisar" accent={r.counts.pending > 0} />
                  <Count n={r.counts.approved} label="selecionados" />
                  <Count n={r.counts.ready} label="prontos" />
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
            {semRegiao && (
              <Link href="/prospeccao?region=none&tab=encontrados" className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2">
                <div className="font-medium text-foreground">Sem região <span className="text-xs text-muted">(manuais)</span></div>
                <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums text-muted">
                  <Count n={semRegiao.total} label="total" />
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  // Second level: a region (or "all") selected → the three tabs, scoped.
  const regionId = region === "all" || region === "none" ? undefined : region;
  const nullRegion = region === "none";
  let regionName = "Todas as regiões";
  if (regionId) {
    const { data: r } = await supabase.from("regions").select("neighborhood, city").eq("id", regionId).maybeSingle();
    if (r) regionName = `${(r as { neighborhood: string }).neighborhood}`;
  } else if (nullRegion) {
    regionName = "Sem região";
  }

  const scope = <T,>(q: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let x: any = q;
    if (regionId) x = x.eq("region_id", regionId);
    else if (nullRegion) x = x.is("region_id", null);
    return x;
  };

  const [{ count: encontrados }, { count: selecionados }, { count: prontos }] = await Promise.all([
    scope(supabase.from("leads").select("id", { count: "exact", head: true }).eq("triage_status", "pending_review")),
    scope(supabase.from("leads").select("id", { count: "exact", head: true }).eq("triage_status", "approved").neq("preparation_status", "ready")),
    scope(supabase.from("leads").select("id", { count: "exact", head: true }).eq("preparation_status", "ready").is("pipeline_stage", null)),
  ]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "encontrados", label: "Encontrados", count: encontrados ?? 0 },
    { key: "selecionados", label: "Selecionados", count: selecionados ?? 0 },
    { key: "prontos", label: "Prontos", count: prontos ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/prospeccao" className="text-xs text-muted hover:text-foreground">
            ← Regiões
          </Link>
          <PageHeading eyebrow="Prospecção" title={regionName} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/prospeccao?region=${region}&tab=${t.key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label} <span className="text-xs text-muted">({t.count})</span>
          </Link>
        ))}
      </div>

      {tab === "encontrados" && <EncontradosTab regionId={regionId} nullRegion={nullRegion} />}
      {tab === "selecionados" && <SelecionadosTab regionId={regionId} nullRegion={nullRegion} />}
      {tab === "prontos" && <ProntosTab regionId={regionId} nullRegion={nullRegion} />}
    </div>
  );
}

function Count({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <span className="hidden sm:inline">
      <span className={accent ? "font-semibold text-accent-2" : "font-semibold text-foreground"}>{n}</span> {label}
    </span>
  );
}

function applyScope<T>(q: T, regionId?: string, nullRegion?: boolean): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let x: any = q;
  if (regionId) x = x.eq("region_id", regionId);
  else if (nullRegion) x = x.is("region_id", null);
  return x;
}

async function EncontradosTab({ regionId, nullRegion }: { regionId?: string; nullRegion?: boolean }) {
  const supabase = await createClient();
  const { data } = await applyScope(
    supabase
      .from("leads")
      .select(
        "id, name, category, address, phone, website, google_rating, google_review_count, price_level, maps_url, pre_score, instagram, instagram_handle, instagram_url, discovery_campaign_id, photo_name"
      )
      .eq("triage_status", "pending_review"),
    regionId,
    nullRegion
  )
    .order("pre_score", { ascending: false })
    .limit(200);
  return (
    <div className="flex flex-col gap-3">
      <SelectionQueue leads={data ?? []} />
      {/* Alternativa de CONTROLE ao Tinder (§20): a tabela completa vive em /leads. */}
      <Link href="/leads" className="w-fit text-xs text-muted transition-colors hover:text-foreground">
        Ver em tabela →
      </Link>
    </div>
  );
}

async function SelecionadosTab({ regionId, nullRegion }: { regionId?: string; nullRegion?: boolean }) {
  const supabase = await createClient();
  const { data: leadsRaw } = await applyScope(
    supabase
      .from("leads")
      .select("id, name, category, preparation_status, instagram, ai_score, pre_score")
      .eq("triage_status", "approved")
      .neq("preparation_status", "ready"),
    regionId,
    nullRegion
  )
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
    return <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Nada para preparar" description="Aprove estabelecimentos em Encontrados para prepará-los aqui." />;
  }
  return <PrepareQueue leads={enriched} />;
}

// Prontos (§25): o lead está pronto para ser chamado — telefone, Instagram, decisor, uma
// observação específica e a mensagem pronta, com WhatsApp a um clique.
async function ProntosTab({ regionId, nullRegion }: { regionId?: string; nullRegion?: boolean }) {
  const supabase = await createClient();
  const { data } = await applyScope(
    supabase
      .from("leads")
      .select("id, name, category, phone, instagram, instagram_handle, instagram_url, ai_score")
      .eq("preparation_status", "ready")
      .is("pipeline_stage", null),
    regionId,
    nullRegion
  )
    .order("ai_score", { ascending: false, nullsFirst: false })
    .limit(100);
  const leads = (data ?? []) as {
    id: string;
    name: string;
    category: string;
    phone: string | null;
    instagram: string | null;
    instagram_handle: string | null;
    instagram_url: string | null;
    ai_score: number | null;
  }[];

  if (!leads.length) {
    return <EmptyState icon={<Inbox className="h-8 w-8" />} title="Nenhum lead pronto" description="Prepare leads em Selecionados para vê-los aqui, prontos para o pipeline." />;
  }

  const ids = leads.map((l) => l.id);
  const [{ data: dmsRaw }, { data: msgsRaw }, { data: analysesRaw }] = await Promise.all([
    supabase.from("decision_makers").select("lead_id, name, role").eq("found", true).in("lead_id", ids),
    supabase.from("outreach_messages").select("lead_id, content, created_at").in("lead_id", ids).order("created_at", { ascending: false }),
    supabase.from("lead_analysis").select("lead_id, main_opportunity, created_at").in("lead_id", ids).order("created_at", { ascending: false }),
  ]);
  const decisorBy = new Map<string, string>();
  for (const d of (dmsRaw ?? []) as { lead_id: string; name: string | null; role: string | null }[]) {
    if (!decisorBy.has(d.lead_id) && d.name) decisorBy.set(d.lead_id, [d.name, d.role].filter(Boolean).join(" · "));
  }
  const messageBy = new Map<string, string>();
  for (const m of (msgsRaw ?? []) as { lead_id: string; content: string }[]) {
    if (!messageBy.has(m.lead_id)) messageBy.set(m.lead_id, m.content);
  }
  const obsBy = new Map<string, string>();
  for (const a of (analysesRaw ?? []) as { lead_id: string; main_opportunity: string | null }[]) {
    if (!obsBy.has(a.lead_id) && a.main_opportunity) obsBy.set(a.lead_id, a.main_opportunity);
  }

  return (
    <div className="flex flex-col divide-y divide-border/70">
      {leads.map((lead) => {
        const handle = (lead.instagram_handle ?? lead.instagram)?.replace(/^@/, "");
        const igUrl = lead.instagram_url ?? (handle ? `https://instagram.com/${handle}` : null);
        const obs = obsBy.get(lead.id);
        return (
          <div key={lead.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <LeadDrawerLink leadId={lead.id} className="text-left font-semibold text-foreground transition-colors hover:text-accent-2">
                  {lead.name}
                </LeadDrawerLink>
                <span className="text-xs text-muted">{categoryLabel(lead.category)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {lead.phone && <span className="tabular-nums">{lead.phone}</span>}
                {handle && igUrl && (
                  <>
                    {lead.phone && " · "}
                    <a href={igUrl} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
                      @{handle}
                    </a>
                  </>
                )}
                {decisorBy.get(lead.id) && <span> · {decisorBy.get(lead.id)}</span>}
              </p>
              {obs && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{obs}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <WhatsAppButton phone={lead.phone} message={messageBy.get(lead.id) ?? ""} />
              <AddToPipelineButton leadId={lead.id} />
              <Link href={`/leads/${lead.id}`} className="text-xs text-accent-2 hover:underline">
                Abrir
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
