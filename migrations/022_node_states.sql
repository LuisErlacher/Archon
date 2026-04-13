-- Node state store: persists validated node execution state
CREATE TABLE IF NOT EXISTS remote_agent_node_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES remote_agent_workflow_runs(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  output TEXT DEFAULT '',
  output_validated BOOLEAN DEFAULT FALSE,
  gate_results JSONB DEFAULT '[]',
  attempt_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workflow_run_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_states_run_id
  ON remote_agent_node_states(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_node_states_status
  ON remote_agent_node_states(status);

-- Test result evidence: stores actual test run data per node
CREATE TABLE IF NOT EXISTS remote_agent_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_state_id UUID NOT NULL REFERENCES remote_agent_node_states(id) ON DELETE CASCADE,
  suite_name VARCHAR(255) NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failures JSONB DEFAULT '[]',
  stdout TEXT DEFAULT '',
  exit_code INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_results_node_state
  ON remote_agent_test_results(node_state_id);
