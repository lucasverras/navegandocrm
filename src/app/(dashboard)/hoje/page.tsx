import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrabalharFila, type FilaDemand } from "@/components/hoje/TrabalharFila";
import { DemandRow } from "@/components/hoje/DemandRow";
import { ChecklistPanel } from "@/components/hoje/ChecklistPanel";
import { LeadDrawerLink } from "@/components/leads/LeadDrawer";
import { HomeReimbs } from "@/components/hoje/HomeReimbs";
import { BRL } from "@/lib/finance";
import {
  DEMAND_SELECT,
  actionLine,
  bucketOf,
  spTodayStart,
  type Demand,
  type DemandBucket,
} from "@/components/hoje/demand";
import { formatHumanDate } from "@/lib/utils";
import type { OutreachMessageRow } from "@/types/database";

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

  const [
    { data: demandsRaw },
    { data: checkPending },
    { data: checkDone },
    { data: reimbRaw },
    { data: messagesRaw },
    { data: meetingsRaw },
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
      .select("id, name, meeting_at, meeting_link")
      .is("archived_at", null)
      .not("meeting_at", "is", null)
      .gte("meeting_at", now.toISOString())
      .neq("pipeline_stage", "closed")
      .order("meeting_at", { ascending: true })
      .limit(10),
  ]);

  const demands = (demandsRaw ?? []) as unknown as Demand[];
  const meetings = (meetingsRaw ?? []) as { id: string; name: string; meeting_at: string; meeting_link: string | null }[];

  const buckets: Record<DemandBucket, Demand[]> = {
    atrasadas: [], hoje: [], amanha: [], semana: [], depois: [], "sem-data": [],
  };
  for (const d of demands) buckets[bucketOf(d, todayStart)].push(d);

  const latestMessageByLead = new Map<string, string>();
  for (const msg of (messagesRaw ?? []) as Pick<OutreachMessageRow, "lead_id" | "content" | "created_at">[]) {
    if (!latestMessageByLead.has(msg.lead_id)) latestMessageByLead.set(msg.lead_id, msg.content);
  }

  const filaDemands = [...buckets.atrasadas, ...buckets.hoje];
  const fila: FilaDemand[] = filaDemands.map((d) => ({
    id: d.id, name: d.name, phone: d.phone, instagram: d.instagram,
    instagram_handle: d.instagram_handle, instagram_url: d.instagram_url,
    website: d.website, maps_url: d.maps_url,
    reason: actionLine(d, todayStart).text, region: d.region?.neighborhood ?? null,
    decisor: null, message: latestMessageByLead.get(d.id) ?? null,
  }));

  const reimbs = (reimbRaw ?? []) as { id: string; description: string; amount: number; amount_received: number; status: string }[];
  const urgentDemands = [...buckets.atrasadas, ...buckets.hoje];
  const futureDemands = [...buckets.amanha, ...buckets.semana];

  return (
    <div className="flex flex-col gap-6 animate-rise">
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

      {/* Checklists */}
      <HomeSection title="Checklists">
        <ChecklistPanel
          initialPending={(checkPending ?? []) as unknown as Parameters<typeof ChecklistPanel>[0]["initialPending"]}
          initialDone={(checkDone ?? []) as unknown as Parameters<typeof ChecklistPanel>[0]["initialDone"]}
        />
      </HomeSection>

      {/* Demandas urgentes */}
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

      {/* Reembolsos */}
      <HomeSection title="Reembolsos pendentes">
        <HomeReimbs initialReimbs={reimbs} />
      </HomeSection>

      {/* Empty state */}
      {urgentDemands.length === 0 && futureDemands.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface p-4">
          <p className="text-sm text-muted">Nenhuma demanda com data definida.</p>
          <Link href="/prospeccao" className="mt-2 inline-block text-sm font-medium text-accent-2 hover:text-accent">
            Prospectar novos restaurantes →
          </Link>
        </div>
      )}
    </div>
  );
}

function HomeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="lift rounded-lg border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{title}</h2>
      {children}
    </section>
  );
}
