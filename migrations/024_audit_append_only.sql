-- 024: Add `actor` column to workflow events + append-only trigger
-- Idempotent: uses IF NOT EXISTS / CREATE OR REPLACE patterns.

-- 1. Add `actor` column with default 'system'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'remote_agent_workflow_events' AND column_name = 'actor'
  ) THEN
    ALTER TABLE remote_agent_workflow_events
      ADD COLUMN actor VARCHAR(255) NOT NULL DEFAULT 'system';
  END IF;
END $$;

-- 2. Append-only trigger: raise exception on UPDATE or DELETE
CREATE OR REPLACE FUNCTION remote_agent_workflow_events_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'remote_agent_workflow_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workflow_events_append_only ON remote_agent_workflow_events;
CREATE TRIGGER trg_workflow_events_append_only
  BEFORE UPDATE OR DELETE ON remote_agent_workflow_events
  FOR EACH ROW
  EXECUTE FUNCTION remote_agent_workflow_events_append_only();
