"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, CATEGORIES } from "@/types/domain";
import type { RegionRow } from "@/types/database";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Maior pré-score" },
  { value: "score_desc", label: "Maior score" },
  { value: "discovered_recent", label: "Descoberto mais recente" },
  { value: "discovered_oldest", label: "Descoberto há mais tempo" },
  { value: "follow_up_soonest", label: "Follow-up mais próximo" },
  { value: "stale", label: "Mais tempo sem atividade" },
  { value: "stage_longest", label: "Mais tempo na etapa atual" },
  { value: "reviews_desc", label: "Maior quantidade de avaliações" },
];

export function LeadsFilters({ regions }: { regions: Pick<RegionRow, "id" | "neighborhood" | "city">[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const inputClass =
    "h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3">
      <select
        className={inputClass}
        value={searchParams.get("region") ?? ""}
        onChange={(e) => set("region", e.target.value || null)}
      >
        <option value="">Todas as regiões</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.neighborhood} — {r.city}
          </option>
        ))}
      </select>

      <select
        className={inputClass}
        value={searchParams.get("category") ?? ""}
        onChange={(e) => set("category", e.target.value || null)}
      >
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        className={inputClass}
        value={searchParams.get("stage") ?? ""}
        onChange={(e) => set("stage", e.target.value || null)}
      >
        <option value="">Todas as etapas</option>
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>
            {PIPELINE_STAGE_LABELS[s]}
          </option>
        ))}
      </select>

      <input
        className={inputClass}
        placeholder="Nota mínima (Google)"
        type="number"
        step="0.1"
        defaultValue={searchParams.get("minRating") ?? ""}
        onBlur={(e) => set("minRating", e.target.value || null)}
      />

      <input
        className={inputClass}
        placeholder="ID do responsável"
        defaultValue={searchParams.get("assignedTo") ?? ""}
        onBlur={(e) => set("assignedTo", e.target.value || null)}
      />

      <label className="flex items-center gap-1 text-xs text-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={searchParams.get("hasPhone") === "1"}
          onChange={(e) => set("hasPhone", e.target.checked ? "1" : null)}
        />
        Com telefone
      </label>

      <label className="flex items-center gap-1 text-xs text-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={searchParams.get("hasMessage") === "1"}
          onChange={(e) => set("hasMessage", e.target.checked ? "1" : null)}
        />
        Com mensagem
      </label>

      <label className="flex items-center gap-1 text-xs text-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={searchParams.get("notContacted") === "1"}
          onChange={(e) => set("notContacted", e.target.checked ? "1" : null)}
        />
        Ainda não abordado
      </label>

      <label className="flex items-center gap-1 text-xs text-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={searchParams.get("overdueFollowUp") === "1"}
          onChange={(e) => set("overdueFollowUp", e.target.checked ? "1" : null)}
        />
        Follow-up atrasado
      </label>

      <label className="flex items-center gap-1 text-xs text-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={searchParams.get("stale") === "1"}
          onChange={(e) => set("stale", e.target.checked ? "1" : null)}
        />
        Sem atividade há 7+ dias
      </label>

      <input
        className={inputClass}
        placeholder="Descoberto há até (dias)"
        type="number"
        defaultValue={searchParams.get("discoveredDays") ?? ""}
        onBlur={(e) => set("discoveredDays", e.target.value || null)}
      />

      <input
        className={inputClass}
        placeholder="Último contato há até (dias)"
        type="number"
        defaultValue={searchParams.get("lastContactDays") ?? ""}
        onBlur={(e) => set("lastContactDays", e.target.value || null)}
      />

      <select
        className={`${inputClass} ml-auto`}
        value={searchParams.get("sort") ?? ""}
        onChange={(e) => set("sort", e.target.value || null)}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

