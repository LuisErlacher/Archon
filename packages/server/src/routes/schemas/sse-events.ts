/**
 * SSE Event Schema Definitions — canonical Zod schemas for the SSE event taxonomy.
 *
 * Per project convention, import `z` from `@hono/zod-openapi` (not from `zod` directly).
 */
import { z } from '@hono/zod-openapi';
import { createId } from '@paralleldrive/cuid2';

// ---------------------------------------------------------------------------
// Scope schema
// ---------------------------------------------------------------------------

export const sseScopeSchema = z.union([
  z.object({ kind: z.literal('dashboard') }),
  z.object({ kind: z.literal('workflowRun'), runId: z.string() }),
  z.object({ kind: z.literal('codebase'), codebaseId: z.string() }),
]);

export type SseScope = z.infer<typeof sseScopeSchema>;

// ---------------------------------------------------------------------------
// Envelope schema
// ---------------------------------------------------------------------------

export const sseEnvelopeSchema = z.object({
  id: z.string(),
  type: z.string(),
  ts: z.string(),
  scope: sseScopeSchema,
  payload: z.unknown(),
});

// ---------------------------------------------------------------------------
// Individual payload schemas
// ---------------------------------------------------------------------------

// --- Workflow run payloads ---

export const workflowRunQueuedPayloadSchema = z.object({
  runId: z.string(),
  workflowName: z.string(),
  codebaseId: z.string().optional(),
});

export const workflowRunStartedPayloadSchema = z.object({
  runId: z.string(),
  workflowName: z.string(),
  conversationId: z.string().optional(),
  codebaseId: z.string().optional(),
});

export const workflowRunTransitionPayloadSchema = z.object({
  runId: z.string(),
  fromStatus: z.string(),
  toStatus: z.string(),
  reason: z.string().optional(),
});

export const workflowRunCompletedPayloadSchema = z.object({
  runId: z.string(),
  workflowName: z.string(),
  duration: z.number(),
  codebaseId: z.string().optional(),
});

export const workflowRunFailedPayloadSchema = z.object({
  runId: z.string(),
  workflowName: z.string(),
  error: z.string(),
  codebaseId: z.string().optional(),
});

export const workflowRunCancelledPayloadSchema = z.object({
  runId: z.string(),
  reason: z.string(),
  nodeId: z.string().optional(),
  codebaseId: z.string().optional(),
});

export const workflowRunPausedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  message: z.string().optional(),
  codebaseId: z.string().optional(),
});

export const workflowRunResumedPayloadSchema = z.object({
  runId: z.string(),
  codebaseId: z.string().optional(),
});

export const workflowRunBlockedPayloadSchema = z.object({
  runId: z.string(),
  reason: z.string(),
  nodeId: z.string().optional(),
  codebaseId: z.string().optional(),
});

// --- Node payloads ---

export const nodeStartedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  nodeName: z.string(),
  codebaseId: z.string().optional(),
});

export const nodeCompletedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  nodeName: z.string(),
  duration: z.number(),
  costUsd: z.number().optional(),
  stopReason: z.string().optional(),
  numTurns: z.number().optional(),
  codebaseId: z.string().optional(),
});

export const nodeFailedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  nodeName: z.string(),
  error: z.string(),
  codebaseId: z.string().optional(),
});

export const nodeRetryingPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  nodeName: z.string(),
  attempt: z.number(),
  codebaseId: z.string().optional(),
});

// --- Gate payloads ---

export const gatePassedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  gateName: z.string().optional(),
  codebaseId: z.string().optional(),
});

export const gateFailedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  gateName: z.string().optional(),
  reason: z.string().optional(),
  codebaseId: z.string().optional(),
});

// --- Intervention payloads ---

export const interventionInjectedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  message: z.string().optional(),
  codebaseId: z.string().optional(),
});

export const interventionRedirectedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  targetNodeId: z.string().optional(),
  codebaseId: z.string().optional(),
});

