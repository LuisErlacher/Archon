# Spec 023 — Kanban Board + Pipeline View

**Issue:** #8
**Batch:** 9
**Prereqs:** none (UI over existing workflow-run data)
**Estimated effort:** M
**Implementation Risk:** LOW — pure frontend plus a single list endpoint.

## Goal

Replace the current table-based dashboard with a Kanban board and a per-story pipeline visualization that surfaces BMAD phase progress in real time.

## Scope

**In:**

- Kanban columns: Backlog, In Progress, Review, QA, Done, Blocked.
- Drag-and-drop between columns (manual state override emits a workflow event).
- Blocked items pinned to top; badge count in top bar "N need attention".
- Filters: project, epic, status, agent.
- Per-story Pipeline view: horizontal timeline of phases with 5 states (completed, in-progress, blocked, pending, skipped).
- Click a phase to expand gate results, agent output summary, test results.
- SSE integration for real-time card updates.

**Out:**

- Historical analytics / burn-down charts.
- Cross-project rollup board.
- Custom column configuration (uses default 6 columns).

## Files to Create / Modify

- `packages/server/src/routes/stories.ts` — `GET /api/stories` list endpoint aggregating workflow runs.
- `packages/server/src/routes/schemas/story.schemas.ts`.
- `packages/web/src/routes/KanbanPage.tsx`.
- `packages/web/src/components/kanban/KanbanBoard.tsx`.
- `packages/web/src/components/kanban/StoryCard.tsx`.
- `packages/web/src/components/pipeline/PipelineVisualizer.tsx`.
- `packages/web/src/stores/kanban-store.ts` — Zustand.
- `packages/web/src/hooks/useStoryStream.ts` — SSE subscription.

## New Interfaces / Types

```ts
export const storyCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  epic: z.string().nullable(),
  project: z.string(),
  column: z.enum(['backlog', 'in_progress', 'review', 'qa', 'done', 'blocked']),
  agent: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  gates: z.array(
    z.object({ id: z.string(), status: z.enum(['pass', 'fail', 'pending', 'skipped']) })
  ),
  lastUpdatedAt: z.string().datetime(),
  needsAttention: z.boolean(),
});

export const pipelinePhaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['completed', 'in_progress', 'blocked', 'pending', 'skipped']),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  gateResults: z.array(
    z.object({ id: z.string(), passed: z.boolean(), message: z.string().optional() })
  ),
});
```

Endpoints:

- `GET /api/stories?project=&column=` → `storyCardSchema[]`.
- `GET /api/stories/:id/pipeline` → `pipelinePhaseSchema[]`.
- `POST /api/stories/:id/move` — manual column move; writes a workflow event.

## Database Changes

None new. Reads aggregate `workflow_runs` + `workflow_events`. Add index on `workflow_runs(status, updated_at)`.

## Tests Required

- Unit: aggregator maps run+events → `storyCardSchema`.
- Component: `KanbanBoard` renders columns, drag-and-drop fires move API.
- Component: `PipelineVisualizer` handles all 5 phase states.
- Integration: SSE event updates a card in-place without refetch.

## Acceptance Criteria

- Dashboard default view is Kanban; table available via toggle.
- Blocked stories pinned top of their column with red indicator.
- Top bar badge matches `needsAttention=true` count.
- Pipeline click-through opens phase detail within 200ms of click.
- Real-time updates visible within 2s of underlying workflow event.
