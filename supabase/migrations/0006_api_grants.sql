-- Explicit API grants for Supabase projects where new public tables are not
-- auto-exposed to API roles. RLS policies still control row-level access.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

