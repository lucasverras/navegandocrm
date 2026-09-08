"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Td, Tr } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import { BRL, receitaGerada, monthsBetween, isActive, type ClientFinance } from "@/lib/finance";

export type Fechado = ClientFinance & { id: string; name: string; region: string | null; lead_origin: string };

export function FechadoRow({ client }: { client: Fechado }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = isActive(client);
  const months = client.closed_at ? monthsBetween(client.closed_at, client.churned_at ?? new Date().toISOString()) : 0;

  async function toggleChurn() {
    setBusy(true);
    const res = await fetch(`/api/leads/${client.id}/client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ churned_at: active ? new Date().toISOString() : null }),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Erro");
    toast.success(active ? "Cliente encerrado" : "Cliente reativado");
    router.refresh();
  }

  return (
    <Tr>
      <Td>
        <Link href={`/leads/${client.id}`} className="font-medium text-foreground hover:text-accent-2">
          {client.name}
        </Link>
      </Td>
      <Td className="text-xs">{client.closed_at ? formatDate(client.closed_at) : "—"}</Td>
      <Td className="text-xs">{client.churned_at ? formatDate(client.churned_at) : "—"}</Td>
      <Td className="tabular-nums text-xs">{months} {months === 1 ? "mês" : "meses"}</Td>
      <Td className="tabular-nums text-xs">{BRL.format(client.current_monthly_fee ?? client.initial_monthly_fee ?? 0)}</Td>
      <Td>
        <span className={active ? "text-success" : "text-muted"}>{active ? "Ativo" : "Encerrado"}</span>
      </Td>
      <Td className="tabular-nums font-medium">{BRL.format(receitaGerada(client))}</Td>
      <Td className="text-xs text-muted">{client.region ?? "—"}</Td>
      <Td>
        <button
          type="button"
          disabled={busy}
          onClick={toggleChurn}
          className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
            active ? "border-border text-muted hover:border-danger hover:text-danger" : "border-border text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {active ? "Encerrar" : "Reativar"}
        </button>
      </Td>
    </Tr>
  );
}
