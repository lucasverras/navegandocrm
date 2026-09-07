// Formerly a recharts bar chart ("Distribuição por categoria"). Recharts was the bulk of the
// dashboard's First Load JS, so this file now hosts a lightweight, chart-free recent-activity
// list — no recharts, no client bundle.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

// Friendly PT labels for outreach_events.event_type. Mirrors the lead Timeline map, plus
// graceful fallbacks for the dynamic `status_*` / `meeting_*` event types.
const EVENT_LABELS: Record<string, string> = {
  lead_discovered: "Lead descoberto",
  haiku_analysis: "Análise realizada",
  batch_analysis_queued: "Análise em lote enfileirada",
  message_generated: "Mensagem gerada",
  message_sent: "Mensagem enviada",
  stage_changed: "Mudança de etapa",
  follow_up_set: "Follow-up definido",
  assigned: "Responsável atribuído",
  contact_registered: "Contato registrado",
  triage_decision: "Decisão de triagem",
  preparation_status_changed: "Preparação atualizada",
  decision_maker_search: "Pesquisa de decisor",
  meeting_scheduled: "Reunião marcada",
  closed_won: "Negócio fechado",
  lead_discarded: "Lead descartado",
  archived: "Lead arquivado",
};

function eventLabel(type: string): string {
  if (EVENT_LABELS[type]) return EVENT_LABELS[type];
  if (type.startsWith("status_")) return `Status: ${type.replace("status_", "").replace(/_/g, " ")}`;
  if (type.startsWith("meeting_")) return `Reunião: ${type.replace("meeting_", "").replace(/_/g, " ")}`;
  return type.replace(/_/g, " ");
}

// Compacts today's events into "N <atividade>" lines instead of listing 12 identical rows.
// `triage_decision` is split by its metadata.decision into revisados/selecionados/descartados.
export function summarizeToday(
  events: { event_type: string; metadata?: Record<string, unknown> | null }[]
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  const bump = (label: string, n = 1) => counts.set(label, (counts.get(label) ?? 0) + n);

  for (const e of events) {
    if (e.event_type === "triage_decision") {
      bump("leads revisados");
      const d = (e.metadata as { decision?: string } | null)?.decision;
      if (d === "approved") bump("selecionados");
      else if (d === "rejected") bump("descartados");
      else if (d === "review_later") bump("adiados");
    } else {
      bump(eventLabel(e.event_type).toLowerCase());
    }
  }
  // Stable, readable order: reviewed first, then the rest by count desc.
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => (a.label === "leads revisados" ? -1 : b.label === "leads revisados" ? 1 : b.count - a.count));
}

export function RecentActivity({ summary }: { summary: { label: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoje em números</CardTitle>
      </CardHeader>
      <CardContent>
        {!summary.length ? (
          <p className="text-sm text-muted">Nenhuma atividade hoje.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
            {summary.map((s) => (
              <li key={s.label} className="text-muted">
                <span className="font-semibold text-foreground">{s.count}</span> {s.label}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
