-- Handle-only Instagram enrichment derives the handle from the business's own website,
-- so it records how the handle was confirmed as 'website_url' (the website field was already an
-- IG link) or 'website_html' (found by scanning the site's HTML). The original 0005 CHECK only
-- allowed 'manual'/'ai_search', which would reject those writes. Extend it safely & idempotently.

alter table public.leads
  drop constraint if exists leads_instagram_confirmation_method_check;

alter table public.leads
  add constraint leads_instagram_confirmation_method_check
  check (
    instagram_confirmation_method is null
    or instagram_confirmation_method in ('manual', 'ai_search', 'website_url', 'website_html')
  );
