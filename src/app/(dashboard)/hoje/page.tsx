import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrabalharFila, type FilaDemand } from "@/components/hoje/TrabalharFila";
import { TrabalharRodada } from "@/components/hoje/TrabalharRodada";
import { DemandRow } from "@/components/hoje/DemandRow";
import { ChecklistPanel } from "@/components/hoje/ChecklistPanel";
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

  // All queries in parallel — single round-trip batch.
  const [
    { data: demandsRaw },
    { data: roundsRaw },
    { data: checkPending },
    { data: checkDone },
    { data: reimbRaw },
  ] = await Promise.all([
    // Demandas específicas (com data: reunião, cobrar proposta, chamar dia X).
    supabase
      .from("leads")
      .select(DEMAND_SELECT)
      .is("archived_at", null)
      .not("next_action_type", "is", null)
      .not("next_action_at", "is", null)
      .or("pipeline_stage.is.null,pipeline_stage.neq.closed")
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .limit(200),
    // Rodadas: leads agrupados por contact_round.
    supabase
      .from("leads")
      .select("id, contact_round")
      .is("archived_at", null)
      .not("contact_round", "is", null)
      .or("pipeline_stage.is.null,pipeline_stage.neq.closed"),
    // Checklists.
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
    // Reembolsos pendentes.
    supabase
      .from("reimbursements")
      .select("id, description, amount, amount_received, status")
      .eq("status", "pending"),
  ]);

  const demands = (demandsRaw ?? []) as unknown as Demand[];
  const rounds = (roundsRaw ?? []) as { id: string; contact_round: ContactRound }[];

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
    if (r.contact_round in roundCounts) roundCounts[r.contact_round]++;
  }
  const totalRounds = Object.values(roundCounts).reduce((a, b) => a + b, 0);

  // Fila de trabalho: atrasadas → hoje → primeira abordagem (sem data).
  const filaDemands = [...buckets.atrasadas, ...buckets.hoje];
  const latestMessageByLead = new Map<string, string>();
  if (filaDemands.length > 0) {
    const { data: messages } = await supabase
      .from("outreach_messages")
      .select("lead_id, content, created_at")
      .in("lead_id", filaDemands.map((d) => d.id))
      .order("created_at", { ascending: false })
      .limit(200);
    for (const msg of (messages ?? []) as Pick<OutreachMessageRow, "lead_id" | "content" | "created_at">[]) {
      if (!latestMessageByLead.has(msg.lead_id)) latestMessageByLead.set(msg.lead_id, msg.content);
    }
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
          <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
            {greeting()}, Lucas
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

          {/* Rodadas de contato (§22-27) */}
          {totalRounds > 0 && (
            <HomeSection title="Rodadas de contato">
              <div className="flex flex-col gap-1">
                {(Object.entries(roundCounts) as [ContactRound, number][])
                  .filter(([, count]) => count > 0)
                  .map(([round, count]) => (
                    <div
                      key={round}
                      className="flex items-center justify-between rounded-md px-2 py-2 text-sm"
                    >
                      <span className="text-foreground">{CONTACT_ROUND_LABELS[round]}</span>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-muted">
                          {count} pendente{count > 1 ? "s" : ""}
                        </span>
                        <TrabalharRodada round={round} />
                      </div>
                    </div>
                  ))}
              </div>
            </HomeSection>
          )}

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

          {/* Empty state */}
          {urgentDemands.length === 0 && futureDemands.length === 0 && totalRounds === 0 && (
            <div className="py-4">
              <p className="text-sm text-muted">Nenhuma demanda pendente.</p>
              <Link
                href="/prospeccao"
                className="mt-2 inline-block rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-2"
              >
                Prospectar novos restaurantes
              </Link>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Summary strip + Reembolsos */}
        <div className="flex flex-col gap-6">
          {/* Quick stats strip */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Atrasados" value={buckets.atrasadas.length} href="/hoje" danger={buckets.atrasadas.length > 0} />
            <StatCard label="Rodadas" value={totalRounds} href="/pipeline" />
            <StatCard label="Hoje" value={buckets.hoje.length} href="/hoje" accent={buckets.hoje.length > 0} />
            <StatCard label="Próximos" value={futureDemands.length} href="/hoje" />
          </div>

          {/* Reembolsos pendentes (§21/§61) */}
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
    <section className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  href,
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
    <Link
      href={href}
      className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:border-accent/50 hover:shadow-md"
    >
      <span
        className={`font-display text-xl font-bold tabular-nums ${
          danger ? "text-danger" : accent ? "text-accent-2" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </Link>
  );
}
