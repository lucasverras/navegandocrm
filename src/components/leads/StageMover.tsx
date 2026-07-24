"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/Input";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from "@/types/domain";

export function StageMover({ leadId, currentStage }: { leadId: string; currentStage: PipelineStage }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function move(stage: PipelineStage) {
    if (stage === currentStage) return;

    if (stage === "closed") {
      const service = window.prompt("Serviço contratado (obrigatório para fechar):");
      if (!service) return;
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
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao fechar negócio");
        return;
      }
      toast.success("Negócio fechado");
      router.refresh();
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, position: 0 }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao mover etapa");
      return;
    }
    toast.success(`Movido para ${PIPELINE_STAGE_LABELS[stage]}`);
    router.refresh();
  }

  return (
    <Select
      aria-label="Mover para etapa"
      value={currentStage}
      disabled={loading}
      onChange={(e) => move(e.target.value as PipelineStage)}
      className="h-9 w-auto"
    >
      {PIPELINE_STAGES.map((stage) => (
        <option key={stage} value={stage}>
          {PIPELINE_STAGE_LABELS[stage]}
        </option>
      ))}
    </Select>
  );
}
