-- Cadence (D+2/D+5/D+10 follow-up chain) + structured Reunião & Proposta capture. Additive/safe.
-- meeting_at, meeting_status and proposal_sent_at already exist (0003); add the missing pieces.

alter table public.leads
  add column if not exists cadence_step integer not null default 0,
  add column if not exists meeting_link text,
  add column if not exists meeting_note text,
  add column if not exists proposal_value numeric(12,2),
  add column if not exists proposal_note text;
