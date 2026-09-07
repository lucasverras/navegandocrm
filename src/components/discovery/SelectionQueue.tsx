"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadQuickActions } from "@/components/leads/LeadQuickActions";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { getPreScoreBucket, PRE_SCORE_BUCKET_LABELS } from "@/lib/prescore";
import { categoryLabel } from "@/types/domain";
import { CheckCircle2, XCircle, Clock, Inbox, Undo2 } from "lucide-react";
import type { LeadRow } from "@/types/database";

type QueueLead = Pick<
  LeadRow,
  | "id"
  | "name"
  | "category"
  | "address"
  | "phone"
  | "website"
  | "google_rating"
  | "google_review_count"
  | "price_level"
  | "maps_url"
  | "pre_score"
  | "instagram"
  | "instagram_handle"
  | "instagram_url"
  | "discovery_campaign_id"
>;

type Decision = "approved" | "rejected" | "review_later";

const DECISION_LABEL: Record<Decision, string> = {
  approved: "aprovado",
  rejected: "descartado",
  review_later: "adiado",
};

// Quick, structured reasons for a discard — one click each. "rede" also unlocks a
// "block similar chains" suggestion so the queue learns from the operator (§ aprender com descartes).
const REJECT_REASONS: { code: string; label: string }[] = [
  { code: "rede", label: "Rede/franquia" },
  { code: "nao_restaurante", label: "Não é restaurante" },
  { code: "pequeno", label: "Pequeno demais" },
  { code: "perfil_ruim", label: "Perfil ruim" },
  { code: "ja_cliente", label: "Já tem relação" },
  { code: "nao_quero", label: "Não quero" },
];

function priceLabel(level: number | null): string | null {
  if (level == null) return null;
  if (level <= 0) return null;
  return "$".repeat(Math.min(4, level));
}

