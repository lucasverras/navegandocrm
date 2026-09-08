"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatHumanDate } from "@/lib/utils";
import { categoryLabel } from "@/types/domain";
import type { LeadRow } from "@/types/database";
import { Archive } from "lucide-react";

export function ArchivedLeads({ leads, regionMap }: { leads: LeadRow[]; regionMap: Record<string, string> }) {
  const router = useRouter();

  async function reactivate(id: string, name: string) {
    const res = await fetch(`/api/leads/${id}/lose`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reactivate: true }),
    });
    if (!res.ok) return toast.error("Erro ao reativar");
    toast.success(`${name} reativado em "A abordar"`);
    router.refresh();
  }

  if (!leads.length) {
    return (
      <EmptyState
        icon={<Archive className="h-8 w-8" />}
        title="Nenhum lead perdido ou arquivado"
        description="Leads marcados como perdidos ou arquivados aparecem aqui — e podem ser reativados."
      />
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-accent-2">
                {lead.name}
              </Link>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>
                  {regionMap[lead.region_id] ?? "—"} · {categoryLabel(lead.category)}
                </span>
                {lead.lost_reason && <Badge tone="danger">{lead.lost_reason}</Badge>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted">{formatHumanDate(lead.archived_at)}</span>
              <button
                type="button"
                onClick={() => reactivate(lead.id, lead.name)}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
              >
                Reativar
              </button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
