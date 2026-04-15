# Spec 005 — Context Injection & Human Escalation System

**Issue:** #20
**Batch:** 2 (Human-in-the-Loop & Observability)
**Prereqs:** spec 003 (state machine — required for safe pause/resume/cancel transitions), spec 004 (metrics — autonomy ratio feeds intervention analytics), spec 005.1 (audit trail endpoints). Spec 006 (SSE protocol) can land in parallel but this spec must emit the new event types defined there.
**Estimated effort:** L

## Goal

Make human intervention a first-class, structured capability of every workflow run. Operators can pause, resume, cancel, inject context, redirect the agent mid-flight, and receive proactive notifications when runs block. No agent failure is silent — after N retries the run moves to `BLOCKED` with a rich notification card explaining what happened and what actions are available. End-to-end round-trip (pause → inject → resume) must complete in under 10 seconds.

## Scope

### In scope

- Pause / resume / cancel actions at workflow-run and (when applicable) DAG-node granularity, routed through spec 003's state machine.
- Context injection: operator posts free-form text + optional file links into a blocked or paused run; content is appended to the next agent invocation's prompt as a `<user_injection>` block.
- "Problem resolved manually" action: marks the failing node as passed, re-runs its quality gate, resumes the DAG.
- Redirect-approach: operator replaces pending instructions for the current node before resume.
- Retry policy: per-node `maxRetries` (default 3); on exhaustion, transition to `blocked` and enqueue notification.
- Notifications: pluggable sinks (console + webhook in V1; email/slack via existing adapters later). Each notification includes problem summary, attempt count, last N log lines, gate failures, and suggested actions.
- Web UI: Chat-tab input inside the run slide-over supports slash commands `/pause`, `/resume`, `/cancel`, `/inject <text>`, `/redirect <text>`, `/resolved`.

### Out of scope

- BMAD-specific escalation flows (Batch 3).
- Multi-channel notification routing rules per user (single-dev tool).
- AI-generated suggested actions (heuristic text only in V1).
- Epic-level pause/resume across stories (comes with Batch 4 epic orchestration).

## Files to Create

| Path                                                               | Purpose                                                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ------ | -------- | --------- |
| `packages/workflows/src/intervention/intervention-service.ts`      | `pauseRun`, `resumeRun`, `cancelRun`, `injectContext`, `redirect`, `markResolved` — orchestrates state machine + event log |
| `packages/workflows/src/intervention/intervention-service.test.ts` | Unit + integration tests                                                                                                   |
| `packages/workflows/src/intervention/retry-policy.ts`              | `shouldEscalate(attempt, policy)` pure fn                                                                                  |
| `packages/core/src/db/interventions.ts`                            | `recordIntervention`, `listInterventions(runId)`                                                                           |
| `packages/core/src/db/interventions.test.ts`                       | DB tests                                                                                                                   |
| `packages/core/src/services/notifier.ts`                           | `INotifier` interface + `ConsoleNotifier`, `WebhookNotifier`                                                               |
| `packages/core/src/services/notifier.test.ts`                      | Unit tests                                                                                                                 |
| `packages/server/src/routes/api.interventions.ts`                  | Routes: `POST /api/workflows/runs/:id/pause                                                                                | resume | cancel | inject | redirect | resolved` |
| `packages/server/src/routes/schemas/intervention.schemas.ts`       | Zod schemas for each action                                                                                                |
| `packages/web/src/components/workflows/InterventionPanel.tsx`      | Slash-command aware chat input + action buttons                                                                            |
| `packages/web/src/components/workflows/NotificationCard.tsx`       | Renders blocker notifications inline                                                                                       |
| `migrations/022_interventions.sql`                                 | `remote_agent_interventions` table                                                                                         |

## Files to Modify

