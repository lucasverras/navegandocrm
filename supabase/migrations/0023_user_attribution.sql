-- Add user attribution to outreach events for multi-user support.
-- Nullable because system-generated events (batch analysis, cadence auto-advance) have no user.

ALTER TABLE public.outreach_events
  ADD COLUMN IF NOT EXISTS performed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_events_performer
  ON public.outreach_events (performed_by)
  WHERE performed_by IS NOT NULL;

-- Checklists already have user_id — no additional column needed.
