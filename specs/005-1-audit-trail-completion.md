# Spec 005.1 — Audit Trail Completion (Follow-ups to PR #41)

**Issue:** #25
**Batch:** 1 (Core Infrastructure — Foundation)
**Prereqs:** PR #41 merged into `dev`. No other spec required, but pairs naturally with spec 003 (state machine events feed the audit trail) and spec 005 (intervention events appear in the trail).
**Estimated effort:** S

## Goal

Finalize the audit trail feature already started in open PR #41 (adds `GET /api/workflows/runs/:runId/events` and `GET /api/workflows/runs/:runId/timeline`) by (a) getting that PR merged after addressing review, and (b) completing the Web UI surface and export/search features that are still missing. The audit trail must give operators a searchable, exportable, append-only chronological view of every agent decision, gate result, human intervention, and skill event per run, and be the substrate that spec 005's escalation notifications reference.

## Scope

### In scope

- **Merge PR #41** after review: verify it still applies cleanly on `dev`, pass `bun run validate`, address any outstanding review comments.
- Web UI "Trail" tab in the workflow run slide-over (`WorkflowRunPage.tsx`) — chronological timeline view with event-type filter + date range + actor filter + full-text search on payload.
- Export endpoint: `GET /api/workflows/runs/:runId/events.json` and `.csv` (reuses existing paginated query; sets `Content-Disposition: attachment`).
- Add `actor` column semantics: events produced by the system carry `actor='system'`; intervention events (spec 005) carry the operator id.
- Ensure audit events are never updated or deleted (append-only guarantee) — add DB-level trigger (Postgres) / check (SQLite adapter) if not already enforced.
- Unit test coverage for any review-fix commits on PR #41.

### Out of scope

- Redesigning the existing events table schema.
- Real-time audit streaming (covered by spec 006's SSE taxonomy).
- Cross-run / cross-codebase audit search (single-run scope for V1).
- Retention / archival policies.

## Files to Create

| Path                                                      | Purpose                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/web/src/components/workflows/TrailTab.tsx`      | Timeline UI — virtualized list + filters + search box                                                                                            |
| `packages/web/src/components/workflows/TrailTab.test.tsx` | Render test with fixture events                                                                                                                  |
| `packages/server/src/routes/api.audit-export.ts`          | CSV + JSON export endpoints (small — could also live in `api.ts`)                                                                                |
| `packages/server/src/routes/api.audit-export.test.ts`     | Route tests (JSON/CSV content-type + disposition)                                                                                                |
| `migrations/024_audit_append_only.sql`                    | Postgres trigger blocking UPDATE/DELETE on `remote_agent_workflow_events`; SQLite adapter enforces via application-level check (no true trigger) |

## Files to Modify

| Path                                                     | Change                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/routes/api.ts`                      | Integrate PR #41 routes if not yet merged; add export route mount                                                                                           |
| `packages/server/src/routes/schemas/workflow.schemas.ts` | Extend timeline entry schema with `actor` and `intervention?` flag; add export query param schema                                                           |
| `packages/core/src/db/workflow-events.ts`                | Add `searchWorkflowEvents({ runId, q, actor, type, from, to, limit, offset })` supporting JSONB / JSON `payload LIKE` full-text search on SQLite + Postgres |
| `packages/web/src/routes/WorkflowRunPage.tsx`            | Add "Trail" tab wiring                                                                                                                                      |
| `packages/web/src/lib/api.ts`                            | Typed client wrappers for new events/timeline/export endpoints                                                                                              |

## New Interfaces / Types

```ts
// additions to workflow-events.ts
export interface SearchWorkflowEventsArgs {
  runId: string;
  q?: string; // matches payload::text or event_type
  actor?: string;
  eventType?: string;
  from?: string; // ISO8601
  to?: string;
  limit: number; // default 100, max 500
  offset: number;
}
export interface WorkflowEventsPage {
  events: WorkflowEvent[];
  total: number;
  nextOffset: number | null;
}
export function searchWorkflowEvents(
  db: IDatabase,
  args: SearchWorkflowEventsArgs
): Promise<WorkflowEventsPage>;
```

```ts
// timeline entry shape (Web UI)
export interface TimelineEntry {
  id: string;
  ts: string;
  eventType: string;
  actor: 'system' | string;
  summary: string;
  durationMs?: number; // for node completion entries
  gate?: { name: string; passed: boolean };
  intervention?: { kind: string; text?: string };
}
```

## Database Changes

`migrations/024_audit_append_only.sql` (Postgres only; SQLite path is app-level):

```sql
CREATE OR REPLACE FUNCTION remote_agent_workflow_events_append_only()
RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'remote_agent_workflow_events is append-only';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_events_append_only
BEFORE UPDATE OR DELETE ON remote_agent_workflow_events
FOR EACH ROW EXECUTE FUNCTION remote_agent_workflow_events_append_only();
```

SQLite adapter: wrap any update/delete in application-level guard throwing `AppendOnlyViolationError`.

## Tests Required

- PR #41 tests continue to pass; add regression test for any review-fix.
- Unit: `searchWorkflowEvents` with each combination of filters returns the expected subset.
- Integration: trying to `UPDATE` or `DELETE` a `workflow_events` row fails on both SQLite and Postgres.
- Route: `/events.json?runId=...` streams valid JSON array; `/events.csv` has header row + one row per event.
- Web: `TrailTab` renders a fixture list, filters by event type + actor + date, and search narrows results.

## Acceptance Criteria

- [ ] PR #41 is merged into `dev`; all its acceptance checks still green.
- [ ] `/workflow-runs/:id` page in the Web UI has a "Trail" tab that lists every event with filter + search.
- [ ] Export as JSON and CSV works from the Trail tab and returns content matching the paginated API.
- [ ] Attempting to UPDATE/DELETE a `workflow_events` row fails with an explicit error on both DBs.
- [ ] `actor` field is populated on every new event; intervention events (from spec 005) appear in the trail with the operator name.
- [ ] `bun run validate` passes.
