-- Expand the commercial pipeline to the 8 sales stages the operation actually uses
-- (brief §PIPELINE). Remap existing rows, then swap the CHECK. pipeline_stage is already
-- nullable (0009) — "not on the board" stays null. previous_stage is historical audit text and
-- is intentionally left untouched.

alter table public.leads drop constraint if exists leads_pipeline_stage_check;

update public.leads set pipeline_stage = case pipeline_stage
  when 'new' then 'ready_to_approach'
  when 'qualified' then 'first_contact'
  when 'to_approach' then 'reaching_dm'
  when 'in_contact' then 'talking_dm'
  when 'meeting_proposal' then 'meeting'
  when 'closed' then 'closed'
  else pipeline_stage
end
where pipeline_stage is not null;

alter table public.leads
  add constraint leads_pipeline_stage_check
  check (pipeline_stage is null or pipeline_stage in (
    'ready_to_approach', 'first_contact', 'reaching_dm', 'talking_dm',
    'meeting', 'proposal', 'negotiation', 'closed'
  ));
