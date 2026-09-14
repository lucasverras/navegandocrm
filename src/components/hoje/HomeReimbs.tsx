"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { BRL } from "@/lib/finance";

type Reimb = { id: string; description: string; amount: number; amount_received: number; status: string };

export function HomeReimbs({ initialReimbs }: { initialReimbs: Reimb[] }) {
  const [reimbs, setReimbs] = useState<Reimb[]>(initialReimbs);
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const total = reimbs.reduce((s, r) => s + (r.amount - (r.amount_received ?? 0)), 0);

  async function addReimb() {
    const d = desc.trim();
    const v = Number(amount.replace(",", "."));
    if (!d || !v || isNaN(v)) { toast.error("Descrição e valor são obrigatórios"); return; }

    const tempId = `temp-${Date.now()}`;
    const item: Reimb = { id: tempId, description: d, amount: v, amount_received: 0, status: "pendente" };
    setReimbs((r) => [...r, item]);
    setDesc("");
    setAmount("");
    setAdding(false);

    try {
      const res = await fetch("/api/reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: d, amount: v }),
      });
      if (!res.ok) throw new Error(`POST ${res.status}`);
      const data = await res.json();
      if (data?.reimbursement?.id) {
        setReimbs((r) => r.map((i) => i.id === tempId ? { ...i, id: data.reimbursement.id } : i));
      }
      toast.success("Reembolso adicionado");
    } catch (err) {
      console.error("[Reimb] create failed:", err);
      setReimbs((r) => r.filter((i) => i.id !== tempId));
      toast.error("Erro ao adicionar reembolso");
    }
  }

  async function markReceived(item: Reimb) {
    if (busy) return;
    setBusy(true);
    setReimbs((r) => r.filter((i) => i.id !== item.id));

    try {
      const res = await fetch(`/api/reimbursements/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "recebido" }),
      });
      if (!res.ok) throw new Error(`PATCH ${res.status}`);
      toast.success("Reembolso recebido");
    } catch (err) {
      console.error("[Reimb] mark received failed:", err);
      setReimbs((r) => [...r, item]);
      toast.error("Erro ao marcar recebido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {reimbs.length > 0 && (
        <>
          <ul className="flex flex-col">
            {reimbs.map((r) => {
              const pending = r.amount - (r.amount_received ?? 0);
              return (
                <li key={r.id} className="checklist-item flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
                  <span className="truncate text-sm text-foreground">{r.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm font-medium tabular-nums text-accent-2">{BRL.format(pending)}</span>
                    <button
                      type="button"
                      onClick={() => markReceived(r)}
                      title="Marcar recebido"
                      className="checklist-action flex h-6 w-6 items-center justify-center rounded text-muted hover:text-success"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-muted">Total pendente</span>
            <Link href="/resultados?tab=reembolsos" className="font-semibold tabular-nums text-accent-2 hover:underline">
              {BRL.format(total)}
            </Link>
          </div>
        </>
      )}

      {/* Quick add */}
      {adding ? (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descrição (ex: Drone, Uber)"
            autoFocus
            className="h-8 rounded border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addReimb()}
            inputMode="decimal"
            placeholder="Valor (ex: 750)"
            className="h-8 rounded border border-border bg-surface px-2 text-sm tabular-nums text-foreground outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button type="button" onClick={addReimb} className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-2">
              Salvar
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-muted hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 text-xs text-accent-2 hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Reembolso
        </button>
      )}
    </div>
  );
}
