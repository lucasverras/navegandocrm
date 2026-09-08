"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, X } from "lucide-react";
import { LeadQuickActions, instagramUrl } from "@/components/leads/LeadQuickActions";
import { AddToPipelineButton } from "@/components/leads/AddToPipelineButton";
import { WhatsAppButton } from "@/components/leads/WhatsAppButton";
import { eventLabel } from "@/lib/event-labels";
import { formatDate, formatHumanDate, daysFromNow } from "@/lib/utils";
import { BRL } from "@/lib/finance";
import { categoryLabel, nextActionLabel, PIPELINE_STAGE_LABELS } from "@/types/domain";

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
    notes: string | null;
    next_follow_up_at: string | null;
    next_action_type: string | null;
    next_action_at: string | null;
    meeting_at: string | null;
    meeting_link: string | null;
    meeting_note: string | null;
    proposal_value: number | null;
    proposal_note: string | null;
    proposal_sent_at: string | null;
    regions: { neighborhood: string; city: string } | null;
  };
  decisionMaker: { name: string | null; role: string | null; confidence: number } | null;
  latestMessage: { content: string; variant: string } | null;
  analysis: { main_opportunity: string | null; opportunity_focus: string | null } | null;
  events: { id: string; event_type: string; metadata: Record<string, unknown> | null; created_at: string }[];
};

const FOLLOW_UP_CHOICES = [
  { days: 1, label: "Amanhã" },
  { days: 2, label: "D+2" },
  { days: 5, label: "D+5" },
  { days: 10, label: "D+10" },
];

