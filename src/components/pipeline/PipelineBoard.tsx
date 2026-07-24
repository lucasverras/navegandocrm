"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { PipelineCard } from "@/components/pipeline/PipelineCard";
import { CloseDealDialog } from "@/components/pipeline/CloseDealDialog";
import { ArchivedLeads } from "@/components/pipeline/ArchivedLeads";
import type { LeadRow } from "@/types/database";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { PipelineStage, MeetingStatus } from "@/types/domain";

function groupByStage(leads: LeadRow[]): Record<PipelineStage, LeadRow[]> {
  const groups = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as LeadRow[]])) as Record<
    PipelineStage,
    LeadRow[]
  >;
  for (const lead of leads) {
    const stage = (groups[lead.pipeline_stage] ? lead.pipeline_stage : "new") as PipelineStage;
    groups[stage].push(lead);
  }
  for (const stage of PIPELINE_STAGES) {
    groups[stage].sort((a, b) => a.pipeline_position - b.pipeline_position);
  }
  return groups;
}

export function PipelineBoard({
  initialLeads,
  archivedLeads,
  regionMap,
}: {
  initialLeads: LeadRow[];
  archivedLeads: LeadRow[];
  regionMap: Record<string, string>;
}) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState<PipelineStage>("new");
  const [showArchived, setShowArchived] = useState(false);
  const [pendingClose, setPendingClose] = useState<{ lead: LeadRow; snapshot: LeadRow[] } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columns = useMemo(() => groupByStage(leads), [leads]);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function moveLead(leadId: string, destStage: PipelineStage, destIndex: number) {
    const snapshot = leads;

    const source = leads.find((l) => l.id === leadId);
    if (!source) return;

    // Build the new flat array with the lead removed and reinserted.
    const without = leads.filter((l) => l.id !== leadId);
    const destStageItems = without.filter((l) => l.pipeline_stage === destStage);
    const others = without.filter((l) => l.pipeline_stage !== destStage);
    const clampedIndex = Math.max(0, Math.min(destIndex, destStageItems.length));
    destStageItems.splice(clampedIndex, 0, { ...source, pipeline_stage: destStage });
    const reindexed = destStageItems.map((l, i) => ({ ...l, pipeline_position: i }));
    const next = [...others, ...reindexed];

    if (destStage === "closed") {
      // Optimistic move into the closed column visually, but hold the API call
      // until the confirmation dialog resolves.
      setLeads(next);
      setPendingClose({ lead: { ...source, pipeline_stage: destStage }, snapshot });
      return;
    }

    setLeads(next);

    try {
      const res = await fetch(`/api/leads/${leadId}/pipeline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: destStage, position: clampedIndex }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao mover lead");
      }
    } catch (err) {
      setLeads(snapshot);
      toast.error(err instanceof Error ? err.message : "Erro ao mover lead");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeLead = leads.find((l) => l.id === active.id);
    if (!activeLead) return;

    let destStage: PipelineStage;
    let destIndex: number;

    const overData = over.data.current as { stage?: PipelineStage } | undefined;
    if (overData?.stage) {
      destStage = overData.stage;
      const stageItems = columns[destStage];
      const overIndex = stageItems.findIndex((l) => l.id === over.id);
      destIndex = overIndex >= 0 ? overIndex : stageItems.length;
    } else if (typeof over.id === "string" && over.id.startsWith("column-")) {
      destStage = over.id.replace("column-", "") as PipelineStage;
      destIndex = columns[destStage].length;
    } else {
      return;
    }

    if (destStage === activeLead.pipeline_stage) {
      const stageItems = columns[destStage];
      const oldIndex = stageItems.findIndex((l) => l.id === active.id);
      if (oldIndex === destIndex) return;
    }

    moveLead(String(active.id), destStage, destIndex);
  }

  async function handleMoveTo(lead: LeadRow, stage: PipelineStage) {
    const destIndex = columns[stage].length;
    await moveLead(lead.id, stage, destIndex);
  }

  async function handleMeetingStatusChange(lead: LeadRow, status: MeetingStatus) {
    const snapshot = leads;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, meeting_status: status } : l)));
    try {
      const res = await fetch(`/api/leads/${lead.id}/meeting-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_status: status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao atualizar status da reunião");
      }
      toast.success("Status da reunião atualizado");
    } catch (err) {
      setLeads(snapshot);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status da reunião");
    }
  }

  function handleCloseCancel() {
    if (!pendingClose) return;
    setLeads(pendingClose.snapshot);
    setPendingClose(null);
  }

  async function handleCloseConfirm(payload: {
    closed_service: string;
    closed_value: number | null;
    closed_note: string | null;
  }) {
    if (!pendingClose) return;
    const { lead, snapshot } = pendingClose;
    try {
      const res = await fetch(`/api/leads/${lead.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao fechar negócio");
      }
      toast.success("Negócio fechado com sucesso");
      setPendingClose(null);
    } catch (err) {
      setLeads(snapshot);
      toast.error(err instanceof Error ? err.message : "Erro ao fechar negócio");
      setPendingClose(null);
    }
  }

  const closedTotal = columns.closed.reduce((sum, l) => sum + (l.closed_value ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={mobileStage}
          onChange={(e) => setMobileStage(e.target.value as PipelineStage)}
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground md:hidden"
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {PIPELINE_STAGE_LABELS[s]} ({columns[s].length})
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)} className="ml-auto">
          {showArchived ? "Ver pipeline" : `Ver arquivados (${archivedLeads.length})`}
        </Button>
      </div>

      {showArchived ? (
        <ArchivedLeads leads={archivedLeads} regionMap={regionMap} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage} className={stage === mobileStage ? "block w-full md:w-auto" : "hidden md:block"}>
                <PipelineColumn
                  stage={stage}
                  leads={columns[stage]}
                  regionMap={regionMap}
                  totalValue={stage === "closed" ? closedTotal : undefined}
                >
                  <SortableContext items={columns[stage].map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    {columns[stage].map((lead) => (
                      <PipelineCard
                        key={lead.id}
                        lead={lead}
                        regionName={regionMap[lead.region_id]}
                        onMoveTo={(s) => handleMoveTo(lead, s)}
                        onMeetingStatusChange={(status) => handleMeetingStatusChange(lead, status)}
                      />
                    ))}
                  </SortableContext>
                </PipelineColumn>
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeLead ? (
              <PipelineCard
                lead={activeLead}
                regionName={regionMap[activeLead.region_id]}
                onMoveTo={() => {}}
                onMeetingStatusChange={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {pendingClose && (
        <CloseDealDialog lead={pendingClose.lead} onCancel={handleCloseCancel} onConfirm={handleCloseConfirm} />
      )}
    </div>
  );
}
