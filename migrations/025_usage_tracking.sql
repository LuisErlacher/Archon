CREATE TABLE IF NOT EXISTS remote_agent_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID REFERENCES remote_agent_workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT,
  codebase_id UUID REFERENCES remote_agent_codebases(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_run ON remote_agent_usage_events(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON remote_agent_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_codebase_day ON remote_agent_usage_events(codebase_id, date_trunc('day', created_at));
