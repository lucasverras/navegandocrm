"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatHumanDate } from "@/lib/utils";
import type { LeadRow } from "@/types/database";
import { Archive } from "lucide-react";

export function ArchivedLeads({ leads, regionMap }: { leads: LeadRow[]; regionMap: Record<string, string> }) {
  if (!leads.length) {
    return (
      <EmptyState
        icon={<Archive className="h-8 w-8" />}
        title="Nenhum lead arquivado"
        description="Leads descartados ou arquivados aparecerão aqui."
      />
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm hover:border-accent"
          >
            <div>
              <div className="font-medium text-foreground">{lead.name}</div>
              <div className="text-xs text-muted">
                {regionMap[lead.region_id] ?? "—"} · {lead.category}
              </div>
            </div>
            <div className="text-xs text-muted">Arquivado {formatHumanDate(lead.archived_at)}</div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
