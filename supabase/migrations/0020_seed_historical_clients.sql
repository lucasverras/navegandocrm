-- Closed clients supplied by the operator. Dates and financial details intentionally
-- remain blank until they are entered in Resultados. Safe to re-run by name.
do $$
declare
  client_name text;
  client_slug text;
  verified_count integer;
begin
  for client_name, client_slug in
    select * from (values
      ('Nossa Carne', 'nossa-carne'),
      ('Santo Portuga', 'santo-portuga'),
      ('Açai Tavares', 'acai-tavares'),
      ('Theozzy', 'theozzy'),
      ('Arena Tatuapé', 'arena-tatuape'),
      ('Ki Mukeka', 'ki-mukeka'),
      ('Rei do ABC', 'rei-do-abc'),
      ('Central do Hambúrguer', 'central-do-hamburguer'),
      ('Wine', 'wine'),
      ('Ball Five', 'ball-five'),
      ('Buteco Augusta', 'buteco-augusta'),
      ('Mooca Buns', 'mooca-buns'),
      ('Pastissimo', 'pastissimo'),
      ('Red Rose Motel', 'red-rose-motel'),
      ('Soul Quiro', 'soul-quiro'),
      ('Buteco da Vera', 'buteco-da-vera'),
      ('Sr. Parmegiano', 'sr-parmegiano'),
      ('Radial Estação Gastronômica', 'radial-estacao-gastronomica'),
      ('Travessa do Bruxo', 'travessa-do-bruxo'),
      ('La Pergoletta', 'la-pergoletta')
    ) as clients(name, slug)
  loop
    update public.leads
    set pipeline_stage = 'closed',
        business_status = 'client',
        record_source = 'historical',
        closed_at = null,
        churned_at = null,
        contact_round = null,
        cadence_step = 0,
        next_action_type = null,
        next_action_at = null,
        next_follow_up_at = null,
        archived_at = null,
        lost_reason = null,
        last_activity_at = now()
    where lower(name) = lower(client_name);

    if not found then
      insert into public.leads (
        region_id,
        place_id,
        name,
        category,
        pre_score,
        business_status,
        pipeline_stage,
        triage_status,
        record_source,
        lead_origin,
        closed_at,
        churned_at,
        contact_round,
        cadence_step,
        next_action_type,
        next_action_at,
        next_follow_up_at
      ) values (
        null,
        'manual:historical:' || client_slug,
        client_name,
        'restaurant',
        0,
        'client',
        'closed',
        'approved',
        'historical',
        'Manual',
        null,
        null,
        null,
        0,
        null,
        null,
        null
      );
    end if;
  end loop;

  select count(*) into verified_count
  from (values
    ('Nossa Carne'), ('Santo Portuga'), ('Açai Tavares'), ('Theozzy'),
    ('Arena Tatuapé'), ('Ki Mukeka'), ('Rei do ABC'), ('Central do Hambúrguer'),
    ('Wine'), ('Ball Five'), ('Buteco Augusta'), ('Mooca Buns'), ('Pastissimo'),
    ('Red Rose Motel'), ('Soul Quiro'), ('Buteco da Vera'), ('Sr. Parmegiano'),
    ('Radial Estação Gastronômica'), ('Travessa do Bruxo'), ('La Pergoletta')
  ) as clients(name)
  where exists (
    select 1
    from public.leads
    where lower(leads.name) = lower(clients.name)
      and leads.pipeline_stage = 'closed'
      and leads.business_status = 'client'
      and leads.record_source = 'historical'
      and leads.closed_at is null
      and leads.churned_at is null
  );

  if verified_count <> 20 then
    raise exception 'Historical client seed verification failed: % of 20 valid', verified_count;
  end if;
end;
$$;
