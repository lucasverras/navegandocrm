"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Search, CornerDownLeft } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { instagramUrl } from "@/components/leads/LeadQuickActions";
import { categoryLabel } from "@/types/domain";

type Result = {
  id: string;
  name: string;
  phone: string | null;
  category: string | null;
  instagram: string | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  maps_url: string | null;
  website: string | null;
};

// Global ⌘K / Ctrl+K search. Find a lead by name or phone and jump to it or fire WhatsApp/IG
// without leaving the current screen. Mounted once in the dashboard layout.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setActive(0);
  }, []);

  // Global open shortcut + a click-to-open custom event (used by the nav/mobile trigger).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Debounced search. All state updates happen inside the async timeout (never synchronously
  // in the effect body) so React doesn't cascade renders.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  function openLead(r: Result) {
    close();
    router.push(`/leads/${r.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      openLead(results[active]);
    }
  }

  if (!open) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={close}>
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
            onKeyDown={onKeyDown}
            placeholder="Buscar restaurante ou telefone…"
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {q.trim().length >= 2 && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">Nenhum resultado.</p>
          )}
          {results.map((r, i) => {
            const ig = instagramUrl(r);
            const wa = r.phone ? buildWhatsAppLink(r.phone, "") : null;
            return (
              <div
                key={r.id}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i === active ? "bg-surface-2" : ""
                }`}
              >
                <button type="button" onClick={() => openLead(r)} className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                  <span className="truncate text-xs text-muted">
                    {categoryLabel(r.category)}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {ig && (
                    <a
                      href={ig}
                      target="_blank"
                      rel="noreferrer"
                      title="Instagram"
                      className="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-[#E1306C]"
                    >
                      <IgGlyph />
                    </a>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp"
                      className="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-[#25D366]"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Clickable search affordance for the nav / mobile (keyboard has ⌘K).
export function SearchTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className={
        className ??
        "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
      }
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Buscar</span>
      <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] md:inline">⌘K</kbd>
    </button>
  );
}

function IgGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
