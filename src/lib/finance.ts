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
  finance_events?: {
    event_type: string;
    amount: number | null;
    effective_at: string;
  }[];
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

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Contractual revenue month by month. Fee changes affect their effective month onward,
// so editing today's fee never rewrites the revenue of earlier months.
export function receitaGerada(c: ClientFinance, now: Date = new Date()): number {
  if (!c.closed_at) return 0;
  const start = new Date(c.closed_at);
  const end = new Date(c.churned_at ?? now.toISOString());
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  let monthly = c.initial_monthly_fee ?? c.current_monthly_fee ?? 0;
  let revenue = 0;
  const changes = (c.finance_events ?? [])
    .filter((event) => event.event_type === "fee_changed" && event.amount != null)
    .sort((a, b) => a.effective_at.localeCompare(b.effective_at));
  let changeIndex = 0;

  while (cursor <= endMonth) {
    const currentMonth = monthKey(cursor);
    while (changes[changeIndex] && changes[changeIndex].effective_at.slice(0, 7) <= currentMonth) {
      monthly = changes[changeIndex].amount ?? monthly;
      changeIndex += 1;
    }
    revenue += monthly;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return revenue;
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
