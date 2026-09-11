"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/Input";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from "@/types/domain";

export function StageMover({ leadId, currentStage }: { leadId: string; currentStage: PipelineStage }) {
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(currentStage);

  async function move(target: PipelineStage) {
    if (target === stage) return;
    const prev = stage;
    setStage(target);

    if (target === "closed") {
      const service = window.prompt("Serviço contratado (obrigatório para fechar):");
      if (!service) { setStage(prev); return; }
      const valueRaw = window.prompt("Valor do fechamento (opcional, só número):") ?? "";
      const value = valueRaw.trim() ? Number(valueRaw.replace(",", ".")) : null;

      setLoading(true);
      const res = await fetch(`/api/leads/${leadId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed_service: service, closed_value: value }),
      });
      setLoading(false);
      if (!res.ok) {
        setStage(prev);
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao fechar negócio");
        return;
      }
      toast.success("Negócio fechado");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: target, position: 0 }),
    });
    setLoading(false);
    if (!res.ok) {
      setStage(prev);
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao mover etapa");
      return;
    }
    toast.success(`Movido para ${PIPELINE_STAGE_LABELS[target]}`);
  }

  return (
    <Select
      aria-label="Mover para etapa"
      value={stage}
      disabled={loading}
      onChange={(e) => move(e.target.value as PipelineStage)}
      className="h-9 w-auto"
    >
      {PIPELINE_STAGES.map((s) => (
        <option key={s} value={s}>
          {PIPELINE_STAGE_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
