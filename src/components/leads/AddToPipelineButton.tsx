"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Plus, ArrowRight } from "lucide-react";
import { FIRST_PIPELINE_STAGE } from "@/types/domain";

// Conscious entry into the commercial pipeline. A lead only reaches the Kanban when someone
// clicks this — discovery/triage never set a pipeline stage. `compact` renders an orange icon
// button for dense rows; the default is a full labelled primary (orange) button.
export function AddToPipelineButton({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function add(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: FIRST_PIPELINE_STAGE, position: 0 }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao adicionar ao pipeline");
      return;
    }
    toast.success("Adicionado ao pipeline");
    router.refresh();
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
      <Plus className="h-3.5 w-3.5" /> Adicionar ao pipeline <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  );
}
