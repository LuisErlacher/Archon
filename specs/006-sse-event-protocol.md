# Spec 006 — SSE Event Protocol Enhancement

**Issue:** #28
**Batch:** 2 (Human-in-the-Loop & Observability)
**Prereqs:** spec 003 (state machine — every transition becomes an event). Should land alongside spec 005 so the new intervention events are part of the same taxonomy. Does not depend on spec 004.
**Estimated effort:** M

## Goal

Replace the current ad-hoc SSE payload shapes with a typed, dot-notation event taxonomy (15+ event types), Zod-validated envelopes, scoped endpoints (`/__dashboard__`, `/workflow-runs/:id`, `/codebases/:id`), idempotent dedup via CUID2 event IDs, and a reconnection protocol that delivers a state snapshot on reconnect so clients never miss events. Heartbeat every 30s.

## Scope

### In scope

- Canonical `SseEvent` envelope: `{ id, type, ts, scope, payload }`.
- 15+ typed events — see taxonomy below. Each has its own Zod schema in `packages/server/src/routes/schemas/sse-events.ts`.
- Scoped endpoints:
  - `GET /api/stream/__dashboard__` — all events, filtered by auth scope.
  - `GET /api/stream/workflow-runs/:runId` — only events for that run.
  - `GET /api/stream/codebases/:codebaseId` — run + intervention events for that codebase.
- Heartbeat: server sends `{ type: 'system.heartbeat', ... }` every 30s.
- Reconnect: client passes `Last-Event-ID`; server replays events newer than that ID from `workflow_events` + `outbox` (bounded to last 24h or 500 events).
- Client helper `packages/web/src/hooks/useSse.ts` updated to parse via shared Zod schemas and handle reconnect.
- `@archon/workflows/event-emitter` refactored to emit canonical typed events; callers get typed `emit<E extends SseEventType>(type, payload)`.

### Out of scope

- WebSockets / bi-directional streaming (SSE is sufficient).
- Cross-tab broadcasting (handled by browser natively on same origin).
- Event compaction or retention pruning (follow-up).
- GraphQL subscriptions.

## Files to Create

| Path                                                    | Purpose                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/server/src/routes/schemas/sse-events.ts`      | Discriminated union of all event schemas + `sseEnvelopeSchema`                               |
| `packages/server/src/routes/schemas/sse-events.test.ts` | Schema round-trip tests                                                                      |
| `packages/server/src/routes/api.sse.ts`                 | Scoped SSE endpoints; handles `Last-Event-ID` replay                                         |
| `packages/server/src/routes/api.sse.test.ts`            | Integration tests using a real HTTP client                                                   |
| `packages/server/src/adapters/web/sse-broker.ts`        | In-process broker: topic → subscribers map; `publish(event)` + `subscribe(scope, handler)`   |
| `packages/server/src/adapters/web/sse-broker.test.ts`   | Unit tests                                                                                   |
| `packages/web/src/lib/sse-client.ts`                    | Thin wrapper around `EventSource` with Zod parsing + auto-reconnect + `lastEventId` tracking |
| `packages/web/src/lib/sse-client.test.ts`               | Vitest tests with mocked `EventSource`                                                       |

## Files to Modify

| Path                                                            | Change                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/workflows/src/event-emitter.ts`                       | Narrow `emit()` signature to accept `SseEventType` literal + matching payload; drop untyped `emit(name, payload)` |
| `packages/workflows/src/executor.ts` + `dag-executor.ts`        | Replace ad-hoc event names with canonical types                                                                   |
| `packages/core/src/services/outbox-consumer.ts` (from spec 003) | Fan events into `SseBroker.publish()`                                                                             |
| `packages/web/src/hooks/useSse.ts`                              | Migrate to new `sse-client.ts`; callers get typed events via discriminator                                        |
| `packages/web/src/routes/WorkflowRunPage.tsx`                   | Subscribe to `/api/stream/workflow-runs/:id`                                                                      |
| `packages/server/src/index.ts`                                  | Mount new SSE routes; start heartbeat interval                                                                    |

