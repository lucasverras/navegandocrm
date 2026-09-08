import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrabalharFila, type FilaDemand } from "@/components/hoje/TrabalharFila";
import { DemandRow } from "@/components/hoje/DemandRow";
import { BRL } from "@/lib/finance";
import {
  DEMAND_SELECT,
  actionLine,
  bucketOf,
  spTodayStart,
  spTodayStartInstant,
  type Demand,
  type DemandBucket,
} from "@/components/hoje/demand";
import type { OutreachMessageRow } from "@/types/database";

type Filter = "todas" | "atrasadas" | "hoje" | "amanha" | "semana" | "sem-data" | "concluidas";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "hoje", label: "Hoje" },
  { key: "amanha", label: "Amanhã" },
  { key: "semana", label: "Próximos 7 dias" },
  { key: "sem-data", label: "Sem data" },
  { key: "concluidas", label: "Concluídas" },
];

const DONE_LABELS: Record<string, string> = {
  cadence_followup: "Sem resposta — próximo follow-up agendado",
  follow_up_set: "Follow-up agendado",
  meeting_scheduled: "Reunião marcada",
  proposal_sent: "Proposta enviada",
  closed_won: "Negócio fechado",
  message_sent: "Mensagem enviada",
  response_respondeu: "Respondeu",
  response_interessado: "Interessado",
  response_apresentacao: "Mandar apresentação",
  response_agencia: "Já tem agência",
  response_depois: "Falar depois",
  response_reuniao: "Pediu reunião",
  response_contato_errado: "Contato errado",
  response_nao_interessado: "Não interessado",
};

const DONE_TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

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