export const interventionResolvedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  codebaseId: z.string().optional(),
});

export const interventionEscalatedPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  reason: z.string().optional(),
  codebaseId: z.string().optional(),
});

// --- Usage payload ---

export const usageRecordedPayloadSchema = z.object({
  runId: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  costUsd: z.number().optional(),
  codebaseId: z.string().optional(),
});

// --- System payloads ---

export const systemHeartbeatPayloadSchema = z.object({
  timestamp: z.number(),
});

export const systemErrorPayloadSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export const systemSnapshotPayloadSchema = z.object({
  activeRuns: z.number().optional(),
  queuedRuns: z.number().optional(),
  serverVersion: z.string().optional(),
  uptimeSeconds: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Full event schemas (envelope + specific payload + literal type)
// ---------------------------------------------------------------------------

const envelopeBase = {
  id: z.string(),
  ts: z.string(),
  scope: sseScopeSchema,
};

const workflowRunQueuedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.queued'),
  payload: workflowRunQueuedPayloadSchema,
});

const workflowRunStartedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.started'),
  payload: workflowRunStartedPayloadSchema,
});

const workflowRunTransitionEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.transition'),
  payload: workflowRunTransitionPayloadSchema,
});

const workflowRunCompletedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.completed'),
  payload: workflowRunCompletedPayloadSchema,
});

const workflowRunFailedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.failed'),
  payload: workflowRunFailedPayloadSchema,
});

const workflowRunCancelledEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.cancelled'),
  payload: workflowRunCancelledPayloadSchema,
});

const workflowRunPausedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.paused'),
  payload: workflowRunPausedPayloadSchema,
});

const workflowRunResumedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.resumed'),
  payload: workflowRunResumedPayloadSchema,
});

const workflowRunBlockedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('workflow.run.blocked'),
  payload: workflowRunBlockedPayloadSchema,
});

const nodeStartedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('node.started'),
  payload: nodeStartedPayloadSchema,
});

const nodeCompletedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('node.completed'),
  payload: nodeCompletedPayloadSchema,
});

const nodeFailedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('node.failed'),
  payload: nodeFailedPayloadSchema,
});

const nodeRetryingEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('node.retrying'),
  payload: nodeRetryingPayloadSchema,
});

const gatePassedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('gate.passed'),
  payload: gatePassedPayloadSchema,
});

const gateFailedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('gate.failed'),
  payload: gateFailedPayloadSchema,
});

const interventionInjectedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('intervention.injected'),
  payload: interventionInjectedPayloadSchema,
});

const interventionRedirectedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('intervention.redirected'),
  payload: interventionRedirectedPayloadSchema,
});

const interventionResolvedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('intervention.resolved'),
  payload: interventionResolvedPayloadSchema,
});

const interventionEscalatedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('intervention.escalated'),
  payload: interventionEscalatedPayloadSchema,
});

const usageRecordedEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('usage.recorded'),
  payload: usageRecordedPayloadSchema,
});

const systemHeartbeatEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('system.heartbeat'),
  payload: systemHeartbeatPayloadSchema,
});

const systemErrorEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('system.error'),
  payload: systemErrorPayloadSchema,
});

const systemSnapshotEventSchema = z.object({
  ...envelopeBase,
  type: z.literal('system.snapshot'),
  payload: systemSnapshotPayloadSchema,
});

// ---------------------------------------------------------------------------
// Discriminated union — canonical event schema
// ---------------------------------------------------------------------------

