"use client";

import { useId } from "react";
import type { LeadRow } from "@/types/database";

const REASONS = [
  "Sem interesse",
  "Já tem agência",
  "Preço",
  "Sem orçamento",
  "Momento ruim",
  "Não respondeu",
  "Não cheguei ao decisor",
  "Concorrente",
  "Contato errado",
  "Outro",
];

// Reason picker shown when a lead is marked as lost.
export function LoseDealDialog({ lead, onCancel, onConfirm }: { lead: LeadRow; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const titleId = useId();
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="animate-scale-in w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-lg font-bold text-foreground">
          Perder {lead.name}?
        </h2>
        <p className="mt-1 text-sm text-muted">Escolha o motivo — o lead sai do board mas fica no histórico.</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onConfirm(r)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger hover:text-danger"
            >
              {r}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-foreground">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
