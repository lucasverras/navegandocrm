import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/Card";
import { ClientRow, formatBRL, type ClientLead } from "@/components/fechados/ClientRow";
import { Wallet } from "lucide-react";

type Row = ClientLead & { regions: { neighborhood: string } | null };

export default async function FechadosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, closed_at, created_at, churned_at, closed_service, closed_value, received_value, regions(neighborhood)")
    .eq("pipeline_stage", "closed")
    .order("closed_at", { ascending: false, nullsFirst: false });

  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, region: r.regions?.neighborhood ?? null }));

  const active = rows.filter((r) => !r.churned_at).length;
  const totalBrought = rows.reduce((s, r) => s + (r.closed_value ?? 0), 0);
  const totalReceived = rows.reduce((s, r) => s + (r.received_value ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Clientes" title="Fechados" />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="Nenhum cliente fechado ainda"
          description="Quando você fechar um negócio no pipeline (etapa Fechado), ele aparece aqui."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Clientes fechados" value={String(rows.length)} />
            <Stat label="Ativos hoje" value={String(active)} />
            <Stat label="Total trazido" value={formatBRL(totalBrought)} accent />
            <Stat label="Total recebido" value={formatBRL(totalReceived)} accent />
          </div>

          <Table>
            <THead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Entrada</Th>
                <Th>Encerramento</Th>
                <Th>Serviço</Th>
                <Th>Valor trazido</Th>
                <Th>Valor recebido</Th>
                <Th></Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <ClientRow key={r.id} client={r} />
              ))}
              <Tr>
                <Td className="font-medium text-foreground">Total</Td>
                <Td></Td>
                <Td></Td>
                <Td></Td>
                <Td className="font-semibold text-foreground">{formatBRL(totalBrought)}</Td>
                <Td className="font-semibold text-foreground">{formatBRL(totalReceived)}</Td>
                <Td></Td>
              </Tr>
            </TBody>
          </Table>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className={`font-display text-2xl font-extrabold tracking-tight ${accent ? "text-accent-2" : "text-foreground"}`}>
          {value}
        </p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </CardContent>
    </Card>
  );
}
