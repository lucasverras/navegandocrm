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
  const [creating, setCreating] = useState(false);
  const [igInput, setIgInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
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

  // Create a brand-new prospect from a typed name (+ optional Instagram/phone) and add it.
  async function createNew() {
    const name = q.trim();
    if (name.length < 2) {
      toast.error("Digite um nome");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, instagram: igInput.trim() || undefined, phone: phoneInput.trim() || undefined }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao criar prospecto");
      return;
    }
    toast.success(`${name} criado e adicionado ao pipeline`);
    setQ("");
    setIgInput("");
    setPhoneInput("");
    setOpen(false);
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
                placeholder="Buscar um lead ou digitar um nome novo…"
                className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto">
              {results.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                    <div className="truncate text-xs text-muted">{categoryLabel(r.category)}</div>
                  </div>
                  <Button size="sm" variant="outline" loading={adding === r.id} onClick={() => add(r)}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
              ))}
            </div>

            {/* Create a new prospect from any name — for leads you have (an Instagram link, a
                referral) that aren't in the CRM yet. */}
            <div className="border-t border-border bg-surface-2/40 p-4">
              <p className="mb-2 text-xs text-muted">
                Não está na lista? Crie um novo prospecto{q.trim() ? ` "${q.trim()}"` : ""}:
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={igInput}
                    onChange={(e) => setIgInput(e.target.value)}
                    placeholder="Instagram (link ou @, opcional)"
                    className="h-9 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                  <input
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Telefone (opcional)"
                    className="h-9 w-40 rounded-md border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
                <Button size="sm" loading={creating} disabled={q.trim().length < 2} onClick={createNew}>
                  <Plus className="h-3.5 w-3.5" /> Criar e adicionar ao pipeline
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
