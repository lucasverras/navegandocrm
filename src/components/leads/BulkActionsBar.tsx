"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Sparkles } from "lucide-react";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from "@/types/domain";

type BulkAction = "move_stage" | "assign" | "follow_up" | "archive" | "discard";

export function BulkActionsBar({
  selectedIds,
  totalCount,
  onDone,
  onAnalyze,
  analyzing,
}: {
  selectedIds: string[];
  totalCount: number;
  onDone: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [stageChoice, setStageChoice] = useState<PipelineStage>(PIPELINE_STAGES[0]);
  const [assignChoice, setAssignChoice] = useState("");
  const [showStagePicker, setShowStagePicker] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");

  const selectedCount = selectedIds.length;

  async function runBulk(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedIds, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao executar ação em massa");
        return;
      }
      toast.success(successMessage);
      onDone();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleMoveStage() {
    runBulk(
      { action: "move_stage" as BulkAction, stage: stageChoice },
      `${selectedCount} lead(s) movido(s) para ${PIPELINE_STAGE_LABELS[stageChoice]}`
    );
    setShowStagePicker(false);
  }

  function handleAssign() {
    if (!assignChoice.trim()) {
      toast.error("Informe o ID do responsável");
      return;
    }
    runBulk({ action: "assign" as BulkAction, assigned_to: assignChoice.trim() }, `${selectedCount} lead(s) atribuído(s)`);
    setShowAssignPicker(false);
  }

  function quickFollowUp(daysFromNow: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    runBulk(
      { action: "follow_up" as BulkAction, next_follow_up_at: d.toISOString() },
      `Follow-up definido para ${selectedCount} lead(s)`
    );
    setShowFollowUpPicker(false);
  }

  function customFollowUp() {
    if (!followUpDate) {
      toast.error("Escolha uma data");
      return;
    }
    runBulk(
      { action: "follow_up" as BulkAction, next_follow_up_at: new Date(followUpDate).toISOString() },
      `Follow-up definido para ${selectedCount} lead(s)`
    );
    setShowFollowUpPicker(false);
  }

  function handleArchive() {
    if (!window.confirm(`Arquivar ${selectedCount} lead(s)?`)) return;
    runBulk({ action: "archive" as BulkAction }, `${selectedCount} lead(s) arquivado(s)`);
  }

  function handleDiscard() {
    if (!window.confirm(`Descartar ${selectedCount} lead(s) (marcar como não interessado)?`)) return;
    runBulk({ action: "discard" as BulkAction }, `${selectedCount} lead(s) descartado(s)`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {selectedCount > 0 ? `${selectedCount} selecionado(s)` : `${totalCount} lead(s)`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={selectedCount === 0} loading={analyzing} onClick={onAnalyze}>
            <Sparkles className="h-3.5 w-3.5" />
            Analisar com IA
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedCount === 0 || busy}
            onClick={() => setShowStagePicker((v) => !v)}
          >
            Mover de etapa
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedCount === 0 || busy}
            onClick={() => setShowAssignPicker((v) => !v)}
          >
            Atribuir responsável
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedCount === 0 || busy}
            onClick={() => setShowFollowUpPicker((v) => !v)}
          >
            Definir follow-up
          </Button>
          <Button size="sm" variant="secondary" disabled={selectedCount === 0 || busy} onClick={handleArchive}>
            Arquivar
          </Button>
          <Button size="sm" variant="danger" disabled={selectedCount === 0 || busy} onClick={handleDiscard}>
            Descartar
          </Button>
        </div>
      </div>

      {showStagePicker && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <select
            className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
            value={stageChoice}
            onChange={(e) => setStageChoice(e.target.value as PipelineStage)}
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <Button size="sm" loading={busy} onClick={handleMoveStage}>
            Confirmar
          </Button>
        </div>
      )}

      {showAssignPicker && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <input
            className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
            placeholder="ID (UUID) do responsável"
            value={assignChoice}
            onChange={(e) => setAssignChoice(e.target.value)}
          />
          <Button size="sm" loading={busy} onClick={handleAssign}>
            Confirmar
          </Button>
        </div>
      )}

      {showFollowUpPicker && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => quickFollowUp(0)}>
            Hoje
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => quickFollowUp(1)}>
            Amanhã
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => quickFollowUp(3)}>
            Em 3 dias
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => quickFollowUp(7)}>
            Em 7 dias
          </Button>
          <input
            type="date"
            className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
          <Button size="sm" loading={busy} onClick={customFollowUp}>
            Confirmar data
          </Button>
        </div>
      )}
    </div>
  );
}