export function SelectionQueue({ leads }: { leads: QueueLead[] }) {
  // Fully local, optimistic queue — decisions never trigger a server refetch. `total` and
  // `done` drive the progress counter; `history` powers undo (the whole card comes back).
  const [queue, setQueue] = useState(leads);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);
  const total = leads.length;
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<{ lead: QueueLead; at: number; decision: Decision }[]>([]);

  async function patchTriage(id: string, decision: Decision | "pending_review", reason?: string) {
    return fetch(`/api/leads/${id}/triage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, ...(reason ? { rejection_reason: reason } : {}) }),
    });
  }

  async function excludeFranchises(campaignId: string) {
    const res = await fetch(`/api/discovery-campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude_franchises: true, exclude_chains: true }),
    });
    if (res.ok) toast.success("Grandes redes bloqueadas nas próximas buscas desta campanha");
    else toast.error("Não foi possível atualizar a campanha");
  }

  async function decide(decision: Decision, reason?: string) {
    const current = queue[index];
    if (!current || submitting) return;
    setSubmitting(true);

    // Optimistic: drop the card and advance immediately.
    const at = index;
    setQueue((q) => q.filter((l) => l.id !== current.id));
    setIndex((i) => Math.min(i, Math.max(0, queue.length - 2)));
    setDone((d) => d + 1);

    const res = await patchTriage(current.id, decision, reason);
    setSubmitting(false);

    if (!res.ok) {
      // Roll back the optimistic removal.
      setQueue((q) => {
        const next = [...q];
        next.splice(at, 0, current);
        return next;
      });
      setIndex(at);
      setDone((d) => Math.max(0, d - 1));
      toast.error("Erro ao registrar decisão");
      return;
    }

    setHistory((h) => [...h, { lead: current, at, decision }]);

    // Learning suggestion: discarding a chain offers to block chains for the whole campaign.
    // Never auto-applies — always a confirmed, one-click action (§ nunca aplicar regra sem confirmação).
    if (decision === "rejected" && reason === "rede" && current.discovery_campaign_id) {
      const campaignId = current.discovery_campaign_id;
      toast(`${current.name} descartado`, {
        description: "Bloquear grandes redes nesta campanha?",
        action: { label: "Bloquear", onClick: () => excludeFranchises(campaignId) },
      });
      return;
    }

    toast(`${current.name} ${DECISION_LABEL[decision]}`, {
      action: { label: "Desfazer", onClick: () => undo(current.id) },
    });
  }

  async function undo(leadId?: string) {
    const last = leadId ? history.findLast((h) => h.lead.id === leadId) : history[history.length - 1];
    if (!last) return;

    setHistory((h) => h.filter((x) => x !== last));
    setQueue((q) => {
      if (q.some((l) => l.id === last.lead.id)) return q;
      const next = [...q];
      next.splice(Math.min(last.at, next.length), 0, last.lead);
      return next;
    });
    setIndex(Math.min(last.at, queue.length));
    setDone((d) => Math.max(0, d - 1));

    const res = await patchTriage(last.lead.id, "pending_review");
    if (!res.ok) toast.error("Não foi possível desfazer");
  }

  useHotkeys(
    {
      a: () => decide("approved"),
      x: () => decide("rejected"),
      d: () => decide("review_later"),
      arrowright: () => setIndex((i) => Math.min(i + 1, queue.length - 1)),
      arrowleft: () => setIndex((i) => Math.max(i - 1, 0)),
      u: () => undo(),
    },
    [queue, index, submitting, history]
  );

  if (!queue.length) {
    return (
      <div className="flex flex-col gap-4">
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => undo()}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <Undo2 className="h-4 w-4" /> Desfazer última decisão
          </button>
        )}
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="Fila de triagem vazia"
          description="Nenhum estabelecimento aguardando revisão. Rode uma busca em Descobrir."
        />
      </div>
    );
  }

  const lead = queue[Math.min(index, queue.length - 1)];
  const bucket = getPreScoreBucket(lead.pre_score);
  const price = priceLabel(lead.price_level);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          <span className="font-semibold text-foreground">{done}</span> / {total} revisados
          {" · "}
          {queue.length} na fila
        </span>
        <span className="hidden sm:block">
          <kbd>A</kbd> aprovar · <kbd>X</kbd> descartar · <kbd>D</kbd> depois · <kbd>U</kbd> desfazer ·{" "}
          <kbd>←</kbd>/<kbd>→</kbd>
        </span>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">{lead.name}</h2>
              <p className="text-sm text-muted">{categoryLabel(lead.category)}</p>
            </div>
            <Badge tone={bucket === "strong" || bucket === "exceptional" ? "success" : bucket === "weak" ? "muted" : "warning"}>
              Pré {lead.pre_score} · {PRE_SCORE_BUCKET_LABELS[bucket]}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-foreground sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted">Nota</div>
              <div>{lead.google_rating ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Avaliações</div>
              <div>{lead.google_review_count ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Preço</div>
              <div>{price ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Telefone</div>
              <div>{lead.phone ?? "—"}</div>
            </div>
          </div>

          <p className="text-sm text-muted">{lead.address}</p>

          <LeadQuickActions lead={lead} className="pt-1" />

          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => decide("approved")} disabled={submitting}>
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
            <Button variant="danger" onClick={() => decide("rejected")} disabled={submitting}>
              <XCircle className="h-4 w-4" /> Descartar
            </Button>
            <Button variant="secondary" onClick={() => decide("review_later")} disabled={submitting}>
              <Clock className="h-4 w-4" /> Ver depois
            </Button>
            {history.length > 0 && (
              <Button variant="ghost" onClick={() => undo()} disabled={submitting}>
                <Undo2 className="h-4 w-4" /> Desfazer
              </Button>
            )}
          </div>

          {/* Descarte com motivo — um clique, opcional. O X acima descarta sem motivo. */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted">Descartar por motivo:</span>
            {REJECT_REASONS.map((r) => (
              <button
                key={r.code}
                type="button"
                disabled={submitting}
                onClick={() => decide("rejected", r.code)}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
              >
                {r.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
