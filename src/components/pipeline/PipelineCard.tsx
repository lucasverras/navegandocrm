"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatHumanDate, daysFromNow } from "@/lib/utils";
import type { LeadRow } from "@/types/database";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, MEETING_STATUSES, MEETING_STATUS_LABELS } from "@/types/domain";
import type { PipelineStage, MeetingStatus } from "@/types/domain";

const COMMERCIAL_STATUS_LABEL: Record<string, string> = {
  not_contacted: "Não abordado",
  message_ready: "Mensagem pronta",
  message_sent: "Enviada",
  invalid_number: "Número inválido",
  chatbot: "Chatbot",
  reception_answered: "Recepção respondeu",
  forwarded: "Encaminhado",
  owner_contact_obtained: "Contato do dono obtido",
  awaiting_reply: "Aguardando retorno",
  no_reply: "Sem resposta",
  not_interested: "Não interessado",
  meeting_scheduled: "Reunião marcada",
};

function scoreColor(score: number): "success" | "warning" | "muted" {
  return score >= 70 ? "success" : score >= 40 ? "warning" : "muted";
}

export function PipelineCard({
  lead,
  regionName,
  onMoveTo,
  onMeetingStatusChange,
}: {
  lead: LeadRow;
  regionName: string | undefined;
  onMoveTo: (stage: PipelineStage) => void;
  onMeetingStatusChange: (status: MeetingStatus) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { stage: lead.pipeline_stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const score = lead.ai_score ?? lead.pre_score;
  const daysInStage = daysFromNow(lead.stage_changed_at);
  const followUpDays = daysFromNow(lead.next_follow_up_at);
  const overdue = followUpDays !== null && followUpDays < 0;

  function handleCardClick(e: React.MouseEvent) {
    // Ignore clicks that originated from the drag handle or the meeting-status select.
    const target = e.target as HTMLElement;
    if (target.closest("[data-drag-handle]") || target.closest("[data-no-navigate]")) return;
    router.push(`/leads/${lead.id}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm shadow-sm transition-opacity",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={handleCardClick}
          className="flex-1 text-left"
        >
          <div className="font-medium text-foreground leading-tight">{lead.name}</div>
          <div className="mt-0.5 text-xs text-muted">{regionName ?? "—"}</div>
        </button>
        <button
          type="button"
          data-drag-handle
          aria-label={`Mover lead: ${lead.name}`}
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-1 text-muted hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="muted" className="text-[10px]">
          {lead.category}
        </Badge>
        <Badge tone={scoreColor(score)} className="text-[10px]">
          {score}
        </Badge>
        {overdue && (
          <Badge tone="danger" className="text-[10px]">
            Atrasado
          </Badge>
        )}
      </div>

      <div className="text-xs text-muted">
        {COMMERCIAL_STATUS_LABEL[lead.commercial_status] ?? lead.commercial_status}
      </div>

      <div className="flex flex-col gap-0.5 text-[11px] text-muted">
        <span>Última atividade: {formatHumanDate(lead.last_activity_at)}</span>
        {lead.next_follow_up_at && <span>Follow-up: {formatHumanDate(lead.next_follow_up_at)}</span>}
        {daysInStage !== null && <span>{daysInStage} dia(s) na etapa</span>}
        <span>Responsável: {lead.assigned_to ?? "—"}</span>
      </div>

      {lead.pipeline_stage === "meeting_proposal" && (
        <select
          data-no-navigate
          value={lead.meeting_status ?? ""}
          onChange={(e) => onMeetingStatusChange(e.target.value as MeetingStatus)}
          className="mt-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-foreground"
        >
          <option value="" disabled>
            Status da reunião...
          </option>
          {MEETING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {MEETING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      )}

      {/* Non-drag fallback for mobile / accessibility */}
      <select
        data-no-navigate
        value=""
        onChange={(e) => {
          if (e.target.value) onMoveTo(e.target.value as PipelineStage);
        }}
        className="mt-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted md:hidden"
      >
        <option value="">Mover para...</option>
        {PIPELINE_STAGES.filter((s) => s !== lead.pipeline_stage).map((s) => (
          <option key={s} value={s}>
            {PIPELINE_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
