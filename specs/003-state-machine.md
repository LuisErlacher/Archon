# Spec 003 — Transactional State Machine with Optimistic Locking

**Issue:** #18
**Batch:** 1 (Core Infrastructure — Foundation)
**Prereqs:** spec 002 (provider session persistence) merged into `dev`
**Estimated effort:** L

## Goal

Turn Archon's workflow run state transitions into a safe, concurrency-correct state machine. Every transition (queued → running → review → done, plus paused / blocked / cancelled) must be atomic, validated against quality gates, and protected against lost updates via an optimistic `version` column. Emits side-effects (SSE, notifications, external sync) via an outbox consumer so that the DB commit is the single source of truth and replays are idempotent.

## Scope

### In scope

- Formal state model for `workflow_runs` and DAG node states (`remote_agent_workflow_runs`, `remote_agent_workflow_events`).
- `version` column + `UPDATE ... WHERE version = :expected` check; `WorkflowStateConflictError` (HTTP 409) on mismatch.
- Transition validation helper: rejects illegal edges (e.g. `done → running`) and enforces quality gate pass before advancing.
- Append-only event log entries per transition with `idempotency_key` (CUID2) for dedup.
- Outbox table + background consumer that fans events out to SSE, notifications and external sinks. Consumer is idempotent (keyed by `idempotency_key`).
- CLI + HTTP surface: `/workflow pause`, `/workflow resume`, `/workflow cancel` all route through the state machine.

### Out of scope

- New event _types_ beyond what `workflow_events` already supports (see spec 006 for SSE taxonomy).
- BMAD-specific story/epic states (spec in Batch 3).
- UI work beyond wiring `409 conflict` toasts in the Web UI.

## Files to Create

| Path                                                 | Purpose                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/workflows/src/state/state-machine.ts`      | Pure function `transition(current, next, gates): Result` + legal-edge table                                            |
| `packages/workflows/src/state/state-machine.test.ts` | Unit tests for all legal/illegal edges                                                                                 |
| `packages/core/src/db/outbox.ts`                     | `enqueueOutbox`, `claimOutboxBatch`, `markOutboxProcessed` — follows `packages/core/src/db/workflow-events.ts` pattern |
| `packages/core/src/db/outbox.test.ts`                | Integration tests against SQLite + Postgres                                                                            |
| `packages/core/src/services/outbox-consumer.ts`      | Background consumer, started from server bootstrap; emits via `IWorkflowPlatform`                                      |
| `migrations/020_workflow_state_machine.sql`          | Adds `version`, `state_machine_state`, `outbox` table                                                                  |

## Files to Modify

| Path                                                     | Change                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/workflows/src/store.ts`                        | Add `transitionRun(runId, from, to, expectedVersion, gateResult): Promise<WorkflowRun>` to `IWorkflowStore`; throws `WorkflowStateConflictError` |
| `packages/core/src/workflows/store-adapter.ts`           | Implement `transitionRun` using the SQL UPDATE+WHERE version pattern                                                                             |
| `packages/workflows/src/executor.ts`                     | Replace direct status writes with `transitionRun(...)` calls                                                                                     |
| `packages/workflows/src/dag-executor.ts`                 | Same — all node-level status updates go through the state machine                                                                                |
| `packages/server/src/routes/api.ts`                      | Map `WorkflowStateConflictError` → HTTP 409 with JSON body `{ code, currentVersion }`                                                            |
| `packages/server/src/routes/schemas/workflow.schemas.ts` | Add `workflowStateConflictErrorSchema`                                                                                                           |
| `packages/workflows/src/schemas/workflow-run.ts`         | Add `version: z.number().int()` field                                                                                                            |

## New Interfaces / Types

```ts
// packages/workflows/src/state/state-machine.ts
export type RunState =
  | 'queued' | 'running' | 'awaiting_review'
  | 'paused' | 'blocked' | 'cancelled' | 'failed' | 'done';

export interface TransitionInput {
  from: RunState;
  to: RunState;
  gates?: { passed: boolean; failures?: string[] };
}
export interface TransitionOk { ok: true }
export interface TransitionErr { ok: false; reason: 'illegal_edge' | 'gates_failed' }
export function canTransition(input: TransitionInput): TransitionOk | TransitionErr;

// packages/workflows/src/store.ts additions
export class WorkflowStateConflictError extends Error {
  readonly code = 'workflow_state_conflict';
  constructor(readonly runId: string, readonly expectedVersion: number, readonly currentVersion: number);
}
export interface IWorkflowStore {
  // ...existing
  transitionRun(args: {
    runId: string; from: RunState; to: RunState;
    expectedVersion: number; gateResult?: { passed: boolean; failures?: string[] };
    idempotencyKey: string;
  }): Promise<WorkflowRun>;
}
```

## Database Changes

`migrations/020_workflow_state_machine.sql`:

- `ALTER TABLE remote_agent_workflow_runs ADD COLUMN version INTEGER NOT NULL DEFAULT 0;`
- `ALTER TABLE remote_agent_workflow_runs ADD COLUMN state_machine_state TEXT` (nullable during rollout, backfill from existing `status`).
- New table `remote_agent_outbox(id PK, idempotency_key UNIQUE, event_type, payload JSONB, created_at, processed_at NULL, attempts INT DEFAULT 0)`.
- Index on `(processed_at IS NULL, created_at)` for consumer polling.
- SQLite + Postgres DDL in matching `adapters/` files.

Transition SQL pattern:

```sql
UPDATE remote_agent_workflow_runs
SET status = $new, state_machine_state = $new, version = version + 1, updated_at = now()
WHERE id = $id AND version = $expectedVersion
RETURNING *;
```

Zero rows affected → throw `WorkflowStateConflictError`.

## Tests Required

- Unit: `canTransition` covers every legal edge and at least 5 illegal edges.
- Unit: gate failure blocks `running → awaiting_review → done`.
- Integration (SQLite + Postgres): two concurrent `transitionRun` calls — one wins with version+1, the other throws `WorkflowStateConflictError`.
- Integration: outbox consumer processes an entry exactly once even when called twice with the same `idempotency_key`.
- HTTP: `PATCH /api/workflows/runs/:id/state` with stale version returns 409 with `currentVersion` in body.
- Executor: existing `executor.test.ts` + `dag-executor.test.ts` still pass after migration.

## Acceptance Criteria

- [ ] All workflow run status writes go through `transitionRun`; no direct `UPDATE ... SET status` remains in the codebase (enforced by grep check in `bun run validate`).
- [ ] Two parallel runs racing on the same workflow run never both succeed; the loser sees 409.
- [ ] Every transition produces exactly one row in `workflow_events` and one row in `outbox`, sharing the same `idempotency_key`.
- [ ] Outbox consumer survives restart: pending rows are retried, processed rows are not re-emitted.
- [ ] CLI `archon workflow pause <id>` / `resume <id>` / `cancel <id>` use the state machine and report 409 as a friendly "run changed, refresh and retry" message.
- [ ] Migration `020` is reversible (down script archived in comment) and runs clean on both SQLite and Postgres.
- [ ] `bun run validate` passes.
