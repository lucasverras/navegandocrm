"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { createChecklist, completeChecklist, editChecklist, deleteChecklist } from "@/app/(dashboard)/hoje/actions";

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
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const editRef = useRef<HTMLInputElement>(null);

  function markBusy(id: string) { setBusyIds((s) => new Set(s).add(id)); }
  function clearBusy(id: string) { setBusyIds((s) => { const n = new Set(s); n.delete(id); return n; }); }

  async function addItem() {
    const text = newText.trim();
    if (!text) return;
    setNewText("");
    const tempId = `temp-${Date.now()}`;
    const item: Item = { id: tempId, text, lead_id: null, amount: null, due_at: null, type: null, completed_at: null, created_at: new Date().toISOString() };
    setPending((p) => [...p, item]);

    const result = await createChecklist(text);
    if (result.error) {
      setPending((p) => p.filter((i) => i.id !== tempId));
      toast.error(result.error);
    } else if (result.item) {
      setPending((p) => p.map((i) => i.id === tempId ? { ...i, id: result.item.id } : i));
    }
  }

  async function handleComplete(item: Item) {
    if (busyIds.has(item.id)) return;
    markBusy(item.id);
    setPending((p) => p.filter((i) => i.id !== item.id));
    setDone((d) => [{ ...item, completed_at: new Date().toISOString() }, ...d]);

    const result = await completeChecklist(item.id, true);
    clearBusy(item.id);
    if (result.error) {
      setDone((d) => d.filter((i) => i.id !== item.id));
      setPending((p) => [...p, item]);
      toast.error("Não foi possível concluir.");
    } else {
      toast("Checklist concluído", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            setDone((d) => d.filter((i) => i.id !== item.id));
            setPending((p) => [...p, { ...item, completed_at: null }]);
            await completeChecklist(item.id, false);
          },
        },
      });
    }
  }

  async function handleUncomplete(item: Item) {
    if (busyIds.has(item.id)) return;
    markBusy(item.id);
    setDone((d) => d.filter((i) => i.id !== item.id));
    setPending((p) => [...p, { ...item, completed_at: null }]);
    const result = await completeChecklist(item.id, false);
    clearBusy(item.id);
    if (result.error) toast.error("Erro ao desfazer");
  }

  async function handleDelete(item: Item, fromDone: boolean) {
    if (fromDone) setDone((d) => d.filter((i) => i.id !== item.id));
    else setPending((p) => p.filter((i) => i.id !== item.id));

    toast("Tarefa excluída", {
      action: {
        label: "Desfazer",
        onClick: () => {
          if (fromDone) setDone((d) => [...d, item]);
          else setPending((p) => [...p, item]);
        },
      },
    });

    // Deferred delete — gives undo window
    setTimeout(async () => {
      await deleteChecklist(item.id);
    }, 4000);
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditText(item.text);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  async function saveEdit(item: Item) {
    const text = editText.trim();
    if (!text || text === item.text) { setEditingId(null); return; }
    setPending((p) => p.map((i) => i.id === item.id ? { ...i, text } : i));
    setEditingId(null);
    const result = await editChecklist(item.id, text);
    if (result.error) {
      setPending((p) => p.map((i) => i.id === item.id ? { ...i, text: item.text } : i));
      toast.error("Erro ao editar");
    }
  }

  return (
    <div>
      <ul className="flex flex-col" role="list">
        {pending.map((item) => (
          <li key={item.id} className="checklist-item flex items-start gap-2.5 border-b border-border/60 py-2 last:border-b-0">
            <button
              type="button"
              role="checkbox"
              aria-checked="false"
              aria-label={`Concluir: ${item.text}`}
              disabled={busyIds.has(item.id)}
              onClick={() => handleComplete(item)}
              className="press mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-border text-transparent hover:border-accent hover:text-accent-2 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
            </button>
            <div className="min-w-0 flex-1">
              {editingId === item.id ? (
                <input
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={() => saveEdit(item)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                />
              ) : (
                <span className="text-sm text-foreground cursor-text" onDoubleClick={() => startEdit(item)}>
                  {item.text}
                </span>
              )}
              {item.leads?.name && <span className="ml-1.5 text-xs text-muted">· {item.leads.name}</span>}
              {item.amount != null && item.amount > 0 && (
                <span className="ml-1.5 text-xs font-medium tabular-nums text-accent-2">{BRL.format(item.amount)}</span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDelete(item, false); }}
              title="Excluir tarefa"
              aria-label={`Excluir: ${item.text}`}
              className="checklist-action mt-0.5 shrink-0 rounded p-0.5 text-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

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

      {done.length > 0 && (
        <details className="mt-3 border-t border-border/60 pt-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
            Concluídos ({done.length})
          </summary>
          <ul className="mt-1 flex flex-col" role="list">
            {done.map((item) => (
              <li key={item.id} className="checklist-item flex items-center gap-2.5 py-1.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked="true"
                  aria-label={`Desfazer: ${item.text}`}
                  disabled={busyIds.has(item.id)}
                  onClick={() => handleUncomplete(item)}
                  className="press flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-border bg-accent-soft text-accent-2 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                </button>
                <span className="flex-1 truncate text-sm text-muted line-through">{item.text}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(item, true); }}
                  title="Excluir"
                  className="checklist-action rounded p-0.5 text-muted hover:text-danger"
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
