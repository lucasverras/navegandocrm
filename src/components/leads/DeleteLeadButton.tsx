"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Excluir "${leadName}"? O lead será arquivado.`)) return;
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/lose`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Excluído manualmente" }),
    });
    if (!res.ok) {
      setLoading(false);
      toast.error("Erro ao excluir lead");
      return;
    }
    toast.success("Lead excluído");
    router.push("/leads");
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleDelete}
      className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
    >
      <Trash2 className="h-3 w-3" /> {loading ? "Excluindo..." : "Excluir lead"}
    </button>
  );
}
