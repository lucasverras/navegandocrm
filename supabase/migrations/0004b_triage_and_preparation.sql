-- Radar Navegando — triage & preparation state on `leads` (additive, fase 1).
-- Does NOT touch pipeline_stage/its default/its constraint — that stays untouched until
-- migration 0005 (fase 4), so today's Kanban keeps working exactly as before during fases 1-3.

alter table public.leads
  add column if not exists triage_status text not null default 'pending_review'
    check (triage_status in ('pending_review', 'approved', 'rejected', 'review_later', 'auto_filtered')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists approval_notes text,
  add column if not exists exclusion_reason text
    check (exclusion_reason is null or exclusion_reason in (
      'blocked_category', 'blocked_keyword', 'closed', 'duplicate', 'out_of_radius',
      'low_reviews', 'already_rejected', 'existing_client', 'already_prospected', 'excluded_franchise'
    )),
  add column if not exists preparation_status text not null default 'not_prepared'
    check (preparation_status in ('not_prepared', 'preparing', 'partially_prepared', 'ready', 'outdated', 'failed')),
  add column if not exists prepared_at timestamptz,
  add column if not exists preparation_hash text,
  add column if not exists next_best_action text,
  add column if not exists instagram_handle text,
  add column if not exists instagram_url text,
  add column if not exists instagram_confirmed boolean not null default false,
  add column if not exists instagram_confirmation_method text
    check (instagram_confirmation_method is null or instagram_confirmation_method in ('manual', 'ai_search')),
  add column if not exists instagram_checked_at timestamptz;

create index if not exists leads_triage_status_idx on public.leads (triage_status, created_at desc);
create index if not exists leads_preparation_status_idx on public.leads (preparation_status);

-- Existing rows (all 353 today) are untouched by this migration: they keep their current
-- pipeline_stage/business_status/etc, and simply get the new default triage_status='pending_review'
-- + preparation_status='not_prepared' bolted on. This does NOT move them out of the Kanban —
-- that reclassification is a separate, explicitly-confirmed step (see 0006_migrate_pending_leads.sql).
