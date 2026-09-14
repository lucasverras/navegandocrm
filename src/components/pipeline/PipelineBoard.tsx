"use client";

import { useMemo, useRef, useState } from "react";
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
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { PipelineCard } from "@/components/pipeline/PipelineCard";
import { PipelineAddLead } from "@/components/pipeline/PipelineAddLead";
import { CloseDealDialog } from "@/components/pipeline/CloseDealDialog";
import { LoseDealDialog } from "@/components/pipeline/LoseDealDialog";
import { ArchivedLeads } from "@/components/pipeline/ArchivedLeads";
import type { LeadRow } from "@/types/database";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types/domain";
import type { PipelineStage, MeetingStatus } from "@/types/domain";

function groupByStage(leads: LeadRow[]): Record<PipelineStage, LeadRow[]> {
  const groups = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as LeadRow[]])) as Record<PipelineStage, LeadRow[]>;
  for (const lead of leads) {
    const stage = (lead.pipeline_stage && groups[lead.pipeline_stage] ? lead.pipeline_stage : "ready_to_approach") as PipelineStage;
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
  messages = {},
}: {
  initialLeads: LeadRow[];
  archivedLeads: LeadRow[];
  regionMap: Record<string, string>;
  messages?: Record<string, string>;
}) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState<PipelineStage>("ready_to_approach");
  const [showArchived, setShowArchived] = useState(false);
  const [pendingClose, setPendingClose] = useState<{ lead: LeadRow; snapshot: LeadRow[] } | null>(null);
  const [pendingLose, setPendingLose] = useState<{ lead: LeadRow; snapshot: LeadRow[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number>(0);

  const [prevInitialLeads, setPrevInitialLeads] = useState(initialLeads);
  if (prevInitialLeads !== initialLeads) {
    setPrevInitialLeads(initialLeads);
    setLeads(initialLeads);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columns = useMemo(() => groupByStage(leads), [leads]);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  // ── Auto-scroll: scroll the board container when dragging near edges ──
  function startAutoScroll(direction: number) {
    stopAutoScroll();
    const el = scrollRef.current;
    if (!el) return;
    const tick = () => {
      el.scrollLeft += direction;
      autoScrollRef.current = requestAnimationFrame(tick);
    };
    autoScrollRef.current = requestAnimationFrame(tick);
  }
  function stopAutoScroll() {
    if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = 0; }
  }
  function handleDragMove(e: { activatorEvent: Event; delta: { x: number; y: number } }) {
    const el = scrollRef.current;
    if (!el || !activeId) return;
    const rect = el.getBoundingClientRect();
    const pointerX = (e.activatorEvent as PointerEvent).clientX + e.delta.x;
    const edgeZone = 80;
    const maxSpeed = 18;
    if (pointerX < rect.left + edgeZone) {
      const ratio = 1 - Math.max(0, pointerX - rect.left) / edgeZone;
      startAutoScroll(-Math.ceil(ratio * maxSpeed));
    } else if (pointerX > rect.right - edgeZone) {
      const ratio = 1 - Math.max(0, rect.right - pointerX) / edgeZone;
      startAutoScroll(Math.ceil(ratio * maxSpeed));
    } else {
      stopAutoScroll();
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as { sortable?: { containerId?: string } } | undefined;
    const overData = over.data.current as { stage?: PipelineStage; sortable?: { containerId?: string } } | undefined;
    const sourceContainer = activeData?.sortable?.containerId;
    const destStage = overData?.sortable?.containerId ?? overData?.stage ?? (typeof over.id === "string" && over.id.startsWith("column-") ? over.id.replace("column-", "") : null);
    if (!sourceContainer || !destStage || sourceContainer === destStage) return;
    setLeads((prev) => {
      const lead = prev.find((l) => l.id === active.id);
      if (!lead || lead.pipeline_stage === destStage) return prev;
      return prev.map((l) => l.id === active.id ? { ...l, pipeline_stage: destStage as PipelineStage } : l);
    });
  }

  async function moveLead(leadId: string, destStage: PipelineStage, destIndex: number) {
    const snapshot = leads;
    const source = leads.find((l) => l.id === leadId);
    if (!source) return;

    const without = leads.filter((l) => l.id !== leadId);
    const destStageItems = without.filter((l) => l.pipeline_stage === destStage);
    const others = without.filter((l) => l.pipeline_stage !== destStage);
    const clampedIndex = Math.max(0, Math.min(destIndex, destStageItems.length));
    destStageItems.splice(clampedIndex, 0, { ...source, pipeline_stage: destStage });
    const reindexed = destStageItems.map((l, i) => ({ ...l, pipeline_position: i }));
    const next = [...others, ...reindexed];

    if (destStage === "closed") {
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
    stopAutoScroll();
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

  function handleDragCancel() {
    setActiveId(null);
    stopAutoScroll();
  }

  async function handleMoveTo(lead: LeadRow, stage: PipelineStage) {
    await moveLead(lead.id, stage, columns[stage].length);
  }

  async function handleFollowUp(lead: LeadRow, days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    const iso = d.toISOString();
    const snapshot = leads;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, next_follow_up_at: iso } : l)));
    try {
      const res = await fetch(`/api/leads/${lead.id}/follow-up`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_follow_up_at: iso }),
      });
      if (!res.ok) throw new Error();
      toast.success(days === 1 ? `${lead.name}: follow-up amanhã` : `${lead.name}: follow-up em ${days} dias`);
    } catch {
      setLeads(snapshot);
      toast.error("Erro ao agendar follow-up");
    }
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
    monthly_fee: number | null;
    commission_type: "legacy_recurring" | "one_time_percentage" | "none";
    commission_percent: number | null;
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

  function handleLose(lead: LeadRow) {
    setPendingLose({ lead, snapshot: leads });
  }

  async function handleLoseConfirm(reason: string) {
    if (!pendingLose) return;
    const { lead, snapshot } = pendingLose;
    setPendingLose(null);
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    try {
      const res = await fetch(`/api/leads/${lead.id}/lose`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("fail");
      toast.success(`${lead.name} marcado como perdido`);
    } catch {
      setLeads(snapshot);
      toast.error("Erro ao marcar como perdido");
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
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scroll-smooth rounded-xl bg-surface-2 p-3 scrollbar-thin"
          >
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage} className={stage === mobileStage ? "block w-full md:w-auto" : "hidden md:block"}>
                <PipelineColumn
                  stage={stage}
                  leads={columns[stage]}
                  regionMap={regionMap}
                  totalValue={stage === "closed" ? closedTotal : undefined}
                  footer={stage !== "closed" ? <PipelineAddLead stage={stage} variant="footer" /> : undefined}
                >
                  <SortableContext items={columns[stage].map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    {columns[stage].map((lead) => (
                      <PipelineCard
                        key={lead.id}
                        lead={lead}
                        regionName={lead.region_id ? regionMap[lead.region_id] : undefined}
                        whatsappMessage={messages[lead.id]}
                        onMoveTo={(s) => handleMoveTo(lead, s)}
                        onMeetingStatusChange={(status) => handleMeetingStatusChange(lead, status)}
                        onLose={() => handleLose(lead)}
                        onFollowUp={(days) => handleFollowUp(lead, days)}
                      />
                    ))}
                  </SortableContext>
                </PipelineColumn>
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeLead ? (
              <div className="rotate-[2deg] scale-105 opacity-90">
                <PipelineCard
                  lead={activeLead}
                  regionName={activeLead.region_id ? regionMap[activeLead.region_id] : undefined}
                  onMoveTo={() => {}}
                  onMeetingStatusChange={() => {}}
                  onLose={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {pendingClose && (
        <CloseDealDialog lead={pendingClose.lead} onCancel={handleCloseCancel} onConfirm={handleCloseConfirm} />
      )}
      {pendingLose && (
        <LoseDealDialog lead={pendingLose.lead} onCancel={() => setPendingLose(null)} onConfirm={handleLoseConfirm} />
      )}
    </div>
  );
}
