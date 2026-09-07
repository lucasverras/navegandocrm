-- The layered discovery filter can now exclude a place because it passed nothing on the
-- allowlist and shows no food signal ('not_food'). Extend the exclusion_reason CHECK to allow it.
-- Idempotent: drop the old constraint (name from 0005's inline check) and recreate with the new value.

alter table public.leads
  drop constraint if exists leads_exclusion_reason_check;

alter table public.leads
  add constraint leads_exclusion_reason_check
  check (exclusion_reason is null or exclusion_reason in (
    'blocked_category', 'blocked_keyword', 'closed', 'duplicate', 'out_of_radius',
    'low_reviews', 'already_rejected', 'existing_client', 'already_prospected',
    'excluded_franchise', 'not_food'
  ));

-- Index to make the pipeline query (only rows consciously added to the board) cheap.
create index if not exists leads_in_pipeline_idx
  on public.leads (pipeline_stage, pipeline_position)
  where pipeline_stage is not null and archived_at is null;
