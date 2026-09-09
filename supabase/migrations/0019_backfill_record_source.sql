-- Existing manual records predate record_source. Keep them out of Radar conversion metrics.
update public.leads
set record_source = case
  when pipeline_stage = 'closed' or business_status = 'client' then 'historical'
  else 'manual'
end
where place_id like 'manual:%';
