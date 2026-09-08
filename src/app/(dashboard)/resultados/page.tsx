import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { Table, THead, TBody, Tr, Th } from "@/components/ui/Table";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FechadoRow, type Fechado } from "@/components/resultados/FechadoRow";
import { CommissionRow, type CommissionClient } from "@/components/resultados/CommissionRow";
import { ReimbursementsPanel, type Reimb } from "@/components/resultados/ReimbursementsPanel";
import { AddClientDialog } from "@/components/resultados/AddClientDialog";
import { Analytics } from "@/components/resultados/Analytics";
import { getAnalytics } from "@/components/resultados/analytics-data";
import {
  BRL,
  isActive,
  mrrActive,
  receitaGerada,
  commissionGenerated,
  commissionPending,
  reimbursementTotals,
  type ClientFinance,
} from "@/lib/finance";
import { Wallet } from "lucide-react";

type Tab = "overview" | "fechados" | "comissoes" | "reembolsos" | "analytics";
type ClientRow = ClientFinance & { id: string; name: string; lead_origin: string; regions: { neighborhood: string } | null };

const FIELDS =
  "id, name, closed_at, churned_at, initial_monthly_fee, current_monthly_fee, commission_type, commission_percent, first_payment_paid, legacy_months_paid, commission_received, lead_origin, regions(neighborhood)";

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabRaw } = await searchParams;
  const tab: Tab = ["fechados", "comissoes", "reembolsos", "analytics"].includes(tabRaw ?? "") ? (tabRaw as Tab) : "overview";
  const supabase = await createClient();

  const [{ data: clientsRaw }, { data: reimbsRaw }, { data: regionsRaw }] = await Promise.all([
    supabase.from("leads").select(FIELDS).eq("pipeline_stage", "closed").order("closed_at", { ascending: false, nullsFirst: false }),
    supabase.from("reimbursements").select("id, description, amount, amount_received, status, spent_at").order("created_at", { ascending: false }),
    supabase.from("regions").select("id, neighborhood, city").order("neighborhood", { ascending: true }),
  ]);

  const clients = ((clientsRaw ?? []) as unknown as ClientRow[]).map((c) => ({ ...c, region: c.regions?.neighborhood ?? null }));
  const reimbs = (reimbsRaw ?? []) as unknown as Reimb[];
  const regions = (regionsRaw ?? []) as { id: string; neighborhood: string; city: string }[];

  // Analytics queries run only when its tab is active (keeps other tabs untouched).
  const analytics = tab === "analytics" ? await getAnalytics(supabase) : null;

  // KPIs
  const now = new Date();
  const activeCount = clients.filter(isActive).length;
  const mrr = mrrActive(clients);
  const receita = clients.reduce((s, c) => s + receitaGerada(c, now), 0);
  const fechamentosMes = clients.filter(
    (c) => c.closed_at && new Date(c.closed_at).getUTCFullYear() === now.getUTCFullYear() && new Date(c.closed_at).getUTCMonth() === now.getUTCMonth()
  ).length;
  const withFee = clients.filter((c) => (c.current_monthly_fee ?? c.initial_monthly_fee ?? 0) > 0);
  const ticket = withFee.length ? withFee.reduce((s, c) => s + (c.current_monthly_fee ?? c.initial_monthly_fee ?? 0), 0) / withFee.length : 0;
  const comGerada = clients.reduce((s, c) => s + commissionGenerated(c), 0);
  const comRecebida = clients.reduce((s, c) => s + (c.commission_received ?? 0), 0);
  const comPendente = clients.reduce((s, c) => s + commissionPending(c), 0);
  const reembT = reimbursementTotals(reimbs);
  const totalReceber = comPendente + reembT.pending;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Visão geral" },
    { key: "fechados", label: "Fechados" },
    { key: "comissoes", label: "Comissões" },
    { key: "reembolsos", label: "Reembolsos" },
    { key: "analytics", label: "Analytics" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeading eyebrow="Comercial" title="Resultados" />
        <AddClientDialog regions={regions} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/resultados?tab=${t.key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Clientes que trouxe" value={String(clients.length)} />
            <Stat label="Ativos" value={String(activeCount)} />
            <Stat label="MRR que trouxe" value={BRL.format(mrr)} accent />
            <Stat label="Receita gerada" value={BRL.format(receita)} accent />
            <Stat label="Fechamentos no mês" value={String(fechamentosMes)} />
            <Stat label="Ticket médio" value={BRL.format(ticket)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Comissões geradas" value={BRL.format(comGerada)} />
            <Stat label="Comissões recebidas" value={BRL.format(comRecebida)} />
            <Stat label="Comissões pendentes" value={BRL.format(comPendente)} accent />
            <Stat label="Reembolsos pendentes" value={BRL.format(reembT.pending)} />
            <Stat label="Total a receber" value={BRL.format(totalReceber)} accent />
          </div>
        </div>
      )}

      {tab === "fechados" &&
        (clients.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Entrou</Th>
                <Th>Saiu</Th>
                <Th>Tempo ativo</Th>
                <Th>Mensalidade</Th>
                <Th>Status</Th>
                <Th>Receita acumulada</Th>
                <Th>Região</Th>
                <Th></Th>
              </Tr>
            </THead>
            <TBody>
              {clients.map((c) => (
                <FechadoRow key={c.id} client={c as Fechado} />
              ))}
            </TBody>
          </Table>
        ))}

      {tab === "comissoes" &&
        (clients.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Regra</Th>
                <Th>Base</Th>
                <Th>%</Th>
                <Th>Gerada</Th>
                <Th>Recebida</Th>
                <Th>Pendente</Th>
                <Th></Th>
              </Tr>
            </THead>
            <TBody>
              {clients.map((c) => (
                <CommissionRow key={c.id} client={c as CommissionClient} />
              ))}
            </TBody>
          </Table>
        ))}

      {tab === "reembolsos" && <ReimbursementsPanel rows={reimbs} />}

      {tab === "analytics" && analytics && <Analytics data={analytics} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className={`font-display text-xl font-extrabold tabular-nums tracking-tight ${accent ? "text-accent-2" : "text-foreground"}`}>
          {value}
        </p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <EmptyState
      icon={<Wallet className="h-8 w-8" />}
      title="Nenhum cliente fechado ainda"
      description="Feche um negócio no pipeline (arraste para Fechado) para vê-lo aqui."
    />
  );
}
