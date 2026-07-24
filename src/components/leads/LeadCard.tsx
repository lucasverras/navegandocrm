"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { formatHumanDate, daysFromNow } from "@/lib/utils";
import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { LeadWithRegion } from "@/app/(dashboard)/leads/page";

const STATUS_LABEL: Record<string, string> = {
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

function scoreTone(score: number): "success" | "warning" | "muted" {
  return score >= 70 ? "success" : score >= 40 ? "warning" : "muted";
}

export function LeadCard({
  lead,
  selected,
  onToggle,
}: {
  lead: LeadWithRegion;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const overdue = (daysFromNow(lead.next_follow_up_at) ?? 0) < 0;

  return (
    <Card className="relative">
      <button
        type="button"
        aria-label="Selecionar lead"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(lead.id);
        }}
        className="absolute left-3 top-3 z-10"
      >
        <input type="checkbox" checked={selected} readOnly className="accent-accent" />
      </button>
      <Link href={`/leads/${lead.id}`} className="block">
        <CardContent className="flex flex-col gap-2 pl-8">
          <div>
            <div className="font-medium text-foreground hover:text-accent-2">{lead.name}</div>
            <div className="text-xs text-muted">{lead.regions?.neighborhood ?? "—"}</div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={scoreTone(lead.pre_score)}>Pré {lead.pre_score}</Badge>
            {lead.ai_score != null && <Badge tone={scoreTone(lead.ai_score)}>IA {lead.ai_score}</Badge>}
            <Badge tone="accent">{PIPELINE_STAGE_LABELS[lead.pipeline_stage]}</Badge>
          </div>

          <div className="text-xs text-muted">{lead.category}</div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span>Responsável: {lead.assigned_to ?? "—"}</span>
            <span>{STATUS_LABEL[lead.commercial_status] ?? lead.commercial_status}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span>Atividade: {formatHumanDate(lead.last_activity_at)}</span>
            {lead.next_follow_up_at ? (
              <Badge tone={overdue ? "danger" : "muted"}>Follow-up: {formatHumanDate(lead.next_follow_up_at)}</Badge>
            ) : (
              <span>Follow-up: —</span>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
