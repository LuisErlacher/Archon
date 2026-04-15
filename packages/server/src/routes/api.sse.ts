/**
 * Scoped SSE HTTP endpoints for streaming workflow and system events.
 *
 * Three scoped endpoints:
 *   GET /api/stream/__dashboard__    — all events (multiplexed)
 *   GET /api/stream/workflow-runs/:runId — per-run events
 *   GET /api/stream/codebases/:codebaseId — per-codebase events
 *
 * Each sets SSE headers, replays buffered events if Last-Event-ID is provided,
 * sends an initial system.snapshot, streams live events via SseBroker,
 * and emits system.heartbeat every 30 s.
 */
import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import { createLogger } from '@archon/paths';
import { getSseBroker, serializeScope } from '../adapters/web/sse-broker';
import { createSseEvent, sseEnvelopeSchema } from './schemas/sse-events';
import type { SseEvent, SseScope } from './schemas/sse-events';

/** Lazy-initialized logger */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('api.sse');
  return cachedLog;
}

/** Heartbeat interval in milliseconds. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Format an SSE event as a text frame:
 *   id: <event.id>
 *   event: <event.type>
 *   data: <JSON.stringify(event)>
 */
function formatSSEFrame(event: SseEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Set standard SSE response headers.
 */
function setSSEHeaders(c: Context): void {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');
}

/**
 * Validate an event against the envelope schema (dev-mode assertion, non-throwing).
 */
function validateEvent(event: SseEvent): void {
  if (process.env.NODE_ENV !== 'production') {
    const result = sseEnvelopeSchema.safeParse(event);
    if (!result.success) {
      getLog().warn({ err: result.error, eventType: event.type }, 'sse_event_validation_failed');
    }
  }
}

/**
 * Create a system.snapshot event for the initial connection.
 */
function createSnapshotEvent(scope: SseScope): SseEvent {
  return createSseEvent('system.snapshot', scope, {
    activeRuns: 0,
    uptimeSeconds: process.uptime(),
  });
}

/**
 * Create a system.heartbeat event.
 */
function createHeartbeatEvent(scope: SseScope): SseEvent {
  return createSseEvent('system.heartbeat', scope, {
    timestamp: Date.now(),
  });
}

/**
 * Handle a scoped SSE connection. Shared logic for all three endpoints.
 */
function handleScopedSSE(c: Context, scope: SseScope): Response {
  const broker = getSseBroker();

  return streamSSE(c, async stream => {
    // 1. Replay buffered events if Last-Event-ID header is present
    const lastEventId = c.req.header('Last-Event-ID') ?? null;
    if (lastEventId) {
      const replayed = broker.replaySince(scope, lastEventId);
      for (const event of replayed) {
        validateEvent(event);
        await stream.writeSSE({ data: JSON.stringify(event), id: event.id, event: event.type });
      }
    }

    // 2. Send initial system.snapshot
    const snapshot = createSnapshotEvent(scope);
    validateEvent(snapshot);
    await stream.writeSSE({
      data: JSON.stringify(snapshot),
      id: snapshot.id,
      event: snapshot.type,
    });

    // 3. Subscribe to live events
    const queue: SseEvent[] = [];
    const unsubscribe = broker.subscribe(scope, (event: SseEvent) => {
      queue.push(event);
    });

    // 4. Start heartbeat interval
    const heartbeatInterval = setInterval(() => {
      const heartbeat = createHeartbeatEvent(scope);
      queue.push(heartbeat);
    }, HEARTBEAT_INTERVAL_MS);

    // 5. Stream loop: drain queue and write to stream
    try {
      while (!stream.closed) {
        // Drain queue
        while (queue.length > 0) {
          const event = queue.shift();
          if (!event) break;
          validateEvent(event);
          await stream.writeSSE({
            data: JSON.stringify(event),
            id: event.id,
            event: event.type,
          });
        }
        // Sleep briefly to avoid busy loop
        await stream.sleep(50);
      }
    } catch (e: unknown) {
      const msg = (e as Error).message ?? '';
      if (!msg.includes('aborted') && !msg.includes('closed') && !msg.includes('cancel')) {
        getLog().warn({ err: e as Error, scope: serializeScope(scope) }, 'sse_stream_error');
      }
    } finally {
      clearInterval(heartbeatInterval);
      unsubscribe();
      getLog().debug({ scope: serializeScope(scope) }, 'sse_stream_closed');
    }
  }) as unknown as Response;
}

/**
 * Register SSE route handlers on the Hono app.
 */
export function registerSSERoutes(app: {
  get: (path: string, handler: (c: Context) => Response | Promise<Response>) => void;
}): void {
  // GET /api/stream/__dashboard__ — multiplexed dashboard SSE (all events)
  app.get('/api/stream/__dashboard__', async c => {
    setSSEHeaders(c);
    const scope: SseScope = { kind: 'dashboard' };
    return handleScopedSSE(c, scope);
  });

  // GET /api/stream/workflow-runs/:runId — per-run events
  app.get('/api/stream/workflow-runs/:runId', async c => {
    setSSEHeaders(c);
    const runId = c.req.param('runId') ?? '';
    const scope: SseScope = { kind: 'workflowRun', runId };
    return handleScopedSSE(c, scope);
  });

  // GET /api/stream/codebases/:codebaseId — per-codebase events
  app.get('/api/stream/codebases/:codebaseId', async c => {
    setSSEHeaders(c);
    const codebaseId = c.req.param('codebaseId') ?? '';
    const scope: SseScope = { kind: 'codebase', codebaseId };
    return handleScopedSSE(c, scope);
  });
}

// Re-export for testing
export {
  handleScopedSSE,
  setSSEHeaders,
  formatSSEFrame,
  createSnapshotEvent,
  createHeartbeatEvent,
};
