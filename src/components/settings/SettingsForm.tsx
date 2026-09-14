"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export interface UsageLimitsValue {
  ai_analyses_per_day: number;
  decision_maker_searches_per_day: number;
  ai_refinements_per_day: number;
}

interface SettingsFormProps {
  initialUsageLimits: UsageLimitsValue;
  initialBlockedKeywords: string[];
  initialBlockedBrands: string[];
}

const LIMIT_FIELDS: { key: keyof UsageLimitsValue; label: string; hint: string }[] = [
  { key: "ai_analyses_per_day", label: "Análises / dia", hint: "Triagem automática de leads." },
  { key: "decision_maker_searches_per_day", label: "Buscas de decisor / dia", hint: "Localização de responsáveis." },
  { key: "ai_refinements_per_day", label: "Refinamentos / dia", hint: "Mensagens refinadas por IA." },
];

function ChipInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addItem(raw: string) {
    const text = raw.trim().toLowerCase();
    if (!text || items.some((i) => i.toLowerCase() === text)) return;
    onChange([...items, raw.trim()]);
    setInputValue("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addItem(inputValue);
    }
    if (e.key === "Backspace" && !inputValue && items.length > 0) {
      removeItem(items.length - 1);
    }
  }

  return (
    <div
      className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1.5 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/40"
      onClick={() => inputRef.current?.focus()}
    >
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground border border-border"
        >
          {item}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeItem(i);
            }}
            className="text-muted hover:text-danger"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue.trim() && addItem(inputValue)}
        placeholder={items.length === 0 ? placeholder : ""}
        className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm text-foreground outline-none placeholder:text-muted/60"
      />
      {inputValue.trim() && (
        <button
          type="button"
          onClick={() => addItem(inputValue)}
          className="text-muted hover:text-accent-2"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function SettingsForm({ initialUsageLimits, initialBlockedKeywords, initialBlockedBrands }: SettingsFormProps) {
  const router = useRouter();
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingFilter, setSavingFilter] = useState(false);
  const [limits, setLimits] = useState<UsageLimitsValue>(initialUsageLimits);
  const [keywords, setKeywords] = useState<string[]>(initialBlockedKeywords);
  const [brands, setBrands] = useState<string[]>(initialBlockedBrands);

  async function patch(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao salvar");
      return false;
    }
    return true;
  }

  async function saveLimits(e: React.FormEvent) {
    e.preventDefault();
    setSavingLimits(true);
    const ok = await patch({ usage_limits: limits });
    setSavingLimits(false);
    if (ok) {
      toast.success("Limites de IA atualizados");
      router.refresh();
    }
  }

  async function saveFilter(e: React.FormEvent) {
    e.preventDefault();
    setSavingFilter(true);
    const ok = await patch({
      extra_blocked_keywords: keywords,
      extra_blocked_brands: brands,
    });
    setSavingFilter(false);
    if (ok) {
      toast.success("Filtro global atualizado");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* IA Section */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Inteligência artificial</h2>
          <p className="text-xs text-muted">Teto diário de operações. Ao atingir o limite, novas chamadas são bloqueadas até o dia seguinte (UTC).</p>
        </div>
        <form onSubmit={saveLimits} className="rounded-lg border border-border bg-surface p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {LIMIT_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={limits[key]}
                  onChange={(e) => setLimits((l) => ({ ...l, [key]: Number(e.target.value) }))}
                />
                <p className="mt-1 text-xs text-muted">{hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button type="submit" loading={savingLimits} size="sm">
              Salvar limites
            </Button>
          </div>
        </form>
      </section>

      {/* Filtro global Section */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Filtros de descoberta</h2>
          <p className="text-xs text-muted">Palavras e marcas bloqueadas em todas as campanhas, além dos filtros fixos do sistema.</p>
        </div>
        <form onSubmit={saveFilter} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-col gap-4">
            <div>
              <Label>Palavras-chave bloqueadas</Label>
              <ChipInput
                items={keywords}
                onChange={setKeywords}
                placeholder="posto, autopeças, oficina..."
              />
            </div>
            <div>
              <Label>Marcas bloqueadas</Label>
              <ChipInput
                items={brands}
                onChange={setBrands}
                placeholder="Rede Local, Franquia X..."
              />
            </div>
            <div>
              <Button type="submit" loading={savingFilter} size="sm">
                Salvar filtros
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
