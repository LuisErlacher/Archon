/**
 * Node state persistence — CRUD operations for the remote_agent_node_states
 * and remote_agent_test_results tables.
 */
import type { NodeStateRow, TestResultRow } from '@archon/workflows/store';
import type { GateResult } from '@archon/workflows/schemas/gate';
import type { NodeState } from '@archon/workflows/schemas/workflow-run';
import { pool, getDialect } from './connection';
import { createLogger } from '@archon/paths';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('db.node-states');
  return cachedLog;
}

/**
 * Upsert a node state row. Fire-and-forget: catches all errors internally.
 */
export async function upsertNodeState(data: {
  workflow_run_id: string;
  node_id: string;
  status: NodeState;
  output?: string;
  output_validated?: boolean;
  gate_results?: GateResult[];
  attempt_count?: number;
}): Promise<void> {
  try {
    const dialect = getDialect();
    const id = dialect.generateUuid();
    const gateResultsJson = JSON.stringify(data.gate_results ?? []);
    const outputValidated = data.output_validated ?? false;

    await pool.query(
      `INSERT INTO remote_agent_node_states
         (id, workflow_run_id, node_id, status, output, output_validated, gate_results, attempt_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(workflow_run_id, node_id) DO UPDATE SET
         status = $4,
         output = $5,
         output_validated = $6,
         gate_results = $7,
         attempt_count = $8,
         completed_at = CASE WHEN $4 IN ('completed', 'failed') THEN ${dialect.now()} ELSE remote_agent_node_states.completed_at END,
         updated_at = ${dialect.now()}`,
      [
        id,
        data.workflow_run_id,
        data.node_id,
        data.status,
        data.output ?? '',
        outputValidated,
        gateResultsJson,
        data.attempt_count ?? 0,
      ]
    );
  } catch (error) {
    getLog().error(
      { err: error as Error, runId: data.workflow_run_id, nodeId: data.node_id },
      'db.node_state_upsert_failed'
    );
    // Fire-and-forget: never throw
  }
}

/**
 * Get a single node state by composite key.
 */
export async function getNodeState(
  workflowRunId: string,
  nodeId: string
): Promise<NodeStateRow | null> {
  const result = await pool.query<NodeStateRow>(
    `SELECT * FROM remote_agent_node_states
     WHERE workflow_run_id = $1 AND node_id = $2`,
    [workflowRunId, nodeId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return normalizeNodeStateRow(row);
}

/**
 * Get all node states for a workflow run, ordered by start time.
 */
export async function getNodeStates(workflowRunId: string): Promise<NodeStateRow[]> {
  const result = await pool.query<NodeStateRow>(
    `SELECT * FROM remote_agent_node_states
     WHERE workflow_run_id = $1
     ORDER BY started_at ASC`,
    [workflowRunId]
  );
  return [...result.rows].map(normalizeNodeStateRow);
}

/**
 * Return a map of nodeId → output for all validated completed nodes.
 * Preferred over getCompletedDagNodeOutputs for new runs.
 */
export async function getValidatedNodeOutputs(workflowRunId: string): Promise<Map<string, string>> {
  const result = await pool.query<{ node_id: string; output: string }>(
    `SELECT node_id, output FROM remote_agent_node_states
     WHERE workflow_run_id = $1 AND status = 'completed' AND output_validated = $2`,
    [workflowRunId, true]
  );
  const outputs = new Map<string, string>();
  for (const row of result.rows) {
    outputs.set(row.node_id, row.output);
  }
  return outputs;
}

/**
 * Create a test result row. Fire-and-forget: catches all errors internally.
 */
export async function createTestResult(data: {
  node_state_id: string;
  suite_name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failures?: { name: string; message: string }[];
  stdout: string;
  exit_code: number;
}): Promise<void> {
  try {
    const dialect = getDialect();
    const id = dialect.generateUuid();
    const failuresJson = JSON.stringify(data.failures ?? []);

    await pool.query(
      `INSERT INTO remote_agent_test_results
         (id, node_state_id, suite_name, total, passed, failed, skipped, failures, stdout, exit_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        data.node_state_id,
        data.suite_name,
        data.total,
        data.passed,
        data.failed,
        data.skipped,
        failuresJson,
        data.stdout,
        data.exit_code,
      ]
    );
  } catch (error) {
    getLog().error(
      { err: error as Error, nodeStateId: data.node_state_id },
      'db.test_result_create_failed'
    );
    // Fire-and-forget: never throw
  }
}

/**
 * Get all test results for a node state, ordered by creation time.
 */
export async function getTestResults(nodeStateId: string): Promise<TestResultRow[]> {
  const result = await pool.query<TestResultRow>(
    `SELECT * FROM remote_agent_test_results
     WHERE node_state_id = $1
     ORDER BY created_at ASC`,
    [nodeStateId]
  );
  return [...result.rows].map(normalizeTestResultRow);
}

// ─── Normalization helpers ──────────────────────────────────────────────────

function normalizeNodeStateRow(row: NodeStateRow): NodeStateRow {
  return {
    ...row,
    // SQLite stores booleans as INTEGER (0/1); coerce via intermediate unknown
    output_validated: Boolean(row.output_validated as unknown),
    // JSON fields may arrive as strings from SQLite
    gate_results:
      typeof row.gate_results === 'string' ? JSON.parse(row.gate_results) : row.gate_results,
  };
}

function normalizeTestResultRow(row: TestResultRow): TestResultRow {
  return {
    ...row,
    failures: typeof row.failures === 'string' ? JSON.parse(row.failures) : row.failures,
  };
}
