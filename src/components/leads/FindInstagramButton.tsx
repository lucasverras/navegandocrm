"use client";

import { useState } from "react";
import { toast } from "sonner";

export function FindInstagramButton({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<string | null>(null);

  async function find() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/instagram`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.found) {
      setFound(data.handle);
      toast.success(`Instagram encontrado: @${data.handle}`);
    } else {
      toast.message("Instagram não encontrado no site do restaurante");
    }
  }

  if (found) {
    return <span className="text-xs text-success">@{found}</span>;
  }

  return (
    <button
      type="button"
      onClick={find}
      disabled={loading}
      className="text-xs text-accent-2 hover:underline disabled:opacity-50"
    >
      {loading ? "Procurando…" : "Encontrar IG"}
    </button>
  );
}
