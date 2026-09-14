"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { DecisionMakerRow } from "@/types/database";
import { UserSearch } from "lucide-react";

export function DecisionMakerPanel({ leadId, decisionMaker }: { leadId: string; decisionMaker: DecisionMakerRow | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecisionMakerRow | null>(decisionMaker);

  async function handleSearch() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/decision-maker`, { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? "Erro ao pesquisar decisor");
      return;
    }

    if (data.decisionMaker) setResult(data.decisionMaker);
    toast.success(data.decisionMaker?.found ? "Decisor encontrado" : "Nenhum decisor encontrado");
  }

  const dm = result ?? decisionMaker;

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
        {!dm ? (
          <p className="text-sm text-muted">Nenhuma pesquisa realizada ainda.</p>
        ) : !dm.found ? (
          <p className="text-sm text-muted">
            Não encontrado em fontes públicas confiáveis (pesquisado em {formatDate(dm.researched_at)}).
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Nome</dt>
              <dd>{dm.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Cargo</dt>
              <dd>{dm.role ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tipo de contato</dt>
              <dd>{dm.contact_type ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Confiança</dt>
              <dd>
                <Badge tone={dm.confidence >= 60 ? "success" : "warning"}>{dm.confidence}%</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">E-mail</dt>
              <dd>{dm.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Telefone</dt>
              <dd>{dm.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">LinkedIn</dt>
              <dd className="truncate">{dm.linkedin ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Fonte</dt>
              <dd className="truncate">
                {dm.source_url ? (
                  <a href={dm.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">
                    {dm.source_title ?? dm.source_url}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {dm.excerpt && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Trecho</dt>
                <dd className="text-muted">{dm.excerpt}</dd>
              </div>
            )}
            <div className="sm:col-span-2 text-xs text-muted">
              Pesquisado em {formatDate(dm.researched_at)}
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
