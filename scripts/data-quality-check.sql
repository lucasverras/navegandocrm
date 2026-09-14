-- Data Quality Report for Radar Navegando
-- Run against the database to identify issues before production launch.

-- 1. Closed clients with missing financial data
SELECT 'clients_missing_data' AS check_name, count(*) AS count
FROM leads
WHERE pipeline_stage = 'closed'
  AND (initial_monthly_fee IS NULL OR initial_monthly_fee = 0 OR closed_at IS NULL);

-- 2. Active pipeline leads without next_action_type
SELECT 'pipeline_no_next_action' AS check_name, count(*) AS count
FROM leads
WHERE pipeline_stage IS NOT NULL
  AND pipeline_stage != 'closed'
  AND archived_at IS NULL
  AND next_action_type IS NULL;

-- 3. Leads with duplicate Instagram handles
SELECT 'duplicate_instagram' AS check_name, count(*) AS count
FROM (
  SELECT instagram_handle, count(*) AS n
  FROM leads
  WHERE instagram_handle IS NOT NULL AND instagram_handle != ''
  GROUP BY instagram_handle
  HAVING count(*) > 1
) dupes;

-- 4. Leads with duplicate phone numbers
SELECT 'duplicate_phone' AS check_name, count(*) AS count
FROM (
  SELECT phone, count(*) AS n
  FROM leads
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY phone
  HAVING count(*) > 1
) dupes;

-- 5. Pipeline leads without phone (can't WhatsApp)
SELECT 'pipeline_no_phone' AS check_name, count(*) AS count
FROM leads
WHERE pipeline_stage IS NOT NULL
  AND pipeline_stage != 'closed'
  AND archived_at IS NULL
  AND (phone IS NULL OR phone = '');

-- 6. Closed clients with commission_type but 0 percent
SELECT 'commission_zero_percent' AS check_name, count(*) AS count
FROM leads
WHERE pipeline_stage = 'closed'
  AND commission_type IS NOT NULL
  AND commission_type != 'none'
  AND (commission_percent IS NULL OR commission_percent = 0);

-- 7. Regions with zero leads
SELECT 'empty_regions' AS check_name, count(*) AS count
FROM regions r
LEFT JOIN leads l ON l.region_id = r.id
WHERE l.id IS NULL
  AND r.status = 'active';

-- 8. Pending reimbursements summary
SELECT 'pending_reimbursements' AS check_name, count(*) AS count
FROM reimbursements
WHERE status = 'pendente';

-- 9. Table row counts
SELECT 'leads_total' AS check_name, count(*) AS count FROM leads
UNION ALL
SELECT 'leads_active_pipeline', count(*) FROM leads WHERE pipeline_stage IS NOT NULL AND archived_at IS NULL
UNION ALL
SELECT 'leads_closed', count(*) FROM leads WHERE pipeline_stage = 'closed'
UNION ALL
SELECT 'leads_archived', count(*) FROM leads WHERE archived_at IS NOT NULL
UNION ALL
SELECT 'regions_total', count(*) FROM regions
UNION ALL
SELECT 'checklists_total', count(*) FROM checklists
UNION ALL
SELECT 'reimbursements_total', count(*) FROM reimbursements
UNION ALL
SELECT 'outreach_messages_total', count(*) FROM outreach_messages
UNION ALL
SELECT 'outreach_events_total', count(*) FROM outreach_events
UNION ALL
SELECT 'api_usage_total', count(*) FROM api_usage;
