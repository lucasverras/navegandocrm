// Formerly a recharts bar chart ("Distribuição por categoria"). Recharts was the bulk of the
// dashboard's First Load JS, so this file now hosts a lightweight, chart-free recent-activity
// list — no recharts, no client bundle.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatHumanDate, formatDate } from "@/lib/utils";

export type ActivityEvent = { id: string; event_type: string; created_at: string };

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

export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividades recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {!events.length ? (
          <p className="text-sm text-muted">Nenhuma atividade registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
              >
                <span className="text-foreground">{eventLabel(event.event_type)}</span>
                <span className="shrink-0 text-xs text-muted" title={formatDate(event.created_at)}>
                  {formatHumanDate(event.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
