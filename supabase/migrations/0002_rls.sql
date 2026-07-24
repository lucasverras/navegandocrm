-- Row Level Security — authenticated users can read/write; no anon access.
-- api_usage and settings writes go through server-only routes using the
-- service role key (which bypasses RLS), so their policies here only cover
-- authenticated read access for the in-app dashboard/settings pages.
--
-- Policies are dropped-then-recreated (`drop policy if exists` + `create policy`)
-- rather than a bare `create policy`, because Postgres has no
-- `CREATE POLICY IF NOT EXISTS` — this keeps the migration safely re-runnable.

alter table public.profiles enable row level security;
alter table public.regions enable row level security;
alter table public.searches enable row level security;
alter table public.leads enable row level security;
alter table public.lead_sources enable row level security;
alter table public.lead_analysis enable row level security;
alter table public.decision_makers enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_events enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_leads enable row level security;
alter table public.api_usage enable row level security;
alter table public.settings enable row level security;

-- profiles: users can read all profiles (small internal team), update only self
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Generic pattern: any authenticated user can read/write. This is an internal
-- SDR tool for a small team, so full read/write for all authenticated users
-- is the intended model — no per-row ownership.
drop policy if exists "regions_all_authenticated" on public.regions;
create policy "regions_all_authenticated" on public.regions
  for all to authenticated using (true) with check (true);

drop policy if exists "searches_all_authenticated" on public.searches;
create policy "searches_all_authenticated" on public.searches
  for all to authenticated using (true) with check (true);

drop policy if exists "leads_all_authenticated" on public.leads;
create policy "leads_all_authenticated" on public.leads
  for all to authenticated using (true) with check (true);

drop policy if exists "lead_sources_all_authenticated" on public.lead_sources;
create policy "lead_sources_all_authenticated" on public.lead_sources
  for all to authenticated using (true) with check (true);

drop policy if exists "lead_analysis_all_authenticated" on public.lead_analysis;
create policy "lead_analysis_all_authenticated" on public.lead_analysis
  for all to authenticated using (true) with check (true);

drop policy if exists "decision_makers_all_authenticated" on public.decision_makers;
create policy "decision_makers_all_authenticated" on public.decision_makers
  for all to authenticated using (true) with check (true);

drop policy if exists "outreach_messages_all_authenticated" on public.outreach_messages;
create policy "outreach_messages_all_authenticated" on public.outreach_messages
  for all to authenticated using (true) with check (true);

drop policy if exists "outreach_events_all_authenticated" on public.outreach_events;
create policy "outreach_events_all_authenticated" on public.outreach_events
  for all to authenticated using (true) with check (true);

drop policy if exists "campaigns_all_authenticated" on public.campaigns;
create policy "campaigns_all_authenticated" on public.campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists "campaign_leads_all_authenticated" on public.campaign_leads;
create policy "campaign_leads_all_authenticated" on public.campaign_leads
  for all to authenticated using (true) with check (true);

drop policy if exists "api_usage_select_authenticated" on public.api_usage;
create policy "api_usage_select_authenticated" on public.api_usage
  for select to authenticated using (true);

drop policy if exists "settings_select_authenticated" on public.settings;
create policy "settings_select_authenticated" on public.settings
  for select to authenticated using (true);
drop policy if exists "settings_update_authenticated" on public.settings;
create policy "settings_update_authenticated" on public.settings
  for update to authenticated using (true) with check (true);

-- No policies for the `anon` role anywhere: RLS defaults to deny, so
-- unauthenticated requests through the anon key are rejected everywhere.
