"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { categoryLabel, FIRST_PIPELINE_STAGE } from "@/types/domain";

type Result = { id: string; name: string; phone: string | null; category: string | null };

// "+ Adicionar lead" on the Pipeline page — search an approved/triaged lead and drop it onto
// the board (into "Pronto para abordar"). This is the conscious entry into the pipeline.
export function PipelineAddLead() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/search?addable=1&q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  async function add(r: Result) {
    setAdding(r.id);
    const res = await fetch(`/api/leads/${r.id}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: FIRST_PIPELINE_STAGE, position: 0 }),
    });
    setAdding(null);
    if (!res.ok) {
      toast.error("Erro ao adicionar");
      return;
    }
    toast.success(`${r.name} adicionado ao pipeline`);
    setResults((rs) => rs.filter((x) => x.id !== r.id));
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Adicionar lead
      </Button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-scale-in w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar lead para adicionar ao pipeline…"
                className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {q.trim().length >= 2 && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted">Nenhum lead disponível.</p>
              )}
              {results.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                    <div className="truncate text-xs text-muted">{categoryLabel(r.category)}</div>
                  </div>
                  <Button size="sm" loading={adding === r.id} onClick={() => add(r)}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
