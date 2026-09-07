"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const RESPONSES: { key: string; label: string; tone?: "danger" }[] = [
  { key: "respondeu", label: "Respondeu" },
  { key: "interessado", label: "Interessado" },
  { key: "apresentacao", label: "Mandar apresentação" },
  { key: "reuniao", label: "Reunião" },
  { key: "depois", label: "Falar depois" },
  { key: "agencia", label: "Já tem agência" },
  { key: "contato_errado", label: "Contato errado", tone: "danger" },
  { key: "nao_interessado", label: "Não interessado", tone: "danger" },
];

// One-tap response registration — auto-adjusts status, pipeline stage and follow-up server-side.
export function ResponseActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function register(key: string, label: string) {
    setBusy(key);
    const res = await fetch(`/api/leads/${leadId}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: key }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error("Erro ao registrar resposta");
      return;
    }
    toast.success(`Registrado: ${label}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar resposta</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {RESPONSES.map((r) => (
            <button
              key={r.key}
              type="button"
              disabled={busy !== null}
              onClick={() => register(r.key, r.label)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                r.tone === "danger"
                  ? "border-border text-muted hover:border-danger hover:text-danger"
                  : "border-border text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
