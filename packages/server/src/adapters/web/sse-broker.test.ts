/**
 * Tests for SseBroker.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { createSseBroker, resetSseBroker, getSseBroker } from './sse-broker';
import { createSseEvent } from '../../routes/schemas/sse-events';
import type { SseEvent, SseScope } from '../../routes/schemas/sse-events';

describe('SseBroker', () => {
  let broker: ReturnType<typeof createSseBroker>;

  beforeEach(() => {
    broker = createSseBroker();
  });

  // ---------------------------------------------------------------------------
  // Subscribe and receive
  // ---------------------------------------------------------------------------

  it('subscribe receives events matching its scope filter', () => {
    const received: SseEvent[] = [];
    const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

    broker.subscribe(scope, event => received.push(event));

    const event = createSseEvent('workflow.run.started', scope, {
      runId: 'run-A',
      workflowName: 'test',
    });
    broker.publish(event);

    expect(received.length).toBe(1);
    expect(received[0].type).toBe('workflow.run.started');
  });

  // ---------------------------------------------------------------------------
  // Dashboard receives all events
  // ---------------------------------------------------------------------------

  it('subscribe to dashboard receives events published to any workflowRun scope', () => {
    const received: SseEvent[] = [];
    const dashboardScope: SseScope = { kind: 'dashboard' };

    broker.subscribe(dashboardScope, event => received.push(event));

    const runScope: SseScope = { kind: 'workflowRun', runId: 'run-A' };
    const event = createSseEvent('workflow.run.started', runScope, {
      runId: 'run-A',
      workflowName: 'test',
    });
    broker.publish(event);

    expect(received.length).toBe(1);
    expect(received[0].type).toBe('workflow.run.started');
  });

  // ---------------------------------------------------------------------------
  // Unsubscribe stops delivery
  // ---------------------------------------------------------------------------

  it('unsubscribe stops delivery', () => {
    const received: SseEvent[] = [];
    const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

    const unsub = broker.subscribe(scope, event => received.push(event));
    unsub();

    const event = createSseEvent('workflow.run.started', scope, {
      runId: 'run-A',
      workflowName: 'test',
    });
    broker.publish(event);

    expect(received.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // replaySince
  // ---------------------------------------------------------------------------

  it('replaySince with null returns all buffered events', () => {
    const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

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

    const replayed = broker.replaySince(scope, null);
    expect(replayed.length).toBe(2);
    // Should be in chronological order
    expect(replayed[0].id).toBe(event1.id);
    expect(replayed[1].id).toBe(event2.id);
  });

  it('replaySince with valid lastEventId returns only newer events', () => {
    const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

    const event1 = createSseEvent('workflow.run.started', scope, {
      runId: 'run-A',
      workflowName: 'test',
    });
    const event2 = createSseEvent('node.started', scope, {
      runId: 'run-A',
      nodeId: 'node-1',
      nodeName: 'step-1',
    });
    const event3 = createSseEvent('node.completed', scope, {
      runId: 'run-A',
      nodeId: 'node-1',
      nodeName: 'step-1',
      duration: 100,
    });

    broker.publish(event1);
    broker.publish(event2);
    broker.publish(event3);

    const replayed = broker.replaySince(scope, event1.id);
    expect(replayed.length).toBe(2);
    expect(replayed[0].id).toBe(event2.id);
    expect(replayed[1].id).toBe(event3.id);
  });

  it('replaySince returns events in chronological order', () => {
    const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

    // Publish events in order
    const events: SseEvent[] = [];
    for (let i = 0; i < 5; i++) {
      const event = createSseEvent('node.started', scope, {
        runId: 'run-A',
        nodeId: `node-${i}`,
        nodeName: `step-${i}`,
      });
      events.push(event);
      broker.publish(event);
    }

    const replayed = broker.replaySince(scope, events[1].id);
    expect(replayed.length).toBe(3);
    // Chronological order
    expect(replayed[0].id).toBe(events[2].id);
    expect(replayed[1].id).toBe(events[3].id);
    expect(replayed[2].id).toBe(events[4].id);
  });

  it('replaySince returns empty array when lastEventId is not in buffer', () => {
    const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

    const event = createSseEvent('workflow.run.started', scope, {
      runId: 'run-A',
      workflowName: 'test',
    });
    broker.publish(event);

    const replayed = broker.replaySince(scope, 'nonexistent-id');
    expect(replayed).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Ring buffer cap
  // ---------------------------------------------------------------------------

  it('ring buffer caps at 500 events per scope; oldest events are evicted', () => {
    const scope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

    // Publish 510 events
    const events: SseEvent[] = [];
    for (let i = 0; i < 510; i++) {
      const event = createSseEvent('node.started', scope, {
        runId: 'run-A',
        nodeId: `node-${i}`,
        nodeName: `step-${i}`,
      });
      events.push(event);
      broker.publish(event);
    }

    // First 10 events should be evicted
    const replayed = broker.replaySince(scope, null);
    expect(replayed.length).toBe(500);
    // The oldest surviving event should be the 11th one (index 10)
    expect(replayed[0].id).toBe(events[10].id);
    // The newest should be the last one
    expect(replayed[499].id).toBe(events[509].id);
  });

  // ---------------------------------------------------------------------------
  // Scope isolation
  // ---------------------------------------------------------------------------

  it('events for run A are not delivered to subscriber of run B', () => {
    const receivedA: SseEvent[] = [];
    const receivedB: SseEvent[] = [];
    const scopeA: SseScope = { kind: 'workflowRun', runId: 'run-A' };
    const scopeB: SseScope = { kind: 'workflowRun', runId: 'run-B' };

    broker.subscribe(scopeA, event => receivedA.push(event));
    broker.subscribe(scopeB, event => receivedB.push(event));

    const eventA = createSseEvent('workflow.run.started', scopeA, {
      runId: 'run-A',
      workflowName: 'test-A',
    });
    broker.publish(eventA);

    expect(receivedA.length).toBe(1);
    // run-B subscriber should NOT receive run-A events (only dashboard subscriber would)
    expect(receivedB.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Codebase scope from payload
  // ---------------------------------------------------------------------------

  it('publishes to codebase scope when payload contains codebaseId', () => {
    const received: SseEvent[] = [];
    const codebaseScope: SseScope = { kind: 'codebase', codebaseId: 'cb-1' };
    const runScope: SseScope = { kind: 'workflowRun', runId: 'run-A' };

    broker.subscribe(codebaseScope, event => received.push(event));

    const event = createSseEvent('workflow.run.started', runScope, {
      runId: 'run-A',
      workflowName: 'test',
      codebaseId: 'cb-1',
    });
    broker.publish(event);

    expect(received.length).toBe(1);
    expect(received[0].id).toBe(event.id);
  });

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  it('getSseBroker returns a singleton', () => {
    resetSseBroker();
    const a = getSseBroker();
    const b = getSseBroker();
    expect(a).toBe(b);
    resetSseBroker();
  });
});
