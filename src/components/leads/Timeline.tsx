import { formatHumanDate, formatDate } from "@/lib/utils";
import type { OutreachEventRow } from "@/types/database";

const EVENT_LABELS: Record<string, string> = {
  lead_discovered: "Lead descoberto",
  haiku_analysis: "Análise realizada",
  message_generated: "Mensagem gerada",
  message_sent: "Mensagem enviada",
  status_message_sent: "Marcado como enviada",
  status_invalid_number: "Número inválido",
  status_chatbot: "Caiu em chatbot",
  status_reception_answered: "Recepção respondeu",
  status_forwarded: "Encaminhado ao responsável",
  status_owner_contact_obtained: "Contato do dono obtido",
  status_awaiting_reply: "Aguardando retorno",
  status_no_reply: "Sem resposta",
  status_not_interested: "Não interessado",
  status_meeting_scheduled: "Reunião marcada",
  stage_changed: "Mudança de etapa",
  follow_up_set: "Follow-up definido",
  assigned: "Responsável atribuído",
  contact_registered: "Contato registrado",
  meeting_scheduled: "Reunião marcada",
  meeting_held: "Reunião realizada",
  meeting_proposal_pending: "Proposta pendente",
  meeting_proposal_sent: "Proposta enviada",
  meeting_negotiation: "Em negociação",
  closed_won: "Negócio fechado",
  lead_discarded: "Lead descartado",
  archived: "Lead arquivado",
  batch_analysis_queued: "Análise em lote enfileirada",
  decision_maker_search: "Pesquisa de decisor",
};

function eventLabel(event: OutreachEventRow): string {
  if (EVENT_LABELS[event.event_type]) return EVENT_LABELS[event.event_type];
  if (event.event_type.startsWith("status_")) return event.event_type.replace("status_", "Status: ");
  return event.event_type;
}

function eventDetail(event: OutreachEventRow): string | null {
  const meta = event.metadata as Record<string, unknown> | null;
  if (!meta) return null;
  if (event.event_type === "stage_changed" && meta.from && meta.to) {
    return `${meta.from} → ${meta.to}`;
  }
  if (event.event_type === "follow_up_set" && meta.next_follow_up_at) {
    return `Para ${formatDate(meta.next_follow_up_at as string)}`;
  }
  if (event.event_type === "closed_won" && meta.service) {
    return `Serviço: ${meta.service}${meta.value ? ` · R$ ${meta.value}` : ""}`;
  }
  if (typeof meta.notes === "string") return meta.notes;
  return null;
}

export function Timeline({ events }: { events: OutreachEventRow[] }) {
  if (!events.length) {
    return <p className="text-sm text-muted">Nenhum evento registrado ainda.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => {
        const detail = eventDetail(event);
        return (
          <li key={event.id} className="flex gap-3 text-sm">
            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground">{eventLabel(event)}</span>
                <time dateTime={event.created_at} title={formatDate(event.created_at)} className="shrink-0 text-xs text-muted">
                  {formatHumanDate(event.created_at)}
                </time>
              </div>
              {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
