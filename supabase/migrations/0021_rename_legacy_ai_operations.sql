-- Rename legacy Anthropic model references in api_usage operation names.
-- Old: haiku_analysis, haiku_analysis_batch, sonnet_refinement
-- New: ai_analysis, ai_analysis_batch, ai_refinement

UPDATE api_usage SET operation = 'ai_analysis'       WHERE operation = 'haiku_analysis';
UPDATE api_usage SET operation = 'ai_analysis_batch'  WHERE operation = 'haiku_analysis_batch';
UPDATE api_usage SET operation = 'ai_refinement'      WHERE operation = 'sonnet_refinement';

-- Rename keys inside the usage_limits JSON stored in settings.
UPDATE settings
SET value = jsonb_build_object(
  'ai_analyses_per_day',            COALESCE((value->>'haiku_analyses_per_day')::int,  (value->>'ai_analyses_per_day')::int,  100),
  'decision_maker_searches_per_day', COALESCE((value->>'decision_maker_searches_per_day')::int, 20),
  'ai_refinements_per_day',          COALESCE((value->>'sonnet_refinements_per_day')::int, (value->>'ai_refinements_per_day')::int, 10)
)
WHERE key = 'usage_limits';
