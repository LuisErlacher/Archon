-- SSE Replay Indexes — support efficient Last-Event-ID lookups for scoped SSE replay
-- These indexes enable the broker's replaySince() to query events by scope and time.

-- Composite index for workflow-run-scoped replay (Last-Event-ID lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_events_run_created_id
  ON remote_agent_workflow_events (workflow_run_id, created_at, id);

-- Note: codebase_id is not a direct column on remote_agent_workflow_events.
-- Codebase-scoped replay is achieved by joining through remote_agent_workflow_runs
-- which has a codebase_id column. A codebase-specific index would require:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_runs_codebase_created
--     ON remote_agent_workflow_runs (codebase_id, created_at, id);
-- This is left as a follow-up optimization since the runs table is typically small
-- enough for index-only filtering without a dedicated composite index.
