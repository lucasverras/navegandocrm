"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadCard } from "@/components/leads/LeadCard";
import { LeadsFilters } from "@/components/leads/LeadsFilters";
import { BulkActionsBar } from "@/components/leads/BulkActionsBar";
import { LeadQuickActions } from "@/components/leads/LeadQuickActions";
import { daysFromNow } from "@/lib/utils";
import { PIPELINE_STAGE_LABELS, categoryLabel } from "@/types/domain";
import type { LeadWithRegion } from "@/app/(dashboard)/leads/page";
import type { RegionRow } from "@/types/database";
import { Users, Trash2 } from "lucide-react";

// The single most useful thing to do next with this lead — surfaced as a table column so the
// operator scans "what do I do" instead of decoding raw status fields.
function nextAction(lead: LeadWithRegion): { label: string; overdue: boolean } {
  if (lead.pipeline_stage === "closed") return { label: "Fechado", overdue: false };
  const followDays = daysFromNow(lead.next_follow_up_at);
  if (followDays !== null && followDays < 0) return { label: "Follow-up atrasado", overdue: true };
  if (lead.ai_score == null) return { label: "Analisar com IA", overdue: false };
  if (lead.commercial_status === "message_ready") return { label: "Enviar mensagem", overdue: false };
  if (lead.commercial_status === "not_contacted") return { label: "Gerar mensagem", overdue: false };
  if (lead.next_follow_up_at) return { label: "Fazer follow-up", overdue: false };
  return { label: "Definir próximo passo", overdue: false };
}

export function LeadsExplorer({
  leads,
  regions,
  page,
  totalPages,
  total,
}: {
  leads: LeadWithRegion[];
  regions: Pick<RegionRow, "id" | "neighborhood" | "city">[];
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(next: number) {
    const p = new URLSearchParams(searchParams.toString());
    if (next <= 1) p.delete("page");
    else p.set("page", String(next));
    router.push(`${pathname}?${p.toString()}`);
  }
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

  async function handleDiscardOne(id: string, name: string) {
    if (!window.confirm(`Descartar "${name}"? Ele sai da lista de leads ativos.`)) return;
    const res = await fetch("/api/leads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: [id], action: "discard" }),
    });
    if (!res.ok) {
      toast.error("Erro ao descartar");
      return;
    }
    toast.success(`${name} descartado`);
    router.refresh();
  }

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
              <Th>Lead</Th>
              <Th>Região</Th>
              <Th>Score</Th>
              <Th>Etapa</Th>
              <Th>Próxima ação</Th>
              <Th>Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {leads.map((lead) => {
              // Só mostra pré-score quando ainda não há score de IA (o de IA prevalece).
              const hasAi = lead.ai_score != null;
              const score = hasAi ? lead.ai_score! : lead.pre_score;
              const action = nextAction(lead);
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
                    <div className="text-xs text-muted">{categoryLabel(lead.category)}</div>
                  </Td>
                  <Td className="text-xs">{lead.regions?.neighborhood ?? "—"}</Td>
                  <Td>
                    <Badge tone={scoreColor(score)}>{score}</Badge>
                    {!hasAi && <span className="ml-1 text-[10px] text-muted">pré</span>}
                  </Td>
                  <Td>
                    <Badge tone="accent">{PIPELINE_STAGE_LABELS[lead.pipeline_stage]}</Badge>
                  </Td>
                  <Td className="text-xs">
                    <span className={action.overdue ? "text-danger" : "text-foreground"}>{action.label}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <LeadQuickActions lead={lead} />
                      <button
                        type="button"
                        onClick={() => handleDiscardOne(lead.id, lead.name)}
                        title="Descartar lead"
                        aria-label="Descartar lead"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link href={`/leads/${lead.id}`} className="ml-1 text-xs text-accent-2 hover:underline">
                        Abrir
                      </Link>
                    </div>
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

      {leads.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {total} lead(s) · página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="rounded-md border border-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="rounded-md border border-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
