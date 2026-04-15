# Spec 008 — Error Classification & Budget Management

**Issue:** #23
**Batch:** 3
**Prereqs:** spec 003
**Estimated effort:** M

## Goal

Introduce a 3-tier error classifier (`transient` / `fatal` / `unknown`) and per-story/epic budget caps (tokens, duration, retries, LLM calls) to prevent infinite loops and runaway cost. Transient errors auto-retry with exponential backoff; fatal errors escalate immediately; unknown errors retry N times then reclassify as fatal. Budget warnings fire at 80% usage, execution is blocked at 100%. Maps to PRD FR63, NFR20-21, Story 2.12.

## Scope

### In scope

- `ErrorClassifier` module returning `{ tier, retryable, reason }` for any thrown error
- Rate-limit aware retry for GitHub API (NFR20) and provider SDKs (NFR21, 30s-120s configurable)
- Budget tracker accumulating per `workflow_run` (tokens, duration, retries, LLM calls)
- Threshold hooks: 80% warn event, 100% hard stop with escalation
- Config surface under `.archon/config.yaml` `budgets.*` (per-story defaults)

### Out of scope

- Cost reporting dashboards (separate spec)
- Cross-run aggregation/analytics
- Dynamic budget adjustment at runtime

## Files to Create

| Path                                               | Purpose                                            |
| -------------------------------------------------- | -------------------------------------------------- |
| `packages/workflows/src/errors/classifier.ts`      | `classifyError()` → tier + retry hint              |
| `packages/workflows/src/errors/classifier.test.ts` | Classification unit tests                          |
| `packages/workflows/src/budgets/tracker.ts`        | `BudgetTracker` class, accumulates metrics per run |
| `packages/workflows/src/budgets/tracker.test.ts`   | Threshold + exhaustion tests                       |
| `packages/workflows/src/schemas/budget.ts`         | Zod schema for `budgetConfigSchema`                |

## Files to Modify

| Path                                        | Change                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/workflows/src/executor.ts`        | Route node errors through classifier; enforce budget before each node       |
| `packages/workflows/src/dag-executor.ts`    | Increment tracker on node completion; emit `budget.threshold_reached` event |
| `packages/providers/src/claude/index.ts`    | Wrap SDK calls with configurable timeout (NFR21)                            |
| `packages/providers/src/codex/index.ts`     | Same timeout wrapper                                                        |
| `packages/core/src/config/config-loader.ts` | Parse `budgets:` section                                                    |
| `packages/workflows/src/event-emitter.ts`   | Add `budget.warn` and `budget.exhausted` event types                        |

## New Interfaces / Types

```typescript
export type ErrorTier = 'transient' | 'fatal' | 'unknown';

export interface ClassifiedError {
  tier: ErrorTier;
  retryable: boolean;
  reason: string;
  retryAfterMs?: number; // for rate-limit aware backoff
}

export function classifyError(err: unknown): ClassifiedError;

export interface BudgetLimits {
  maxTokens?: number;
  maxDurationMs?: number;
  maxRetries?: number;
  maxLLMCalls?: number;
}

export interface BudgetUsage {
  tokens: number;
  durationMs: number;
  retries: number;
  llmCalls: number;
}

export class BudgetTracker {
  constructor(limits: BudgetLimits, runId: string);
  record(delta: Partial<BudgetUsage>): void;
  check(): { ok: boolean; exceeded?: keyof BudgetLimits; percent: number };
}
```

## Database Changes

Extend `workflow_runs` with JSONB column:

```sql
ALTER TABLE remote_agent_workflow_runs
  ADD COLUMN budget_usage JSONB NOT NULL DEFAULT '{}'::jsonb;
```

SQLite migration: add `budget_usage TEXT DEFAULT '{}'`. Migration under `migrations/008_budget_usage.sql` and corresponding SQLite file.

## Tests Required

- Classifier: transient (ECONNRESET, 429, 503, SDK timeout), fatal (auth, syntax, validation), unknown (generic Error) — table-driven tests
- Tracker: accumulates correctly, 80% triggers warn, 100% triggers exhausted, concurrent increments are atomic
- Executor integration: transient error retries with backoff; fatal surfaces immediately; unknown retries N times then escalates
- Provider timeout: hanging mock SDK call aborts after configured timeout and classifies as transient

## Acceptance Criteria

- [ ] `classifyError()` handles all PRD error classes with unit tests
- [ ] Exponential backoff respects `retryAfterMs` from rate-limit headers (GitHub `X-RateLimit-Reset`)
- [ ] Provider timeouts configurable per provider in `.archon/config.yaml`; default 60s
- [ ] Budget exhaustion emits `budget.exhausted` event and pauses run with human escalation
- [ ] 80% threshold emits `budget.warn` event exactly once per run
- [ ] `workflow_runs.budget_usage` persists across restarts; resume correctly continues tracking
- [ ] `bun run validate` passes
