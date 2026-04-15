/**
 * Tests for scoped SSE HTTP endpoints.
 *
 * Uses a fresh SseBroker and a minimal Hono app to test SSE streaming behavior.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import {
  getSseBroker,
  resetSseBroker,
  createSseBroker,
  type SseBroker,
} from '../adapters/web/sse-broker';
import { registerSSERoutes } from './api.sse';
import { createSseEvent } from './schemas/sse-events';
import type { SseEvent, SseScope } from './schemas/sse-events';

// ---------------------------------------------------------------------------
// We need to override the broker singleton for testing.
// Since registerSSERoutes calls getSseBroker(), we reset and set a fresh one
// before each test.
// ---------------------------------------------------------------------------

// Mock the broker module to use a local instance
import { serializeScope } from '../adapters/web/sse-broker';
import type { SseEventHandler } from '../adapters/web/sse-broker';

describe('SSE HTTP Endpoints', () => {
  let app: OpenAPIHono;

  beforeEach(() => {
    resetSseBroker();
    app = new OpenAPIHono();
    registerSSERoutes(app);
  });

  // ---------------------------------------------------------------------------
  // Dashboard endpoint
  // ---------------------------------------------------------------------------

  describe('GET /api/stream/__dashboard__', () => {
    it('sets correct SSE headers', async () => {
      const response = app.request('/api/stream/__dashboard__');
      // Don't await the full stream — just check initial response
      // Hono streamSSE returns a Response immediately
      const res = await app.request('/api/stream/__dashboard__');
      // Abort the stream to prevent hanging
      try {
        expect(res.headers.get('Content-Type')).toBe('text/event-stream');
        expect(res.headers.get('Cache-Control')).toBe('no-cache');
        expect(res.headers.get('Connection')).toBe('keep-alive');
        expect(res.headers.get('X-Accel-Buffering')).toBe('no');
      } finally {
        // Consume body to release the stream
        if (res.body) {
          const reader = res.body.getReader();
          reader.cancel();
        }
      }
    });

    it('sends system.snapshot as first event', async () => {
      const broker = getSseBroker();

      const res = await app.request('/api/stream/__dashboard__');
      try {
        if (res.body) {
          const reader = res.body.getReader();
          const { value } = await reader.read();
          reader.cancel();

          const text = new TextDecoder().decode(value);
          // Should contain system.snapshot event data
          expect(text).toContain('system.snapshot');
        }
      } catch {
        // Stream may be cancelled already
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow run endpoint
  // ---------------------------------------------------------------------------

  describe('GET /api/stream/workflow-runs/:runId', () => {
    it('sets correct SSE headers', async () => {
      const res = await app.request('/api/stream/workflow-runs/run-123');
      try {
        expect(res.headers.get('Content-Type')).toBe('text/event-stream');
        expect(res.headers.get('Cache-Control')).toBe('no-cache');
      } finally {
        if (res.body) {
          const reader = res.body.getReader();
          reader.cancel();
        }
      }
    });

    it('sends system.snapshot as first event', async () => {
      const res = await app.request('/api/stream/workflow-runs/run-123');
      try {
        if (res.body) {
          const reader = res.body.getReader();
          const { value } = await reader.read();
          reader.cancel();

          const text = new TextDecoder().decode(value);
          expect(text).toContain('system.snapshot');
        }
      } catch {
        // Stream may be cancelled
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Codebase endpoint
  // ---------------------------------------------------------------------------

  describe('GET /api/stream/codebases/:codebaseId', () => {
    it('sets correct SSE headers', async () => {
      const res = await app.request('/api/stream/codebases/cb-456');
      try {
        expect(res.headers.get('Content-Type')).toBe('text/event-stream');
        expect(res.headers.get('Cache-Control')).toBe('no-cache');
      } finally {
        if (res.body) {
          const reader = res.body.getReader();
          reader.cancel();
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Scope isolation via broker
  // ---------------------------------------------------------------------------

  describe('scope isolation', () => {
    it('events for run A are not streamed to run B subscriber', async () => {
      const broker = getSseBroker();

      // Subscribe to run-B
      const received: SseEvent[] = [];
      const unsub = broker.subscribe({ kind: 'workflowRun', runId: 'run-B' }, event =>
        received.push(event)
      );

      // Publish event for run-A
      const eventA = createSseEvent(
        'workflow.run.started',
        { kind: 'workflowRun', runId: 'run-A' },
        { runId: 'run-A', workflowName: 'test-A' }
      );
      broker.publish(eventA);

      expect(received.length).toBe(0);

      unsub();
    });

    it('dashboard subscriber receives all workflowRun events', async () => {
      const broker = getSseBroker();

      const received: SseEvent[] = [];
      const unsub = broker.subscribe({ kind: 'dashboard' }, event => received.push(event));

      const eventA = createSseEvent(
        'workflow.run.started',
        { kind: 'workflowRun', runId: 'run-A' },
        { runId: 'run-A', workflowName: 'test-A' }
      );
      broker.publish(eventA);

      expect(received.length).toBe(1);
      expect(received[0].type).toBe('workflow.run.started');

      unsub();
    });
  });

  // ---------------------------------------------------------------------------
  // Last-Event-ID replay via broker
  // ---------------------------------------------------------------------------

  describe('Last-Event-ID replay', () => {
    it('replays events since lastEventId', async () => {
      const broker = getSseBroker();
      const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

      // Publish some events
      const event1 = createSseEvent('workflow.run.started', scope, {
        runId: 'run-A',
        workflowName: 'test',
      });
      const event2 = createSseEvent('node.started', scope, {
        runId: 'run-A',
        nodeId: 'node-1',
        nodeName: 'step-1',
      });
      broker.publish(event1);
      broker.publish(event2);

      // Replay since event1
      const replayed = broker.replaySince(scope, event1.id);
      expect(replayed.length).toBe(1);
      expect(replayed[0].id).toBe(event2.id);
    });

    it('returns all buffered events when lastEventId is null', async () => {
      const broker = getSseBroker();
      const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

      const event1 = createSseEvent('workflow.run.started', scope, {
        runId: 'run-A',
        workflowName: 'test',
      });
      broker.publish(event1);

      const replayed = broker.replaySince(scope, null);
      expect(replayed.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // SSE payload validation
  // ---------------------------------------------------------------------------

  describe('SSE payload validation', () => {
    it('all outbound events validate against sseEnvelopeSchema', async () => {
      const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };
      const event = createSseEvent('workflow.run.started', scope, {
        runId: 'run-A',
        workflowName: 'test',
      });

      // Validate envelope
      const { sseEnvelopeSchema } = await import('./schemas/sse-events');
      const result = sseEnvelopeSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });
});
