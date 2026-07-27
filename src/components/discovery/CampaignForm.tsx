"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CATEGORIES } from "@/types/domain";

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurantes",
  bar: "Bares",
  cafe: "Cafeterias",
  bakery: "Padarias",
  meal_takeaway: "Comida para viagem",
  steak_house: "Churrascarias",
  hamburger_restaurant: "Hamburguerias",
  pizza_restaurant: "Pizzarias",
  brazilian_restaurant: "Comida brasileira",
  italian_restaurant: "Comida italiana",
  japanese_restaurant: "Comida japonesa",
  seafood_restaurant: "Frutos do mar",
  dessert_shop: "Docerias",
  ice_cream_shop: "Sorveterias",
  coffee_shop: "Cafés",
  sandwich_shop: "Sanduicherias",
};

const defaultForm = {
  name: "",
  neighborhood: "",
  city: "",
  state: "",
  radius_meters: 2000,
  included_types: [...CATEGORIES] as string[],
  blocked_keywords: "",
  min_rating: "",
  min_reviews: "",
  exclude_franchises: false,
  exclude_no_phone: false,
  exclude_no_website: false,
};

export function CampaignForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [conflict, setConflict] = useState<{ existingCampaignId: string } | null>(null);

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      included_types: f.included_types.includes(cat)
        ? f.included_types.filter((c) => c !== cat)
        : [...f.included_types, cat],
    }));
  }

  async function submit(force: boolean) {
    setLoading(true);
    const res = await fetch("/api/discovery-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        min_rating: form.min_rating ? Number(form.min_rating) : null,
        min_reviews: form.min_reviews ? Number(form.min_reviews) : null,
        blocked_keywords: form.blocked_keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        force,
      }),
    });
    setLoading(false);

    if (res.status === 409) {
      const data = await res.json();
      setConflict({ existingCampaignId: data.existingCampaignId });
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao criar campanha");
      return;
    }

    toast.success("Campanha criada");
    setForm(defaultForm);
    setConflict(null);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova campanha de descoberta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Nome da campanha</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mooca • Restaurantes independentes"
              />
            </div>
            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                required
                value={form.neighborhood}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                placeholder="Mooca"
              />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                required
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="São Paulo"
              />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                required
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                placeholder="SP"
              />
            </div>
            <div>
              <Label htmlFor="radius">Raio (m)</Label>
              <Input
                id="radius"
                type="number"
                min={200}
                max={20000}
                step={100}
                required
                value={form.radius_meters}
                onChange={(e) => setForm((f) => ({ ...f, radius_meters: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="min_rating">Nota mínima</Label>
              <Input
                id="min_rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={form.min_rating}
                onChange={(e) => setForm((f) => ({ ...f, min_rating: e.target.value }))}
                placeholder="Ex: 3.5"
              />
            </div>
            <div>
              <Label htmlFor="min_reviews">Avaliações mínimas</Label>
              <Input
                id="min_reviews"
                type="number"
                min={0}
                value={form.min_reviews}
                onChange={(e) => setForm((f) => ({ ...f, min_reviews: e.target.value }))}
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div>
            <Label>Categorias incluídas</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    form.included_types.includes(cat)
                      ? "border-accent bg-accent-soft text-accent-2"
                      : "border-border bg-surface-2 text-muted"
                  }`}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="blocked_keywords">
              Palavras bloqueadas adicionais (separadas por vírgula, além do filtro padrão)
            </Label>
            <Textarea
              id="blocked_keywords"
              rows={2}
              value={form.blocked_keywords}
              onChange={(e) => setForm((f) => ({ ...f, blocked_keywords: e.target.value }))}
              placeholder="ex: rede, franquia local X"
            />
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.exclude_franchises}
                onChange={(e) => setForm((f) => ({ ...f, exclude_franchises: e.target.checked }))}
              />
              Excluir franquias/redes conhecidas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.exclude_no_phone}
                onChange={(e) => setForm((f) => ({ ...f, exclude_no_phone: e.target.checked }))}
              />
              Excluir sem telefone
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.exclude_no_website}
                onChange={(e) => setForm((f) => ({ ...f, exclude_no_website: e.target.checked }))}
              />
              Excluir sem site
            </label>
          </div>

          {conflict ? (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
              <p>Já existe uma campanha para essa região.</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" onClick={() => submit(true)} loading={loading}>
                  Criar mesmo assim
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setConflict(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button type="submit" loading={loading}>
                Criar campanha
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
