-- Radar Navegando — Discovery campaigns (Descoberta → Triagem rework, fase 1).
-- Additive only. Does not touch `regions`/`leads` existing behavior beyond adding new nullable columns.
-- `discovery_campaigns` is unrelated to the pre-existing `campaigns`/`campaign_leads` tables
-- (dead A/B-testing scaffolding, zero code references) — kept separate to avoid any collision.

create table if not exists public.discovery_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  neighborhood text not null,
  city text not null,
  state text not null,
  lat double precision,
  lng double precision,
  radius_meters integer not null default 2000 check (radius_meters between 100 and 50000),
  included_types text[] not null default '{}',
  excluded_types text[] not null default '{}',
  blocked_keywords text[] not null default '{}',
  min_rating numeric(2,1),
  min_reviews integer,
  exclude_franchises boolean not null default false,
  exclude_chains boolean not null default false,
  exclude_no_phone boolean not null default false,
  exclude_no_website boolean not null default false,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  last_searched_at timestamptz,
  source_region_id uuid references public.regions (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_campaigns_status_idx on public.discovery_campaigns (status);

alter table public.leads
  add column if not exists discovery_campaign_id uuid references public.discovery_campaigns (id) on delete set null;

alter table public.searches
  add column if not exists discovery_campaign_id uuid references public.discovery_campaigns (id) on delete set null;

drop trigger if exists set_discovery_campaigns_updated_at on public.discovery_campaigns;
create trigger set_discovery_campaigns_updated_at
  before update on public.discovery_campaigns
  for each row execute function public.set_updated_at();

-- Rollup counters computed on read (avoids write-amplification/drift vs stored counters).
create or replace view public.discovery_campaign_stats as
select
  dc.id as discovery_campaign_id,
  count(l.id) filter (where l.triage_status = 'pending_review') as pending_review,
  count(l.id) filter (where l.triage_status = 'approved') as approved,
  count(l.id) filter (where l.triage_status = 'rejected') as rejected,
  count(l.id) filter (where l.triage_status = 'review_later') as review_later,
  count(l.id) filter (where l.triage_status = 'auto_filtered') as auto_filtered,
  count(l.id) filter (where l.preparation_status = 'ready') as prepared,
  count(l.id) filter (where l.pipeline_stage is not null) as in_pipeline,
  count(l.id) as total_found
from public.discovery_campaigns dc
left join public.leads l on l.discovery_campaign_id = dc.id
group by dc.id;

alter table public.discovery_campaigns enable row level security;
drop policy if exists "discovery_campaigns_all_authenticated" on public.discovery_campaigns;
create policy "discovery_campaigns_all_authenticated" on public.discovery_campaigns
  for all to authenticated using (true) with check (true);

-- Backfill: one campaign per existing active region, using the full current category set
-- as the allowlist (matches today's implicit behavior — no categories excluded yet).
insert into public.discovery_campaigns (
  name, neighborhood, city, state, radius_meters, included_types, source_region_id, status, last_searched_at
)
select
  r.neighborhood || ' • ' || r.city,
  r.neighborhood,
  r.city,
  r.state,
  r.radius_meters,
  array[
    'restaurant', 'bar', 'cafe', 'bakery', 'meal_takeaway', 'steak_house',
    'hamburger_restaurant', 'pizza_restaurant', 'brazilian_restaurant',
    'italian_restaurant', 'japanese_restaurant', 'seafood_restaurant',
    'dessert_shop', 'ice_cream_shop', 'coffee_shop', 'sandwich_shop'
  ],
  r.id,
  r.status,
  r.last_searched_at
from public.regions r
where not exists (
  select 1 from public.discovery_campaigns dc where dc.source_region_id = r.id
);

-- Backfill leads.discovery_campaign_id from the region they came from, via the new mapping.
update public.leads l
set discovery_campaign_id = dc.id
from public.discovery_campaigns dc
where dc.source_region_id = l.region_id
  and l.discovery_campaign_id is null;
