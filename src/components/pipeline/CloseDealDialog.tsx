"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { LeadRow } from "@/types/database";

export function CloseDealDialog({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: LeadRow;
  onCancel: () => void;
  onConfirm: (payload: {
    closed_service: string;
    closed_value: number | null;
    closed_note: string | null;
    monthly_fee: number | null;
    commission_type: "legacy_recurring" | "one_time_percentage" | "none";
    commission_percent: number | null;
  }) => void;
}) {
  const [service, setService] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [commissionType, setCommissionType] = useState<"legacy_recurring" | "one_time_percentage" | "none">(
    "one_time_percentage"
  );
  const [commissionPercent, setCommissionPercent] = useState("20");
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();

  const canSubmit = service.trim().length > 0;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, submitting]);

  function handleConfirm() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const monthly = value.trim() ? Number(value) : null;
    onConfirm({
      closed_service: service.trim(),
      closed_value: monthly,
      closed_note: note.trim() ? note.trim() : null,
      monthly_fee: monthly,
      commission_type: commissionType,
      commission_percent:
        commissionType === "none" ? null : commissionType === "legacy_recurring" ? 10 : commissionPercent.trim() ? Number(commissionPercent) : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold text-foreground">Fechar negócio</h2>
        <p className="mt-1 text-sm text-muted">
          Confirme os detalhes do fechamento para <span className="text-foreground">{lead.name}</span>.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground">Serviço contratado *</span>
            <input
              autoFocus
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              placeholder="Ex: Gestão de redes sociais"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground">Mensalidade (R$)</span>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              placeholder="Ex: 4000"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-foreground">Comissão</span>
              <select
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value as typeof commissionType)}
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="one_time_percentage">Pontual (% de 1 mensalidade)</option>
                <option value="legacy_recurring">Legado (10% recorrente)</option>
                <option value="none">Nenhuma</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-foreground">Percentual</span>
              <input
                type="number"
                value={commissionType === "legacy_recurring" ? "10" : commissionPercent}
                disabled={commissionType !== "one_time_percentage"}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
                placeholder="20"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground">Observação (opcional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit} loading={submitting}>
            Confirmar fechamento
          </Button>
        </div>
      </div>
    </div>
  );
}
