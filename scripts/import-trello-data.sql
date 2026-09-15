-- Import Trello pipeline data into Radar Navegando
-- Run this in the Supabase SQL Editor

-- FUP DE HJ → first_contact + FOLLOW_UP_1
INSERT INTO leads (place_id, name, category, pipeline_stage, pipeline_position, contact_round, next_action_type, commercial_status, lead_origin, triage_status, created_at)
VALUES
  ('manual:' || gen_random_uuid(), 'THIAGO SACADA', 'restaurant', 'first_contact', 0, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'MENSAGEM DE FOLLOW', 'restaurant', 'first_contact', 1, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'MARQUINHOS ESPETO', 'restaurant', 'first_contact', 2, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'CEPAM', 'restaurant', 'first_contact', 3, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), '1445 GIBA', 'restaurant', 'first_contact', 4, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'GABI CALÇADÃO', 'restaurant', 'first_contact', 5, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'DENNIS JAMIE OLIVER', 'restaurant', 'first_contact', 6, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'JANDÁ STEAK', 'restaurant', 'first_contact', 7, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'GUILHERME TERRA E BRASA E FUMAÇA', 'restaurant', 'first_contact', 8, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'MARCO HÚNGARO', 'restaurant', 'first_contact', 9, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now());

-- REUNIÃO → meeting
INSERT INTO leads (place_id, name, category, pipeline_stage, pipeline_position, next_action_type, commercial_status, lead_origin, triage_status, created_at)
VALUES
  ('manual:' || gen_random_uuid(), 'LUANA DCK', 'restaurant', 'meeting', 0, 'meeting', 'meeting_scheduled', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'LA DOLCE VITTA', 'restaurant', 'meeting', 1, 'meeting', 'meeting_scheduled', 'manual', 'approved', now());

-- ORÇAMENTO ENVIADO → proposal
INSERT INTO leads (place_id, name, category, pipeline_stage, pipeline_position, next_action_type, commercial_status, lead_origin, triage_status, created_at)
VALUES
  ('manual:' || gen_random_uuid(), 'WST BURGER ERIKA', 'restaurant', 'proposal', 0, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'TALITA', 'restaurant', 'proposal', 1, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'CÉSAR - LIMEIRA', 'restaurant', 'proposal', 2, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'GIOVANNE ESFIHA IMIGRANTES', 'restaurant', 'proposal', 3, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'KAWAN - JUNDIAÍ', 'restaurant', 'proposal', 4, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'OSNIR', 'restaurant', 'proposal', 5, 'chase_proposal', 'message_sent', 'manual', 'approved', now());

-- FECHAR → negotiation
INSERT INTO leads (place_id, name, category, pipeline_stage, pipeline_position, next_action_type, commercial_status, lead_origin, triage_status, created_at)
VALUES
  ('manual:' || gen_random_uuid(), 'CALÇADÃO URBANÓIDE', 'restaurant', 'negotiation', 0, 'close_deal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'CLAYTON AMIGO PORTUGA - BUFFET E JEQUITIBÁ', 'restaurant', 'negotiation', 1, 'close_deal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'MARTHA - THAIS', 'restaurant', 'negotiation', 2, 'close_deal', 'message_sent', 'manual', 'approved', now()),
  ('manual:' || gen_random_uuid(), 'MARQUINHO BSK', 'restaurant', 'negotiation', 3, 'close_deal', 'message_sent', 'manual', 'approved', now());

-- OFF/PERDIDO → archived
INSERT INTO leads (place_id, name, category, pipeline_stage, pipeline_position, commercial_status, lead_origin, triage_status, archived_at, lost_reason, created_at)
VALUES
  ('manual:' || gen_random_uuid(), 'AR NATURAL DIEGO', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'KAUE ZAIN?', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'SAMPA SMAHS', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'TAYNAN JÓIAS', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'CAÍQUE FRUTARIA', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'ANDREA - FAMILIA MINEIRA', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'FELIPE PADARIA ENZO', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'NATHAN CELESTINO BAR', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'BETO THIBÉ', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
  ('manual:' || gen_random_uuid(), 'LUÍZ SOROCABA ZENKO SUSHI', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now());

-- NEGATIVA → archived
INSERT INTO leads (place_id, name, category, pipeline_stage, pipeline_position, commercial_status, lead_origin, triage_status, archived_at, lost_reason, created_at)
VALUES
  ('manual:' || gen_random_uuid(), 'LYKKA DOCCES', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'PIEVA PIZZARIA DELIVERY', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'JOAO JEFFS', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'CAÍQUE', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'RAFA GOOD STUFF', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'LAÍS STUDIO MANI', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'ANTHONY TURISMO', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'VK CARS', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
  ('manual:' || gen_random_uuid(), 'ARTHUR PIZZARIA', 'restaurant', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now());

-- Verify
SELECT pipeline_stage, count(*) FROM leads WHERE lead_origin = 'manual' AND created_at > now() - interval '5 minutes' GROUP BY pipeline_stage ORDER BY pipeline_stage;
