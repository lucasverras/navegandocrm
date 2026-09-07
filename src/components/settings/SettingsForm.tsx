"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export interface UsageLimitsValue {
  haiku_analyses_per_day: number;
  decision_maker_searches_per_day: number;
  sonnet_refinements_per_day: number;
}

interface SettingsFormProps {
  initialUsageLimits: UsageLimitsValue;
  initialBlockedKeywords: string[];
  initialBlockedBrands: string[];
}

const LIMIT_FIELDS: { key: keyof UsageLimitsValue; label: string; hint: string }[] = [
  { key: "haiku_analyses_per_day", label: "Análises Haiku / dia", hint: "Triagem automática de leads." },
  { key: "decision_maker_searches_per_day", label: "Buscas de decisor / dia", hint: "Localização de responsáveis." },
  { key: "sonnet_refinements_per_day", label: "Refinamentos Sonnet / dia", hint: "Mensagens refinadas por IA." },
];

// Comma-separated (or newline) text ⇄ list of trimmed terms.
function parseList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function SettingsForm({ initialUsageLimits, initialBlockedKeywords, initialBlockedBrands }: SettingsFormProps) {
  const router = useRouter();
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingFilter, setSavingFilter] = useState(false);
  const [limits, setLimits] = useState<UsageLimitsValue>(initialUsageLimits);
  const [keywords, setKeywords] = useState(initialBlockedKeywords.join(", "));
  const [brands, setBrands] = useState(initialBlockedBrands.join(", "));

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
      extra_blocked_keywords: parseList(keywords),
      extra_blocked_brands: parseList(brands),
    });
    setSavingFilter(false);
    if (ok) {
      toast.success("Filtro global atualizado");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Limites de IA</CardTitle>
          <CardDescription>
            Teto diário de operações com IA. Ao atingir o limite, novas chamadas são bloqueadas até o dia seguinte (UTC).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveLimits} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <div className="sm:col-span-3">
              <Button type="submit" loading={savingLimits}>
                Salvar limites
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtro global</CardTitle>
          <CardDescription>
            Palavras e marcas adicionais bloqueadas em todas as campanhas de descoberta, além dos filtros fixos do
            sistema. Separe os termos por vírgula.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveFilter} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="extra_blocked_keywords">Palavras-chave bloqueadas</Label>
              <Textarea
                id="extra_blocked_keywords"
                rows={3}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="posto, autopeças, oficina"
              />
            </div>
            <div>
              <Label htmlFor="extra_blocked_brands">Marcas bloqueadas</Label>
              <Textarea
                id="extra_blocked_brands"
                rows={3}
                value={brands}
                onChange={(e) => setBrands(e.target.value)}
                placeholder="Rede Local, Franquia X"
              />
            </div>
            <div>
              <Button type="submit" loading={savingFilter}>
                Salvar filtro
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
