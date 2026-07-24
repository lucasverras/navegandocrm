-- Radar Navegando — initial schema
-- Run via `supabase db push` or the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (mirrors auth.users; no public signup — rows created manually)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- regions
-- ---------------------------------------------------------------------------
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  neighborhood text not null,
  city text not null,
  state text not null,
  radius_meters integer not null default 2000 check (radius_meters between 100 and 50000),
  status text not null default 'active' check (status in ('active', 'archived')),
  last_searched_at timestamptz,
  restaurants_found integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (neighborhood, city, state)
);
create index if not exists regions_status_idx on public.regions (status);

-- ---------------------------------------------------------------------------
-- searches
-- ---------------------------------------------------------------------------
create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'partial')),
  categories text[] not null default '{}',
  queries_executed integer not null default 0,
  places_found integer not null default 0,
  places_new integer not null default 0,
  places_duplicate integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists searches_region_idx on public.searches (region_id);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete cascade,
  place_id text not null unique,
  name text not null,
  category text not null,
  address text,
  phone text,
  website text,
  instagram text,
  maps_url text,
  google_rating numeric(2,1),
  google_review_count integer,
  price_level integer,
  estimated_units integer default 1,
  lat double precision,
  lng double precision,
  pre_score integer not null default 0 check (pre_score between 0 and 100),
  ai_score integer check (ai_score between 0 and 100),
  agency_status text not null default 'unknown'
    check (agency_status in ('confirmed', 'probable', 'internal_team_probable', 'no_signs', 'unknown')),
  business_status text not null default 'new'
    check (business_status in ('client', 'closed', 'not_interested', 'in_progress', 'new')),
  commercial_status text not null default 'not_contacted' check (commercial_status in (
    'not_contacted', 'message_ready', 'message_sent', 'invalid_number', 'chatbot',
    'reception_answered', 'forwarded', 'owner_contact_obtained', 'awaiting_reply',
    'no_reply', 'not_interested', 'meeting_scheduled'
  )),
  is_duplicate boolean not null default false,
  is_demo boolean not null default false,
  notes text,
  opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_region_idx on public.leads (region_id);
create index if not exists leads_category_idx on public.leads (category);
create index if not exists leads_prescore_idx on public.leads (pre_score desc);
create index if not exists leads_commercial_status_idx on public.leads (commercial_status);

-- ---------------------------------------------------------------------------
-- lead_sources — raw source payloads kept for audit (compact, not full HTML)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  source_type text not null,
  raw_data jsonb not null default '{}',
  fetched_at timestamptz not null default now()
);
create index if not exists lead_sources_lead_idx on public.lead_sources (lead_id);

-- ---------------------------------------------------------------------------
-- lead_analysis — Claude structured analysis results
-- ---------------------------------------------------------------------------
create table if not exists public.lead_analysis (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  model text not null,
  opportunity_score integer not null check (opportunity_score between 0 and 100),
  contact_score integer not null check (contact_score between 0 and 100),
  business_strength text not null check (business_strength in ('weak', 'medium', 'strong', 'unknown')),
  marketing_status text not null check (marketing_status in ('strong', 'regular', 'weak', 'abandoned', 'unknown')),
  agency_status text not null check (agency_status in ('confirmed', 'probable', 'internal_team_probable', 'no_signs', 'unknown')),
  agency_confidence integer not null default 0 check (agency_confidence between 0 and 100),
  opportunity_focus text not null default '',
  main_opportunity text not null default '',
  evidence jsonb not null default '[]',
  recommended_service text not null default '',
  recommended_approach text not null check (recommended_approach in ('social_proof', 'diagnosis', 'question', 'expansion')),
  risks jsonb not null default '[]',
  should_contact boolean not null default false,
  reason text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  is_refined boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lead_analysis_lead_idx on public.lead_analysis (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- decision_makers
-- ---------------------------------------------------------------------------
create table if not exists public.decision_makers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  name text,
  role text,
  contact_type text,
  email text,
  phone text,
  linkedin text,
  source_url text,
  source_title text,
  excerpt text,
  confidence integer not null default 0 check (confidence between 0 and 100),
  found boolean not null default false,
  opted_out boolean not null default false,
  researched_at timestamptz not null default now()
);
create index if not exists decision_makers_lead_idx on public.decision_makers (lead_id);

-- ---------------------------------------------------------------------------
-- outreach_messages
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  variant text not null check (variant in (
    'social_proof', 'diagnosis', 'question', 'expansion', 'routing', 'agency', 'abandoned_instagram'
  )),
  content text not null,
  original_content text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  edited boolean not null default false,
  refined boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists outreach_messages_lead_idx on public.outreach_messages (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- outreach_events — full history log
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  message_id uuid references public.outreach_messages (id) on delete set null,
  event_type text not null,
  channel text not null default 'whatsapp',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists outreach_events_lead_idx on public.outreach_events (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- campaigns / campaign_leads — A/B/C testing
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  variant text not null check (variant in ('A', 'B', 'C')),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  responded boolean not null default false,
  positive_response boolean not null default false,
  meeting_scheduled boolean not null default false,
  proposal_sent boolean not null default false,
  closed_won boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

-- ---------------------------------------------------------------------------
-- api_usage — cost tracking
-- ---------------------------------------------------------------------------
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  model text,
  operation text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  lead_id uuid references public.leads (id) on delete set null,
  region_id uuid references public.regions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_created_idx on public.api_usage (created_at desc);
create index if not exists api_usage_operation_idx on public.api_usage (operation, created_at desc);

-- ---------------------------------------------------------------------------
-- settings — key/value config (pre-score weights, usage limits, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('usage_limits', '{"haiku_analyses_per_day": 100, "decision_maker_searches_per_day": 20, "sonnet_refinements_per_day": 10}'),
  ('prescore_weights', '{"reviewCount": 20, "rating": 15, "hasWebsite": 10, "hasPhone": 10, "categoryMatch": 10, "appearsActive": 15, "notDuplicate": 5, "notContacted": 10, "notClient": 5, "notClosed": 5, "multiUnit": 5}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists regions_set_updated_at on public.regions;
create trigger regions_set_updated_at before update on public.regions
  for each row execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
