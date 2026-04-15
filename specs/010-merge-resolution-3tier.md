# Spec 010 — AI-Powered Merge Resolution (3-tier)

**Issue:** #15
**Batch:** 4
**Prereqs:** spec 007
**Estimated effort:** M

## Goal

When parallel story worktrees produce merge conflicts against the epic base branch, resolve them automatically via a 3-tier strategy: **Tier 1** `git merge --no-edit` (auto-merge, zero AI cost); **Tier 2** AI analyzes only conflict regions with minimal context (ACs, adjacent code); **Tier 3** AI receives full files from both sides (fallback). After each tier, quality gates re-run to verify resolution. If all tiers fail, escalate to a human with an annotated diff and the latest AI suggestion. Target: ~98% token reduction vs naive full-file approach. Maps to PRD FR64, Story 5.6.

## Implementation Risk

**HIGH RISK for autonomous AI implementation.** Incorrect merge resolutions can silently corrupt code or lose work. **Human review is critical before enabling this in production.** Specific risks:

- AI "resolution" that compiles and passes tests but silently drops feature code from one side
- Tier 2 region extraction off-by-one errors producing non-conflicting but incorrect output
- Resolutions committed to shared epic branch without human checkpoint
- Quality gates insufficient to detect semantic loss (tests may not cover the resolved area)

Require: mandatory `--dry-run` mode during initial rollout, a post-resolution diff stored in the audit trail, and an opt-out (`merge_resolution.enabled: false`) default-off flag until a senior reviewer signs off on production runs.

## Scope

### In scope

- 3-tier resolver with explicit tier selection + fallthrough
- Conflict region extraction (parses `<<<<<<< / ======= / >>>>>>>` markers)
- Per-tier quality gate invocation (delegates to existing gate runners)
- Audit record: tier used, conflicts found, resolution applied, token cost
- CLI: `archon merge resolve <worktree-branch>`

### Out of scope

- Cross-repo merges
- Rebase workflows (merge-only in this spec)
- UI for reviewing AI merges (surface via existing workflow events)

## Files to Create

| Path                                         | Purpose                              |
| -------------------------------------------- | ------------------------------------ |
| `packages/core/src/merge/resolver.ts`        | 3-tier orchestration                 |
| `packages/core/src/merge/conflict-parser.ts` | Parses conflict markers → regions    |
| `packages/core/src/merge/tier1-auto.ts`      | `git merge --no-edit` wrapper        |
| `packages/core/src/merge/tier2-region.ts`    | AI call with minimal region context  |
| `packages/core/src/merge/tier3-fullfile.ts`  | AI call with full both-sides content |
| `packages/core/src/merge/audit.ts`           | Persists resolution record           |
| `packages/core/src/merge/types.ts`           | Shared types                         |
| Tests for each module                        | `*.test.ts` siblings                 |
| `packages/cli/src/commands/merge.ts`         | `archon merge resolve` CLI command   |

## Files to Modify

| Path                                                           | Change                                               |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `packages/git/src/branch.ts`                                   | Add `tryAutoMerge()` helper returning conflict paths |
| `packages/core/src/orchestration/team-lead.ts` (from spec 009) | Invoke resolver when merging a worker worktree       |
| `packages/core/src/db/schema.sql`                              | Add `remote_agent_merge_resolutions` table           |
| `packages/core/src/config/config-loader.ts`                    | Parse `merge_resolution.*` config                    |

## New Interfaces / Types

```typescript
export type MergeTier = 'auto' | 'region' | 'fullfile';

export interface MergeAttempt {
  tier: MergeTier;
  success: boolean;
  conflictsResolved: number;
  tokensUsed: number;
  gatesPass: boolean;
  error?: string;
}

export interface MergeResolutionResult {
  resolved: boolean;
  attempts: MergeAttempt[];
  finalTier?: MergeTier;
  escalated: boolean;
  annotatedDiffPath?: string; // if escalated
}

export interface ConflictRegion {
  file: string;
  startLine: number;
  endLine: number;
  ours: string;
  theirs: string;
  context: string; // adjacent N lines
}

export async function resolveMerge(
  targetBranch: string,
  sourceBranch: string,
  cwd: string,
  opts: { dryRun?: boolean; gates: () => Promise<boolean> }
): Promise<MergeResolutionResult>;
```

## Database Changes

```sql
CREATE TABLE remote_agent_merge_resolutions (
  id TEXT PRIMARY KEY,
  epic_run_id TEXT,                 -- nullable, links to epic_runs
  source_branch TEXT NOT NULL,
  target_branch TEXT NOT NULL,
  attempts JSONB NOT NULL,          -- MergeAttempt[]
  final_tier TEXT,                  -- MergeTier or null if escalated
  escalated BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Migration: `migrations/010_merge_resolutions.sql` + SQLite equivalent.

## Tests Required

- Conflict parser: multi-file, nested, diff3-style markers (reject unsupported styles)
- Tier 1: clean merge succeeds and returns zero conflicts; real conflict returns file list
- Tier 2: fixture with single-region conflict resolves with AI mock; region extraction is correct
- Tier 3: whole-file fallback invoked only after Tier 2 gate failure
- Escalation: all tiers failing produces annotated diff artifact and returns `escalated: true`
- Dry-run: no branch mutation, full decision tree logged
- Token budget: Tier 2 confirmed to use <5% tokens of Tier 3 on identical fixture

## Acceptance Criteria

- [ ] `archon merge resolve <branch>` runs tier ladder and reports outcome
- [ ] Tier 1 handles all non-conflicting merges with zero AI cost (asserted in tests)
- [ ] Tier 2 region extraction is byte-exact for all parser test fixtures
- [ ] Quality gates re-run after each tier; failure advances to next tier
- [ ] Failure at Tier 3 escalates with annotated diff saved to `$ARTIFACTS_DIR/merge-escalation.diff`
- [ ] Every resolution (including dry-runs) persisted to `remote_agent_merge_resolutions`
- [ ] Default config is `merge_resolution.enabled: false` (opt-in until reviewed)
- [ ] `bun run validate` passes
