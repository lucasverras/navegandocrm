"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Td, Tr } from "@/components/ui/Table";
import { BRL, commissionGenerated, commissionPending, type ClientFinance, type CommissionType } from "@/lib/finance";

export type CommissionClient = ClientFinance & { id: string; name: string; region: string | null };

const TYPE_LABEL: Record<CommissionType, string> = {
  one_time_percentage: "Pontual",
  legacy_recurring: "Legado 10%/mês",
  none: "Sem comissão",
};

export function CommissionRow({ client }: { client: CommissionClient }) {
  const router = useRouter();
  const [pay, setPay] = useState("");
  const [busy, setBusy] = useState(false);
  const generated = commissionGenerated(client);
  const pending = commissionPending(client);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    const res = await fetch(`/api/leads/${client.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Erro");
    toast.success(ok);
    router.refresh();
  }

  return (
    <Tr>
      <Td>
        <Link href={`/leads/${client.id}`} className="font-medium text-foreground hover:text-accent-2">
          {client.name}
        </Link>
        <div className="text-xs text-muted">{client.region ?? "—"}</div>
      </Td>
      <Td className="text-xs">{TYPE_LABEL[client.commission_type]}</Td>
      <Td className="tabular-nums text-xs">{BRL.format(client.initial_monthly_fee ?? 0)}</Td>
      <Td className="tabular-nums text-xs">{client.commission_percent != null ? `${client.commission_percent}%` : "—"}</Td>
      <Td className="tabular-nums font-medium">{BRL.format(generated)}</Td>
      <Td className="tabular-nums">{BRL.format(client.commission_received ?? 0)}</Td>
      <Td className={`tabular-nums font-semibold ${pending > 0 ? "text-accent-2" : "text-muted"}`}>{BRL.format(pending)}</Td>
      <Td>
        <div className="flex flex-wrap items-center gap-1">
          {client.commission_type === "one_time_percentage" && !client.first_payment_paid && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: "first_payment", paid: true }, "1ª mensalidade paga")}
              className="rounded-md border border-accent/40 bg-accent-soft px-2 py-1 text-xs text-accent-2 hover:bg-accent hover:text-white"
            >
              1ª paga
            </button>
          )}
          {client.commission_type === "legacy_recurring" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: "add_legacy_month" }, "Mês pago registrado")}
              className="rounded-md border border-accent/40 bg-accent-soft px-2 py-1 text-xs text-accent-2 hover:bg-accent hover:text-white"
            >
              + mês pago
            </button>
          )}
          <input
            value={pay}
            onChange={(e) => setPay(e.target.value)}
            inputMode="decimal"
            placeholder="R$ recebido"
            className="h-7 w-24 rounded-md border border-border bg-surface-2 px-2 text-xs tabular-nums text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={busy || !pay.trim()}
            onClick={() => {
              act({ action: "register_received", amount: Number(pay.replace(",", ".")) }, "Pagamento registrado");
              setPay("");
            }}
            className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted hover:text-foreground disabled:opacity-40"
          >
            Registrar
          </button>
        </div>
      </Td>
    </Tr>
  );
}
