-- 0015: next action + Places photo + message rationale.
--
-- NEXT ACTION (SuiteCRM "Next Step" / Odoo activity pattern): every active commercial
-- lead must answer "qual é o próximo passo?". Hoje (post-it) is born from these columns.

alter table leads add column if not exists next_action_type text;
alter table leads add column if not exists next_action_at timestamptz;

-- Google Places photo resource name (places/{place}/photos/{photo}) — rendered via proxy.
alter table leads add column if not exists photo_name text;

-- "Why this message" (brief/observation/evidence) persisted with each generated message.
alter table outreach_messages add column if not exists rationale jsonb;

create index if not exists idx_leads_next_action_at
  on leads (next_action_at)
  where archived_at is null;

-- ── Backfill from existing operational fields ──────────────────────────────────

-- Scheduled follow-ups become dated follow_up actions.
update leads
set next_action_type = 'follow_up', next_action_at = next_follow_up_at
where next_follow_up_at is not null
  and archived_at is null
  and next_action_type is null
  and (pipeline_stage is null or pipeline_stage <> 'closed');

-- Upcoming meetings win over follow-ups.
update leads
set next_action_type = 'meeting', next_action_at = meeting_at
where meeting_at is not null
  and meeting_at > now()
  and archived_at is null;

-- Leads sitting in "proposta": the demand is chasing the proposal, not a generic follow-up.
update leads
set next_action_type = 'chase_proposal'
where pipeline_stage = 'proposal'
  and archived_at is null
  and next_action_type = 'follow_up';

-- Prepared-but-never-approached leads: a real (undated) demand — primeira abordagem.
update leads
set next_action_type = 'first_approach'
where commercial_status = 'message_ready'
  and archived_at is null
  and next_action_type is null
  and (pipeline_stage is null or pipeline_stage <> 'closed');
