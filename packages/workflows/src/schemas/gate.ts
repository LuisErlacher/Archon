/**
 * Zod schemas for quality gate configuration and results.
 *
 * Gates independently verify agent claims (test results, type checks, lint)
 * by running real commands and parsing their output.
 */
import { z } from '@hono/zod-openapi';

// ---------------------------------------------------------------------------
// Gate severity — determines whether a failure blocks the node
// ---------------------------------------------------------------------------

export const gateSeveritySchema = z.enum(['p0', 'p1', 'p2']).openapi('GateSeverity');

export type GateSeverity = z.infer<typeof gateSeveritySchema>;

// ---------------------------------------------------------------------------
// Gate type — built-in gate categories
// ---------------------------------------------------------------------------

export const gateTypeSchema = z
  .enum(['test-suite', 'typecheck', 'lint', 'custom'])
  .openapi('GateType');

export type GateType = z.infer<typeof gateTypeSchema>;

// ---------------------------------------------------------------------------
// Test results — parsed from command stdout
// ---------------------------------------------------------------------------

export const testFailureSchema = z.object({
  name: z.string(),
  message: z.string(),
});

export const testResultsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failures: z.array(testFailureSchema).default([]),
  })
  .openapi('TestResults');

export type TestResults = z.infer<typeof testResultsSchema>;

// ---------------------------------------------------------------------------
// Gate evidence — captured from command execution
// ---------------------------------------------------------------------------

export const gateEvidenceSchema = z
  .object({
    stdout: z.string(),
    exitCode: z.number().int(),
    parsedResults: testResultsSchema.optional(),
  })
  .openapi('GateEvidence');

export type GateEvidence = z.infer<typeof gateEvidenceSchema>;

// ---------------------------------------------------------------------------
// Gate result — outcome of a single gate execution
// ---------------------------------------------------------------------------

export const gateResultSchema = z
  .object({
    gateId: z.string(),
    gateName: z.string(),
    gateType: gateTypeSchema,
    severity: gateSeveritySchema,
    passed: z.boolean(),
    evidence: gateEvidenceSchema,
    error: z.string().optional(),
  })
  .openapi('GateResult');

export type GateResult = z.infer<typeof gateResultSchema>;

// ---------------------------------------------------------------------------
// Quality gate configuration — defined per-node in workflow YAML
// ---------------------------------------------------------------------------

export const qualityGateConfigSchema = z.object({
  type: gateTypeSchema,
  name: z.string().optional(),
  command: z.string().optional(),
  severity: gateSeveritySchema.default('p1'),
  maxRetries: z.number().int().nonnegative().default(0),
});

export type QualityGateConfig = z.infer<typeof qualityGateConfigSchema>;

// ---------------------------------------------------------------------------
// Node gates config — array of gates for a single node
// ---------------------------------------------------------------------------

export const nodeGatesConfigSchema = z.array(qualityGateConfigSchema);

export type NodeGatesConfig = z.infer<typeof nodeGatesConfigSchema>;
