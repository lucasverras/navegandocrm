import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthsBetween,
  receitaGerada,
  commissionGenerated,
  commissionPending,
  mrrActive,
  reimbursementTotals,
  type ClientFinance,
} from "./finance";

const base: ClientFinance = {
  closed_at: "2026-07-01T00:00:00Z",
  churned_at: null,
  initial_monthly_fee: 4000,
  current_monthly_fee: 4000,
  commission_type: "one_time_percentage",
  commission_percent: 20,
  first_payment_paid: false,
  legacy_months_paid: 0,
  commission_received: 0,
};

test("receita gerada: Jul→Nov, R$4.000/mês = 5 meses = R$20.000 (§97)", () => {
  assert.equal(monthsBetween("2026-07-01", "2026-11-15"), 5);
  const c = { ...base, churned_at: "2026-11-15T00:00:00Z" };
  assert.equal(receitaGerada(c), 20000);
});

test("comissão pontual: 20% de R$4.000 = R$800 quando 1ª mensalidade paga (§45/§95)", () => {
  assert.equal(commissionGenerated({ ...base, first_payment_paid: false }), 0);
  assert.equal(commissionGenerated({ ...base, first_payment_paid: true }), 800);
  // pagamento parcial: gerada 800, recebida 500 → pendente 300 (§48)
  assert.equal(commissionPending({ ...base, first_payment_paid: true, commission_received: 500 }), 300);
});

test("comissão legado: 10% de R$4.000 = R$400/mês, base sempre a inicial (§44/§96)", () => {
  const legacy: ClientFinance = {
    ...base,
    commission_type: "legacy_recurring",
    commission_percent: 10,
    initial_monthly_fee: 4000,
    current_monthly_fee: 5000, // atual maior, mas comissão usa a inicial
    legacy_months_paid: 1,
  };
  assert.equal(commissionGenerated(legacy), 400); // nunca 500
  assert.equal(commissionGenerated({ ...legacy, legacy_months_paid: 2 }), 800);
});

test("MRR ativo soma mensalidade atual só dos ativos", () => {
  const active = { ...base, current_monthly_fee: 5000 };
  const churned = { ...base, churned_at: "2026-10-01T00:00:00Z", current_monthly_fee: 3000 };
  assert.equal(mrrActive([active, churned]), 5000);
});

test("reembolsos: drone R$750 pendente + uber R$80 recebido (§98)", () => {
  const totals = reimbursementTotals([
    { amount: 750, amount_received: 0, status: "pendente" },
    { amount: 80, amount_received: 80, status: "recebido" },
  ]);
  assert.deepEqual(totals, { total: 830, received: 80, pending: 750 });
});
