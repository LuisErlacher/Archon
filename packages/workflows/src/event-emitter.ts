/**
 * WorkflowEventEmitter - typed event emitter for workflow execution observability.
 *
 * Lives in @archon/workflows so the executor can emit events.
 * The Web adapter in @archon/server subscribes to forward events to SSE streams.
 *
 * Design:
 * - Singleton pattern via getWorkflowEventEmitter()
 * - Fire-and-forget: listener errors never propagate to the executor
 * - Conversation-scoped subscriptions via registerRun() mapping
 * - Canonical SSE emission via emitSse() for the new typed event taxonomy
 * - Automatic legacy→canonical mapping: every legacy emit() also produces
 *   a canonical SSE event so the new broker receives events without modifying
 *   call sites in the executor/dag-executor.
 */
import { EventEmitter } from 'events';
import type { ArtifactType } from './schemas';
import type { SseEventType, SseScope, SseEventMap, SseEvent } from './sse-event-types';
import { createLogger } from '@archon/paths';

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('workflow.emitter');
  return cachedLog;
}

// ---------------------------------------------------------------------------
// Event types (legacy)
// ---------------------------------------------------------------------------

interface WorkflowStartedEvent {
  type: 'workflow_started';
  runId: string;
  workflowName: string;
  conversationId: string;
}

interface WorkflowCompletedEvent {
  type: 'workflow_completed';
  runId: string;
  workflowName: string;
  duration: number;
}

interface WorkflowFailedEvent {
  type: 'workflow_failed';
  runId: string;
  workflowName: string;
  error: string;
}

interface LoopIterationStartedEvent {
  type: 'loop_iteration_started';
  runId: string;
  nodeId?: string; // present when loop runs as a DAG node
  iteration: number;
  maxIterations: number;
}

interface LoopIterationCompletedEvent {
  type: 'loop_iteration_completed';
  runId: string;
  nodeId?: string; // present when loop runs as a DAG node
  iteration: number;
  duration: number;
  completionDetected: boolean;
}

interface LoopIterationFailedEvent {
  type: 'loop_iteration_failed';
  runId: string;
  nodeId?: string; // present when loop runs as a DAG node
  iteration: number;
  error: string;
}

interface WorkflowArtifactEvent {
  type: 'workflow_artifact';
  runId: string;
  artifactType: ArtifactType;
  label: string;
  url?: string;
  path?: string;
}

interface NodeStartedEvent {
  type: 'node_started';
  runId: string;
  nodeId: string;
  nodeName: string; // command name or node.id for inline prompts
}

interface NodeCompletedEvent {
  type: 'node_completed';
  runId: string;
  nodeId: string;
  nodeName: string;
  duration: number;
  costUsd?: number;
  stopReason?: string;
  numTurns?: number;
}

interface NodeFailedEvent {
  type: 'node_failed';
  runId: string;
  nodeId: string;
  nodeName: string;
  error: string;
}

interface NodeSkippedEvent {
  type: 'node_skipped';
  runId: string;
  nodeId: string;
  nodeName: string;
  reason: 'when_condition' | 'when_condition_parse_error' | 'trigger_rule' | 'prior_success';
}

interface ToolStartedEvent {
  type: 'tool_started';
  runId: string;
  toolName: string;
  stepName: string;
}

interface ToolCompletedEvent {
  type: 'tool_completed';
  runId: string;
  toolName: string;
  stepName: string;
  durationMs: number;
}

interface ApprovalPendingEvent {
  type: 'approval_pending';
  runId: string;
  nodeId: string;
  message: string;
}

interface WorkflowCancelledEvent {
  type: 'workflow_cancelled';
  runId: string;
  nodeId: string;
  reason: string;
}

export type WorkflowEmitterEvent =
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | LoopIterationStartedEvent
  | LoopIterationCompletedEvent
  | LoopIterationFailedEvent
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | NodeSkippedEvent
  | WorkflowArtifactEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ApprovalPendingEvent
  | WorkflowCancelledEvent;

// ---------------------------------------------------------------------------
// Re-export canonical SSE types for consumers
// ---------------------------------------------------------------------------

export type { SseEventType, SseScope, SseEventMap, SseEvent } from './sse-event-types';

// ---------------------------------------------------------------------------
// Legacy → Canonical event mapping
// ---------------------------------------------------------------------------

/**
 * Map a legacy WorkflowEmitterEvent to a canonical SSE event.
 * Returns null for events that have no canonical mapping (e.g., tool_started, tool_completed).
 */
