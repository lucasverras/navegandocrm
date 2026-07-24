-- Radar Navegando — commercial pipeline (Kanban), follow-ups, and ownership.
-- Reuses public.outreach_events for the stage-change history (event_type = 'stage_changed')
-- instead of a new events table — outreach_events already covers lead-scoped event logging.

alter table public.leads
  add column if not exists pipeline_stage text not null default 'new'
    check (pipeline_stage in ('new', 'qualified', 'to_approach', 'in_contact', 'meeting_proposal', 'closed')),
  add column if not exists pipeline_position integer not null default 0,
  add column if not exists previous_stage text,
  add column if not exists stage_changed_at timestamptz not null default now(),
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists first_contacted_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists meeting_at timestamptz,
  add column if not exists meeting_status text
    check (meeting_status is null or meeting_status in ('scheduled', 'held', 'proposal_pending', 'proposal_sent', 'negotiation')),
  add column if not exists proposal_sent_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_service text,
  add column if not exists closed_value numeric(12,2),
  add column if not exists closed_note text,
  add column if not exists lost_reason text,
  add column if not exists archived_at timestamptz;

create index if not exists leads_pipeline_stage_idx on public.leads (pipeline_stage, pipeline_position);
create index if not exists leads_next_follow_up_idx on public.leads (next_follow_up_at);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_last_activity_idx on public.leads (last_activity_at desc);

-- Backfill last_activity_at from created_at for existing rows (was just added with `now()` default).
update public.leads set last_activity_at = created_at where last_activity_at > created_at;