| Path                                                             | Change                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/workflows/src/executor.ts`                             | On node failure, increment attempt count; if ≥ `maxRetries`, call `intervention.escalate()` |
| `packages/workflows/src/dag-executor.ts`                         | Before invoking each node, check paused state + consume any pending `injection` payload     |
| `packages/workflows/src/schemas/dag-node.ts`                     | Add optional `retry: { maxAttempts: number; backoffMs?: number }`                           |
| `packages/workflows/src/utils/prompt-builder.ts` (or equivalent) | Append pending `<user_injection>` block to prompt                                           |
| `packages/server/src/index.ts`                                   | Mount `/api/interventions`; wire `ConsoleNotifier` by default                               |
| `packages/web/src/routes/WorkflowRunPage.tsx`                    | Embed `InterventionPanel`; subscribe to `workflow.blocked` SSE events                       |

## New Interfaces / Types

```ts
// packages/workflows/src/intervention/intervention-service.ts
export type InterventionKind =
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'inject'
  | 'redirect'
  | 'resolved'
  | 'escalate';

export interface InterventionRecord {
  id: string;
  workflowRunId: string;
  nodeId: string | null;
  kind: InterventionKind;
  actor: string; // operator id or 'system'
  payload: { text?: string; links?: string[] };
  createdAt: string;
}

export interface IInterventionService {
  pauseRun(runId: string, actor: string, reason?: string): Promise<void>;
  resumeRun(runId: string, actor: string): Promise<void>;
  cancelRun(runId: string, actor: string, reason?: string): Promise<void>;
  injectContext(runId: string, actor: string, text: string, links?: string[]): Promise<void>;
  redirect(runId: string, actor: string, newInstruction: string): Promise<void>;
  markResolved(runId: string, nodeId: string, actor: string): Promise<void>;
  escalate(runId: string, nodeId: string, reason: string, attempts: number): Promise<void>;
}

// packages/core/src/services/notifier.ts
export interface NotificationPayload {
  runId: string;
  nodeId?: string;
  title: string;
  summary: string;
  attempts: number;
  lastLogs: string[];
  suggestedActions: Array<'retry' | 'pause' | 'inject' | 'cancel' | 'resolved'>;
}
export interface INotifier {
  notify(p: NotificationPayload): Promise<void>;
}
```

## Database Changes

`migrations/022_interventions.sql`:

```sql
CREATE TABLE remote_agent_interventions (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES remote_agent_workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT,
  kind TEXT NOT NULL,          -- pause|resume|cancel|inject|redirect|resolved|escalate
  actor TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interventions_run ON remote_agent_interventions(workflow_run_id, created_at);
```

A pending injection is the most-recent `kind='inject'` row where `consumed_at IS NULL` — add `consumed_at TIMESTAMPTZ` column; DAG executor marks it consumed after it's appended to a prompt.

## Tests Required

- Unit: `retry-policy.shouldEscalate` — boundary cases (attempt < max, == max, > max).
- Unit: each `InterventionService` method emits the correct state-machine transition + audit event + outbox row.
- Integration: full round-trip — start run, simulate node failure loop, verify `blocked` transition + notification fired + operator-injected context appears in next prompt + resume brings run to completion.
- Route: each `POST /api/workflows/runs/:id/<action>` returns 200 and the correct event is in `workflow_events`.
- Route: pause on already-paused run → 409 from state machine (spec 003) surfaced as friendly error.
- Notifier: `WebhookNotifier` posts JSON to configured URL with correct payload.
- Web: `InterventionPanel` parses `/inject hello world` as `kind=inject, text="hello world"`.

## Acceptance Criteria

- [ ] A workflow that retries a failing node 3 times transitions to `blocked`, fires exactly one notification, and records an `escalate` intervention row.
- [ ] Operator sending `/inject <text>` in the Web UI results in the next agent turn receiving the text inside a `<user_injection>` block (verified by capturing the built prompt in a test).
- [ ] Pause → inject → resume round-trip completes in < 10s on a local dev setup (measured in integration test).
- [ ] `/workflow pause <id>` and `/workflow resume <id>` in the CLI call the same intervention service.
- [ ] "Problem resolved manually" re-runs the node's quality gate; if it passes, the DAG advances.
- [ ] No code path swallows a final failure: after retry exhaustion, the run is always in `blocked` or `failed` and an intervention row exists.
- [ ] `bun run validate` passes.
