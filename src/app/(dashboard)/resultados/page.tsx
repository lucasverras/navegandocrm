import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { Table, THead, TBody, Tr, Th } from "@/components/ui/Table";
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
import { formatDateOnly } from "@/lib/utils";
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
        <div className="flex flex-col gap-8">
          {/* Hero — the three numbers that matter most, editorial not boxed. */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Hero label="Receita gerada p/ Navegando" value={BRL.format(receita)} />
            <Hero label="MRR que você trouxe" value={BRL.format(mrr)} accent />
            <Hero label="Total a receber" value={BRL.format(totalReceber)} accent />
          </div>
          {/* Secondary — compact, divided, no boxes. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-4">
            <Mini label="Clientes que trouxe" value={String(clients.length)} />
            <Mini label="Ativos" value={String(activeCount)} />
            <Mini label="Ticket médio" value={BRL.format(ticket)} />
            <Mini label="Fechamentos no mês" value={String(fechamentosMes)} />
            <Mini label="Comissões geradas" value={BRL.format(comGerada)} />
            <Mini label="Comissões recebidas" value={BRL.format(comRecebida)} />
            <Mini label="Comissões pendentes" value={BRL.format(comPendente)} />
            <Mini label="Reembolsos pendentes" value={BRL.format(reembT.pending)} />
          </div>

          {/* Clientes fechados — a quick list right on the overview, so the numbers above have
              faces behind them. Full detail + edição fica na aba "Fechados". */}
          {clients.length > 0 && (
            <div className="border-t border-border pt-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-foreground">Clientes fechados</h2>
                {clients.length > 8 && (
                  <Link href="/resultados?tab=fechados" className="text-xs text-muted transition-colors hover:text-foreground">
                    Ver todos ({clients.length})
                  </Link>
                )}
              </div>
              <ul className="flex flex-col">
                {clients.slice(0, 8).map((c) => {
                  const active = isActive(c);
                  const fee = c.current_monthly_fee ?? c.initial_monthly_fee ?? 0;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-4 border-b border-border/70 py-2.5 last:border-b-0">
                      <div className="min-w-0">
                        <Link href={`/leads/${c.id}`} className="text-sm font-medium text-foreground transition-colors hover:text-accent-2">
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {c.region ?? "Sem região"} · desde {c.closed_at ? formatDateOnly(c.closed_at) : "—"}
                          {fee > 0 && ` · ${BRL.format(fee)}/mês`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-5">
                        <span className="tabular-nums text-sm font-semibold text-foreground">{BRL.format(receitaGerada(c, now))}</span>
                        <span className={`w-16 text-right text-xs ${active ? "text-success" : "text-muted"}`}>
                          {active ? "Ativo" : "Encerrado"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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

function Hero({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className={`font-display text-[34px] font-extrabold leading-none tracking-tight tabular-nums ${accent ? "text-accent-2" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
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
