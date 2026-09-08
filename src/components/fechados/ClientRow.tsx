"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Td, Tr } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";

export type ClientLead = {
  id: string;
  name: string;
  closed_at: string | null;
  created_at: string;
  churned_at: string | null;
  closed_service: string | null;
  closed_value: number | null;
  received_value: number | null;
  region: string | null;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ClientRow({ client }: { client: ClientLead }) {
  const router = useRouter();
  const [brought, setBrought] = useState(client.closed_value?.toString() ?? "");
  const [received, setReceived] = useState(client.received_value?.toString() ?? "");
  const [churnedAt, setChurnedAt] = useState(client.churned_at);
  const [saving, setSaving] = useState(false);

  async function patch(body: Record<string, unknown>, ok?: string) {
    setSaving(true);
    const res = await fetch(`/api/leads/${client.id}/client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Erro ao salvar");
      return false;
    }
    if (ok) toast.success(ok);
    router.refresh();
    return true;
  }

  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  async function toggleChurn() {
    if (churnedAt) {
      if (await patch({ churned_at: null }, "Cliente reativado")) setChurnedAt(null);
    } else {
      const now = new Date().toISOString();
      if (await patch({ churned_at: now }, "Cliente encerrado")) setChurnedAt(now);
    }
  }

  const entrada = client.closed_at ?? client.created_at;
  const inputCls =
    "h-8 w-28 rounded-md border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-accent";

  return (
    <Tr>
      <Td>
        <Link href={`/leads/${client.id}`} className="font-medium text-foreground hover:text-accent-2">
          {client.name}
        </Link>
        <div className="text-xs text-muted">{client.region ?? "—"}</div>
      </Td>
      <Td className="text-xs">{formatDate(entrada)}</Td>
      <Td className="text-xs">
        {churnedAt ? (
          <span className="text-muted">{formatDate(churnedAt)}</span>
        ) : (
          <span className="text-accent-2">Ativo · até hoje</span>
        )}
      </Td>
      <Td className="text-xs">{client.closed_service ?? "—"}</Td>
      <Td>
        <input
          value={brought}
          onChange={(e) => setBrought(e.target.value)}
          onBlur={() => patch({ closed_value: num(brought) })}
          disabled={saving}
          inputMode="decimal"
          placeholder="R$"
          className={inputCls}
          aria-label="Valor trazido"
        />
      </Td>
      <Td>
        <input
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          onBlur={() => patch({ received_value: num(received) })}
          disabled={saving}
          inputMode="decimal"
          placeholder="R$"
          className={inputCls}
          aria-label="Valor recebido"
        />
      </Td>
      <Td>
        <button
          type="button"
          onClick={toggleChurn}
          disabled={saving}
          className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
            churnedAt
              ? "border-border text-muted hover:border-accent hover:text-accent"
              : "border-border text-muted hover:border-danger hover:text-danger"
          }`}
        >
          {churnedAt ? "Reativar" : "Encerrar"}
        </button>
      </Td>
    </Tr>
  );
}

export function formatBRL(v: number | null | undefined): string {
  return brl.format(v ?? 0);
}
