-- Import Trello pipeline data into Radar Navegando
-- Run this in the Supabase SQL Editor
-- Each lead is created as a manual lead with the appropriate pipeline stage

-- Get the first user ID for attribution
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM profiles LIMIT 1;

  -- ══════════════════════════════════════════
  -- FUP DE HJ → first_contact + FOLLOW_UP_1
  -- ══════════════════════════════════════════
  INSERT INTO leads (name, pipeline_stage, pipeline_position, contact_round, next_action_type, commercial_status, lead_origin, triage_status, created_at)
  VALUES
    ('THIAGO SACADA', 'first_contact', 0, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('MENSAGEM DE FOLLOW', 'first_contact', 1, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('MARQUINHOS ESPETO', 'first_contact', 2, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('CEPAM', 'first_contact', 3, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('1445 GIBA', 'first_contact', 4, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('GABI CALÇADÃO', 'first_contact', 5, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('DENNIS JAMIE OLIVER', 'first_contact', 6, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('JANDÁ STEAK', 'first_contact', 7, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('GUILHERME TERRA E BRASA E FUMAÇA', 'first_contact', 8, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now()),
    ('MARCO HÚNGARO', 'first_contact', 9, 'FOLLOW_UP_1', 'follow_up', 'message_sent', 'manual', 'approved', now())
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════
  -- REUNIÃO → meeting
  -- ══════════════════════════════════════════
  INSERT INTO leads (name, pipeline_stage, pipeline_position, next_action_type, commercial_status, lead_origin, triage_status, created_at)
  VALUES
    ('LUANA DCK', 'meeting', 0, 'meeting', 'meeting_scheduled', 'manual', 'approved', now()),
    ('LA DOLCE VITTA', 'meeting', 1, 'meeting', 'meeting_scheduled', 'manual', 'approved', now())
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════
  -- ORÇAMENTO ENVIADO → proposal
  -- ══════════════════════════════════════════
  INSERT INTO leads (name, pipeline_stage, pipeline_position, next_action_type, commercial_status, lead_origin, triage_status, created_at)
  VALUES
    ('WST BURGER ERIKA', 'proposal', 0, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
    ('TALITA', 'proposal', 1, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
    ('CÉSAR - LIMEIRA', 'proposal', 2, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
    ('GIOVANNE ESFIHA IMIGRANTES', 'proposal', 3, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
    ('KAWAN - JUNDIAÍ', 'proposal', 4, 'chase_proposal', 'message_sent', 'manual', 'approved', now()),
    ('OSNIR', 'proposal', 5, 'chase_proposal', 'message_sent', 'manual', 'approved', now())
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════
  -- FECHAR → negotiation
  -- ══════════════════════════════════════════
  INSERT INTO leads (name, pipeline_stage, pipeline_position, next_action_type, commercial_status, lead_origin, triage_status, created_at)
  VALUES
    ('CALÇADÃO URBANÓIDE', 'negotiation', 0, 'close_deal', 'message_sent', 'manual', 'approved', now()),
    ('CLAYTON AMIGO PORTUGA - BUFFET E JEQUITIBÁ', 'negotiation', 1, 'close_deal', 'message_sent', 'manual', 'approved', now()),
    ('MARTHA - THAIS', 'negotiation', 2, 'close_deal', 'message_sent', 'manual', 'approved', now()),
    ('MARQUINHO BSK', 'negotiation', 3, 'close_deal', 'message_sent', 'manual', 'approved', now())
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════
  -- OFF/PERDIDO → archived
  -- ══════════════════════════════════════════
  INSERT INTO leads (name, pipeline_stage, pipeline_position, commercial_status, lead_origin, triage_status, archived_at, lost_reason, created_at)
  VALUES
    ('AR NATURAL DIEGO', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('KAUE ZAIN?', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('SAMPA SMAHS', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('TAYNAN JÓIAS', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('CAÍQUE FRUTARIA', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('ANDREA - FAMILIA MINEIRA', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('FELIPE PADARIA ENZO', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('NATHAN CELESTINO BAR', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('BETO THIBÉ', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now()),
    ('LUÍZ SOROCABA ZENKO SUSHI', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'off/perdido', now())
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════
  -- NEGATIVA → archived
  -- ══════════════════════════════════════════
  INSERT INTO leads (name, pipeline_stage, pipeline_position, commercial_status, lead_origin, triage_status, archived_at, lost_reason, created_at)
  VALUES
    ('LYKKA DOCCES', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('PIEVA PIZZARIA DELIVERY', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('JOAO JEFFS', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('CAÍQUE', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('RAFA GOOD STUFF', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('LAÍS STUDIO MANI', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('ANTHONY TURISMO', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('VK CARS', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now()),
    ('ARTHUR PIZZARIA', NULL, 0, 'not_contacted', 'manual', 'approved', now(), 'negativa', now())
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════
  -- Log import event
  -- ══════════════════════════════════════════
  RAISE NOTICE 'Trello import completed. Check leads table for new records.';

END $$;

-- Verify counts
SELECT pipeline_stage, count(*) FROM leads WHERE lead_origin = 'manual' AND created_at > now() - interval '1 minute' GROUP BY pipeline_stage ORDER BY pipeline_stage;
