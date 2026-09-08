import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { TrabalharFila, type FilaDemand } from "@/components/hoje/TrabalharFila";
import { DemandRow } from "@/components/hoje/DemandRow";
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

// Hoje = o post-it. Uma pergunta só: "o que eu preciso fazer?" — respondida por next_action
// em cada lead ativo (fundação 0015). Nada de score, nada de análise, nada de métrica aqui.

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

// O que conta como demanda resolvida hoje (aba Concluídas).
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

const HEADER_DATE = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
const DONE_TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function HojePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f: fRaw } = await searchParams;
  const filter = (FILTERS.some((c) => c.key === fRaw) ? fRaw : null) as Filter | null;

  const supabase = await createClient();
  const now = new Date();
  const todayStart = spTodayStart(now);

  const { data: demandsRaw } = await supabase
    .from("leads")
    .select(DEMAND_SELECT)
    .is("archived_at", null)
    .not("next_action_type", "is", null)
    .or("pipeline_stage.is.null,pipeline_stage.neq.closed")
    .order("next_action_at", { ascending: true, nullsFirst: false })
    .limit(300);
  const demands = (demandsRaw ?? []) as unknown as Demand[];

  const buckets: Record<DemandBucket, Demand[]> = {
    atrasadas: [],
    hoje: [],
    amanha: [],
    semana: [],
    depois: [],
    "sem-data": [],
  };
  for (const d of demands) buckets[bucketOf(d, todayStart)].push(d);

  // Fila de trabalho: atrasadas → hoje → sem data (primeira abordagem). Amanhã em diante não
  // é trabalho de hoje.
  const filaDemands = [...buckets.atrasadas, ...buckets.hoje, ...buckets["sem-data"]];

  // Última mensagem preparada por lead da fila — WhatsApp abre preenchido.
  const latestMessageByLead = new Map<string, string>();
  if (filaDemands.length > 0) {
    const { data: messages } = await supabase
      .from("outreach_messages")
      .select("lead_id, content, created_at")
      .in("lead_id", filaDemands.map((d) => d.id))
      .order("created_at", { ascending: false });
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

  // Concluídas de hoje — só quando a aba é aberta.
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

  const coisas = buckets.atrasadas.length + buckets.hoje.length;
  const subtitle = `${HEADER_DATE.format(now)} · ${
    coisas === 0 ? "nada pendente para hoje" : `${coisas} ${coisas === 1 ? "coisa" : "coisas"} para resolver`
  }`;

  const counts: Record<Filter, number> = {
    todas: demands.length,
    atrasadas: buckets.atrasadas.length,
    hoje: buckets.hoje.length,
    amanha: buckets.amanha.length,
    semana: buckets.semana.length,
    "sem-data": buckets["sem-data"].length,
    concluidas: done.length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading title="Hoje" subtitle={subtitle} />
        <TrabalharFila demands={fila} />
      </div>

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

// FOCO (default): o post-it — Atrasados, Hoje, Próximos. Só.
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
  const nothing = buckets.atrasadas.length === 0 && buckets.hoje.length === 0 && proximos.length === 0;

  if (nothing) {
    return (
      <div className="flex flex-col items-start gap-3 py-8">
        <p className="text-sm text-muted">Nada por hoje. Post-it limpo.</p>
        <div className="flex gap-2">
          <Link
            href="/prospeccao"
            className="rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-2"
          >
            Prospectar novos restaurantes
          </Link>
          {buckets["sem-data"].length > 0 && (
            <Link
              href="/hoje?f=sem-data"
              className="rounded-md border border-border px-3.5 py-2 text-sm text-foreground transition-colors hover:border-accent"
            >
              {buckets["sem-data"].length} primeira{buckets["sem-data"].length === 1 ? "" : "s"} abordagem{buckets["sem-data"].length === 1 ? "" : "ns"} sem data
            </Link>
          )}
        </div>
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
      {proximos.length > 0 && (
        <Section title="Próximos" count={proximos.length}>
          <DemandList items={proximos} todayStart={todayStart} messages={messages} />
        </Section>
      )}
      {buckets["sem-data"].length > 0 && (
        <Link href="/hoje?f=sem-data" className="text-xs text-muted transition-colors hover:text-foreground">
          + {buckets["sem-data"].length} sem data (primeira abordagem) →
        </Link>
      )}
    </div>
  );
}

// CONTROLE: lista completa filtrada por chip.
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
          { title: "Amanhã", items: buckets.amanha },
          { title: "Próximos 7 dias", items: buckets.semana },
          { title: "Depois", items: buckets.depois },
          { title: "Sem data", items: buckets["sem-data"] },
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
