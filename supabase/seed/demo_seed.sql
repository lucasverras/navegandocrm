-- Demo seed data — 5 fictitious restaurants, clearly marked with is_demo = true
-- and a "[DEMO]" name prefix. Safe to run against a fresh database after the
-- migrations. Never present these as real leads in production use.

insert into public.regions (id, neighborhood, city, state, radius_meters, status, restaurants_found, last_searched_at)
values ('00000000-0000-0000-0000-000000000001', 'Mooca', 'São Paulo', 'SP', 2000, 'active', 5, now())
on conflict (id) do nothing;

insert into public.leads (
  region_id, place_id, name, category, address, phone, website, instagram, maps_url,
  google_rating, google_review_count, price_level, estimated_units, pre_score, is_demo, commercial_status
) values
  (
    '00000000-0000-0000-0000-000000000001', 'demo-place-1', '[DEMO] Cantina do Vale', 'italian_restaurant',
    'Rua Borges de Figueiredo, 100 - Mooca, São Paulo - SP', '(11) 91234-5601', 'https://cantinadovale-demo.example.com',
    '@cantinadovale.demo', 'https://maps.google.com/?q=Cantina+do+Vale+Demo',
    4.6, 812, 2, 1, 0, true, 'not_contacted'
  ),
  (
    '00000000-0000-0000-0000-000000000001', 'demo-place-2', '[DEMO] Empório Mooca Grill', 'steak_house',
    'Rua Taquari, 200 - Mooca, São Paulo - SP', '(11) 91234-5602', null,
    '@emporiomoocagrill.demo', 'https://maps.google.com/?q=Emporio+Mooca+Grill+Demo',
    4.3, 356, 3, 1, 0, true, 'not_contacted'
  ),
  (
    '00000000-0000-0000-0000-000000000001', 'demo-place-3', '[DEMO] Padaria Bella Vita', 'bakery',
    'Rua da Independência, 55 - Mooca, São Paulo - SP', null, 'https://bellavita-demo.example.com',
    null, 'https://maps.google.com/?q=Padaria+Bella+Vita+Demo',
    4.1, 128, 1, 2, 0, true, 'not_contacted'
  ),
  (
    '00000000-0000-0000-0000-000000000001', 'demo-place-4', '[DEMO] Sushi Koi Mooca', 'japanese_restaurant',
    'Av. Paes de Barros, 900 - Mooca, São Paulo - SP', '(11) 91234-5604', 'https://sushikoi-demo.example.com',
    '@sushikoimooca.demo', 'https://maps.google.com/?q=Sushi+Koi+Mooca+Demo',
    4.8, 1450, 3, 1, 0, true, 'not_contacted'
  ),
  (
    '00000000-0000-0000-0000-000000000001', 'demo-place-5', '[DEMO] Boteco da Esquina', 'bar',
    'Rua Bresser, 320 - Mooca, São Paulo - SP', '(11) 91234-5605', null,
    null, 'https://maps.google.com/?q=Boteco+da+Esquina+Demo',
    3.9, 64, 1, 1, 0, true, 'not_contacted'
  )
on conflict (place_id) do nothing;

-- Rough pre-scores for the demo rows (normally computed by src/lib/prescore.ts on ingest)
update public.leads set pre_score = 78 where place_id = 'demo-place-1';
update public.leads set pre_score = 55 where place_id = 'demo-place-2';
update public.leads set pre_score = 40 where place_id = 'demo-place-3';
update public.leads set pre_score = 90 where place_id = 'demo-place-4';
update public.leads set pre_score = 35 where place_id = 'demo-place-5';

