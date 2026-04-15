/**
 * SseBroker — in-process pub/sub broker for SSE events.
 *
 * Replaces the hardcoded fan-out in WorkflowEventBridge with a scoped pub/sub
 * that supports replay, ring buffers, and dashboard multiplexing.
 */
import type { SseEvent, SseScope } from '../../routes/schemas/sse-events';
import { createLogger } from '@archon/paths';

/** Lazy-initialized logger */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('sse.broker');
  return cachedLog;
}

/** Max events to buffer per scope for replay. */
const RING_BUFFER_MAX = 500;

/** Ring buffer entry. */
interface BufferedEvent {
  event: SseEvent;
  enqueuedAt: number; // Date.now()
}

/** Serialise a scope to a string key. */
export function serializeScope(scope: SseScope): string {
  switch (scope.kind) {
    case 'dashboard':
      return 'dashboard';
    case 'workflowRun':
      return `workflowRun:${scope.runId}`;
    case 'codebase':
      return `codebase:${scope.codebaseId}`;
  }
}

/** Handler type */
export type SseEventHandler = (event: SseEvent) => void;

export interface SseBroker {
  /** Publish an event to all matching subscribers and append to the ring buffer. */
  publish(event: SseEvent): void;

  /**
   * Subscribe to events matching a scope.
   * Returns an unsubscribe function.
   */
  subscribe(scope: SseScope, handler: SseEventHandler): () => void;

  /**
   * Return buffered events for the scope newer than `lastEventId`, ordered by `ts`.
   * Returns [] if lastEventId is beyond the buffer window.
   */
  replaySince(scope: SseScope, lastEventId: string | null): SseEvent[];
}

class SseBrokerImpl implements SseBroker {
  /** Map from serialized scope → set of handlers */
  private subscribers = new Map<string, Set<SseEventHandler>>();

  /** Map from serialized scope → ring buffer */
  private buffers = new Map<string, BufferedEvent[]>();

  publish(event: SseEvent): void {
    const primaryScopeKey = serializeScope(event.scope);

    // Append to ring buffer for the primary scope
    this.appendToBuffer(primaryScopeKey, event);

    // Determine all scopes that should receive this event
    const scopeKeys = this.resolveTargetScopes(event);

    // Deliver to matching subscribers
    for (const key of scopeKeys) {
      const handlers = this.subscribers.get(key);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(event);
          } catch (err) {
            getLog().error(
              { err: err as Error, eventType: event.type, scopeKey: key },
              'sse_broker_handler_error'
            );
          }
        }
      }
    }
  }

  subscribe(scope: SseScope, handler: SseEventHandler): () => void {
    const key = serializeScope(scope);
    let set = this.subscribers.get(key);
    if (!set) {
      set = new Set();
      this.subscribers.set(key, set);
    }
    set.add(handler);

    return () => {
      const s = this.subscribers.get(key);
      if (s) {
        s.delete(handler);
        if (s.size === 0) {
          this.subscribers.delete(key);
          // No remaining subscribers — free the ring buffer for this scope
          this.buffers.delete(key);
        }
      }
    };
  }

  replaySince(scope: SseScope, lastEventId: string | null): SseEvent[] {
    const key = serializeScope(scope);
    const buffer = this.buffers.get(key);
    if (!buffer || buffer.length === 0) return [];

    if (lastEventId === null) {
      // Return all buffered events sorted chronologically
      return [...buffer].sort((a, b) => a.event.ts.localeCompare(b.event.ts)).map(e => e.event);
    }

    // Find the index of the event with lastEventId
    const idx = buffer.findIndex(e => e.event.id === lastEventId);
    if (idx === -1) {
      // Event not found in buffer — client is too far behind
      return [];
    }

    // Return events after the found index, sorted chronologically
    return buffer
      .slice(idx + 1)
      .sort((a, b) => a.event.ts.localeCompare(b.event.ts))
      .map(e => e.event);
  }

  /**
   * Resolve all scopes that should receive a given event.
   * For example, a workflowRun event also goes to dashboard subscribers
   * and optionally to codebase subscribers.
   */
  private resolveTargetScopes(event: SseEvent): string[] {
    const keys = new Set<string>();

    // Primary scope always gets the event
    keys.add(serializeScope(event.scope));

    // Dashboard subscribers always receive all events
    keys.add('dashboard');

    // If the payload contains a codebaseId, also deliver to codebase subscribers
    const payload = event.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload.codebaseId === 'string') {
      keys.add(`codebase:${payload.codebaseId}`);
    }

    return Array.from(keys);
  }

  private appendToBuffer(scopeKey: string, event: SseEvent): void {
    let buffer = this.buffers.get(scopeKey);
    if (!buffer) {
      buffer = [];
      this.buffers.set(scopeKey, buffer);
    }
    buffer.push({ event, enqueuedAt: Date.now() });

    // Evict oldest events if over cap
    if (buffer.length > RING_BUFFER_MAX) {
      buffer.splice(0, buffer.length - RING_BUFFER_MAX);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: SseBroker | null = null;

export function getSseBroker(): SseBroker {
  if (!instance) {
    instance = new SseBrokerImpl();
  }
  return instance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetSseBroker(): void {
  instance = null;
}

/**
 * Create a fresh broker instance (for testing).
 */
export function createSseBroker(): SseBroker {
  return new SseBrokerImpl();
}
