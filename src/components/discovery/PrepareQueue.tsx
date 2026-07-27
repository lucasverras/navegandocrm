"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sparkles, ExternalLink } from "lucide-react";
import type { LeadRow } from "@/types/database";

type PrepLead = Pick<
  LeadRow,
  "id" | "name" | "category" | "preparation_status" | "instagram" | "ai_score" | "pre_score"
> & { hasDecisionMaker: boolean; hasMessage: boolean };

export function PrepareQueue({ leads }: { leads: PrepLead[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markStatus(leadId: string, action: "mark_ready" | "mark_partial") {
    setBusyId(leadId);
    const res = await fetch(`/api/leads/${leadId}/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, next_best_action: "Adicionar ao pipeline e abordar" }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("Erro ao atualizar status de preparação");
      return;
    }
    toast.success(action === "mark_ready" ? "Lead marcado como pronto" : "Lead marcado como parcialmente preparado");
    router.refresh();
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

  return (
    <div className="flex flex-col gap-3">
      {leads.map((lead) => (
        <Card key={lead.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{lead.name}</span>
                <Badge tone={lead.preparation_status === "partially_prepared" ? "warning" : "muted"}>
                  {lead.preparation_status === "partially_prepared" ? "Parcialmente preparado" : "Aguardando preparação"}
                </Badge>
              </div>
              <p className="text-xs text-muted">{lead.category}</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                <span>{lead.hasDecisionMaker ? "✓ Decisor pesquisado" : "— Decisor não pesquisado"}</span>
                <span>·</span>
                <span>{lead.ai_score != null ? "✓ Análise feita" : "— Sem análise IA"}</span>
                <span>·</span>
                <span>{lead.hasMessage ? "✓ Mensagem gerada" : "— Sem mensagem"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/leads/${lead.id}`} className="inline-flex">
                <Button size="sm" variant="secondary">
                  Abrir lead <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button size="sm" variant="outline" loading={busyId === lead.id} onClick={() => markStatus(lead.id, "mark_partial")}>
                Marcar parcial
              </Button>
              <Button size="sm" loading={busyId === lead.id} onClick={() => markStatus(lead.id, "mark_ready")}>
                Marcar pronto
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
