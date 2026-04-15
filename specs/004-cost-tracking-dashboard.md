# Spec 004 — Usage Metrics & Cost Tracking Dashboard

**Issue:** #19
**Batch:** 1 (Core Infrastructure — Foundation)
**Prereqs:** spec 002 (provider session persistence) merged into `dev`. Does **not** depend on spec 003, but should land after it to benefit from the state machine's transition hooks.
**Estimated effort:** M

## Goal

Capture token usage and computed cost for every AI invocation (Claude, Codex, pi-ai providers), aggregate per node / run / workflow / codebase, and expose both a REST API and a Web UI dashboard. Operators need to answer: "how much did this epic cost?", "which provider is cheapest per story?", "are we trending over budget?". Also feeds the autonomy ratio metric (interventions / total runs) needed by spec 005.

## Scope

### In scope

- Per-chunk usage capture inside each provider's streaming loop (`input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cost_usd` when SDK reports it).
- Pricing table (code-first, overridable via config) to compute cost when a provider doesn't surface it.
- Aggregates: by `workflow_run_id`, by DAG `node_id`, by `codebase_id`, by provider + model, bucketed daily.
- REST endpoints under `/api/metrics/*` returning Zod-validated responses.
- Dashboard page `/metrics` in Web UI: KPI cards (runs/week, $/week, autonomy ratio), stacked chart (cost by provider), top-10 most expensive runs table.
- Autonomy ratio = runs that reached terminal state without an `approval` or `human_escalation` event / total terminal runs.

### Out of scope

- Budget _enforcement_ / caps (spec in Batch 3, issue #23).
- Per-user / per-tenant cost attribution (single-dev tool, YAGNI).
- Historical duration estimates (V1.5+ item in issue #19).
- Billing integration, invoicing, currency conversion beyond USD.

## Files to Create

| Path                                                    | Purpose                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/db/usage.ts`                         | `recordUsage`, `aggregateUsage`, `topRunsByCost` — follows `packages/core/src/db/workflow-events.ts` pattern           |
| `packages/core/src/db/usage.test.ts`                    | Integration tests (SQLite + Postgres)                                                                                  |
| `packages/providers/src/pricing.ts`                     | Static pricing map `{ provider, model, inputPer1M, outputPer1M, cacheRead, cacheWrite }` + `computeCost(usage, model)` |
| `packages/providers/src/pricing.test.ts`                | Unit tests with known model pairs                                                                                      |
| `packages/server/src/routes/api.metrics.ts`             | New route module: `/api/metrics/summary`, `/api/metrics/runs`, `/api/metrics/autonomy`                                 |
| `packages/server/src/routes/schemas/metrics.schemas.ts` | Zod schemas (`metricsSummarySchema`, `metricsRunRowSchema`, `autonomyRatioSchema`)                                     |
| `packages/server/src/routes/api.metrics.test.ts`        | Route tests                                                                                                            |
| `packages/web/src/routes/MetricsPage.tsx`               | Dashboard page (KPI cards + charts, shadcn/ui + recharts)                                                              |
| `packages/web/src/components/metrics/`                  | `KpiCard.tsx`, `CostByProviderChart.tsx`, `TopRunsTable.tsx`                                                           |
| `migrations/021_usage_tracking.sql`                     | `remote_agent_usage_events` table                                                                                      |

## Files to Modify

| Path                                             | Change                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `packages/providers/src/types.ts`                | Extend `MessageChunk` with optional `usage: { inputTokens, outputTokens, cacheReadTokens?, cacheCreationTokens?, costUsd? }` |
| `packages/providers/src/claude/*.ts`             | Emit usage from SDK `message.usage` on every assistant chunk                                                                 |
| `packages/providers/src/codex/*.ts`              | Emit usage from Codex SDK response metadata                                                                                  |
| `packages/providers/src/pi-ai/*.ts`              | Emit usage from pi-agent-core `AgentMessage.usage`                                                                           |
| `packages/workflows/src/dag-executor.ts`         | On each chunk with `usage`, call `deps.store.recordUsage({ runId, nodeId, provider, model, usage })`                         |
| `packages/workflows/src/deps.ts`                 | Add optional `recordUsage` to `IWorkflowPlatform` / store                                                                    |
| `packages/server/src/index.ts`                   | Mount `/api/metrics` routes                                                                                                  |
| `packages/web/src/App.tsx`                       | Add `/metrics` route                                                                                                         |
| `packages/web/src/components/layout/Sidebar.tsx` | Add "Metrics" nav item                                                                                                       |

## New Interfaces / Types

```ts
// packages/providers/src/types.ts
export interface UsageSample {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd?: number;
}

// packages/core/src/db/usage.ts
export interface UsageEvent {
  id: string;
  workflowRunId: string;
  nodeId: string | null;
  codebaseId: string | null;
  provider: string;
  model: string;
  sample: UsageSample;
  computedCostUsd: number; // filled from pricing if sample.costUsd absent
  createdAt: string;
}

export interface MetricsSummary {
  periodStart: string;
  periodEnd: string;
  runs: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  autonomyRatio: number; // 0..1
  byProvider: Array<{ provider: string; model: string; costUsd: number; runs: number }>;
}
```

## Database Changes

`migrations/021_usage_tracking.sql`:

```sql
CREATE TABLE remote_agent_usage_events (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT REFERENCES remote_agent_workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT,
  codebase_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_run ON remote_agent_usage_events(workflow_run_id);
CREATE INDEX idx_usage_created ON remote_agent_usage_events(created_at DESC);
CREATE INDEX idx_usage_codebase_day ON remote_agent_usage_events(codebase_id, date(created_at));
```

Aggregation queries use `SUM()` + `GROUP BY date_trunc('day', created_at)` (Postgres) / `GROUP BY date(created_at)` (SQLite) — encapsulate in `db/adapters`.

## Tests Required

- Unit: `computeCost()` returns known values for Claude Sonnet, GPT-5-Codex, and at least one pi-ai model.
- Unit: `computeCost()` prefers `sample.costUsd` when present.
- Integration: `recordUsage` + `aggregateUsage` round-trip on SQLite + Postgres.
- Route: `GET /api/metrics/summary?from=...&to=...` returns schema-valid response.
- Route: `GET /api/metrics/autonomy` computes ratio correctly given fixture runs (some with `approval` events, some without).
- Provider: mock SDK messages → verify chunks include `usage` for each provider.
- Web: basic render test for `MetricsPage` (renders KPI cards when API returns fixture).

## Acceptance Criteria

- [ ] Every assistant chunk emitted by Claude / Codex / pi-ai providers carries a populated `usage` field (verified by provider tests).
- [ ] DAG executor writes one `usage_events` row per chunk with non-null usage; cost is computed if SDK didn't provide one.
- [ ] `GET /api/metrics/summary` returns totals matching the sum of `usage_events` for the period.
- [ ] `/metrics` page loads in Web UI, shows totals, cost-by-provider chart, and top-10 most expensive runs.
- [ ] Autonomy ratio is computed from `workflow_events` (runs without `approval` / `human_escalation` events in terminal state).
- [ ] Zero performance regression on hot streaming path (benchmark: executor test wall time within ±5% of baseline).
- [ ] `bun run validate` passes.
