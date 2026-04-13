-- 022: Add workflow definitions table for DB-backed workflow storage
CREATE TABLE IF NOT EXISTS remote_agent_workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  definition TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  codebase_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_name
  ON remote_agent_workflow_definitions (name);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_codebase_id
  ON remote_agent_workflow_definitions (codebase_id)
  WHERE codebase_id IS NOT NULL;