export default async function HojePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f: fRaw } = await searchParams;
  const filter = (FILTERS.some((c) => c.key === fRaw) ? fRaw : null) as Filter | null;

  const supabase = await createClient();
  const now = new Date();
  const todayStart = spTodayStart(now);

  // Main data + summary counts in parallel — one round-trip batch.
  const [{ data: demandsRaw }, { count: pipelineCount }, { count: prospectCount }, { data: reimbRaw }] =
    await Promise.all([
      supabase
        .from("leads")
        .select(DEMAND_SELECT)
        .is("archived_at", null)
        .not("next_action_type", "is", null)
        .or("pipeline_stage.is.null,pipeline_stage.neq.closed")
        .order("next_action_at", { ascending: true, nullsFirst: false })
        .limit(300),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .not("pipeline_stage", "is", null)
        .neq("pipeline_stage", "closed"),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("triage_status", "pending_review"),
      supabase
        .from("reimbursements")
        .select("amount, amount_received, status")
        .eq("status", "pending"),
    ]);

  const demands = (demandsRaw ?? []) as unknown as Demand[];
  const reimbPending = ((reimbRaw ?? []) as { amount: number; amount_received: number; status: string }[]).reduce(
    (s, r) => s + (r.amount - (r.amount_received ?? 0)),
    0
  );

  const buckets: Record<DemandBucket, Demand[]> = {
    atrasadas: [],
    hoje: [],
    amanha: [],
    semana: [],
    depois: [],
    "sem-data": [],
  };
  for (const d of demands) buckets[bucketOf(d, todayStart)].push(d);

  const filaDemands = [...buckets.atrasadas, ...buckets.hoje, ...buckets["sem-data"]];

  const latestMessageByLead = new Map<string, string>();
  if (filaDemands.length > 0) {
    const { data: messages } = await supabase
      .from("outreach_messages")
      .select("lead_id, content, created_at")
      .in("lead_id", filaDemands.map((d) => d.id))
      .order("created_at", { ascending: false })
      .limit(300);
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

  let done: { id: string; name: string; label: string; at: string }[] = [];
  if (filter === "concluidas") {
    const { data: events } = await supabase
      .from("outreach_events")
      .select("id, event_type, created_at, leads(name)")
      .gte("created_at", spTodayStartInstant(now).toISOString())
      .in("event_type", Object.keys(DONE_LABELS))
      .order("created_at", { ascending: false })
      .limit(100);
    done = ((events ?? []) as unknown as { id: string; event_type: string; created_at: string; leads: { name: string } | null }[]).map(
      (e) => ({
        id: e.id,
        name: e.leads?.name ?? "—",
        label: DONE_LABELS[e.event_type] ?? e.event_type,
        at: e.created_at,
      })
    );
  }

  const counts: Record<Filter, number> = {
    todas: demands.length,
    atrasadas: buckets.atrasadas.length,
    hoje: buckets.hoje.length,
    amanha: buckets.amanha.length,
    semana: buckets.semana.length,
    "sem-data": buckets["sem-data"].length,
    concluidas: done.length,
  };

  const urgentCount = buckets.atrasadas.length + buckets.hoje.length;

  // Card data
  const cards: { label: string; value: string; href: string; accent?: boolean; danger?: boolean }[] = [
    {
      label: "A resolver hoje",
      value: String(urgentCount),
      href: "/hoje?f=hoje",
      danger: buckets.atrasadas.length > 0,
      accent: urgentCount > 0 && buckets.atrasadas.length === 0,
    },
    {
      label: "Leads no pipeline",
      value: String(pipelineCount ?? 0),
      href: "/pipeline",
    },
    {
      label: "Primeira abordagem",
      value: String(buckets["sem-data"].length),
      href: "/hoje?f=sem-data",
      accent: buckets["sem-data"].length > 0,
    },
    {
      label: "A prospectar",
      value: String(prospectCount ?? 0),
      href: "/prospeccao",
    },
  ];

  // Only show reimbursement card if there's something pending
  if (reimbPending > 0) {
    cards.push({
      label: "Reembolsos pendentes",
      value: BRL.format(reimbPending),
      href: "/resultados?tab=reembolsos",
      accent: true,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting + date */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
            {greeting()}, Lucas
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted">{DATE_FMT.format(now)}</p>
        </div>
        <TrabalharFila demands={fila} />
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:border-accent/50 hover:shadow-md"
          >
            <span
              className={`font-display text-2xl font-bold tabular-nums ${
                c.danger ? "text-danger" : c.accent ? "text-accent-2" : "text-foreground"
              }`}
            >
              {c.value}
            </span>
            <span className="text-xs text-muted group-hover:text-foreground">{c.label}</span>
          </Link>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((c) => {
          const active = filter === c.key;
          const count = c.key === "concluidas" && filter !== "concluidas" ? null : counts[c.key];
          return (
            <Link
              key={c.key}
              href={active ? "/hoje" : `/hoje?f=${c.key}`}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "border-accent bg-accent-soft font-medium text-accent-2"
                  : "border-border text-muted hover:border-accent/50 hover:text-foreground"
              }`}
            >
              {c.label}
              {count != null && count > 0 && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {filter === "concluidas" ? (
        <Section title="Concluídas hoje" count={done.length}>
          {done.length === 0 ? (
            <p className="py-2 text-sm text-muted">Nada registrado hoje ainda.</p>
          ) : (
            <ul className="flex flex-col">
              {done.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 border-b border-border/70 py-2 last:border-b-0">
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-medium text-foreground">{e.name}</span>
                    <span className="text-muted"> — {e.label}</span>
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{DONE_TIME.format(new Date(e.at))}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : filter ? (
        <FilteredList filter={filter} buckets={buckets} todayStart={todayStart} messages={latestMessageByLead} />
      ) : (
        <PostIt buckets={buckets} todayStart={todayStart} messages={latestMessageByLead} />
      )}
    </div>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone?: "danger"; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border pb-1.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{title}</h2>
        <span className={`text-xs font-semibold tabular-nums ${tone === "danger" && count > 0 ? "text-danger" : "text-muted"}`}>{count}</span>
      </div>
      {children}
    </section>
  );
}

function DemandList({ items, todayStart, messages }: { items: Demand[]; todayStart: Date; messages: Map<string, string> }) {
  return (
    <ul className="flex flex-col">
      {items.map((d) => (
        <DemandRow key={d.id} demand={d} todayStart={todayStart} message={messages.get(d.id)} />
      ))}
    </ul>
  );
}

function PostIt({
  buckets,
  todayStart,
  messages,
}: {
  buckets: Record<DemandBucket, Demand[]>;
  todayStart: Date;
  messages: Map<string, string>;
}) {
  const proximos = [...buckets.amanha, ...buckets.semana];
  const nothing = buckets.atrasadas.length === 0 && buckets.hoje.length === 0 && proximos.length === 0 && buckets["sem-data"].length === 0;

  if (nothing) {
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <p className="text-sm text-muted">Nada pendente. Post-it limpo.</p>
        <Link
          href="/prospeccao"
          className="rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-2"
        >
          Prospectar novos restaurantes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {buckets.atrasadas.length > 0 && (
        <Section title="Atrasados" count={buckets.atrasadas.length} tone="danger">
          <DemandList items={buckets.atrasadas} todayStart={todayStart} messages={messages} />
        </Section>
      )}
      {buckets.hoje.length > 0 && (
        <Section title="Hoje" count={buckets.hoje.length}>
          <DemandList items={buckets.hoje} todayStart={todayStart} messages={messages} />
        </Section>
      )}
      {buckets["sem-data"].length > 0 && (
        <Section title="Primeira abordagem" count={buckets["sem-data"].length}>
          <DemandList items={buckets["sem-data"]} todayStart={todayStart} messages={messages} />
        </Section>
      )}
      {proximos.length > 0 && (
        <Section title="Próximos" count={proximos.length}>
          <DemandList items={proximos} todayStart={todayStart} messages={messages} />
        </Section>
      )}
    </div>
  );
}

function FilteredList({
  filter,
  buckets,
  todayStart,
  messages,
}: {
  filter: Exclude<Filter, "concluidas">;
  buckets: Record<DemandBucket, Demand[]>;
  todayStart: Date;
  messages: Map<string, string>;
}) {
  const groups: { title: string; items: Demand[]; tone?: "danger" }[] =
    filter === "todas"
      ? [
          { title: "Atrasadas", items: buckets.atrasadas, tone: "danger" as const },
          { title: "Hoje", items: buckets.hoje },
          { title: "Primeira abordagem", items: buckets["sem-data"] },
          { title: "Amanhã", items: buckets.amanha },
          { title: "Próximos 7 dias", items: buckets.semana },
          { title: "Depois", items: buckets.depois },
        ].filter((g) => g.items.length > 0)
      : [
          {
            title: FILTERS.find((c) => c.key === filter)!.label,
            items: buckets[filter as DemandBucket] ?? [],
            tone: filter === "atrasadas" ? ("danger" as const) : undefined,
          },
        ];

  if (groups.every((g) => g.items.length === 0)) {
    return <p className="py-4 text-sm text-muted">Nenhuma demanda aqui.</p>;
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {groups.map((g) => (
        <Section key={g.title} title={g.title} count={g.items.length} tone={g.tone}>
          <DemandList items={g.items} todayStart={todayStart} messages={messages} />
        </Section>
      ))}
    </div>
  );
}
