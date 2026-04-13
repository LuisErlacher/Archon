/**
 * Zod schemas for gate-related API endpoints.
 */
import { z } from '@hono/zod-openapi';
import { gateResultSchema } from '@archon/workflows/schemas/gate';

/** A single gate result with OpenAPI metadata. */
export const gateResultResponseSchema = gateResultSchema.openapi('GateResult');

/** A node state row returned by the API. */
export const nodeStateResponseSchema = z
  .object({
    id: z.string(),
    workflow_run_id: z.string(),
    node_id: z.string(),
    status: z.string(),
    output: z.string(),
    output_validated: z.boolean(),
    gate_results: z.array(gateResultResponseSchema),
    attempt_count: z.number(),
    started_at: z.string(),
    completed_at: z.string().nullable(),
    updated_at: z.string(),
  })
  .openapi('NodeState');

/** Test result evidence for a single node. */
export const testResultResponseSchema = z
  .object({
    id: z.string(),
    node_state_id: z.string(),
    suite_name: z.string(),
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    failures: z.array(z.object({ name: z.string(), message: z.string() })),
    stdout: z.string(),
    exit_code: z.number(),
    created_at: z.string(),
  })
  .openapi('TestResult');

/** Per-node summary with gate results and test evidence. */
export const nodeSummarySchema = z
  .object({
    nodeState: nodeStateResponseSchema,
    testResults: z.array(testResultResponseSchema),
  })
  .openapi('NodeSummary');

/** GET /api/workflows/runs/:runId/summary response. */
export const runSummaryResponseSchema = z
  .object({
    runId: z.string(),
    nodes: z.array(nodeSummarySchema),
  })
  .openapi('RunSummary');

/** POST /api/workflows/runs/:runId/nodes/:nodeId/gate-result request body.
 * Uses a standalone schema (not derived from gateResultSchema) to avoid
 * Zod input/output type mismatches from .default() fields. */
export const storeGateResultBodySchema = z
  .object({
    gateId: z.string(),
    gateName: z.string(),
    gateType: z.enum(['test-suite', 'typecheck', 'lint', 'custom']),
    severity: z.enum(['p0', 'p1', 'p2']),
    passed: z.boolean(),
    evidence: z.object({
      stdout: z.string(),
      exitCode: z.number().int(),
      parsedResults: z
        .object({
          total: z.number(),
          passed: z.number(),
          failed: z.number(),
          skipped: z.number(),
          failures: z.array(z.object({ name: z.string(), message: z.string() })).default([]),
        })
        .optional(),
    }),
    error: z.string().optional(),
  })
  .openapi('StoreGateResultBody');

/** POST /api/workflows/runs/:runId/nodes/:nodeId/gate-result response. */
export const storeGateResultResponseSchema = z
  .object({ success: z.boolean() })
  .openapi('StoreGateResultResponse');
