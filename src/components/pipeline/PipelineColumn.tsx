"use client";

import { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { PipelineStage } from "@/types/domain";
import type { LeadRow } from "@/types/database";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PipelineColumn({
  stage,
  leads,
  totalValue,
  children,
}: {
  stage: PipelineStage;
  leads: LeadRow[];
  regionMap: Record<string, string>;
  totalValue?: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${stage}`,
    data: { stage },
  });

  return (
    <div ref={setNodeRef} className="h-full">
      <Card className={`flex h-full min-w-[280px] max-w-[320px] flex-col ${isOver ? "border-accent" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>{PIPELINE_STAGE_LABELS[stage]}</span>
            <span className="text-xs font-normal text-muted">{leads.length}</span>
          </CardTitle>
          {totalValue !== undefined && (
            <div className="mt-1 text-xs text-muted">Total: {currencyFormatter.format(totalValue)}</div>
          )}
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto pt-0">
          {children}
          {leads.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted">
              Nenhum lead
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
