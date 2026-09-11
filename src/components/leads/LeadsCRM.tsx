"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LeadDrawerLink } from "@/components/leads/LeadDrawer";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { BRL } from "@/lib/finance";
import { formatHumanDate } from "@/lib/utils";
import {
  PIPELINE_STAGE_LABELS,
  CONTACT_ROUND_SHORT,
  nextActionLabel,
  PIPELINE_STAGES,
} from "@/types/domain";
import type { CRMView } from "@/app/(dashboard)/leads/page";
import type { PipelineStage, ContactRound } from "@/types/domain";
import type { RegionRow } from "@/types/database";

type CRMLead = {
  id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  category: string;
  region_id: string | null;
  pipeline_stage: string | null;
  contact_round: string | null;
  next_action_type: string | null;
  next_action_at: string | null;
  proposal_value: number | null;
  proposal_sent_at: string | null;
  meeting_at: string | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  commercial_status: string | null;
  maps_url: string | null;
  website: string | null;
  notes: string | null;
  archived_at: string | null;
  regionName: string | null;
  decisionMaker: { name: string | null; role: string | null } | null;
};

const VIEWS: { key: CRMView; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "no_action", label: "Sem próximo passo" },
  { key: "to_approach", label: "A abordar" },
  { key: "follow_up", label: "Follow-up" },
  { key: "meetings", label: "Reuniões" },
  { key: "proposals", label: "Propostas" },
  { key: "lost", label: "Perdidos" },
];

export function LeadsCRM({
  leads,
  regions,
  view,
  viewCounts,
  page,
  totalPages,
  total,
}: {
  leads: CRMLead[];
  regions: Pick<RegionRow, "id" | "neighborhood">[];
  view: CRMView;
  viewCounts: Record<CRMView, number>;
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const set = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function handleSearch(value: string) {
    setSearchValue(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      set({ q: value.trim() || null });
    }, 300);
  }

  function goToPage(next: number) {
    const p = new URLSearchParams(searchParams.toString());
    if (next <= 1) p.delete("page");
    else p.set("page", String(next));
    router.push(`${pathname}?${p.toString()}`);
  }

  const thClass = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap";
  const tdClass = "px-3 py-2 text-sm align-middle";
  const selectClass = "h-7 rounded border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">CRM</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Leads</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={searchRef}
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar lead, telefone, Instagram..."
            className="w-48 bg-transparent text-sm text-foreground outline-none placeholder:text-muted sm:w-64"
          />
        </div>
      </div>

      {/* Views */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => set({ view: v.key === "all" ? null : v.key })}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              view === v.key
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {v.label}
            {viewCounts[v.key] > 0 && (
              <span className={`ml-1.5 text-xs tabular-nums ${view === v.key ? "text-accent-2" : "text-muted"}`}>
                {viewCounts[v.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectClass}
          value={searchParams.get("region") ?? ""}
          onChange={(e) => set({ region: e.target.value || null })}
        >
          <option value="">Região</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.neighborhood}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={searchParams.get("stage") ?? ""}
          onChange={(e) => set({ stage: e.target.value || null })}
        >
          <option value="">Etapa</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={searchParams.get("sort") ?? ""}
          onChange={(e) => set({ sort: e.target.value || null })}
        >
          <option value="">Mais recente</option>
          <option value="name">Nome A-Z</option>
          <option value="next_action">Próxima ação</option>
          <option value="last_contact">Último contato</option>
          <option value="proposal">Maior proposta</option>
        </select>
        <span className="ml-auto text-xs tabular-nums text-muted">
          {total} lead{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
          <p className="text-sm text-muted">Nenhum lead encontrado nesta visualização.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className={thClass}>Lead</th>
                <th className={thClass}>Contato</th>
                <th className={`${thClass} hidden lg:table-cell`}>Telefone</th>
                <th className={`${thClass} hidden md:table-cell`}>Instagram</th>
                <th className={`${thClass} hidden xl:table-cell`}>Região</th>
                <th className={thClass}>Etapa</th>
                <th className={`${thClass} hidden lg:table-cell`}>Rodada</th>
                <th className={thClass}>Próxima ação</th>
                <th className={`${thClass} hidden lg:table-cell`}>Proposta</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const handle = (lead.instagram_handle ?? lead.instagram)?.replace(/^@/, "");
                const igUrl = lead.instagram_url ?? (handle ? `https://instagram.com/${handle}` : null);
                const wa = lead.phone ? buildWhatsAppLink(lead.phone, "") : null;
                const actionOverdue = lead.next_action_at && new Date(lead.next_action_at) < new Date();

                return (
                  <tr
                    key={lead.id}
                    className="border-t border-border hover:bg-surface-2/50 transition-colors"
                  >
                    {/* Lead name */}
                    <td className={tdClass}>
                      <LeadDrawerLink leadId={lead.id}>
                        {lead.name}
                      </LeadDrawerLink>
                    </td>

                    {/* Decision maker */}
                    <td className={`${tdClass} text-xs text-muted`}>
                      {lead.decisionMaker?.name ? (
                        <span>
                          {lead.decisionMaker.name}
                          {lead.decisionMaker.role && (
                            <span className="text-muted/70"> · {lead.decisionMaker.role}</span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Phone */}
                    <td className={`${tdClass} hidden lg:table-cell`}>
                      {lead.phone ? (
                        <span className="tabular-nums text-foreground">{lead.phone}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Instagram */}
                    <td className={`${tdClass} hidden md:table-cell`}>
                      {handle && igUrl ? (
                        <a
                          href={igUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent-2 hover:underline"
                        >
                          @{handle}
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Region */}
                    <td className={`${tdClass} hidden xl:table-cell text-xs text-muted`}>
                      {lead.regionName ?? "—"}
                    </td>

                    {/* Stage */}
                    <td className={tdClass}>
                      {lead.pipeline_stage ? (
                        <Badge tone="accent" className="text-[10px]">
                          {PIPELINE_STAGE_LABELS[lead.pipeline_stage as PipelineStage] ?? lead.pipeline_stage}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>

                    {/* Round */}
                    <td className={`${tdClass} hidden lg:table-cell text-xs`}>
                      {lead.contact_round ? (
                        CONTACT_ROUND_SHORT[lead.contact_round as ContactRound] ?? lead.contact_round
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Next action */}
                    <td className={tdClass}>
                      {lead.next_action_type ? (
                        <div>
                          <span className={`text-xs ${actionOverdue ? "font-medium text-danger" : "text-foreground"}`}>
                            {nextActionLabel(lead.next_action_type)}
                          </span>
                          {lead.next_action_at && (
                            <span className="ml-1 text-[10px] text-muted">
                              {formatHumanDate(lead.next_action_at)}
                            </span>
                          )}
                        </div>
                      ) : lead.pipeline_stage && lead.pipeline_stage !== "closed" ? (
                        <span className="text-xs font-medium text-danger">Definir</span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>

                    {/* Proposal */}
                    <td className={`${tdClass} hidden lg:table-cell`}>
                      {lead.proposal_value ? (
                        <span className="tabular-nums text-xs font-medium text-foreground">
                          {BRL.format(lead.proposal_value)}/mês
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Quick actions */}
                    <td className={`${tdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            title="WhatsApp"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {igUrl && (
                          <a
                            href={igUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Instagram"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#E1306C] hover:bg-[#E1306C]/10 transition-colors"
                          >
                            <IgGlyph />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="rounded border border-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="rounded border border-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IgGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
