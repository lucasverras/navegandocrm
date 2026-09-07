"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

// Conscious entry into the commercial pipeline. A lead only reaches the Kanban when someone
// clicks this — discovery/triage never set a pipeline stage.
export function AddToPipelineButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function add() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "new", position: 0 }),
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

  return (
    <Button size="sm" loading={loading} onClick={add}>
      Adicionar ao pipeline <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  );
}
