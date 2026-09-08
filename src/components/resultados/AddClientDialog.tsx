"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

type Region = { id: string; neighborhood: string; city: string };
const ORIGINS = ["Radar", "Indicação", "Evento", "Instagram", "Networking", "Parceiro", "Manual", "Outro"];

// Add a CLOSED CLIENT manually — for clients you already won (outside the Radar funnel).
// Creates it straight into Resultados with its contract + commission, not as a pipeline lead.
export function AddClientDialog({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    phone: "",
    instagram: "",
    region_id: "",
    origin: "Indicação",
    contract_start: new Date().toISOString().slice(0, 10),
    contract_end: "",
    monthly_fee: "",
    commission_type: "one_time_percentage" as "one_time_percentage" | "legacy_recurring" | "none",
    commission_percent: "20",
    first_payment_paid: false,
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    if (f.name.trim().length < 2) return toast.error("Nome é obrigatório");
    setBusy(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        as_client: true,
        name: f.name.trim(),
        phone: f.phone.trim() || undefined,
        instagram: f.instagram.trim() || undefined,
        region_id: f.region_id || null,
        origin: f.origin,
        monthly_fee: f.monthly_fee.trim() ? Number(f.monthly_fee.replace(",", ".")) : null,
        commission_type: f.commission_type,
        commission_percent:
          f.commission_type === "none" ? null : f.commission_type === "legacy_recurring" ? 10 : Number(f.commission_percent || "0"),
        contract_start: new Date(f.contract_start + "T12:00:00").toISOString(),
        contract_end: f.contract_end ? new Date(f.contract_end + "T12:00:00").toISOString() : null,
        first_payment_paid: f.first_payment_paid,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return toast.error(data.error ?? "Erro ao adicionar cliente");
    }
    toast.success(`${f.name.trim()} adicionado aos resultados`);
    setOpen(false);
    setF((prev) => ({ ...prev, name: "", phone: "", instagram: "", monthly_fee: "" }));
    router.refresh();
  }

  const input = "h-9 w-full rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground outline-none focus:border-accent";
  const label = "flex flex-col gap-1 text-xs text-muted";

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Adicionar cliente
      </Button>

      {open && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]" onClick={() => setOpen(false)}>
          <div className="animate-scale-in w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">Adicionar cliente fechado</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className={`${label} col-span-2`}>
                Nome do cliente *
                <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Dom Sushi Mooca" />
              </label>
              <label className={label}>
                Telefone
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
              <label className={label}>
                Entrou em
                <input type="date" className={input} value={f.contract_start} onChange={(e) => set("contract_start", e.target.value)} />
              </label>
              <label className={label}>
                Saiu em (vazio = ativo)
                <input type="date" className={input} value={f.contract_end} onChange={(e) => set("contract_end", e.target.value)} />
              </label>
              <label className={label}>
                Mensalidade (R$)
                <input className={input} inputMode="decimal" value={f.monthly_fee} onChange={(e) => set("monthly_fee", e.target.value)} placeholder="4000" />
              </label>
              <label className={label}>
                Comissão
                <select className={input} value={f.commission_type} onChange={(e) => set("commission_type", e.target.value as typeof f.commission_type)}>
                  <option value="one_time_percentage">Pontual (% de 1 mensalidade)</option>
                  <option value="legacy_recurring">Legado (10% recorrente)</option>
                  <option value="none">Nenhuma</option>
                </select>
              </label>
              <label className={label}>
                Percentual
                <input
                  className={input}
                  inputMode="decimal"
                  disabled={f.commission_type !== "one_time_percentage"}
                  value={f.commission_type === "legacy_recurring" ? "10" : f.commission_percent}
                  onChange={(e) => set("commission_percent", e.target.value)}
                />
              </label>
              <label className="col-span-2 flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={f.first_payment_paid} onChange={(e) => set("first_payment_paid", e.target.checked)} className="accent-accent" />
                1ª mensalidade já paga (gera a comissão pontual)
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" loading={busy} onClick={submit}>
                Adicionar cliente
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
