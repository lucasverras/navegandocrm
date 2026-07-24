"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { CalendarClock } from "lucide-react";

const QUICK_OPTIONS = [
  { label: "Hoje", days: 0 },
  { label: "Amanhã", days: 1 },
  { label: "Em 3 dias", days: 3 },
  { label: "Em 7 dias", days: 7 },
];

export function FollowUpPicker({ leadId, current }: { leadId: string; current: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function setFollowUp(iso: string | null) {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/follow-up`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_follow_up_at: iso }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao definir follow-up");
      return;
    }
    toast.success(iso ? "Follow-up agendado" : "Follow-up removido");
    setOpen(false);
    router.refresh();
  }

  function quickDate(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarClock className="h-3.5 w-3.5" />
        {current ? "Reagendar follow-up" : "Agendar follow-up"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_OPTIONS.map((opt) => (
          <Button key={opt.label} size="sm" variant="secondary" loading={loading} onClick={() => setFollowUp(quickDate(opt.days))}>
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          className="h-9 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-accent"
          aria-label="Escolher data e horário do follow-up"
        />
        <Button
          size="sm"
          loading={loading}
          disabled={!customDate}
          onClick={() => setFollowUp(new Date(customDate).toISOString())}
        >
          Definir
        </Button>
      </div>
      <div className="flex justify-between">
        {current && (
          <button
            type="button"
            className="text-xs text-muted hover:text-danger"
            onClick={() => setFollowUp(null)}
            disabled={loading}
          >
            Remover follow-up
          </button>
        )}
        <button type="button" className="ml-auto text-xs text-muted hover:text-foreground" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
