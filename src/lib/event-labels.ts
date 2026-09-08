import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { PipelineStage } from "@/types/domain";

// ONE label map for outreach_events — used by Histórico, the lead Timeline and the drawer.
// (Before this module, two renderers kept divergent maps and events like cadence_followup
// fell through as raw slugs.)

export const RESPONSE_LABELS: Record<string, string> = {
  respondeu: "Respondeu",
  interessado: "Interessado",
  apresentacao: "Pediu apresentação",
  agencia: "Já tem agência",
  depois: "Falar depois",
  reuniao: "Pediu reunião",
  contato_errado: "Contato errado",
  nao_interessado: "Não interessado",
};

const TRIAGE_LABELS: Record<string, string> = {
  approved: "Selecionado na triagem",
  rejected: "Descartado na triagem",
  review_later: "Adiado na triagem",
  pending_review: "Voltou para triagem",
};

const STATIC_LABELS: Record<string, string> = {
  lead_discovered: "Lead descoberto",
  instagram_found: "Instagram encontrado",
  haiku_analysis: "Análise de IA",
  batch_analysis_queued: "Análise em lote enfileirada",
  message_generated: "Mensagem gerada",
  message_sent: "Mensagem enviada",
  contacted: "Contato realizado",
  contact_registered: "Contato registrado",
  closed_won: "Negócio fechado",
  reactivated: "Reativado",
  lead_created_manual: "Lead criado manualmente",
  client_added_manual: "Cliente adicionado manualmente",
  preparation_status_changed: "Preparação atualizada",
  decision_maker_search: "Busca de decisor",
  assigned: "Responsável definido",
  follow_up_set: "Follow-up agendado",
  cadence_followup: "Sem resposta — próximo follow-up da cadência",
  meeting_scheduled: "Reunião marcada",
  meeting_held: "Reunião realizada",
  meeting_proposal_pending: "Proposta pendente",
  meeting_proposal_sent: "Proposta enviada",
  meeting_negotiation: "Negociação",
  proposal_sent: "Proposta enviada",
  lead_discarded: "Lead descartado",
  archived: "Arquivado",
};

function stageLabel(raw: unknown): string {
  return PIPELINE_STAGE_LABELS[raw as PipelineStage] ?? String(raw ?? "");
}

export function eventLabel(type: string, metadata?: Record<string, unknown> | null): string {
  if (type.startsWith("response_")) {
    const kind = type.slice("response_".length);
    return `Resposta: ${RESPONSE_LABELS[kind] ?? kind.replace(/_/g, " ")}`;
  }
  if (type === "triage_decision") {
    const decision = String(metadata?.decision ?? "");
    return TRIAGE_LABELS[decision] ?? "Triagem";
  }
  if (type === "stage_changed") {
    return metadata?.to ? `Movido para ${stageLabel(metadata.to)}` : "Etapa alterada";
  }
  if (type === "lost") {
    return metadata?.reason ? `Perdido — ${String(metadata.reason)}` : "Perdido";
  }
  if (type.startsWith("status_")) {
    const slug = type.slice("status_".length);
    return STATUS_LABELS[slug] ?? `Status: ${slug.replace(/_/g, " ")}`;
  }
  return STATIC_LABELS[type] ?? type.replace(/_/g, " ");
}

const STATUS_LABELS: Record<string, string> = {
  message_sent: "Marcado como enviada",
  invalid_number: "Número inválido",
  chatbot: "Caiu em chatbot",
  reception_answered: "Recepção respondeu",
  forwarded: "Encaminhado ao responsável",
  owner_contact_obtained: "Contato do dono obtido",
  awaiting_reply: "Aguardando retorno",
  no_reply: "Sem resposta",
  not_interested: "Não interessado",
  meeting_scheduled: "Reunião marcada",
};
