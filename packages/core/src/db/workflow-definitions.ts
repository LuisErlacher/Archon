/**
 * Database operations for workflow definitions (DB-backed storage).
 * These are separate from workflow RUNS (packages/core/src/db/workflows.ts).
 */
import { pool, getDialect } from './connection';
import { createLogger } from '@archon/paths';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('db.workflow-definitions');
  return cachedLog;
}

export interface WorkflowDefinitionRecord {
  id: string;
  name: string;
  description: string | null;
  definition: string; // JSON string of parsed WorkflowDefinition
  source: 'user' | 'imported';
  codebase_id: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeRecord(row: WorkflowDefinitionRecord): WorkflowDefinitionRecord {
  return row;
}

export async function upsertWorkflowDefinition(data: {
  name: string;
  description?: string | null;
  definition: string; // JSON.stringify(WorkflowDefinition)
  source?: 'user' | 'imported';
  codebase_id?: string | null;
}): Promise<WorkflowDefinitionRecord> {
  const dialect = getDialect();
  const result = await pool.query<WorkflowDefinitionRecord>(
    `INSERT INTO remote_agent_workflow_definitions
       (id, name, description, definition, source, codebase_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, ${dialect.now()}, ${dialect.now()})
     ON CONFLICT (name) DO UPDATE SET
       description = EXCLUDED.description,
       definition = EXCLUDED.definition,
       source = EXCLUDED.source,
       codebase_id = EXCLUDED.codebase_id,
       updated_at = ${dialect.now()}
     RETURNING *`,
    [
      dialect.generateUuid(),
      data.name,
      data.description ?? null,
      data.definition,
      data.source ?? 'user',
      data.codebase_id ?? null,
    ]
  );
  getLog().info({ name: data.name }, 'workflow_definition.upsert_completed');
  return normalizeRecord(result.rows[0]);
}

export async function getWorkflowDefinition(
  name: string
): Promise<WorkflowDefinitionRecord | null> {
  const result = await pool.query<WorkflowDefinitionRecord>(
    'SELECT * FROM remote_agent_workflow_definitions WHERE name = $1',
    [name]
  );
  if (result.rows.length === 0) return null;
  return normalizeRecord(result.rows[0]);
}

export async function listWorkflowDefinitions(
  codebaseId?: string | null
): Promise<WorkflowDefinitionRecord[]> {
  let sql = 'SELECT * FROM remote_agent_workflow_definitions';
  const params: unknown[] = [];
  if (codebaseId !== undefined) {
    sql += ' WHERE (codebase_id = $1 OR codebase_id IS NULL)';
    params.push(codebaseId);
  }
  sql += ' ORDER BY name ASC';
  const result = await pool.query<WorkflowDefinitionRecord>(sql, params);
  return result.rows.map(normalizeRecord);
}

export async function deleteWorkflowDefinition(name: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM remote_agent_workflow_definitions WHERE name = $1', [
    name,
  ]);
  if (result.rowCount > 0) {
    getLog().info({ name }, 'workflow_definition.delete_completed');
  }
  return result.rowCount > 0;
}
