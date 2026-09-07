"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Discreet action to find a lead's Instagram handle from its own website (handle-only, no scraping
// of instagram.com). Shown when no handle is known yet.
export function FindInstagramButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function find() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/instagram`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.found) {
      toast.success(`Instagram encontrado: @${data.handle}`);
      router.refresh();
    } else {
      toast.message("Instagram não encontrado no site do restaurante");
    }
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
