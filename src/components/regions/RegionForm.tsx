"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function RegionForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ neighborhood: "", city: "", state: "", radius_meters: 2000 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao criar região");
      return;
    }

    toast.success("Região adicionada");
    setForm({ neighborhood: "", city: "", state: "", radius_meters: 2000 });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova região</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
          <div className="sm:col-span-4">
            <Button type="submit" loading={loading}>
              Adicionar região
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
