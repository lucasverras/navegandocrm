"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadCard } from "@/components/leads/LeadCard";
import { LeadsFilters } from "@/components/leads/LeadsFilters";
import { BulkActionsBar } from "@/components/leads/BulkActionsBar";
import { formatHumanDate, daysFromNow } from "@/lib/utils";
import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { LeadWithRegion } from "@/app/(dashboard)/leads/page";
import type { RegionRow } from "@/types/database";
import { Users } from "lucide-react";

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

export function LeadsExplorer({
  leads,
  regions,
}: {
  leads: LeadWithRegion[];
  regions: Pick<RegionRow, "id" | "neighborhood" | "city">[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyzing, startAnalyzing] = useTransition();
  const [view, setView] = useState<"table" | "cards">("table");

  const allSelected = leads.length > 0 && selected.size === leads.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = selected.size;

  async function handleAnalyze(force = false) {
    if (selectedCount === 0) return;
    if (selectedCount > 50 && !force) {
      const confirmed = window.confirm(
        `Você selecionou ${selectedCount} leads. Analisar mais de 50 de uma vez pode consumir uma parte relevante do limite diário. Confirmar mesmo assim?`
      );
      if (!confirmed) return;
    }

    startAnalyzing(async () => {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected), confirmedOverLimit: selectedCount > 50 }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao analisar leads");
        return;
      }

      toast.success(`${data.analyzed} lead(s) analisado(s) com IA`);
      if (data.failed?.length) {
        toast.warning(`${data.failed.length} lead(s) falharam na análise`);
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  const scoreColor = useMemo(
    () => (score: number): "success" | "warning" | "muted" =>
      score >= 70 ? "success" : score >= 40 ? "warning" : "muted",
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <LeadsFilters regions={regions} />

      <BulkActionsBar
        selectedIds={Array.from(selected)}
        totalCount={leads.length}
        onDone={() => setSelected(new Set())}
        onAnalyze={() => handleAnalyze(false)}
        analyzing={analyzing}
      />

      <div className="flex items-center justify-end gap-1 text-xs">
        <button
          type="button"
          onClick={() => setView("table")}
          className={`rounded-md px-3 py-1.5 ${
            view === "table" ? "bg-accent-soft text-accent-2" : "bg-surface-2 text-muted hover:text-foreground"
          }`}
        >
          Tabela
        </button>
        <button
          type="button"
          onClick={() => setView("cards")}
          className={`rounded-md px-3 py-1.5 ${
            view === "cards" ? "bg-accent-soft text-accent-2" : "bg-surface-2 text-muted hover:text-foreground"
          }`}
        >
          Cards
        </button>
      </div>

      {!leads.length ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou pesquise uma região para começar a coletar leads."
        />
      ) : view === "table" ? (
        <Table>
          <THead>
            <Tr>
              <Th>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-accent" />
              </Th>
              <Th>Nome</Th>
              <Th>Região</Th>
              <Th>Categoria</Th>
              <Th>Pré-score</Th>
              <Th>Score IA</Th>
              <Th>Etapa</Th>
              <Th>Responsável</Th>
              <Th>Última atividade</Th>
              <Th>Próximo follow-up</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {leads.map((lead) => {
              const overdue = (daysFromNow(lead.next_follow_up_at) ?? 0) < 0;
              return (
                <Tr key={lead.id}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      className="accent-accent"
                    />
                  </Td>
                  <Td>
                    <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-accent-2">
                      {lead.name}
                    </Link>
                    <div className="text-xs text-muted">{lead.address}</div>
                  </Td>
                  <Td className="text-xs">{lead.regions?.neighborhood ?? "—"}</Td>
                  <Td className="text-xs">{lead.category}</Td>
                  <Td>
                    <Badge tone={scoreColor(lead.pre_score)}>{lead.pre_score}</Badge>
                  </Td>
                  <Td>
                    {lead.ai_score != null ? <Badge tone={scoreColor(lead.ai_score)}>{lead.ai_score}</Badge> : "—"}
                  </Td>
                  <Td>
                    <Badge tone="accent">{PIPELINE_STAGE_LABELS[lead.pipeline_stage]}</Badge>
                  </Td>
                  <Td className="text-xs">{lead.assigned_to ?? "—"}</Td>
                  <Td className="text-xs">{formatHumanDate(lead.last_activity_at)}</Td>
                  <Td className="text-xs">
                    {lead.next_follow_up_at ? (
                      <Badge tone={overdue ? "danger" : "muted"}>{formatHumanDate(lead.next_follow_up_at)}</Badge>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-xs">{STATUS_LABEL[lead.commercial_status] ?? lead.commercial_status}</Td>
                  <Td>
                    <Link href={`/leads/${lead.id}`} className="text-xs text-accent-2 hover:underline">
                      Abrir
                    </Link>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} selected={selected.has(lead.id)} onToggle={toggleOne} />
          ))}
        </div>
      )}
    </div>
  );
}
