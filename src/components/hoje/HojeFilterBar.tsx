"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, CATEGORIES } from "@/types/domain";

export function HojeFilterBar({ regions }: { regions: { id: string; neighborhood: string; city: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const toggleAtrasados = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("atrasados") === "1") params.delete("atrasados");
    else params.set("atrasados", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router, searchParams]);

  const selectClass =
    "h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs text-foreground outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3">
      <select
        className={selectClass}
        value={searchParams.get("regiao") ?? ""}
        onChange={(e) => update("regiao", e.target.value)}
      >
        <option value="">Todas as regiões</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.neighborhood} — {r.city}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={searchParams.get("etapa") ?? ""}
        onChange={(e) => update("etapa", e.target.value)}
      >
        <option value="">Todas as etapas</option>
        {PIPELINE_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {PIPELINE_STAGE_LABELS[stage]}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={searchParams.get("categoria") ?? ""}
        onChange={(e) => update("categoria", e.target.value)}
      >
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      <input
        type="number"
        min={0}
        max={100}
        placeholder="Score mín."
        className={`${selectClass} w-24`}
        defaultValue={searchParams.get("scoreMin") ?? ""}
        onBlur={(e) => update("scoreMin", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") update("scoreMin", (e.target as HTMLInputElement).value);
        }}
      />

      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={searchParams.get("atrasados") === "1"}
          onChange={toggleAtrasados}
        />
        Só atrasados
      </label>

      {(searchParams.get("regiao") ||
        searchParams.get("etapa") ||
        searchParams.get("categoria") ||
        searchParams.get("scoreMin") ||
        searchParams.get("atrasados")) && (
        <button
          type="button"
          className="text-xs text-muted underline hover:text-foreground"
          onClick={() => router.push(pathname)}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
