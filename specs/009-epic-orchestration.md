# Spec 009 — Epic Orchestration (Scrum Master + Team Lead)

**Issue:** #14
**Batch:** 4
**Prereqs:** spec 007, spec 008
**Estimated effort:** L

## Goal

Introduce hierarchical agent coordination: a project-level **Scrum Master** decides epic ordering (sequential vs parallel), and a per-epic **Team Lead** orchestrates N workers (one per story) in isolated worktrees, handling dependency analysis, blocked-story decisions, and epic-level PR creation. Sequential by default within an epic; parallel optional between epics. Supports pause/resume/cancel semantics. Maps to PRD FR2, FR3, FR6, FR23-24, FR28, FR58, Stories 5.1-5.4.

## Implementation Risk

**HIGH RISK for autonomous AI implementation.** This spec introduces multi-agent hierarchies and long-lived orchestration state. **Human review is critical before merging.** Specific risks:

- Deadlocks / livelocks from incorrect dependency analysis between stories
- Worktree leaks if Team Lead crashes mid-orchestration (ensure cleanup in `finally` paths)
- Race conditions on shared epic PR branch when parallel workers merge
- Budget-exhaustion escalation must not orphan in-flight workers
- Event ordering (`epic.started` → `teamlead.decision` → `worker.*`) must be preserved for audit

Require: a senior reviewer familiar with the workflow executor, a dry-run on a 2-story fixture epic, and a kill-switch to cancel all children of a runaway Scrum Master run before merging.

## Scope

### In scope

- `ScrumMasterAgent` — analyzes open epics, decides execution plan, confirms with user
- `TeamLeadAgent` — one per epic, sequences story workers, validates, merges
- Story dependency parser (reads epic YAML / story metadata)
- Hierarchical event stream (`epic.*`, `teamlead.*`, `worker.*`)
- Pause/resume/cancel for epics (and their descendants)
- Epic-level PR aggregation after all stories DONE

### Out of scope

- Cross-project orchestration (one project at a time)
- UI/Web surfaces for Scrum Master (CLI + events only in this spec)
- Automatic epic prioritization (Scrum Master proposes, user confirms)

## Files to Create

| Path                                                     | Purpose                                    |
| -------------------------------------------------------- | ------------------------------------------ |
| `packages/core/src/orchestration/scrum-master.ts`        | Project-level orchestrator                 |
| `packages/core/src/orchestration/team-lead.ts`           | Epic-level orchestrator                    |
| `packages/core/src/orchestration/dependency-analyzer.ts` | Parses story deps, produces run order      |
| `packages/core/src/orchestration/epic-lifecycle.ts`      | Pause/resume/cancel state machine          |
| `packages/core/src/orchestration/types.ts`               | Shared types                               |
| `.archon/workflows/defaults/archon-scrum-master.yaml`    | Thin DAG wrapper around `ScrumMasterAgent` |
| `.archon/workflows/defaults/archon-team-lead.yaml`       | Thin DAG wrapper around `TeamLeadAgent`    |
| Tests for each module above                              | `*.test.ts` siblings                       |

## Files to Modify

| Path                                      | Change                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| `packages/workflows/src/event-emitter.ts` | Add `epic.*` / `teamlead.*` / `worker.*` event types |
| `packages/core/src/db/schema.sql`         | Add `remote_agent_epic_runs` table                   |
| `packages/server/src/routes/api.ts`       | Endpoints: list epics, pause/resume/cancel           |
| `packages/cli/src/commands/epic.ts`       | `archon epic start/pause/resume/cancel/status`       |
| `packages/workflows/src/executor.ts`      | Honor `epic_run_id` when paused                      |

## New Interfaces / Types

```typescript
export interface EpicPlan {
  epicId: string;
  stories: Array<{ id: string; dependsOn: string[] }>;
  order: string[][]; // each inner array = parallel wave
}

export interface ScrumMasterDecision {
  epics: Array<{ id: string; mode: 'sequential' | 'parallel' }>;
  confirmationRequired: true;
}

export interface TeamLeadAction {
  kind: 'spawn' | 'retry' | 'inject-context' | 'escalate' | 'merge' | 'complete';
  storyId?: string;
  reason: string;
}

export type EpicStatus = 'pending' | 'running' | 'paused' | 'done' | 'cancelled' | 'failed';
```

## Database Changes

```sql
CREATE TABLE remote_agent_epic_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  epic_ref TEXT NOT NULL,          -- epic identifier (file path or slug)
  status TEXT NOT NULL,            -- EpicStatus
  plan JSONB NOT NULL,             -- EpicPlan
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  parent_scrum_master_run_id TEXT, -- links to workflow_runs.id
  final_pr_url TEXT
);

CREATE INDEX idx_epic_runs_status ON remote_agent_epic_runs(status);
```

Migration files: `migrations/009_epic_runs.sql` + SQLite equivalent.

## Tests Required

- Dependency analyzer: DAG with fan-out/fan-in, cycles rejected, independent stories detected as parallel
- Scrum Master: selects sequential when deps detected, parallel otherwise; user confirmation required before spawning
- Team Lead: spawns worker per story, handles BLOCKED (retry → inject-context → escalate ladder)
- Lifecycle: pause transitions active workers to PAUSED, resume resumes only eligible stories, cancel cleans up worktrees
- Integration: 2-story epic fixture completes DONE with final PR created
- Crash recovery: killing Team Lead mid-run leaves recoverable state (resume reconstructs from DB + events)

## Acceptance Criteria

- [ ] `archon epic start <epic-id>` runs through Scrum Master → Team Lead → workers → final PR
- [ ] `archon epic pause <epic-id>` halts in-flight workers within 10s; backlog blocked
- [ ] `archon epic resume <epic-id>` continues paused stories; eligible backlog starts
- [ ] `archon epic cancel <epic-id>` cancels all non-DONE stories and cleans up worktrees
- [ ] Parallel stories run in separate worktrees (verified via `archon isolation list`)
- [ ] Hierarchical events appear in DB in causal order
- [ ] Budget exhaustion (from spec 008) propagates up to Team Lead which escalates to human
- [ ] `bun run validate` passes
