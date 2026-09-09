"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageCircle } from "lucide-react";
import { instagramUrl } from "@/components/leads/LeadQuickActions";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { BRL } from "@/lib/finance";
import { cn, formatHumanDate, daysFromNow } from "@/lib/utils";
import type { LeadRow } from "@/types/database";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, MEETING_STATUSES, MEETING_STATUS_LABELS, CONTACT_ROUND_SHORT } from "@/types/domain";
import type { ContactRound } from "@/types/domain";
import type { PipelineStage, MeetingStatus } from "@/types/domain";

const FOLLOW_UP_CHOICES = [
  { days: 1, label: "Amanhã" },
  { days: 2, label: "D+2" },
  { days: 5, label: "D+5" },
  { days: 10, label: "D+10" },
];

// Trello-minimal card: name, phone + WhatsApp, @handle + Instagram, and the next date. Nothing
// else on the face — extra detail lives one click into the lead (side drawer, §50).
export function PipelineCard({
  lead,
  regionName,
  whatsappMessage,
  onMoveTo,
  onMeetingStatusChange,
  onLose,
  onFollowUp,
}: {
  lead: LeadRow;
  regionName: string | undefined;
  whatsappMessage?: string | null;
  onMoveTo: (stage: PipelineStage) => void;
  onMeetingStatusChange: (status: MeetingStatus) => void;
  onLose: () => void;
  onFollowUp?: (days: number) => void;
}) {
  const [showFollowUp, setShowFollowUp] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { stage: lead.pipeline_stage },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const followUpDays = daysFromNow(lead.next_follow_up_at);
  const overdue = followUpDays !== null && followUpDays < 0;
  const dueToday = followUpDays === 0;
  const wa = lead.phone ? buildWhatsAppLink(lead.phone, whatsappMessage ?? "") : null;
  const ig = instagramUrl(lead);
  const handle = (lead.instagram_handle ?? lead.instagram ?? "").replace(/^@/, "");

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-navigate]")) return;
    // §50: click opens the side drawer — the board never navigates away.
    window.dispatchEvent(new CustomEvent("open-lead-drawer", { detail: { leadId: lead.id } }));
  }
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  const iconBtn = "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 transition-colors active:scale-90";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      className={cn(
        "group flex cursor-grab select-none flex-col gap-1.5 rounded-lg border border-border bg-surface p-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-opacity active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground leading-tight">{lead.name}</div>
          {regionName && <div className="truncate text-[11px] text-muted">{regionName}</div>}
        </div>
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted/30 group-hover:text-muted" aria-hidden />
      </div>

      {lead.phone && (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate tabular-nums text-[13px] text-foreground">{lead.phone}</span>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" data-no-navigate onPointerDown={stopDrag} onClick={(e) => e.stopPropagation()} title="WhatsApp" className={cn(iconBtn, "text-[#25D366] hover:bg-surface-hover")}>
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>
      )}

      {ig && (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-accent-2">@{handle}</span>
          <a href={ig} target="_blank" rel="noreferrer" data-no-navigate onPointerDown={stopDrag} onClick={(e) => e.stopPropagation()} title="Instagram" className={cn(iconBtn, "text-[#E1306C] hover:bg-surface-hover")}>
            <IgGlyph />
          </a>
        </div>
      )}

      {lead.contact_round && CONTACT_ROUND_SHORT[lead.contact_round as ContactRound] && (
        <span className="text-[11px] font-medium text-accent-2">
          {CONTACT_ROUND_SHORT[lead.contact_round as ContactRound]}
        </span>
      )}

      {lead.proposal_value != null && lead.proposal_value > 0 && (
        <div className="text-[12px] font-semibold tabular-nums text-foreground">{BRL.format(lead.proposal_value)}/mês</div>
      )}

      {lead.meeting_at ? (
        <div className="text-[11px] text-accent-2">Reunião · {formatHumanDate(lead.meeting_at)}</div>
      ) : lead.next_follow_up_at ? (
        <div className={cn("text-[11px]", overdue ? "text-danger" : dueToday ? "text-warning" : "text-muted")}>
          {overdue ? "Follow-up atrasado" : "Follow-up"} · {formatHumanDate(lead.next_follow_up_at)}
        </div>
      ) : null}

      {lead.pipeline_stage === "meeting" && (
        <select
          data-no-navigate
          onPointerDown={stopDrag}
          value={lead.meeting_status ?? ""}
          onChange={(e) => onMeetingStatusChange(e.target.value as MeetingStatus)}
          className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] text-foreground"
        >
          <option value="" disabled>
            Status…
          </option>
          {MEETING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {MEETING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      )}

      {/* Quick follow-up (§37): Amanhã / D+2 / D+5 / D+10 sem sair do board. */}
      {showFollowUp && onFollowUp && (
        <div data-no-navigate onPointerDown={stopDrag} className="flex flex-wrap gap-1">
          {FOLLOW_UP_CHOICES.map((c) => (
            <button
              key={c.days}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFollowUp(false);
                onFollowUp(c.days);
              }}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent-2"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile stage mover (drag is desktop-first) + hover actions. */}
      <div className="flex items-center justify-between gap-2">
        <select
          data-no-navigate
          onPointerDown={stopDrag}
          value=""
          onChange={(e) => e.target.value && onMoveTo(e.target.value as PipelineStage)}
          className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] text-muted md:hidden"
        >
          <option value="">Mover…</option>
          {PIPELINE_STAGES.filter((s) => s !== lead.pipeline_stage).map((s) => (
            <option key={s} value={s}>
              {PIPELINE_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {onFollowUp && (
            <button
              type="button"
              data-no-navigate
              onPointerDown={stopDrag}
              onClick={(e) => {
                e.stopPropagation();
                setShowFollowUp((v) => !v);
              }}
              className="text-[11px] text-muted hover:text-accent-2"
            >
              Follow-up
            </button>
          )}
          <button
            type="button"
            data-no-navigate
            onPointerDown={stopDrag}
            onClick={(e) => {
              e.stopPropagation();
              onLose();
            }}
            className="text-[11px] text-muted hover:text-danger"
          >
            Perder
          </button>
        </div>
      </div>
    </div>
  );
}

function IgGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
