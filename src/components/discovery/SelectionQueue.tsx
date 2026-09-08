"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadQuickActions, instagramUrl } from "@/components/leads/LeadQuickActions";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { categoryLabel } from "@/types/domain";
import { CheckCircle2, XCircle, Clock, Inbox, Undo2, Star } from "lucide-react";
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
  | "photo_name"
>;

type Decision = "approved" | "rejected" | "review_later";

const DECISION_LABEL: Record<Decision, string> = {
  approved: "selecionado",
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
  if (level == null || level <= 0) return null;
  return "$".repeat(Math.min(4, level));
}

// O Tinder do Radar (V6 §20-23): decisão em 2-4 segundos, um restaurante por vez.
// Selecionar salva, avança na hora e dispara a preparação em background — nunca bloqueia.
export function SelectionQueue({ leads }: { leads: QueueLead[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(leads);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);
  const total = leads.length;
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<{ lead: QueueLead; at: number; decision: Decision }[]>([]);
  // Background preparations run one at a time (AI rate limits) without ever blocking triage.
  const prepChain = useRef<Promise<void>>(Promise.resolve());

  async function patchTriage(id: string, decision: Decision | "pending_review", reason?: string) {
    return fetch(`/api/leads/${id}/triage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, ...(reason ? { rejection_reason: reason } : {}) }),
    });
  }

  // Selecionar → preparar sem burocracia (§23): Instagram → análise → decisor → mensagem,
  // tudo em background, com um toast no final. Falha vira "parcial", nunca um bloqueio.
  function queueBackgroundPrep(lead: QueueLead) {
    prepChain.current = prepChain.current.then(async () => {
      try {
        await fetch(`/api/leads/${lead.id}/instagram`, { method: "POST" }).catch(() => null);
        const aRes = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: [lead.id] }),
        });
        await fetch(`/api/leads/${lead.id}/decision-maker`, { method: "POST" }).catch(() => null);
        const mRes = await fetch(`/api/leads/${lead.id}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const ready = aRes.ok && mRes.ok;
        await fetch(`/api/leads/${lead.id}/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: ready ? "mark_ready" : "mark_partial",
            next_best_action: ready ? "Revisar mensagem e abordar" : "Completar manualmente",
          }),
        });
        if (ready) toast.success(`${lead.name} preparado — pronto para abordar`);
        else toast.warning(`${lead.name}: preparação parcial — finalize em Selecionados`);
        router.refresh();
      } catch {
        toast.warning(`${lead.name}: preparação falhou — finalize em Selecionados`);
      }
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

    if (decision === "approved") {
      queueBackgroundPrep(current);
    }

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

  const lead = queue.length ? queue[Math.min(index, queue.length - 1)] : null;

  function openExternal(url: string | null | undefined) {
    if (url) window.open(url, "_blank", "noopener");
  }

  useHotkeys(
    {
      a: () => decide("approved"),
      ArrowRight: () => decide("approved"),
      x: () => decide("rejected"),
      ArrowLeft: () => decide("rejected"),
      d: () => decide("review_later"),
      u: () => undo(),
      i: () => openExternal(lead ? instagramUrl(lead) : null),
      w: () => openExternal(lead?.phone ? buildWhatsAppLink(lead.phone, "") : null),
      g: () => openExternal(lead?.maps_url),
    },
    [queue, index, submitting, history]
  );

  if (!lead) {
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

  const price = priceLabel(lead.price_level);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          <span className="font-semibold text-foreground">{done}</span> / {total} revisados
          {" · "}
          {queue.length} na fila
        </span>
        <span className="hidden sm:block text-xs">
          <kbd>A</kbd>/<kbd>→</kbd> selecionar · <kbd>X</kbd>/<kbd>←</kbd> descartar · <kbd>D</kbd> depois · <kbd>U</kbd> desfazer ·{" "}
          <kbd>I</kbd> instagram · <kbd>W</kbd> whatsapp · <kbd>G</kbd> maps
        </span>
      </div>

      <Card className="max-w-2xl overflow-hidden">
        {lead.photo_name && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/places/photo?name=${encodeURIComponent(lead.photo_name)}`}
            alt={lead.name}
            loading="lazy"
            className="h-56 w-full bg-surface-2 object-cover"
          />
        )}
        <CardContent className="flex flex-col gap-3 p-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">{lead.name}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span>{categoryLabel(lead.category)}</span>
              {lead.google_rating != null && (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  {lead.google_rating}
                  {lead.google_review_count != null && <span className="text-muted">({lead.google_review_count})</span>}
                </span>
              )}
              {price && <span>{price}</span>}
              {lead.phone && <span className="tabular-nums">{lead.phone}</span>}
            </p>
            {lead.address && <p className="mt-1 text-xs text-muted">{lead.address}</p>}
          </div>

          <LeadQuickActions lead={lead} className="pt-1" />

          <div className="mt-1 flex flex-wrap gap-2">
            <Button onClick={() => decide("approved")} disabled={submitting}>
              <CheckCircle2 className="h-4 w-4" /> Selecionar
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
