/**
 * Tests for SSE event schema definitions.
 */
import { describe, it, expect } from 'bun:test';
import {
  sseEventSchema,
  sseEnvelopeSchema,
  sseScopeSchema,
  createSseEvent,
  ALL_SSE_EVENT_TYPES,
  // individual payload schemas for testing
  workflowRunQueuedPayloadSchema,
  workflowRunStartedPayloadSchema,
  workflowRunTransitionPayloadSchema,
  workflowRunCompletedPayloadSchema,
  workflowRunFailedPayloadSchema,
  workflowRunCancelledPayloadSchema,
  workflowRunPausedPayloadSchema,
  workflowRunResumedPayloadSchema,
  workflowRunBlockedPayloadSchema,
  nodeStartedPayloadSchema,
  nodeCompletedPayloadSchema,
  nodeFailedPayloadSchema,
  nodeRetryingPayloadSchema,
  gatePassedPayloadSchema,
  gateFailedPayloadSchema,
  interventionInjectedPayloadSchema,
  interventionRedirectedPayloadSchema,
  interventionResolvedPayloadSchema,
  interventionEscalatedPayloadSchema,
  usageRecordedPayloadSchema,
  systemHeartbeatPayloadSchema,
  systemErrorPayloadSchema,
  systemSnapshotPayloadSchema,
} from './sse-events';
import type { SseScope, SseEventType } from './sse-events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dashboardScope: SseScope = { kind: 'dashboard' };
const workflowScope: SseScope = { kind: 'workflowRun', runId: 'run-123' };
const codebaseScope: SseScope = { kind: 'codebase', codebaseId: 'cb-456' };

/** A sample valid payload for each event type */
const samplePayloads: Record<string, unknown> = {
  'workflow.run.queued': { runId: 'run-123', workflowName: 'test-workflow' },
  'workflow.run.started': { runId: 'run-123', workflowName: 'test-workflow' },
  'workflow.run.transition': { runId: 'run-123', fromStatus: 'pending', toStatus: 'running' },
  'workflow.run.completed': { runId: 'run-123', workflowName: 'test-workflow', duration: 1000 },
  'workflow.run.failed': { runId: 'run-123', workflowName: 'test-workflow', error: 'boom' },
  'workflow.run.cancelled': { runId: 'run-123', reason: 'user request' },
  'workflow.run.paused': { runId: 'run-123', nodeId: 'node-1' },
  'workflow.run.resumed': { runId: 'run-123' },
  'workflow.run.blocked': { runId: 'run-123', reason: 'waiting for gate' },
  'node.started': { runId: 'run-123', nodeId: 'node-1', nodeName: 'step-1' },
  'node.completed': { runId: 'run-123', nodeId: 'node-1', nodeName: 'step-1', duration: 500 },
  'node.failed': { runId: 'run-123', nodeId: 'node-1', nodeName: 'step-1', error: 'fail' },
  'node.retrying': { runId: 'run-123', nodeId: 'node-1', nodeName: 'step-1', attempt: 2 },
  'gate.passed': { runId: 'run-123', nodeId: 'gate-1' },
  'gate.failed': { runId: 'run-123', nodeId: 'gate-1' },
  'intervention.injected': { runId: 'run-123', nodeId: 'int-1' },
  'intervention.redirected': { runId: 'run-123', nodeId: 'int-1' },
  'intervention.resolved': { runId: 'run-123', nodeId: 'int-1' },
  'intervention.escalated': { runId: 'run-123', nodeId: 'int-1' },
  'usage.recorded': { runId: 'run-123' },
  'system.heartbeat': { timestamp: Date.now() },
  'system.error': { message: 'something went wrong' },
  'system.snapshot': { activeRuns: 3 },
};

