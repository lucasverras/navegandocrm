"use client";

import { useState, useRef } from "react";
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
  const [pending, setPending] = useState<Item[]>(initialPending);
  const [done, setDone] = useState<Item[]>(initialDone);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  async function addItem() {
    const text = newText.trim();
    if (!text) return;
    setNewText("");

    const tempId = `temp-${Date.now()}`;
    const item: Item = {
      id: tempId, text, lead_id: null, amount: null,
      due_at: null, type: null, completed_at: null,
      created_at: new Date().toISOString(),
    };
    setPending((prev) => [...prev, item]);

    const res = await fetch("/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);

    if (!res?.ok) {
      setPending((prev) => prev.filter((i) => i.id !== tempId));
      toast.error("Erro ao criar item");
      return;
    }
    const data = await res.json().catch(() => null);
    if (data?.item?.id) {
      setPending((prev) => prev.map((i) => i.id === tempId ? { ...i, id: data.item.id } : i));
    }
  }

  function completeItem(item: Item) {
    setPending((prev) => prev.filter((i) => i.id !== item.id));
    const completed = { ...item, completed_at: new Date().toISOString() };
    setDone((prev) => [completed, ...prev]);

    const undoComplete = () => {
      setDone((prev) => prev.filter((i) => i.id !== item.id));
      setPending((prev) => [...prev, { ...item, completed_at: null }]);
      fetch(`/api/checklists/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: false }),
      });
    };

    fetch(`/api/checklists/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    }).then((res) => {
      if (!res?.ok) {
        undoComplete();
        toast.error("Não foi possível concluir. Tente novamente.");
        return;
      }
      toast("Checklist concluído", { action: { label: "Desfazer", onClick: undoComplete } });
    }).catch(() => {
      undoComplete();
      toast.error("Não foi possível concluir. Tente novamente.");
    });
  }

  function uncompleteItem(item: Item) {
    setDone((prev) => prev.filter((i) => i.id !== item.id));
    setPending((prev) => [...prev, { ...item, completed_at: null }]);

    fetch(`/api/checklists/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    }).then((res) => {
      if (!res?.ok) toast.error("Erro ao desfazer");
    }).catch(() => {});
  }

  function deletePendingItem(item: Item) {
    setPending((prev) => prev.filter((i) => i.id !== item.id));

    const undoDelete = () => {
      setPending((prev) => [...prev, item]);
      fetch(`/api/checklists/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text }),
      });
    };

    toast("Checklist excluído", { action: { label: "Desfazer", onClick: undoDelete } });
    fetch(`/api/checklists/${item.id}`, { method: "DELETE" }).catch(() => {
      undoDelete();
    });
  }

  function deleteDoneItem(id: string) {
    setDone((prev) => prev.filter((i) => i.id !== id));
    fetch(`/api/checklists/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditText(item.text);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  async function saveEdit(item: Item) {
    const text = editText.trim();
    if (!text || text === item.text) {
      setEditingId(null);
      return;
    }
    setPending((prev) => prev.map((i) => i.id === item.id ? { ...i, text } : i));
    setEditingId(null);

    const res = await fetch(`/api/checklists/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    if (!res?.ok) {
      setPending((prev) => prev.map((i) => i.id === item.id ? { ...i, text: item.text } : i));
      toast.error("Erro ao editar");
    }
  }

  return (
    <div>
      {/* Pending items */}
      <ul className="flex flex-col">
        {pending.map((item) => (
          <li
            key={item.id}
            className="group flex items-start gap-2.5 border-b border-border/60 py-2 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => completeItem(item)}
              aria-label="Concluir"
              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-border text-transparent transition-colors hover:border-accent hover:text-accent-2 focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Check className="h-3 w-3" />
            </button>
            <div className="min-w-0 flex-1">
              {editingId === item.id ? (
                <input
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(item);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => saveEdit(item)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                />
              ) : (
                <span
                  className="text-sm text-foreground cursor-text"
                  onDoubleClick={() => startEdit(item)}
                >
                  {item.text}
                </span>
              )}
              {item.leads?.name && (
                <span className="ml-1.5 text-xs text-muted">· {item.leads.name}</span>
              )}
              {item.amount != null && item.amount > 0 && (
                <span className="ml-1.5 text-xs font-medium tabular-nums text-accent-2">{BRL.format(item.amount)}</span>
              )}
            </div>
            {/* Delete on hover — desktop; always visible on mobile */}
            <button
              type="button"
              onClick={() => deletePendingItem(item)}
              title="Excluir"
              aria-label="Excluir"
              className="mt-0.5 shrink-0 text-muted opacity-100 transition-opacity hover:text-danger focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40 md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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

      {/* Completed items (collapsed) */}
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
                  onClick={() => uncompleteItem(item)}
                  title="Desfazer"
                  aria-label="Desfazer conclusão"
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-border bg-accent-soft text-accent-2"
                >
                  <Check className="h-3 w-3" />
                </button>
                <span className="flex-1 truncate text-sm text-muted line-through">{item.text}</span>
                <button
                  type="button"
                  onClick={() => deleteDoneItem(item.id)}
                  title="Excluir"
                  aria-label="Excluir"
                  className="text-muted opacity-100 transition-opacity hover:text-danger md:opacity-0 md:group-hover:opacity-100"
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
