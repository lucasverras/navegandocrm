"use client";

import { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { PipelineStage } from "@/types/domain";
import type { LeadRow } from "@/types/database";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Trello-light column: narrow, quiet background (not a heavy bordered card), sticky header,
// discreet counter, and a small "Nenhum lead" line when empty (no giant dashed box).
export function PipelineColumn({
  stage,
  leads,
  totalValue,
  children,
  footer,
}: {
  stage: PipelineStage;
  leads: LeadRow[];
  regionMap: Record<string, string>;
  totalValue?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}`, data: { stage } });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-[264px] shrink-0 flex-col rounded-lg border transition-all ${
        isOver
          ? "border-accent/60 bg-accent-soft/30 ring-2 ring-accent/30"
          : "border-border/60 bg-surface-2/70"
      }`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-lg border-b border-border/40 bg-surface-2 px-3 py-2.5">
        <span className="text-[13px] font-semibold text-foreground">{PIPELINE_STAGE_LABELS[stage]}</span>
        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] tabular-nums text-muted">{leads.length}</span>
      </div>
      {totalValue !== undefined && totalValue > 0 && (
        <div className="px-3 pb-1 text-[11px] tabular-nums text-muted">{currencyFormatter.format(totalValue)}</div>
      )}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 pt-1">
        {children}
        {leads.length === 0 && !footer && <p className="px-1 py-4 text-center text-xs text-muted/70">Nenhum lead</p>}
        {footer}
      </div>
    </div>
  );
}
