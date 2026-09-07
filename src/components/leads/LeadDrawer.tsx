"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Eye, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LeadQuickActions } from "@/components/leads/LeadQuickActions";
import { WhatsAppButton } from "@/components/leads/WhatsAppButton";
import { categoryLabel, PIPELINE_STAGE_LABELS } from "@/types/domain";

type Summary = {
  lead: {
    id: string;
    name: string;
    category: string | null;
    phone: string | null;
    website: string | null;
    instagram: string | null;
    instagram_handle: string | null;
    instagram_url: string | null;
    maps_url: string | null;
    google_rating: number | null;
    google_review_count: number | null;
    ai_score: number | null;
    pre_score: number;
    pipeline_stage: string | null;
    regions: { neighborhood: string; city: string } | null;
  };
  decisionMaker: { name: string | null; role: string | null; confidence: number } | null;
  latestMessage: { content: string; variant: string } | null;
  analysis: { main_opportunity: string | null; opportunity_focus: string | null } | null;
};

// Global side-drawer preview so the operator rarely needs the full lead page.
// Open from anywhere: window.dispatchEvent(new CustomEvent("open-lead-drawer", { detail: { leadId } })).
export function LeadDrawer() {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const loading = leadId != null && data == null;

  const close = useCallback(() => {
    setLeadId(null);
    setData(null);
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ leadId: string }>).detail?.leadId;
      if (id) {
        setData(null);
        setLeadId(id);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("open-lead-drawer", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-lead-drawer", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d.lead ? d : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (!leadId) return null;
  const lead = data?.lead;
  const score = lead ? lead.ai_score ?? lead.pre_score : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={close}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {lead ? (
              <>
                <h2 className="font-display text-xl font-bold text-foreground">{lead.name}</h2>
                <p className="text-sm text-muted">
                  {categoryLabel(lead.category)}
                  {lead.regions ? ` · ${lead.regions.neighborhood}` : ""}
                </p>
              </>
            ) : (
              <div className="h-6 w-40 animate-pulse rounded bg-surface-2" />
            )}
          </div>
          <button type="button" onClick={close} aria-label="Fechar" className="rounded p-1 text-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && !lead && <p className="text-sm text-muted">Carregando…</p>}

        {lead && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <LeadQuickActions lead={lead} />
              {lead.phone && data?.latestMessage && (
                <WhatsAppButton phone={lead.phone} message={data.latestMessage.content} />
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={score != null && score >= 70 ? "success" : score != null && score >= 40 ? "warning" : "muted"}>
                Score {score}
              </Badge>
              {lead.pipeline_stage && <Badge tone="accent">{PIPELINE_STAGE_LABELS[lead.pipeline_stage as keyof typeof PIPELINE_STAGE_LABELS]}</Badge>}
              {lead.google_rating != null && (
                <Badge tone="muted">
                  ★ {lead.google_rating} ({lead.google_review_count ?? 0})
                </Badge>
              )}
            </div>

            {data?.analysis?.main_opportunity && (
              <div>
                <p className="text-xs text-muted">Oportunidade</p>
                <p className="text-sm text-foreground/90">{data.analysis.main_opportunity}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted">Decisor</p>
              <p className="text-sm">
                {data?.decisionMaker?.name
                  ? `${data.decisionMaker.name}${data.decisionMaker.role ? ` · ${data.decisionMaker.role}` : ""}`
                  : "Não confirmado"}
              </p>
            </div>

            {data?.latestMessage && (
              <div>
                <p className="text-xs text-muted">Última mensagem</p>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-sm">
                  {data.latestMessage.content}
                </p>
              </div>
            )}

            <Link
              href={`/leads/${lead.id}`}
              onClick={close}
              className="mt-1 inline-flex w-fit items-center gap-1 text-sm text-accent-2 hover:underline"
            >
              Abrir página completa →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

// Eye button that opens the preview drawer for a lead.
export function LeadPreviewTrigger({ leadId, className }: { leadId: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-lead-drawer", { detail: { leadId } }));
      }}
      title="Pré-visualizar"
      aria-label="Pré-visualizar lead"
      className={className ?? "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"}
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}
