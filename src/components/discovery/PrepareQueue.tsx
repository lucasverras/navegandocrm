"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { categoryLabel } from "@/types/domain";
import { Sparkles, ExternalLink, Zap, Check, AlertTriangle } from "lucide-react";
import type { LeadRow } from "@/types/database";

type PrepLead = Pick<
  LeadRow,
  "id" | "name" | "category" | "preparation_status" | "instagram" | "ai_score" | "pre_score"
> & { hasDecisionMaker: boolean; hasMessage: boolean };

type PrepState = { phase: "idle" | "running" | "ready" | "needs_help"; step?: string };

export function PrepareQueue({ leads }: { leads: PrepLead[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, PrepState>>({});
  const [batchRunning, setBatchRunning] = useState(false);

  function setPhase(id: string, s: PrepState) {
    setState((prev) => ({ ...prev, [id]: s }));
  }

  // "Preparar todos" — runs the chain for each not-yet-ready lead, one at a time (a simple
  // sequential queue keeps the UI responsive and avoids hammering the AI rate limits).
  async function prepareAll() {
    setBatchRunning(true);
    for (const lead of leads) {
      if (state[lead.id]?.phase === "ready") continue;
      await autoPrepare(lead);
    }
    setBatchRunning(false);
  }

  // Chains the whole preparation so the operator doesn't click six sequential buttons across
  // three screens: Instagram → análise → decisor → mensagem → marcar. Instagram and decisor are
  // best-effort (non-fatal); análise + mensagem are the gates. Failures downgrade to "precisa de
  // ajuda" (partial) instead of erroring the whole flow.
  async function autoPrepare(lead: PrepLead) {
    setPhase(lead.id, { phase: "running", step: "Buscando Instagram…" });
    try {
      await fetch(`/api/leads/${lead.id}/instagram`, { method: "POST" }).catch(() => null);

      setPhase(lead.id, { phase: "running", step: "Analisando com IA…" });
      const aRes = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [lead.id] }),
      });
      const analysisOk = aRes.ok;

      setPhase(lead.id, { phase: "running", step: "Pesquisando decisor…" });
      await fetch(`/api/leads/${lead.id}/decision-maker`, { method: "POST" }).catch(() => null);

      setPhase(lead.id, { phase: "running", step: "Gerando mensagem…" });
      const mRes = await fetch(`/api/leads/${lead.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const messageOk = mRes.ok;

      const ready = analysisOk && messageOk;
      await fetch(`/api/leads/${lead.id}/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: ready ? "mark_ready" : "mark_partial",
          next_best_action: ready ? "Revisar mensagem e abordar" : "Completar manualmente",
        }),
      });

      if (ready) {
        setPhase(lead.id, { phase: "ready" });
        toast.success(`${lead.name} pronto para abordar`);
      } else {
        const reason = !messageOk ? await mRes.json().then((d) => d.error).catch(() => null) : null;
        setPhase(lead.id, { phase: "needs_help" });
        toast.warning(`${lead.name}: preparação parcial${reason ? ` — ${reason}` : ""}`);
      }
      router.refresh();
    } catch {
      setPhase(lead.id, { phase: "needs_help" });
      toast.error("Falha na preparação automática");
    }
  }

  if (!leads.length) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="Nenhum lead aguardando preparação"
        description="Aprove leads em Selecionar para que apareçam aqui."
      />
    );
  }

  const readyCount = leads.filter((l) => state[l.id]?.phase === "ready").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{leads.length}</span> selecionado(s)
          {readyCount > 0 && ` · ${readyCount} pronto(s)`}
        </p>
        <Button size="sm" loading={batchRunning} onClick={prepareAll}>
          <Zap className="h-3.5 w-3.5" /> Preparar todos
        </Button>
      </div>
      {leads.map((lead) => {
        const st = state[lead.id]?.phase ?? "idle";
        const running = st === "running";
        return (
          <Card key={lead.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{lead.name}</span>
                  {st === "ready" ? (
                    <Badge tone="success">
                      <Check className="h-3 w-3" /> Pronto
                    </Badge>
                  ) : st === "needs_help" ? (
                    <Badge tone="warning">
                      <AlertTriangle className="h-3 w-3" /> Precisa de ajuda
                    </Badge>
                  ) : running ? (
                    <Badge tone="accent">{state[lead.id]?.step ?? "Preparando…"}</Badge>
                  ) : (
                    <Badge tone={lead.preparation_status === "partially_prepared" ? "warning" : "muted"}>
                      {lead.preparation_status === "partially_prepared" ? "Parcialmente preparado" : "Aguardando preparação"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted">{categoryLabel(lead.category)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                  <span>{lead.hasDecisionMaker ? "✓ Decisor" : "— Decisor"}</span>
                  <span>·</span>
                  <span>{lead.ai_score != null ? "✓ Análise" : "— Análise"}</span>
                  <span>·</span>
                  <span>{lead.hasMessage ? "✓ Mensagem" : "— Mensagem"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" loading={running} onClick={() => autoPrepare(lead)}>
                  <Zap className="h-3.5 w-3.5" />
                  Preparar
                </Button>
                <Link href={`/leads/${lead.id}`} className="inline-flex">
                  <Button size="sm" variant="ghost">
                    Abrir <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
