// Results / finance rules (V4). Pure, deterministic. Each client freezes its own commission
// rule; nothing is recalculated retroactively when defaults change.

export type CommissionType = "legacy_recurring" | "one_time_percentage" | "none";

export interface ClientFinance {
  closed_at: string | null; // contract start (when the deal closed)
  churned_at: string | null; // contract end (null = still active)
  initial_monthly_fee: number | null;
  current_monthly_fee: number | null;
  commission_type: CommissionType;
  commission_percent: number | null;
  first_payment_paid: boolean;
  legacy_months_paid: number;
  commission_received: number;
}

// Inclusive count of calendar months between two dates. Jul → Nov = 5.
export function monthsBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso);
  const e = new Date(endIso);
  // UTC to avoid a timezone shifting a day-01 date into the previous month.
  const months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
  return Math.max(0, months);
}

export function isActive(c: Pick<ClientFinance, "churned_at">): boolean {
  return !c.churned_at;
}

// Contractual revenue the client generated for Navegando: months active × monthly fee.
// Active clients count up to the current month. Uses current fee, falling back to initial.
export function receitaGerada(c: ClientFinance, now: Date = new Date()): number {
  if (!c.closed_at) return 0;
  const monthly = c.current_monthly_fee ?? c.initial_monthly_fee ?? 0;
  const end = c.churned_at ?? now.toISOString();
  return monthsBetween(c.closed_at, end) * monthly;
}

// Commission the client has GENERATED so far. Base is ALWAYS the initial monthly fee.
export function commissionGenerated(c: ClientFinance): number {
  const pct = (c.commission_percent ?? 0) / 100;
  const base = c.initial_monthly_fee ?? 0;
  switch (c.commission_type) {
    case "one_time_percentage":
      return c.first_payment_paid ? pct * base : 0;
    case "legacy_recurring":
      return pct * base * (c.legacy_months_paid ?? 0);
    default:
      return 0;
  }
}

export function commissionPending(c: ClientFinance): number {
  return Math.max(0, commissionGenerated(c) - (c.commission_received ?? 0));
}

// MRR the commercial brought = sum of the current monthly fee across ACTIVE clients.
export function mrrActive(clients: ClientFinance[]): number {
  return clients.filter(isActive).reduce((s, c) => s + (c.current_monthly_fee ?? c.initial_monthly_fee ?? 0), 0);
}

export interface Reimbursement {
  amount: number;
  amount_received: number;
  status: "pendente" | "recebido";
}

export function reimbursementTotals(rows: Reimbursement[]) {
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const received = rows.reduce((s, r) => s + (r.status === "recebido" ? r.amount : r.amount_received ?? 0), 0);
  return { total, received, pending: Math.max(0, total - received) };
}

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
