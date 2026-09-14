-- Targeted indexes for V9 production queries.
-- Only adds indexes justified by actual query patterns, not speculative.

-- Home page demands: leads with next_action that are not archived/closed
create index if not exists idx_leads_active_demands
  on public.leads (next_action_at)
  where archived_at is null and next_action_type is not null and next_action_at is not null;

-- Prospeccao overview: single bulk query on non-archived leads for region count bucketing
create index if not exists idx_leads_active_region_triage
  on public.leads (region_id, triage_status, preparation_status)
  where archived_at is null;

-- API usage daily limit check (cost-control.ts queries today's records per operation)
create index if not exists idx_api_usage_operation_date
  on public.api_usage (operation, created_at desc);

-- Outreach messages by lead (latest message lookup pattern)
create index if not exists idx_outreach_messages_lead_date
  on public.outreach_messages (lead_id, created_at desc);

-- Lead analysis by lead (latest analysis lookup)
create index if not exists idx_lead_analysis_lead_date
  on public.lead_analysis (lead_id, created_at desc);
