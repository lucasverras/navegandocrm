import { formatHumanDate, formatDate } from "@/lib/utils";
import { eventLabel } from "@/lib/event-labels";
import type { OutreachEventRow } from "@/types/database";

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
                <span className="text-foreground">{eventLabel(event.event_type, event.metadata as Record<string, unknown> | null)}</span>
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