## Event Taxonomy (minimum 15)

`workflow.run.queued`, `workflow.run.started`, `workflow.run.transition`, `workflow.run.completed`, `workflow.run.failed`, `workflow.run.cancelled`, `workflow.run.paused`, `workflow.run.resumed`, `workflow.run.blocked`,
`node.started`, `node.completed`, `node.failed`, `node.retrying`,
`gate.passed`, `gate.failed`,
`intervention.injected`, `intervention.redirected`, `intervention.resolved`, `intervention.escalated`,
`usage.recorded`,
`system.heartbeat`, `system.error`, `system.snapshot`.

## New Interfaces / Types

```ts
// packages/server/src/routes/schemas/sse-events.ts
export const sseScopeSchema = z.union([
  z.object({ kind: z.literal('dashboard') }),
  z.object({ kind: z.literal('workflowRun'), runId: z.string() }),
  z.object({ kind: z.literal('codebase'), codebaseId: z.string() }),
]);

export const sseEnvelopeSchema = z.object({
  id: z.string(), // CUID2
  type: z.string(), // dot.notation
  ts: z.string(), // ISO8601
  scope: sseScopeSchema,
  payload: z.unknown(), // refined per type via discriminated union
});

// Each specific event: workflowRunStartedEventSchema, gatePassedEventSchema, ...
// Union: sseEventSchema = z.discriminatedUnion('type', [ ...allEventSchemas ]);

export type SseEvent = z.infer<typeof sseEventSchema>;
export type SseEventType = SseEvent['type'];
```

```ts
// packages/server/src/adapters/web/sse-broker.ts
export interface SseBroker {
  publish(event: SseEvent): void;
  subscribe(scope: SseScope, handler: (e: SseEvent) => void): () => void; // returns unsubscribe
  replaySince(scope: SseScope, lastEventId: string | null): Promise<SseEvent[]>;
}
```

## Database Changes

None new — replay reads from `remote_agent_workflow_events` and `remote_agent_outbox` (spec 003). Add index `(workflow_run_id, created_at, id)` to `workflow_events` if not already present to support efficient `Last-Event-ID` lookups.

Add migration `023_sse_replay_indexes.sql` with only indexes (no schema change).

## Tests Required

- Schema: every event type round-trips through its Zod schema.
- Schema: discriminated union rejects unknown `type` values.
- Broker: `subscribe` receives only events matching its scope filter; `unsubscribe` stops delivery.
- Route: `GET /api/stream/workflow-runs/:id` emits `system.snapshot` first, then heartbeats at 30s intervals (test with fake timers).
- Route: reconnect with `Last-Event-ID` replays missing events in order, then resumes live stream.
- Route: scope isolation — events for run A are not delivered to a subscriber of run B.
- Web: `sse-client` reconnects with exponential backoff and preserves `lastEventId` across reconnects.
- Executor: emitting `node.completed` results in typed event in the correct scope(s) (`dashboard` + `workflowRun` + `codebase`).

## Acceptance Criteria

- [ ] Every SSE payload sent to clients validates against `sseEnvelopeSchema`; lint rule or runtime assert catches deviations in dev mode.
- [ ] At least 15 event types are defined, documented, and emitted somewhere in the codebase (grep check in test).
- [ ] Clients receive a `system.snapshot` event on initial subscribe and after each reconnect; no duplicate events within a reconnect cycle (dedup by `id`).
- [ ] Heartbeat keeps idle connections open through NGINX / reverse proxies (60s timeout default).
- [ ] Three scoped endpoints exist and respect their filters.
- [ ] Web UI subscribes to per-run stream on the run page and to the dashboard stream on the runs list; no more polling.
- [ ] `bun run validate` passes.
