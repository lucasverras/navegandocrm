"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";

type Item = {
  id: string;
  text: string;
  lead_id: string | null;
  amount: number | null;
  due_at: string | null;
  type: string | null;
  completed_at: string | null;
  created_at: string;
  leads?: { name: string } | null;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ChecklistPanel({
  initialPending,
  initialDone,
}: {
  initialPending: Item[];
  initialDone: Item[];
}) {
  const [, startTransition] = useTransition();
  const [newText, setNewText] = useState("");
  const [pending, addOptimistic] = useOptimistic(initialPending, (state, action: { type: "add"; item: Item } | { type: "remove"; id: string }) => {
    if (action.type === "add") return [...state, action.item];
    return state.filter((i) => i.id !== action.id);
  });
  const [done, addDoneOptimistic] = useOptimistic(initialDone, (state, action: { type: "add"; item: Item } | { type: "remove"; id: string }) => {
    if (action.type === "add") return [action.item, ...state];
    return state.filter((i) => i.id !== action.id);
  });

  async function addItem() {
    const text = newText.trim();
    if (text.length < 1) return;
    setNewText("");

    const tempId = `temp-${Date.now()}`;
    const optimisticItem: Item = {
      id: tempId,
      text,
      lead_id: null,
      amount: null,
      due_at: null,
      type: null,
      completed_at: null,
      created_at: new Date().toISOString(),
    };

    startTransition(async () => {
      addOptimistic({ type: "add", item: optimisticItem });
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => null);
      if (!res?.ok) toast.error("Erro ao criar item");
      // Optimistic UI already updated — no router.refresh() needed.
    });
  }

  async function toggleComplete(item: Item) {
    const completing = !item.completed_at;

    startTransition(async () => {
      if (completing) {
        addOptimistic({ type: "remove", id: item.id });
        addDoneOptimistic({ type: "add", item: { ...item, completed_at: new Date().toISOString() } });
      } else {
        addDoneOptimistic({ type: "remove", id: item.id });
        addOptimistic({ type: "add", item: { ...item, completed_at: null } });
      }

      const res = await fetch(`/api/checklists/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: completing }),
      }).catch(() => null);

      if (!res?.ok) {
        toast.error("Erro ao atualizar");
      } else if (completing) {
        toast("Item concluído", {
          action: {
            label: "Desfazer",
            onClick: () => {
              fetch(`/api/checklists/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: false }),
              });
            },
          },
        });
      }
      // Optimistic UI already updated — no router.refresh() needed.
    });
  }

  async function deleteItem(id: string) {
    startTransition(async () => {
      addDoneOptimistic({ type: "remove", id });
      await fetch(`/api/checklists/${id}`, { method: "DELETE" }).catch(() => null);
      // Optimistic UI already updated — no router.refresh() needed.
    });
  }

  return (
    <div>
      {/* Pending items */}
      <ul className="flex flex-col">
        {pending.map((item) => (
          <li key={item.id} className="group flex items-start gap-2.5 border-b border-border/60 py-2 last:border-b-0">
            <button
              type="button"
              onClick={() => toggleComplete(item)}
              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-border text-transparent transition-colors hover:border-accent hover:text-accent-2"
            >
              <Check className="h-3 w-3" />
            </button>
            <div className="min-w-0 flex-1">
              <span className="text-sm text-foreground">{item.text}</span>
              {item.leads?.name && (
                <span className="ml-1.5 text-xs text-muted">· {item.leads.name}</span>
              )}
              {item.amount != null && item.amount > 0 && (
                <span className="ml-1.5 text-xs font-medium tabular-nums text-accent-2">{BRL.format(item.amount)}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Quick add */}
      <div className="mt-2 flex items-center gap-2">
        <Plus className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Adicionar item..."
          className="h-8 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>

      {/* Recently done (collapsed) */}
      {done.length > 0 && (
        <details className="mt-3 border-t border-border/60 pt-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
            {done.length} concluído{done.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-1 flex flex-col">
            {done.map((item) => (
              <li key={item.id} className="group flex items-center gap-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => toggleComplete(item)}
                  title="Desfazer"
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-border bg-accent-soft text-accent-2"
                >
                  <Check className="h-3 w-3" />
                </button>
                <span className="flex-1 truncate text-sm text-muted line-through">{item.text}</span>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
