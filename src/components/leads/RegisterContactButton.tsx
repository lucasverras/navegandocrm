"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { PhoneCall, Check } from "lucide-react";

export function RegisterContactButton({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function register() {
    setLoading(true);
    setDone(true);
    const res = await fetch(`/api/leads/${leadId}/contact`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setDone(false);
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao registrar contato");
      return;
    }
    toast.success("Contato registrado");
  }

  if (done) {
    return (
      <Button size="sm" variant="secondary" disabled>
        <Check className="h-3.5 w-3.5" /> Registrado
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" loading={loading} onClick={register}>
      <PhoneCall className="h-3.5 w-3.5" />
      Registrar contato
    </Button>
  );
}
