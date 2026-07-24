import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WhatsAppButton } from "@/components/leads/WhatsAppButton";
import { formatHumanDate, formatDate, daysFromNow } from "@/lib/utils";
import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { HojeLead } from "./types";
import { leadScore } from "./types";

function scoreTone(score: number): "success" | "warning" | "muted" {
  return score >= 70 ? "success" : score >= 40 ? "warning" : "muted";
}

export function HojeLeadRow({
  lead,
  action,
  dateLabel,
  dateValue,
  whatsappMessage,
}: {
  lead: HojeLead;
  action: string;
  /** Label for the date column, e.g. "Próximo follow-up" or "Reunião" */
  dateLabel?: string;
  dateValue?: string | null;
  /** If present and lead has a phone, a quick WhatsApp button is shown. */
  whatsappMessage?: string | null;
}) {
  const score = leadScore(lead);
  const overdueDays = dateValue ? daysFromNow(dateValue) : null;
  const isOverdue = overdueDays != null && overdueDays < 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-accent-2">
            {lead.name}
          </Link>
          <Badge tone={scoreTone(score)}>{score}</Badge>
          <Badge tone="default">{PIPELINE_STAGE_LABELS[lead.pipeline_stage]}</Badge>
          {isOverdue && <Badge tone="danger">{Math.abs(overdueDays!)} dia(s) atrasado</Badge>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span>{lead.category}</span>
          {lead.region && (
            <span>
              {lead.region.neighborhood}, {lead.region.city}
            </span>
          )}
          <span>Responsável: {lead.assigned_to ?? "—"}</span>
          <span>Última atividade: {formatHumanDate(lead.last_activity_at)}</span>
          {dateLabel && (
            <span title={dateValue ? formatDate(dateValue) : undefined}>
              {dateLabel}: {formatHumanDate(dateValue)}
            </span>
          )}
        </div>
        <p className="text-xs text-accent-2">{action}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {whatsappMessage && lead.phone && <WhatsAppButton phone={lead.phone} message={whatsappMessage} />}
        <Link href={`/leads/${lead.id}`}>
          <Button variant="outline" size="sm">
            Ver lead
          </Button>
        </Link>
      </div>
    </div>
  );
}
