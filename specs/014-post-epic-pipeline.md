# Spec 014 — Post-Epic Pipeline (Retrospective → Docs → Skills → Memory Cleanup)

**Issue:** #17
**Batch:** 5
**Prereqs:** 011, 012, 009
**Estimated effort:** M

## Goal

After an epic completes (success or abandonment), run an automated 4-phase pipeline:

1. **Retrospective** — analyze time, blockers, retries, human interventions per story
2. **Documentation** — update `project-context.md` with new APIs, components, patterns observed
3. **Skills** — invoke skill-creator agent (spec 012) to generate/update skills from lessons
4. **Memory cleanup** — persist durable insights into shared memory (spec 011) and prune ephemeral entries

Each phase is individually toggleable per project; results are viewable in the dashboard. Emits `retro.completed` event with counts.

## Scope

**In:**

- Pipeline orchestrator running as a dedicated workflow (`defaults/post-epic.yaml`)
- Retrospective analyzer over `workflow_runs` + `workflow_events` + interventions table (spec 009)
- Doc updater patching `project-context.md` via structured diff (human-approved via approval node)
- Skills generation hook into `skill-creator` agent
- Memory pruner using LRU + category rules
- SSE event `retro.completed` with `{ epicId, skillsCreated, skillsUpdated, lessonsCount, durationMs }`

**Out:**

- ML-based retro summarization (use structured JSON output from Claude/Codex)
- Cross-epic aggregation (one epic at a time in v1)
- Automatic rollback of bad skill evolutions (covered by spec 012 manual disable)

## Files to Create / Modify

### Create

| Path                                                       | Purpose                             |
| ---------------------------------------------------------- | ----------------------------------- |
| `packages/workflows/src/defaults/workflows/post-epic.yaml` | DAG: retro → docs → skills → memory |
| `packages/core/src/services/retro/analyzer.ts`             | Aggregate metrics per story         |
| `packages/core/src/services/retro/doc-patcher.ts`          | Diff proposal for project-context   |
| `packages/core/src/services/retro/memory-pruner.ts`        | LRU + category prune                |
| `packages/server/src/routes/retro.ts`                      | `GET /api/epics/:id/retro`          |
| `packages/web/src/routes/RetroReportPage.tsx`              | Timeline + metrics + diff preview   |

### Modify

| Path                                          | Change                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `packages/workflows/src/executor.ts`          | On epic terminal state, enqueue `post-epic` run |
| `packages/core/src/services/shared-memory.ts` | Expose `pruneEphemeral(projectId, epicId)`      |
| `packages/workflows/src/event-emitter.ts`     | Emit `retro.completed` event type               |

## New Interfaces / Types

```ts
export interface RetroMetrics {
  epicId: string;
  storiesCompleted: number;
  storiesFailed: number;
  totalDurationMs: number;
  totalRetries: number;
  humanInterventions: number;
  blockers: Array<{ storyId: string; reason: string; resolvedAt: string | null }>;
  costUsd: number;
}

export interface RetroResult {
  epicId: string;
  metrics: RetroMetrics;
  skillsCreated: number;
  skillsUpdated: number;
  lessonsCount: number;
  docPatchApplied: boolean;
  memoryEntriesPruned: number;
  durationMs: number;
}

export interface PostEpicConfig {
  enableRetro: boolean;
  enableDocUpdate: boolean;
  enableSkillGen: boolean;
  enableMemoryCleanup: boolean;
}
```

## Database Changes

- New table `remote_agent_retros` (id, epic_id, project_id, metrics JSONB, result JSONB, created_at)
- `codebases.post_epic_config JSONB` column for per-project toggles

Migration files: `migrations/009_retros.sql` + sqlite counterpart.

## Tests Required

- `retro/analyzer.test.ts`: fixture `workflow_runs` → expected `RetroMetrics`
- `retro/doc-patcher.test.ts`: generated patch is valid unified diff
- `retro/memory-pruner.test.ts`: prunes only `epicId`-scoped ephemeral entries
- `workflows/post-epic.test.ts`: end-to-end on fixture epic with all phases enabled
- `routes/retro.test.ts`: fetch retro report, 404 for missing epic

## Acceptance Criteria

- [ ] Terminal epic triggers a `post-epic` workflow run automatically
- [ ] Disabled phases are skipped cleanly (no-op nodes)
- [ ] `retro.completed` SSE event arrives in the Web UI with correct counts
- [ ] Doc update requires human approval via existing approval node type before applying
- [ ] Ephemeral memory entries for the epic are removed; durable ones persist
- [ ] `bun run validate` green
