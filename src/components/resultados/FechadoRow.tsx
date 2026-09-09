"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Td, Tr } from "@/components/ui/Table";
import { EditClientDialog } from "./EditClientDialog";
import { formatDate } from "@/lib/utils";
import { BRL, receitaGerada, commissionGenerated, monthsBetween, isActive, type ClientFinance } from "@/lib/finance";

export type Fechado = ClientFinance & {
  id: string;
  name: string;
  region: string | null;
  lead_origin: string;
  closed_note: string | null;
};

export function FechadoRow({ client }: { client: Fechado }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = isActive(client);
  const months = client.closed_at ? monthsBetween(client.closed_at, client.churned_at ?? new Date().toISOString()) : 0;
  const comGerada = commissionGenerated(client);
  const comRecebida = client.commission_received ?? 0;
  const comPendente = comGerada - comRecebida;

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
      <Td className="text-xs tabular-nums">{client.closed_at ? formatDate(client.closed_at) : "—"}</Td>
      <Td className="text-xs tabular-nums">{client.churned_at ? formatDate(client.churned_at) : "—"}</Td>
      <Td className="tabular-nums text-xs">{months} {months === 1 ? "mês" : "meses"}</Td>
      <Td className="tabular-nums text-xs">{BRL.format(client.current_monthly_fee ?? client.initial_monthly_fee ?? 0)}</Td>
      <Td className="tabular-nums text-xs">{BRL.format(receitaGerada(client))}</Td>
      <Td className="tabular-nums text-xs">{BRL.format(comGerada)}</Td>
      <Td className="tabular-nums text-xs">{BRL.format(comRecebida)}</Td>
      <Td className={`tabular-nums text-xs ${comPendente > 0 ? "font-medium text-accent-2" : "text-muted"}`}>
        {BRL.format(comPendente)}
      </Td>
      <Td>
        <span className={`text-xs ${active ? "text-success" : "text-muted"}`}>{active ? "Ativo" : "Encerrado"}</span>
      </Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <EditClientDialog client={client} />
          <button
            type="button"
            disabled={busy}
            onClick={toggleChurn}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              active ? "border-border text-muted hover:border-danger hover:text-danger" : "border-border text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {active ? "Encerrar" : "Reativar"}
          </button>
        </div>
      </Td>
    </Tr>
  );
}
