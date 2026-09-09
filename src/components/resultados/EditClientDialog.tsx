"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Pencil, X } from "lucide-react";

type ClientData = {
  id: string;
  name: string;
  closed_at: string | null;
  churned_at: string | null;
  initial_monthly_fee: number | null;
  current_monthly_fee: number | null;
  commission_type: string | null;
  commission_percent: number | null;
  commission_received: number | null;
  legacy_months_paid: number | null;
  first_payment_paid: boolean;
  closed_note: string | null;
};

export function EditClientDialog({ client }: { client: ClientData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    closed_at: client.closed_at?.slice(0, 10) ?? "",
    churned_at: client.churned_at?.slice(0, 10) ?? "",
    initial_monthly_fee: client.initial_monthly_fee ?? 0,
    current_monthly_fee: client.current_monthly_fee ?? 0,
    commission_type: client.commission_type ?? "one_time_percentage",
    commission_percent: client.commission_percent ?? 0,
    commission_received: client.commission_received ?? 0,
    legacy_months_paid: client.legacy_months_paid ?? 0,
    first_payment_paid: client.first_payment_paid ?? false,
    closed_note: client.closed_note ?? "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      name: form.name,
      initial_monthly_fee: form.initial_monthly_fee || null,
      current_monthly_fee: form.current_monthly_fee || null,
      commission_type: form.commission_type,
      commission_percent: form.commission_percent || null,
      commission_received: form.commission_received,
      legacy_months_paid: form.legacy_months_paid,
      first_payment_paid: form.first_payment_paid,
      closed_note: form.closed_note || null,
    };
    body.closed_at = form.closed_at ? new Date(form.closed_at + "T12:00:00Z").toISOString() : null;
    if (form.churned_at) body.churned_at = new Date(form.churned_at + "T12:00:00Z").toISOString();
    else body.churned_at = null;

    const res = await fetch(`/api/leads/${client.id}/client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Cliente atualizado");
    setOpen(false);
    router.refresh();
  }

  const inputClass = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent";
  const labelClass = "text-xs text-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent-2"
      >
        <Pencil className="h-3 w-3" /> Editar
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-start sm:p-4 sm:pt-[8vh]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-client-${client.id}`}
            className="animate-scale-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-border bg-surface shadow-2xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 id={`edit-client-${client.id}`} className="font-display text-lg font-bold text-foreground">Editar {client.name}</h2>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div>
                <label className={labelClass}>Nome</label>
                <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Data início</label>
                  <input type="date" className={inputClass} value={form.closed_at} onChange={(e) => set("closed_at", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Data saída (vazio = ativo)</label>
                  <input type="date" className={inputClass} value={form.churned_at} onChange={(e) => set("churned_at", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Mensalidade inicial</label>
                  <input type="number" className={inputClass} value={form.initial_monthly_fee} onChange={(e) => set("initial_monthly_fee", Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Mensalidade atual</label>
                  <input type="number" className={inputClass} value={form.current_monthly_fee} onChange={(e) => set("current_monthly_fee", Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Regra comissão</label>
                  <select className={inputClass} value={form.commission_type} onChange={(e) => set("commission_type", e.target.value)}>
                    <option value="legacy_recurring">Legado (recorrente)</option>
                    <option value="one_time_percentage">Pontual (%)</option>
                    <option value="none">Sem comissão</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>% comissão</label>
                  <input type="number" className={inputClass} value={form.commission_percent} onChange={(e) => set("commission_percent", Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelClass}>Comissão recebida</label>
                  <input type="number" className={inputClass} value={form.commission_received} onChange={(e) => set("commission_received", Number(e.target.value))} />
                </div>
              </div>

              {form.commission_type === "legacy_recurring" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Meses pagos (legado)</label>
                    <input type="number" className={inputClass} value={form.legacy_months_paid} onChange={(e) => set("legacy_months_paid", Number(e.target.value))} />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" className="accent-accent" checked={form.first_payment_paid} onChange={(e) => set("first_payment_paid", e.target.checked)} />
                      Primeira mensalidade paga
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className={labelClass}>Observação</label>
                <textarea
                  rows={2}
                  className={`${inputClass} py-2`}
                  value={form.closed_note}
                  onChange={(e) => set("closed_note", e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" loading={saving} onClick={save}>
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
