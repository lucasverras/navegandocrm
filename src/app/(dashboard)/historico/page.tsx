import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import { History } from "lucide-react";

type EventRow = {
  id: string;
  created_at: string;
  event_type: string;
  lead_id: string | null;
  metadata: Record<string, unknown> | null;
  leads?: { name?: string } | null;
};

const STAGE = PIPELINE_STAGE_LABELS as Record<string, string>;
const RESPONSE_LABEL: Record<string, string> = {
  respondeu: "respondeu", interessado: "demonstrou interesse", apresentacao: "pediu apresentação",
  agencia: "já tem agência", depois: "chamar depois", reuniao: "topou reunião",
  contato_errado: "contato errado", nao_interessado: "não teve interesse",
};

// Turns a raw event_type + metadata into one human sentence.
function humanize(e: EventRow): string {
  const m = e.metadata ?? {};
  const t = e.event_type;
  if (t === "triage_decision") {
    const d = String((m as { decision?: string }).decision ?? "");
    return d === "approved" ? "Selecionado na triagem" : d === "rejected" ? "Descartado na triagem" : d === "review_later" ? "Adiado na triagem" : "Triagem";
  }
  if (t === "stage_changed") {
    const from = STAGE[String((m as { from?: string }).from ?? "")] ?? null;
    const to = STAGE[String((m as { to?: string }).to ?? "")] ?? null;
    return to ? `Movido para “${to}”${from ? ` (de ${from})` : ""}` : "Movido no pipeline";
  }
  if (t === "lost") return `Marcado como perdido — ${String((m as { reason?: string }).reason ?? "sem motivo")}`;
  if (t.startsWith("response_")) return `Resposta registrada: ${RESPONSE_LABEL[t.replace("response_", "")] ?? t.replace("response_", "")}`;
  if (t.startsWith("status_")) return `Status: ${t.replace("status_", "").replace(/_/g, " ")}`;
  const STATIC: Record<string, string> = {
    lead_discovered: "Lead encontrado",
    instagram_found: "Instagram encontrado",
    haiku_analysis: "Análise de IA gerada",
    message_generated: "Mensagem gerada",
    message_sent: "Mensagem enviada",
    contacted: "Primeira abordagem",
    closed_won: "Negócio fechado 🎉",
    reactivated: "Reativado",
    lead_created_manual: "Lead criado manualmente",
    client_added_manual: "Cliente adicionado aos resultados",
    preparation_status_changed: "Preparação atualizada",
    decision_maker_search: "Pesquisa de decisor",
    assigned: "Responsável atribuído",
    follow_up_set: "Follow-up definido",
    meeting_scheduled: "Reunião marcada",
  };
  return STATIC[t] ?? t.replace(/_/g, " ");
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yst = new Date(today);
  yst.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoje";
  if (same(d, yst)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function HistoricoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outreach_events")
    .select("id, created_at, event_type, lead_id, metadata, leads(name)")
    .order("created_at", { ascending: false })
    .limit(300);
  const events = (data ?? []) as unknown as EventRow[];

  // Group by day, and collapse consecutive identical system events for the same lead within a day.
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = e.created_at.slice(0, 10);
    const arr = byDay.get(key) ?? [];
    const prev = arr[arr.length - 1];
    if (prev && prev.event_type === e.event_type && prev.lead_id === e.lead_id) continue; // dedupe repeats
    arr.push(e);
    byDay.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Registro" title="Histórico" subtitle="A jornada de cada lead, em linguagem humana." />

      {!events.length ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="Nenhum evento registrado" />
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{dayLabel(list[0].created_at)}</h2>
              <ol className="flex flex-col border-l border-border pl-4">
                {list.map((e) => (
                  <li key={e.id} className="relative py-1.5 text-sm">
                    <span className="absolute -left-[21px] top-2.5 h-2 w-2 rounded-full bg-accent/60 ring-4 ring-background" />
                    <span className="tabular-nums text-xs text-muted">
                      {new Date(e.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>{" "}
                    {e.lead_id ? (
                      <Link href={`/leads/${e.lead_id}`} className="font-medium text-foreground hover:text-accent-2">
                        {e.leads?.name ?? "Lead"}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">Sistema</span>
                    )}
                    <span className="text-muted"> · {humanize(e)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