// O lead drawer (V6 §50): clique em lead abre isto — nunca uma página gigante. Cabeçalho com
// nome/telefone/WhatsApp/Instagram e seções: próxima ação, notas, decisor, mensagem, reunião,
// proposta e timeline. Aberto de qualquer lugar via CustomEvent("open-lead-drawer").
export function LeadDrawer() {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const loading = leadId != null && data == null;

  const close = useCallback(() => {
    setLeadId(null);
    setData(null);
    setNotesDraft(null);
  }, []);

  // Re-fetches the summary after a mutation (follow-up, nota) without closing the drawer.
  const reload = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ leadId: string }>).detail?.leadId;
      if (id) {
        setData(null);
        setNotesDraft(null);
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
        if (!cancelled && d.lead) {
          setData(d);
          setNotesDraft(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshTick]);

  if (!leadId) return null;
  const lead = data?.lead;
  const handle = lead ? (lead.instagram_handle ?? lead.instagram)?.replace(/^@/, "") : null;
  const igUrl = lead ? instagramUrl(lead) : null;
  const actionDays = lead?.next_action_at ? daysFromNow(lead.next_action_at) : null;
  const actionOverdue = actionDays != null && actionDays < 0;

  async function setFollowUp(days: number) {
    if (!lead) return;
    setBusy("followup");
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    const res = await fetch(`/api/leads/${lead.id}/follow-up`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_follow_up_at: d.toISOString() }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return void toast.error("Erro ao agendar follow-up");
    toast.success(days === 1 ? "Follow-up amanhã" : `Follow-up em ${days} dias`);
    reload();
  }

  async function saveNotes() {
    if (!lead || notesDraft == null) return;
    setBusy("notes");
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return void toast.error("Erro ao salvar nota");
    toast.success("Nota salva");
    reload();
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex justify-end bg-black/50" onClick={close}>
      <aside
        className="animate-slide-in-right flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho: nome, telefone, WhatsApp, Instagram (§50). */}
        <div className="sticky top-0 z-10 border-b border-border bg-surface/95 p-5 pb-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {lead ? (
                <>
                  <h2 className="truncate font-display text-xl font-bold text-foreground">{lead.name}</h2>
                  <p className="text-xs text-muted">
                    {categoryLabel(lead.category)}
                    {lead.regions ? ` · ${lead.regions.neighborhood}` : ""}
                    {lead.pipeline_stage
                      ? ` · ${PIPELINE_STAGE_LABELS[lead.pipeline_stage as keyof typeof PIPELINE_STAGE_LABELS] ?? lead.pipeline_stage}`
                      : ""}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm">
                    {lead.phone && <span className="tabular-nums text-foreground">{lead.phone}</span>}
                    {handle && igUrl && (
                      <a href={igUrl} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
                        @{handle}
                      </a>
                    )}
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
          {lead && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {lead.phone && <WhatsAppButton phone={lead.phone} message={data?.latestMessage?.content ?? ""} />}
              <LeadQuickActions lead={lead} />
              {!lead.pipeline_stage && <AddToPipelineButton leadId={lead.id} />}
            </div>
          )}
        </div>

        {loading && !lead && <p className="p-5 text-sm text-muted">Carregando…</p>}

        {lead && (
          <div className="flex flex-col gap-5 p-5">
            {/* Próxima ação — a pergunta que todo lead ativo responde. */}
            <Section title="Próxima ação">
              <p className={`text-sm ${actionOverdue ? "font-medium text-danger" : "text-foreground"}`}>
                {lead.next_action_type ? (
                  <>
                    {nextActionLabel(lead.next_action_type)}
                    {lead.next_action_at && ` · ${formatHumanDate(lead.next_action_at)}`}
                    {actionOverdue && " (atrasado)"}
                  </>
                ) : (
                  <span className="text-muted">Nenhuma — defina um follow-up:</span>
                )}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {FOLLOW_UP_CHOICES.map((c) => (
                  <button
                    key={c.days}
                    type="button"
                    disabled={busy === "followup"}
                    onClick={() => setFollowUp(c.days)}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent-2 disabled:opacity-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Section>

            {data?.analysis?.main_opportunity && (
              <Section title="Oportunidade">
                <p className="text-sm text-foreground/90">{data.analysis.main_opportunity}</p>
              </Section>
            )}

            <Section title="Decisor">
              <p className="text-sm">
                {data?.decisionMaker?.name
                  ? `${data.decisionMaker.name}${data.decisionMaker.role ? ` · ${data.decisionMaker.role}` : ""}`
                  : "Não confirmado"}
              </p>
            </Section>

            {data?.latestMessage && (
              <Section title="Mensagem">
                <p className="whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-sm leading-relaxed">
                  {data.latestMessage.content}
                </p>
              </Section>
            )}

            {lead.meeting_at && (
              <Section title="Reunião">
                <p className="text-sm text-foreground">
                  {formatDate(lead.meeting_at)}
                  {lead.meeting_link && (
                    <>
                      {" · "}
                      <a href={lead.meeting_link} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
                        Meet
                      </a>
                    </>
                  )}
                </p>
                {lead.meeting_note && <p className="mt-0.5 text-xs text-muted">{lead.meeting_note}</p>}
              </Section>
            )}

            {lead.proposal_sent_at && (
              <Section title="Proposta">
                <p className="text-sm tabular-nums text-foreground">
                  {lead.proposal_value != null ? `${BRL.format(lead.proposal_value)}/mês` : "Sem valor"}
                  <span className="text-muted"> · enviada {formatHumanDate(lead.proposal_sent_at)}</span>
                </p>
                {lead.proposal_note && <p className="mt-0.5 text-xs text-muted">{lead.proposal_note}</p>}
              </Section>
            )}

            <Section title="Notas">
              <textarea
                rows={3}
                value={notesDraft ?? lead.notes ?? ""}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Anote algo sobre este lead…"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
              />
              {notesDraft != null && notesDraft !== (lead.notes ?? "") && (
                <button
                  type="button"
                  disabled={busy === "notes"}
                  onClick={saveNotes}
                  className="mt-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-2 disabled:opacity-50"
                >
                  {busy === "notes" ? "Salvando…" : "Salvar nota"}
                </button>
              )}
            </Section>

            {data && data.events.length > 0 && (
              <Section title="Timeline">
                <ul className="flex flex-col gap-1.5">
                  {data.events.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-foreground/80">{eventLabel(e.event_type, e.metadata)}</span>
                      <span className="shrink-0 tabular-nums text-muted">{formatHumanDate(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Link
              href={`/leads/${lead.id}`}
              onClick={close}
              className="inline-flex w-fit items-center gap-1 text-sm text-accent-2 hover:underline"
            >
              Abrir página completa →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{title}</p>
      {children}
    </div>
  );
}

// Text trigger — renders like a link but opens the drawer (used on demand rows, lists, cards).
export function LeadDrawerLink({ leadId, children, className }: { leadId: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("open-lead-drawer", { detail: { leadId } }));
      }}
      className={className ?? "truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-accent-2"}
    >
      {children}
    </button>
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
      className={className ?? "inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-2 text-muted transition-all hover:bg-surface-hover hover:text-foreground active:scale-90"}
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}
