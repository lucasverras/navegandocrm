import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrabalharFila, type FilaDemand } from "@/components/hoje/TrabalharFila";
import { TrabalharRodada } from "@/components/hoje/TrabalharRodada";
import { DemandRow } from "@/components/hoje/DemandRow";
import { ChecklistPanel } from "@/components/hoje/ChecklistPanel";
import { LeadDrawerLink } from "@/components/leads/LeadDrawer";
import { BRL } from "@/lib/finance";
import {
  DEMAND_SELECT,
  actionLine,
  bucketOf,
  spTodayStart,
  type Demand,
  type DemandBucket,
} from "@/components/hoje/demand";
import { CONTACT_ROUND_LABELS, type ContactRound } from "@/types/domain";
import { formatHumanDate } from "@/lib/utils";
import type { OutreachMessageRow } from "@/types/database";

// V7 §16-17: Hoje = CHECKLISTS + RODADAS + DEMANDAS. Não é post-it, não é dashboard de KPI.

function greeting(): string {
  const h = new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
  const hour = parseInt(h, 10);
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

export default async function HojePage() {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = spTodayStart(now);

  // ALL queries in parallel — zero sequential waterfalls. The messages query runs for all
  // leads with next_action (broader than the fila subset) so it can join the first batch.
  const [
    { data: demandsRaw },
    { data: roundsRaw },
    { data: checkPending },
    { data: checkDone },
    { data: reimbRaw },
    { data: messagesRaw },
    { data: orphansRaw },
    { data: meetingsRaw },
    { data: proposalsRaw },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(DEMAND_SELECT)
      .is("archived_at", null)
      .not("next_action_type", "is", null)
      .not("next_action_at", "is", null)
      .or("pipeline_stage.is.null,pipeline_stage.neq.closed")
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .limit(200),
    supabase
      .from("leads")
      .select("id, contact_round, next_action_at")
      .is("archived_at", null)
      .not("contact_round", "is", null)
      .or("pipeline_stage.is.null,pipeline_stage.neq.closed")
      .limit(200),
    supabase
      .from("checklists")
      .select("id, text, lead_id, amount, due_at, type, completed_at, created_at, leads(name)")
      .is("completed_at", null)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("checklists")
      .select("id, text, lead_id, amount, type, completed_at, leads(name)")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase
      .from("reimbursements")
      .select("id, description, amount, amount_received, status")
      .eq("status", "pendente")
      .limit(50),
    supabase
      .from("outreach_messages")
      .select("lead_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("leads")
      .select("id, name, pipeline_stage")
      .is("archived_at", null)
      .is("next_action_type", null)
      .not("pipeline_stage", "is", null)
      .neq("pipeline_stage", "closed")
      .limit(50),
    supabase
      .from("leads")
      .select("id, name, meeting_at, meeting_link")
      .is("archived_at", null)
      .not("meeting_at", "is", null)
      .gte("meeting_at", now.toISOString())
      .neq("pipeline_stage", "closed")
      .order("meeting_at", { ascending: true })
      .limit(10),
    supabase
      .from("leads")
      .select("id, name, proposal_value, proposal_sent_at")
      .is("archived_at", null)
      .not("proposal_sent_at", "is", null)
      .neq("pipeline_stage", "closed")
      .order("proposal_sent_at", { ascending: false })
      .limit(10),
  ]);

  const demands = (demandsRaw ?? []) as unknown as Demand[];
  const rounds = (roundsRaw ?? []) as { id: string; contact_round: ContactRound; next_action_at: string | null }[];
  const orphanLeads = (orphansRaw ?? []) as { id: string; name: string; pipeline_stage: string }[];
  const meetings = (meetingsRaw ?? []) as { id: string; name: string; meeting_at: string; meeting_link: string | null }[];
  const proposals = (proposalsRaw ?? []) as { id: string; name: string; proposal_value: number | null; proposal_sent_at: string }[];

  // Bucketize dated demands.
  const buckets: Record<DemandBucket, Demand[]> = {
    atrasadas: [], hoje: [], amanha: [], semana: [], depois: [], "sem-data": [],
  };
  for (const d of demands) buckets[bucketOf(d, todayStart)].push(d);

  // Rounds summary.
  const roundCounts: Record<ContactRound, number> = {
    FIRST_CONTACT: 0, FOLLOW_UP_1: 0, FOLLOW_UP_2: 0, FOLLOW_UP_3: 0,
  };
  for (const r of rounds) {
    const due = r.contact_round === "FIRST_CONTACT" || (!!r.next_action_at && new Date(r.next_action_at) <= now);
    if (due && r.contact_round in roundCounts) roundCounts[r.contact_round]++;
  }
  const totalRounds = Object.values(roundCounts).reduce((a, b) => a + b, 0);

  // Build message map from the pre-fetched messages (already sorted by created_at desc).
  const filaDemands = [...buckets.atrasadas, ...buckets.hoje];
  const latestMessageByLead = new Map<string, string>();
  for (const msg of (messagesRaw ?? []) as Pick<OutreachMessageRow, "lead_id" | "content" | "created_at">[]) {
    if (!latestMessageByLead.has(msg.lead_id)) latestMessageByLead.set(msg.lead_id, msg.content);
  }

  const fila: FilaDemand[] = filaDemands.map((d) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    instagram: d.instagram,
    instagram_handle: d.instagram_handle,
    instagram_url: d.instagram_url,
    website: d.website,
    maps_url: d.maps_url,
    reason: actionLine(d, todayStart).text,
    region: d.region?.neighborhood ?? null,
    decisor: null,
    message: latestMessageByLead.get(d.id) ?? null,
  }));

  // Reembolsos pendentes.
  const reimbs = (reimbRaw ?? []) as { id: string; description: string; amount: number; amount_received: number; status: string }[];
  const reimbTotal = reimbs.reduce((s, r) => s + (r.amount - (r.amount_received ?? 0)), 0);

  // Demandas urgentes (atrasadas + hoje).
  const urgentDemands = [...buckets.atrasadas, ...buckets.hoje];
  const futureDemands = [...buckets.amanha, ...buckets.semana];

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground">
            {greeting()}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted">{DATE_FMT.format(now)}</p>
        </div>
        {fila.length > 0 && <TrabalharFila demands={fila} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* LEFT COLUMN — Checklists + Rounds + Demandas */}
        <div className="flex flex-col gap-6">
          {/* Checklists (§18-21) */}
          <HomeSection title="Checklists">
            <ChecklistPanel
              initialPending={(checkPending ?? []) as unknown as Parameters<typeof ChecklistPanel>[0]["initialPending"]}
              initialDone={(checkDone ?? []) as unknown as Parameters<typeof ChecklistPanel>[0]["initialDone"]}
            />
          </HomeSection>

          {/* Rodadas de contato (§22-27) — always visible, compact when empty */}
          <HomeSection title="Rodadas de contato">
            <div className="flex flex-col">
              {(Object.entries(roundCounts) as [ContactRound, number][]).map(([round, count]) => (
                <div
                  key={round}
                  className="flex items-center justify-between border-b border-border-subtle py-2 last:border-b-0"
                >
                  <span className={count > 0 ? "text-sm text-foreground" : "text-sm text-muted"}>
                    {CONTACT_ROUND_LABELS[round]}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`tabular-nums text-sm ${count > 0 ? "font-medium text-foreground" : "text-muted"}`}>
                      {count}
                    </span>
                    {count > 0 && <TrabalharRodada round={round} />}
                  </div>
                </div>
              ))}
            </div>
            {totalRounds === 0 && (
              <p className="mt-2 text-xs text-muted">Nenhum lead aguardando contato.</p>
            )}
          </HomeSection>

          {/* Demandas específicas — leads com compromisso de data */}
          {urgentDemands.length > 0 && (
            <HomeSection title={buckets.atrasadas.length > 0 ? "Demandas urgentes" : "Demandas de hoje"}>
              <ul className="flex flex-col">
                {urgentDemands.map((d) => (
                  <DemandRow key={d.id} demand={d} todayStart={todayStart} message={latestMessageByLead.get(d.id)} />
                ))}
              </ul>
            </HomeSection>
          )}

          {futureDemands.length > 0 && (
            <HomeSection title="Próximos dias">
              <ul className="flex flex-col">
                {futureDemands.map((d) => (
                  <DemandRow key={d.id} demand={d} todayStart={todayStart} message={latestMessageByLead.get(d.id)} />
                ))}
              </ul>
            </HomeSection>
          )}

          {/* Orphan leads — pipeline leads without a next action (§36) */}
          {orphanLeads.length > 0 && (
            <HomeSection title="Sem próximo passo">
              <ul className="flex flex-col">
                {orphanLeads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between border-b border-border-subtle py-2 last:border-b-0">
                    <LeadDrawerLink leadId={lead.id}>{lead.name}</LeadDrawerLink>
                    <span className="text-xs text-danger font-medium">Definir ação</span>
                  </li>
                ))}
              </ul>
            </HomeSection>
          )}

          {/* Empty state — only when no demands at all */}
          {urgentDemands.length === 0 && futureDemands.length === 0 && orphanLeads.length === 0 && (
            <div className="rounded-lg border border-border-subtle bg-surface p-4">
              <p className="text-sm text-muted">Nenhuma demanda com data definida.</p>
              <Link
                href="/prospeccao"
                className="mt-2 inline-block text-sm font-medium text-accent-2 hover:text-accent"
              >
                Prospectar novos restaurantes →
              </Link>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Summary + Reembolsos */}
        <div className="flex flex-col gap-4">
          {/* Operation summary */}
          <HomeSection title="Resumo da operação">
            <div className="flex flex-col gap-1.5">
              <StatCard label="Atrasados" value={buckets.atrasadas.length} href="/hoje" danger={buckets.atrasadas.length > 0} />
              <StatCard label="Hoje" value={buckets.hoje.length} href="/hoje" accent={buckets.hoje.length > 0} />
              <StatCard label="Rodadas pendentes" value={totalRounds} href="/pipeline" />
              <StatCard label="Próximos dias" value={futureDemands.length} href="/hoje" />
            </div>
          </HomeSection>

          {/* Próximas reuniões */}
          {meetings.length > 0 && (
            <HomeSection title="Próximas reuniões">
              <ul className="flex flex-col">
                {meetings.map((m) => (
                  <li key={m.id} className="flex items-center justify-between border-b border-border-subtle py-2 last:border-b-0">
                    <LeadDrawerLink leadId={m.id}>{m.name}</LeadDrawerLink>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted">{formatHumanDate(m.meeting_at)}</span>
                      {m.meeting_link && (
                        <a href={m.meeting_link} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent-2 hover:underline">
                          Meet
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </HomeSection>
          )}

          {/* Propostas aguardando */}
          {proposals.length > 0 && (
            <HomeSection title="Propostas aguardando">
              <ul className="flex flex-col">
                {proposals.map((p) => (
                  <li key={p.id} className="flex items-center justify-between border-b border-border-subtle py-2 last:border-b-0">
                    <LeadDrawerLink leadId={p.id}>{p.name}</LeadDrawerLink>
                    <span className="text-xs font-medium tabular-nums text-foreground">
                      {p.proposal_value ? `${BRL.format(p.proposal_value)}/mês` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </HomeSection>
          )}

          {/* Reembolsos pendentes */}
          {reimbs.length > 0 && (
            <HomeSection title="Reembolsos pendentes">
              <ul className="flex flex-col">
                {reimbs.map((r) => {
                  const pending = r.amount - (r.amount_received ?? 0);
                  return (
                    <li key={r.id} className="flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
                      <span className="truncate text-sm text-foreground">{r.description}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-accent-2">{BRL.format(pending)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted">Total</span>
                <Link href="/resultados?tab=reembolsos" className="font-semibold tabular-nums text-accent-2 hover:underline">
                  {BRL.format(reimbTotal)}
                </Link>
              </div>
            </HomeSection>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  danger,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          danger ? "text-danger" : accent ? "text-accent-2" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
