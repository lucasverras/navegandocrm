"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import { BRL } from "@/lib/finance";
import { Plus, Trash2, Check } from "lucide-react";

export type Reimb = {
  id: string;
  description: string;
  amount: number;
  amount_received: number;
  status: "pendente" | "recebido";
  spent_at: string;
};

type Action =
  | { type: "add"; item: Reimb }
  | { type: "remove"; id: string }
  | { type: "status"; id: string; status: "pendente" | "recebido" };

export function ReimbursementsPanel({ rows }: { rows: Reimb[] }) {
  const [, startTransition] = useTransition();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const [items, dispatch] = useOptimistic(rows, (state, action: Action) => {
    if (action.type === "add") return [...state, action.item];
    if (action.type === "remove") return state.filter((r) => r.id !== action.id);
    if (action.type === "status") return state.map((r) => r.id === action.id ? { ...r, status: action.status } : r);
    return state;
  });

  async function add() {
    if (!desc.trim() || !amount.trim()) {
      toast.error("Descrição e valor são obrigatórios");
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const numAmount = Number(amount.replace(",", "."));
    const optimistic: Reimb = {
      id: tempId, description: desc.trim(), amount: numAmount,
      amount_received: 0, status: "pendente", spent_at: new Date().toISOString(),
    };
    setDesc("");
    setAmount("");

    startTransition(async () => {
      dispatch({ type: "add", item: optimistic });
      setBusy(true);
      const res = await fetch("/api/reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: optimistic.description, amount: numAmount }),
      });
      setBusy(false);
      if (!res.ok) toast.error("Erro ao adicionar");
      else toast.success("Reembolso adicionado");
    });
  }

  async function mark(id: string, status: "pendente" | "recebido") {
    startTransition(async () => {
      dispatch({ type: "status", id, status });
      const res = await fetch(`/api/reimbursements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) toast.error("Erro ao atualizar");
      else if (status === "recebido") toast.success("Marcado como recebido");
    });
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este reembolso?")) return;
    startTransition(async () => {
      dispatch({ type: "remove", id });
      const res = await fetch(`/api/reimbursements/${id}`, { method: "DELETE" });
      if (!res.ok) toast.error("Erro ao remover");
      else toast.success("Removido");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Descrição (ex: Drone, Uber para gravação)"
          className="h-9 flex-1 rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          inputMode="decimal"
          placeholder="R$"
          className="h-9 w-28 rounded-md border border-border bg-surface-2 px-2 text-sm tabular-nums text-foreground outline-none focus:border-accent"
        />
        <Button size="sm" loading={busy} onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nenhum reembolso registrado.</p>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Descrição</Th>
              <Th>Data</Th>
              <Th>Valor</Th>
              <Th>Status</Th>
              <Th></Th>
            </Tr>
          </THead>
          <TBody>
            {items.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-foreground">{r.description}</Td>
                <Td className="text-xs">{formatDate(r.spent_at)}</Td>
                <Td className="tabular-nums">{BRL.format(r.amount)}</Td>
                <Td>
                  <span className={r.status === "recebido" ? "text-success" : "text-muted"}>
                    {r.status === "recebido" ? "Recebido" : "Pendente"}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    {r.status === "pendente" ? (
                      <button
                        type="button"
                        onClick={() => mark(r.id, "recebido")}
                        title="Marcar recebido"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-muted hover:text-success"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => mark(r.id, "pendente")}
                        className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground"
                      >
                        Desfazer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      title="Remover"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
