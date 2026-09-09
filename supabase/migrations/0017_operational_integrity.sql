-- Operational integrity for historical clients, meeting/proposal outcomes and finance auditing.

alter table public.searches alter column region_id drop not null;

alter table public.leads
  add column if not exists record_source text not null default 'radar',
  add column if not exists proposal_status text;

alter table public.leads drop constraint if exists leads_record_source_check;
alter table public.leads add constraint leads_record_source_check
  check (record_source in ('radar', 'manual', 'historical'));

alter table public.leads drop constraint if exists leads_meeting_status_check;
alter table public.leads add constraint leads_meeting_status_check
  check (meeting_status is null or meeting_status in (
    'scheduled', 'held', 'no_show', 'cancelled', 'rescheduled',
    'proposal_pending', 'proposal_sent', 'negotiation'
  ));

alter table public.leads drop constraint if exists leads_proposal_status_check;
alter table public.leads add constraint leads_proposal_status_check
  check (proposal_status is null or proposal_status in ('sent', 'accepted', 'rejected', 'revised'));

alter table public.outreach_messages
  add column if not exists contact_round text,
  add column if not exists purpose text not null default 'initial';

alter table public.outreach_messages drop constraint if exists outreach_messages_contact_round_check;
alter table public.outreach_messages add constraint outreach_messages_contact_round_check
  check (contact_round is null or contact_round in ('FIRST_CONTACT', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'FOLLOW_UP_3'));

alter table public.outreach_messages drop constraint if exists outreach_messages_purpose_check;
alter table public.outreach_messages add constraint outreach_messages_purpose_check
  check (purpose in ('initial', 'follow_up'));

create index if not exists idx_outreach_messages_lead_round
  on public.outreach_messages (lead_id, contact_round, created_at desc);

create table if not exists public.client_finance_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null check (event_type in (
    'contract_started', 'fee_changed', 'commission_rule_changed',
    'commission_generated', 'commission_received', 'client_payment',
    'contract_ended', 'contract_reactivated', 'adjustment'
  )),
  amount numeric(12,2),
  effective_at timestamptz not null default now(),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_client_finance_events_lead_date
  on public.client_finance_events (lead_id, effective_at, created_at);

alter table public.client_finance_events enable row level security;

drop policy if exists "Authenticated users manage finance events" on public.client_finance_events;
create policy "Authenticated users manage finance events"
  on public.client_finance_events for all to authenticated
  using (true) with check (true);

grant all on public.client_finance_events to authenticated, service_role;

-- Atomic counters prevent two quick clicks from losing a commission/month update.
create or replace function public.increment_client_finance(
  p_lead_id uuid,
  p_field text,
  p_amount numeric,
  p_user uuid
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  result numeric;
  finance_event text;
begin
  if p_field = 'commission_received' then
    update leads
      set commission_received = coalesce(commission_received, 0) + p_amount,
          last_activity_at = now()
      where id = p_lead_id
      returning commission_received into result;
    finance_event := 'commission_received';
  elsif p_field = 'legacy_months_paid' then
    update leads
      set legacy_months_paid = coalesce(legacy_months_paid, 0) + p_amount::integer,
          last_activity_at = now()
      where id = p_lead_id
      returning legacy_months_paid into result;
    finance_event := 'client_payment';
  else
    raise exception 'Unsupported finance field';
  end if;

  if result is null then raise exception 'Client not found'; end if;

  insert into client_finance_events (lead_id, event_type, amount, created_by, metadata)
  values (p_lead_id, finance_event, p_amount, p_user, jsonb_build_object('field', p_field));
  return result;
end;
$$;

revoke all on function public.increment_client_finance(uuid, text, numeric, uuid) from public;
grant execute on function public.increment_client_finance(uuid, text, numeric, uuid) to authenticated, service_role;
