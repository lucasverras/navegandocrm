-- One-time reclassification of leads imported BEFORE the deterministic filter existed
-- (brief §2). Mirrors the TS classifier (src/lib/discovery-filters.ts) for the unambiguous,
-- accent-free cases — the exact junk the user reported (Extra Mercado, Posto Petrobras,
-- McDonald's, Burger King, Drogaria, Assaí…). Nothing is deleted: only triage_status,
-- exclusion_reason, pre_score and pipeline_stage change, so it is fully reversible and auditable.
-- Runs inside the migration transaction — any error rolls the whole thing back.
--
-- For a thorough pass that also handles accents + the allowlist 'not_food' rule, the app also
-- exposes POST /api/admin/reclassify (reuses the TS classifier). This migration handles the
-- clear cases automatically so no manual step is required for them.

-- A lead only belongs on the Kanban when it was consciously added. Model "not in the pipeline"
-- as pipeline_stage IS NULL. Originally the column was NOT NULL DEFAULT 'new' (0003), which both
-- forced every discovery onto the board and made this reclassification impossible. Relax it:
-- drop NOT NULL and the default (discovery/triage now leave it null; AddToPipeline sets a stage).
-- The 0003 CHECK stays and already tolerates null.
alter table public.leads alter column pipeline_stage drop not null;
alter table public.leads alter column pipeline_stage drop default;

do $$
declare
  n_cat int; n_fran int; n_kw int; n_detach int;
begin
  -- 1) Denylist Google types (blocked_category).
  update public.leads set
    triage_status = 'auto_filtered', exclusion_reason = 'blocked_category', pre_score = 0, pipeline_stage = null
  where coalesce(business_status, '') <> 'client'
    and triage_status <> 'auto_filtered'
    and category in (
      'supermarket','grocery_store','pharmacy','drugstore','convenience_store','gas_station',
      'shopping_mall','hotel','hospital','department_store','wholesaler','pet_store',
      'clothing_store','gym','beauty_salon','furniture_store'
    );
  get diagnostics n_cat = row_count;

  -- 2) Known big chains (excluded_franchise) — substring match on the lowercased name.
  update public.leads set
    triage_status = 'auto_filtered', exclusion_reason = 'excluded_franchise', pre_score = 0, pipeline_stage = null
  where coalesce(business_status, '') <> 'client'
    and triage_status <> 'auto_filtered'
    and lower(name) ~ '(mcdonald|burger king|subway|habib|china in box|outback|starbucks|spoleto|bob''s|kfc|pizza hut|domino|ragazzo|giraffas)';
  get diagnostics n_fran = row_count;

  -- 3) Blocked words in the name (blocked_keyword) — word-boundary match, accent-free stems.
  --    'atacad' (no closing boundary) catches atacado/atacadão/atacadista (e.g. "Assaí Atacadista").
  update public.leads set
    triage_status = 'auto_filtered', exclusion_reason = 'blocked_keyword', pre_score = 0, pipeline_stage = null
  where coalesce(business_status, '') <> 'client'
    and triage_status <> 'auto_filtered'
    and (
      lower(name) ~ '\y(mercado|supermercado|hipermercado|minimercado|mercadinho|farmacia|drogaria|drogasil|distribuidora|hortifruti|posto|petrobras|ipiranga|shell|hotel|hospital|papelaria|petshop)\y'
      or lower(name) ~ '\yatacad'
    );
  get diagnostics n_kw = row_count;

  -- 4) Detach raw discovery rows dumped into the first pipeline stage: they were never
  --    consciously added, so they must leave the board (brief §11). Leads worked into later
  --    stages (qualified+) are kept.
  update public.leads set pipeline_stage = null where pipeline_stage = 'new';
  get diagnostics n_detach = row_count;

  raise notice 'RECLASSIFY-0009 blocked_category=% excluded_franchise=% blocked_keyword=% detached_new=%',
    n_cat, n_fran, n_kw, n_detach;
end $$;
