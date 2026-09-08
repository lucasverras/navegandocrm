-- Results / finance (V4): per-client contract + commission rule (frozen per client, never
-- recalculated retroactively) and a reimbursements ledger. Additive & safe.
-- contract_start = closed_at (existing); contract_end = churned_at (existing, 0012).

alter table public.leads
  add column if not exists commission_type text not null default 'one_time_percentage'
    check (commission_type in ('legacy_recurring', 'one_time_percentage', 'none')),
  add column if not exists commission_percent numeric(5,2),
  add column if not exists initial_monthly_fee numeric(12,2),
  add column if not exists current_monthly_fee numeric(12,2),
  add column if not exists first_payment_paid boolean not null default false,
  add column if not exists first_payment_at timestamptz,
  add column if not exists legacy_months_paid integer not null default 0,
  add column if not exists commission_received numeric(12,2) not null default 0,
  add column if not exists lead_origin text not null default 'radar';

create table if not exists public.reimbursements (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  description text not null,
  amount numeric(12,2) not null default 0,
  amount_received numeric(12,2) not null default 0,
  spent_at timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'recebido')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reimbursements_status_idx on public.reimbursements (status, created_at desc);

alter table public.reimbursements enable row level security;

drop policy if exists reimbursements_all_authenticated on public.reimbursements;
create policy reimbursements_all_authenticated on public.reimbursements
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.reimbursements to authenticated;
