-- Won-clients tracking (the "Fechados" screen): when a client churned (null = still active,
-- shown as "até hoje") and how much has actually been received vs the closed_value (the value
-- the deal brought to Navegando). Additive & safe.

alter table public.leads
  add column if not exists churned_at timestamptz,
  add column if not exists received_value numeric(12,2);