describe('SSE Event Schemas', () => {
  it('has at least 15 event types', () => {
    expect(ALL_SSE_EVENT_TYPES.length).toBeGreaterThanOrEqual(15);
  });

  it('all event types are unique', () => {
    const set = new Set(ALL_SSE_EVENT_TYPES);
    expect(set.size).toBe(ALL_SSE_EVENT_TYPES.length);
  });

  // --- Round-trip tests for every event type ---

  for (const type of ALL_SSE_EVENT_TYPES) {
    describe(`event type: ${type}`, () => {
      it('round-trips through sseEventSchema (parse → serialize → parse)', () => {
        const payload = samplePayloads[type];
        const event = createSseEvent(type as SseEventType, workflowScope, payload);
        // First parse
        const parsed = sseEventSchema.parse(event);
        // Serialize
        const serialized = JSON.stringify(parsed);
        // Second parse
        const reparsed = sseEventSchema.parse(JSON.parse(serialized));
        expect(reparsed.type).toBe(type);
        expect(reparsed.id).toBe(parsed.id);
        expect(reparsed.ts).toBe(parsed.ts);
      });
    });
  }

  // --- Discriminated union rejects unknown types ---

  it('sseEventSchema rejects unknown type values', () => {
    const unknownEvent = {
      id: 'test-id',
      type: 'unknown.type',
      ts: new Date().toISOString(),
      scope: workflowScope,
      payload: { foo: 'bar' },
    };
    const result = sseEventSchema.safeParse(unknownEvent);
    expect(result.success).toBe(false);
  });

  // --- Envelope accepts but discriminated union rejects unknown type ---

  it('sseEnvelopeSchema validates but sseEventSchema rejects unknown type', () => {
    const unknownEvent = {
      id: 'test-id',
      type: 'unknown.type',
      ts: new Date().toISOString(),
      scope: workflowScope,
      payload: { foo: 'bar' },
    };
    // Envelope should validate (accepts any type string)
    const envelopeResult = sseEnvelopeSchema.safeParse(unknownEvent);
    expect(envelopeResult.success).toBe(true);
    // Discriminated union should reject
    const eventResult = sseEventSchema.safeParse(unknownEvent);
    expect(eventResult.success).toBe(false);
  });

  // --- createSseEvent produces valid events ---

  it('createSseEvent produces a valid envelope with CUID2 id and ISO8601 ts', () => {
    const event = createSseEvent('workflow.run.started', workflowScope, {
      runId: 'run-123',
      workflowName: 'test-workflow',
    });

    // CUID2 ids are at least 20 chars
    expect(event.id.length).toBeGreaterThanOrEqual(20);
    // ts is valid ISO8601
    expect(new Date(event.ts).toISOString()).toBe(event.ts);
    // Type is correct
    expect(event.type).toBe('workflow.run.started');
    // Scope is preserved
    expect(event.scope).toEqual(workflowScope);

    // Validates against schema
    const result = sseEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  // --- Scope schema validation ---

  it('validates dashboard scope', () => {
    const result = sseScopeSchema.safeParse({ kind: 'dashboard' });
    expect(result.success).toBe(true);
  });

  it('validates workflowRun scope', () => {
    const result = sseScopeSchema.safeParse({ kind: 'workflowRun', runId: 'abc' });
    expect(result.success).toBe(true);
  });

  it('validates codebase scope', () => {
    const result = sseScopeSchema.safeParse({ kind: 'codebase', codebaseId: 'cb-1' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid scope kind', () => {
    const result = sseScopeSchema.safeParse({ kind: 'invalid' });
    expect(result.success).toBe(false);
  });

  // --- Individual payload schemas ---

  it('node.completed payload schema validates correctly', () => {
    const payload = {
      runId: 'run-1',
      nodeId: 'node-1',
      nodeName: 'test-node',
      duration: 1000,
      costUsd: 0.05,
    };
    const result = nodeCompletedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('system.heartbeat payload schema validates correctly', () => {
    const payload = { timestamp: Date.now() };
    const result = systemHeartbeatPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('system.snapshot payload schema validates correctly', () => {
    const payload = { activeRuns: 3, queuedRuns: 1, serverVersion: '0.3.6' };
    const result = systemSnapshotPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('system.error payload schema validates correctly', () => {
    const payload = { message: 'something went wrong', code: 'ERR_INTERNAL' };
    const result = systemErrorPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
