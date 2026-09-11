"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Plus, ArrowRight, Check } from "lucide-react";
import { FIRST_PIPELINE_STAGE } from "@/types/domain";

export function AddToPipelineButton({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function add(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setLoading(true);
    setAdded(true);
    const res = await fetch(`/api/leads/${leadId}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: FIRST_PIPELINE_STAGE, position: 0 }),
    });
    setLoading(false);
    if (!res.ok) {
      setAdded(false);
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao adicionar ao pipeline");
      return;
    }
    toast.success("Adicionado ao pipeline");
  }

  if (added) {
    if (compact) {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-success/10 text-success">
          <Check className="h-4 w-4" />
        </span>
      );
    }
    return (
      <Button size="sm" variant="secondary" disabled>
        <Check className="h-3.5 w-3.5" /> No pipeline
      </Button>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={add}
        disabled={loading}
        title="Adicionar ao pipeline"
        aria-label="Adicionar ao pipeline"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-accent/40 bg-accent-soft text-accent-2 transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Button size="sm" loading={loading} onClick={add}>
      <Plus className="h-3.5 w-3.5" /> Pipeline <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  );
}
