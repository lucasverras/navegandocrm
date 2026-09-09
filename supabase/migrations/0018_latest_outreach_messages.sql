-- Return exactly one latest message per requested lead. A global LIMIT can allow a
-- highly active lead to crowd other leads out of the Pipeline WhatsApp prefill.
create or replace function public.latest_outreach_messages(p_lead_ids uuid[])
returns table (lead_id uuid, content text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (m.lead_id) m.lead_id, m.content, m.created_at
  from public.outreach_messages m
  where m.lead_id = any(p_lead_ids)
  order by m.lead_id, m.created_at desc;
$$;

grant execute on function public.latest_outreach_messages(uuid[]) to authenticated, service_role;