function mapLegacyToCanonical(
  event: WorkflowEmitterEvent,
  codebaseId: string | undefined
): { type: SseEventType; scope: SseScope; payload: unknown } | null {
  const scope: SseScope = {
    kind: 'workflowRun',
    runId: event.runId,
  };

  switch (event.type) {
    case 'workflow_started':
      return {
        type: 'workflow.run.started',
        scope,
        payload: {
          runId: event.runId,
          workflowName: event.workflowName,
          conversationId: event.conversationId,
          codebaseId,
        },
      };

    case 'workflow_completed':
      return {
        type: 'workflow.run.completed',
        scope,
        payload: {
          runId: event.runId,
          workflowName: event.workflowName,
          duration: event.duration,
          codebaseId,
        },
      };

    case 'workflow_failed':
      return {
        type: 'workflow.run.failed',
        scope,
        payload: {
          runId: event.runId,
          workflowName: event.workflowName,
          error: event.error,
          codebaseId,
        },
      };

    case 'workflow_cancelled':
      return {
        type: 'workflow.run.cancelled',
        scope,
        payload: {
          runId: event.runId,
          reason: event.reason,
          nodeId: event.nodeId,
          codebaseId,
        },
      };

    case 'node_started':
      return {
        type: 'node.started',
        scope,
        payload: {
          runId: event.runId,
          nodeId: event.nodeId,
          nodeName: event.nodeName,
          codebaseId,
        },
      };

    case 'node_completed':
      return {
        type: 'node.completed',
        scope,
        payload: {
          runId: event.runId,
          nodeId: event.nodeId,
          nodeName: event.nodeName,
          duration: event.duration,
          costUsd: event.costUsd,
          stopReason: event.stopReason,
          numTurns: event.numTurns,
          codebaseId,
        },
      };

    case 'node_failed':
      return {
        type: 'node.failed',
        scope,
        payload: {
          runId: event.runId,
          nodeId: event.nodeId,
          nodeName: event.nodeName,
          error: event.error,
          codebaseId,
        },
      };

    case 'node_skipped':
      // Node skipped maps to node.completed with a skip indicator
      // For now, emit as node.failed with the skip reason so the UI can show it
      return null; // No canonical mapping for skipped — handled by the UI

    case 'approval_pending':
      return {
        type: 'workflow.run.paused',
        scope,
        payload: {
          runId: event.runId,
          nodeId: event.nodeId,
          message: event.message,
          codebaseId,
        },
      };

    case 'loop_iteration_started':
      // Loop iterations are internal; map to node.started if nodeId present
      if (event.nodeId) {
        return {
          type: 'node.started',
          scope,
          payload: {
            runId: event.runId,
            nodeId: event.nodeId,
            nodeName: `iteration-${String(event.iteration)}`,
            codebaseId,
          },
        };
      }
      return null;

    case 'loop_iteration_completed':
      if (event.nodeId) {
        return {
          type: 'node.completed',
          scope,
          payload: {
            runId: event.runId,
            nodeId: event.nodeId,
            nodeName: `iteration-${String(event.iteration)}`,
            duration: event.duration,
            codebaseId,
          },
        };
      }
      return null;

    case 'loop_iteration_failed':
      if (event.nodeId) {
        return {
          type: 'node.failed',
          scope,
          payload: {
            runId: event.runId,
            nodeId: event.nodeId,
            nodeName: `iteration-${String(event.iteration)}`,
            error: event.error,
            codebaseId,
          },
        };
      }
      return null;

    case 'workflow_artifact':
      // Artifacts are metadata; no direct canonical event type
      return null;

    case 'tool_started':
    case 'tool_completed':
      // Tool activity is too granular for the canonical event taxonomy
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Emitter class
// ---------------------------------------------------------------------------

type Listener = (event: WorkflowEmitterEvent) => void;
type SseCallback = (event: SseEvent) => void;

const WORKFLOW_EVENT = 'workflow_event';
const SSE_EVENT = 'sse_event';

class WorkflowEventEmitter {
  private emitter = new EventEmitter();
  private conversationMap = new Map<string, string>(); // runId -> conversationId
  private codebaseMap = new Map<string, string>(); // runId -> codebaseId
  private sseCallback: SseCallback | null = null;

  constructor() {
    // Allow many subscribers (adapters, DB persistence, tests, etc.)
    this.emitter.setMaxListeners(50);
  }

  /**
   * Register a run-to-conversation mapping so subscribers can filter by conversation.
   */
  registerRun(runId: string, conversationId: string): void {
    this.conversationMap.set(runId, conversationId);
  }

  /**
   * Register a run-to-codebase mapping for canonical SSE scope resolution.
   */
  registerCodebase(runId: string, codebaseId: string): void {
    this.codebaseMap.set(runId, codebaseId);
  }

  /**
   * Remove the run-to-conversation mapping (called at workflow end).
   */
  unregisterRun(runId: string): void {
    this.conversationMap.delete(runId);
    this.codebaseMap.delete(runId);
  }

  /**
   * Get the conversation ID for a given run.
   */
  getConversationId(runId: string): string | undefined {
    return this.conversationMap.get(runId);
  }

  /**
   * Get the codebase ID for a given run.
   */
  getCodebaseId(runId: string): string | undefined {
    return this.codebaseMap.get(runId);
  }

  /**
   * Emit a legacy workflow event. Fire-and-forget: listener errors are caught and logged.
   * Existing callers continue to work during incremental migration.
   * Also automatically maps and emits a canonical SSE event.
   */
  emit(event: WorkflowEmitterEvent): void {
    try {
      this.emitter.emit(WORKFLOW_EVENT, event);
    } catch (error) {
      getLog().error({ err: error as Error, eventType: event.type }, 'event_emit_failed');
    }

    // Auto-map legacy event to canonical SSE event
    const codebaseId = this.codebaseMap.get(event.runId);
    const mapped = mapLegacyToCanonical(event, codebaseId);
    if (mapped) {
      this.emitSse(mapped.type, mapped.scope, mapped.payload as SseEventMap[typeof mapped.type]);
    }
  }

  /**
   * Emit a canonical SSE event using the new typed taxonomy.
   *
   * Creates a full SseEvent envelope and:
   * 1. Emits to the internal EventEmitter for type-specific listeners
   * 2. Calls the registered SSE callback (wired to SseBroker.publish by the server)
   *
   * TypeScript rejects unknown type literals at compile time.
   */
  emitSse<E extends SseEventType>(type: E, scope: SseScope, payload: SseEventMap[E]): void {
    const event: SseEvent = {
      id: '', // Will be filled by the server's createSseEvent factory
      type,
      ts: new Date().toISOString(),
      scope,
      payload,
    };

    try {
      this.emitter.emit(SSE_EVENT, event);
    } catch (error) {
      getLog().error({ err: error as Error, eventType: type }, 'sse_event_emit_failed');
    }

    // Forward to the registered callback (wired to SseBroker.publish by the server)
    if (this.sseCallback) {
      try {
        this.sseCallback(event);
      } catch (error) {
        getLog().error({ err: error as Error, eventType: type }, 'sse_callback_error');
      }
    }
  }

  /**
   * Register a callback for canonical SSE events. The server wires this to
   * SseBroker.publish() so events flow through the broker to SSE subscribers.
   */
  setSseCallback(cb: SseCallback): void {
    this.sseCallback = cb;
  }

  /**
   * Subscribe to all legacy workflow events. Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    // Wrap listener to catch errors - listener failures must not propagate
    const safeListener = (event: WorkflowEmitterEvent): void => {
      try {
        listener(event);
      } catch (error) {
        getLog().error({ err: error as Error, eventType: event.type }, 'event_listener_error');
      }
    };

    this.emitter.on(WORKFLOW_EVENT, safeListener);
    return (): void => {
      this.emitter.removeListener(WORKFLOW_EVENT, safeListener);
    };
  }

  /**
   * Subscribe to canonical SSE events by type. Returns an unsubscribe function.
   * The handler receives the full SseEvent envelope.
   */
  onSse<E extends SseEventType>(
    type: E,
    handler: (event: SseEvent & { type: E }) => void
  ): () => void {
    const safeHandler = (event: SseEvent): void => {
      if (event.type === type) {
        try {
          handler(event as SseEvent & { type: E });
        } catch (error) {
          getLog().error({ err: error as Error, eventType: type }, 'sse_listener_error');
        }
      }
    };

    this.emitter.on(SSE_EVENT, safeHandler);
    return (): void => {
      this.emitter.removeListener(SSE_EVENT, safeHandler);
    };
  }

  /**
   * Subscribe to all canonical SSE events. Returns an unsubscribe function.
   */
  subscribeSse(handler: SseCallback): () => void {
    const safeHandler = (event: SseEvent): void => {
      try {
        handler(event);
      } catch (error) {
        getLog().error({ err: error as Error, eventType: event.type }, 'sse_listener_error');
      }
    };

    this.emitter.on(SSE_EVENT, safeHandler);
    return (): void => {
      this.emitter.removeListener(SSE_EVENT, safeHandler);
    };
  }

  /**
   * Subscribe to events for a specific conversation only. Returns unsubscribe function.
   */
  subscribeForConversation(conversationId: string, listener: Listener): () => void {
    return this.subscribe((event: WorkflowEmitterEvent) => {
      const eventConversationId = this.conversationMap.get(event.runId);
      if (eventConversationId === conversationId) {
        listener(event);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: WorkflowEventEmitter | null = null;

export function getWorkflowEventEmitter(): WorkflowEventEmitter {
  if (!instance) {
    instance = new WorkflowEventEmitter();
  }
  return instance;
}

/**
 * Reset singleton for testing.
 */
export function resetWorkflowEventEmitter(): void {
  instance = null;
}
