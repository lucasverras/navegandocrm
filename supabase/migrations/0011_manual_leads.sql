-- Allow manually-created prospects (a name + maybe an Instagram/phone the user already has,
-- not from Google Places discovery). Such leads have no region — relax region_id to nullable.
-- place_id stays NOT NULL UNIQUE and is satisfied with a synthetic "manual:<uuid>" value in code.
-- Safe/idempotent: dropping NOT NULL only widens what's allowed; existing rows are unaffected.

alter table public.leads alter column region_id drop not null;
