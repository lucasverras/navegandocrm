"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { getPreScoreBucket, PRE_SCORE_BUCKET_LABELS } from "@/lib/prescore";
import { CheckCircle2, XCircle, Clock, ExternalLink, Inbox } from "lucide-react";
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
>;

export function SelectionQueue({ leads }: { leads: QueueLead[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(leads);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const current = queue[index];

  async function decide(decision: "approved" | "rejected" | "review_later") {
    if (!current || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/leads/${current.id}/triage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error("Erro ao registrar decisão");
      return;
    }

    setQueue((q) => q.filter((l) => l.id !== current.id));
    if (decision === "approved") toast.success(`${current.name} aprovado — aguardando preparação`);
    router.refresh();
  }

  useHotkeys(
    {
      a: () => decide("approved"),
      x: () => decide("rejected"),
      d: () => decide("review_later"),
      arrowright: () => setIndex((i) => Math.min(i + 1, queue.length - 1)),
      arrowleft: () => setIndex((i) => Math.max(i - 1, 0)),
    },
    [current, submitting, queue.length]
  );

  if (!queue.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-8 w-8" />}
        title="Fila de triagem vazia"
        description="Nenhum estabelecimento aguardando revisão. Rode uma busca em Descobrir."
      />
    );
  }

  const lead = queue[Math.min(index, queue.length - 1)];
  const bucket = getPreScoreBucket(lead.pre_score);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted">
        {index + 1} de {queue.length} — atalhos: <kbd>A</kbd> aprovar, <kbd>X</kbd> descartar, <kbd>D</kbd> ver depois,{" "}
        <kbd>←</kbd>/<kbd>→</kbd> navegar
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">{lead.name}</h2>
              <p className="text-sm text-muted">{lead.category}</p>
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
              <div className="text-xs text-muted">Telefone</div>
              <div>{lead.phone ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Site</div>
              <div>{lead.website ? "Sim" : "—"}</div>
            </div>
          </div>

          <p className="text-sm text-muted">{lead.address}</p>

          {lead.maps_url && (
            <a
              href={lead.maps_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-sm text-accent-2 hover:underline"
            >
              Ver no Google Maps <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => decide("approved")} loading={submitting}>
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
            <Button variant="danger" onClick={() => decide("rejected")} loading={submitting}>
              <XCircle className="h-4 w-4" /> Descartar
            </Button>
            <Button variant="secondary" onClick={() => decide("review_later")} loading={submitting}>
              <Clock className="h-4 w-4" /> Ver depois
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
