"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types/domain";

type Region = { id: string; neighborhood: string; city: string };
const ORIGINS = ["Radar", "Indicação", "Evento", "Instagram", "Networking", "Parceiro", "Manual", "Outro"];

// Global "+ Novo lead" — keeps the Trello flexibility: add any lead by hand with origin, region
// and starting stage. Opens on the sidebar button or the `open-new-lead` window event.
export function NewLeadDialog({ regions, compact = false }: { regions: Region[]; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    phone: "",
    instagram: "",
    region_id: "",
    origin: "Indicação",
    stage: "ready_to_approach",
    notes: "",
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    if (f.name.trim().length < 2) return toast.error("Nome é obrigatório");
    setBusy(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name.trim(),
        phone: f.phone.trim() || undefined,
        instagram: f.instagram.trim() || undefined,
        region_id: f.region_id || null,
        origin: f.origin,
        stage: f.stage,
        notes: f.notes.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return toast.error(data.error ?? "Erro ao criar lead");
    }
    toast.success(`${f.name.trim()} adicionado`);
    setOpen(false);
    setF((p) => ({ ...p, name: "", phone: "", instagram: "", notes: "" }));
    router.refresh();
  }

  const input = "h-9 w-full rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground outline-none focus:border-accent";
  const label = "flex flex-col gap-1 text-xs text-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Novo lead"
        className={compact
          ? "flex h-11 w-11 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent-2"
          : "flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-2"}
      >
        <Plus className="h-4 w-4" /> {compact ? <span className="sr-only">Novo lead</span> : "Novo lead"}
      </button>

      {open && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-start sm:p-4 sm:pt-[8vh]" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="new-lead-title" className="animate-scale-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-border bg-surface p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 id="new-lead-title" className="font-display text-lg font-bold text-foreground">Novo lead</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={`${label} sm:col-span-2`}>
                Nome *
                <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Croma Burgers" />
              </label>
              <label className={label}>
                WhatsApp
                <input className={input} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 99999-9999" />
              </label>
              <label className={label}>
                Instagram
                <input className={input} value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@ ou link" />
              </label>
              <label className={label}>
                Região
                <select className={input} value={f.region_id} onChange={(e) => set("region_id", e.target.value)}>
                  <option value="">—</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.neighborhood} — {r.city}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Origem
                <select className={input} value={f.origin} onChange={(e) => set("origin", e.target.value)}>
                  {ORIGINS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${label} sm:col-span-2`}>
                Etapa
                <select className={input} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
                  {PIPELINE_STAGES.filter((s) => s !== "closed").map((s) => (
                    <option key={s} value={s}>
                      {PIPELINE_STAGE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${label} sm:col-span-2`}>
                Observação
                <input className={input} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opcional" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" loading={busy} onClick={submit}>
                Adicionar lead
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