export const sseEventSchema = z.discriminatedUnion('type', [
  workflowRunQueuedEventSchema,
  workflowRunStartedEventSchema,
  workflowRunTransitionEventSchema,
  workflowRunCompletedEventSchema,
  workflowRunFailedEventSchema,
  workflowRunCancelledEventSchema,
  workflowRunPausedEventSchema,
  workflowRunResumedEventSchema,
  workflowRunBlockedEventSchema,
  nodeStartedEventSchema,
  nodeCompletedEventSchema,
  nodeFailedEventSchema,
  nodeRetryingEventSchema,
  gatePassedEventSchema,
  gateFailedEventSchema,
  interventionInjectedEventSchema,
  interventionRedirectedEventSchema,
  interventionResolvedEventSchema,
  interventionEscalatedEventSchema,
  usageRecordedEventSchema,
  systemHeartbeatEventSchema,
  systemErrorEventSchema,
  systemSnapshotEventSchema,
]);

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type SseEvent = z.infer<typeof sseEventSchema>;

/** All valid event type literal strings */
export type SseEventType = SseEvent['type'];

/** Type-level mapping from event type → payload type */
export interface SseEventMap {
  'workflow.run.queued': z.infer<typeof workflowRunQueuedPayloadSchema>;
  'workflow.run.started': z.infer<typeof workflowRunStartedPayloadSchema>;
  'workflow.run.transition': z.infer<typeof workflowRunTransitionPayloadSchema>;
  'workflow.run.completed': z.infer<typeof workflowRunCompletedPayloadSchema>;
  'workflow.run.failed': z.infer<typeof workflowRunFailedPayloadSchema>;
  'workflow.run.cancelled': z.infer<typeof workflowRunCancelledPayloadSchema>;
  'workflow.run.paused': z.infer<typeof workflowRunPausedPayloadSchema>;
  'workflow.run.resumed': z.infer<typeof workflowRunResumedPayloadSchema>;
  'workflow.run.blocked': z.infer<typeof workflowRunBlockedPayloadSchema>;
  'node.started': z.infer<typeof nodeStartedPayloadSchema>;
  'node.completed': z.infer<typeof nodeCompletedPayloadSchema>;
  'node.failed': z.infer<typeof nodeFailedPayloadSchema>;
  'node.retrying': z.infer<typeof nodeRetryingPayloadSchema>;
  'gate.passed': z.infer<typeof gatePassedPayloadSchema>;
  'gate.failed': z.infer<typeof gateFailedPayloadSchema>;
  'intervention.injected': z.infer<typeof interventionInjectedPayloadSchema>;
  'intervention.redirected': z.infer<typeof interventionRedirectedPayloadSchema>;
  'intervention.resolved': z.infer<typeof interventionResolvedPayloadSchema>;
  'intervention.escalated': z.infer<typeof interventionEscalatedPayloadSchema>;
  'usage.recorded': z.infer<typeof usageRecordedPayloadSchema>;
  'system.heartbeat': z.infer<typeof systemHeartbeatPayloadSchema>;
  'system.error': z.infer<typeof systemErrorPayloadSchema>;
  'system.snapshot': z.infer<typeof systemSnapshotPayloadSchema>;
}

// ---------------------------------------------------------------------------
// All event types list for inventory / grep-check
// ---------------------------------------------------------------------------

export const ALL_SSE_EVENT_TYPES: readonly string[] = [
  'workflow.run.queued',
  'workflow.run.started',
  'workflow.run.transition',
  'workflow.run.completed',
  'workflow.run.failed',
  'workflow.run.cancelled',
  'workflow.run.paused',
  'workflow.run.resumed',
  'workflow.run.blocked',
  'node.started',
  'node.completed',
  'node.failed',
  'node.retrying',
  'gate.passed',
  'gate.failed',
  'intervention.injected',
  'intervention.redirected',
  'intervention.resolved',
  'intervention.escalated',
  'usage.recorded',
  'system.heartbeat',
  'system.error',
  'system.snapshot',
] as const;

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Create a valid SSE event envelope with auto-filled id (CUID2) and ts (ISO8601).
 */
export function createSseEvent<T extends SseEventType>(
  type: T,
  scope: SseScope,
  payload: SseEventMap[T]
): SseEvent {
  return {
    id: createId(),
    type,
    ts: new Date().toISOString(),
    scope,
    payload,
  } as SseEvent;
}
