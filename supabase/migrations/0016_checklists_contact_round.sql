-- 0016: Checklists (standalone todos) + contact rounds (explicit outreach stage).

-- ── CHECKLISTS ──────────────────────────────────────────────────────────────────
-- A checklist item is NOT a lead. It can be anything: "Falar com Kaue", "Reembolso
-- drone", "Confirmar gravação X". Optionally linked to a lead for context.

create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  text text not null,
  lead_id uuid references leads(id) on delete set null,
  amount numeric(12,2),
  due_at timestamptz,
  type text, -- free tag: 'reembolso', 'interno', 'cliente', etc.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checklists_user_pending
  on checklists (user_id, created_at)
  where completed_at is null;

-- RLS: user sees only their own items.
alter table checklists enable row level security;

create policy "Users see own checklists"
  on checklists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role (admin client) bypasses RLS.
grant all on checklists to service_role;

-- ── CONTACT ROUNDS ──────────────────────────────────────────────────────────────
-- Explicit outreach stage: FIRST_CONTACT → FOLLOW_UP_1 → FOLLOW_UP_2 → FOLLOW_UP_3.
-- Replaces the opaque cadence_step integer with a human-readable enum that powers
-- "Trabalhar rodada" and the Home rounds summary.

alter table leads add column if not exists contact_round text;

-- Backfill from existing cadence_step values:
update leads set contact_round = 'FIRST_CONTACT'
  where contact_round is null
    and cadence_step = 0
    and commercial_status in ('message_ready', 'not_contacted')
    and pipeline_stage is not null
    and pipeline_stage <> 'closed'
    and archived_at is null;

update leads set contact_round = 'FOLLOW_UP_1'
  where contact_round is null
    and cadence_step = 1
    and archived_at is null;

update leads set contact_round = 'FOLLOW_UP_2'
  where contact_round is null
    and cadence_step = 2
    and archived_at is null;

update leads set contact_round = 'FOLLOW_UP_3'
  where contact_round is null
    and cadence_step >= 3
    and archived_at is null;

create index if not exists idx_leads_contact_round
  on leads (contact_round)
  where archived_at is null and contact_round is not null;
