"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { PhoneCall } from "lucide-react";

export function RegisterContactButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function register() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/contact`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao registrar contato");
      return;
    }
    toast.success("Contato registrado");
    router.refresh();
  }

  return (
    <Button size="sm" variant="outline" loading={loading} onClick={register}>
      <PhoneCall className="h-3.5 w-3.5" />
      Registrar contato
    </Button>
  );
}
