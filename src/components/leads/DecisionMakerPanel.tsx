"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { DecisionMakerRow } from "@/types/database";
import { UserSearch } from "lucide-react";

export function DecisionMakerPanel({ leadId, decisionMaker }: { leadId: string; decisionMaker: DecisionMakerRow | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/decision-maker`, { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? "Erro ao pesquisar decisor");
      return;
    }

    toast.success(data.decisionMaker?.found ? "Decisor encontrado" : "Nenhum decisor encontrado");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Decisor</CardTitle>
        <Button size="sm" variant="secondary" loading={loading} onClick={handleSearch}>
          <UserSearch className="h-3.5 w-3.5" />
          Pesquisar decisor
        </Button>
      </CardHeader>
      <CardContent>
        {!decisionMaker ? (
          <p className="text-sm text-muted">Nenhuma pesquisa realizada ainda.</p>
        ) : !decisionMaker.found ? (
          <p className="text-sm text-muted">
            Não encontrado em fontes públicas confiáveis (pesquisado em {formatDate(decisionMaker.researched_at)}).
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Nome</dt>
              <dd>{decisionMaker.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Cargo</dt>
              <dd>{decisionMaker.role ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tipo de contato</dt>
              <dd>{decisionMaker.contact_type ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Confiança</dt>
              <dd>
                <Badge tone={decisionMaker.confidence >= 60 ? "success" : "warning"}>{decisionMaker.confidence}%</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">E-mail</dt>
              <dd>{decisionMaker.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Telefone</dt>
              <dd>{decisionMaker.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">LinkedIn</dt>
              <dd className="truncate">{decisionMaker.linkedin ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Fonte</dt>
              <dd className="truncate">
                {decisionMaker.source_url ? (
                  <a href={decisionMaker.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">
                    {decisionMaker.source_title ?? decisionMaker.source_url}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {decisionMaker.excerpt && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Trecho</dt>
                <dd className="text-muted">{decisionMaker.excerpt}</dd>
              </div>
            )}
            <div className="sm:col-span-2 text-xs text-muted">
              Pesquisado em {formatDate(decisionMaker.researched_at)}
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
