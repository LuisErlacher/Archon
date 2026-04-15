# Spec 015 — Provider Failover Chain

**Issue:** #10
**Batch:** 6
**Prereqs:** 002 (pi-ai provider — already merged)
**Estimated effort:** M

## Goal

When the primary LLM provider fails (rate limit, auth error, timeout, 5xx), automatically switch execution to the next provider in a configurable chain without losing the in-flight workflow node. Provider switches emit SSE events for observability, are logged for audit, and fall back to the original provider once it becomes healthy again.

## Scope

**In:**

- `failover` config block in `.archon/config.yaml`
- `FailoverExecutor` wrapping `IAgentProvider.sendQuery` with chain traversal
- Health tracker (success/failure rate per provider, rolling window)
- Classification of failover-eligible errors (429, 401, timeout, 5xx)
- SSE event `provider.failover` with `{ from, to, reason, attempt }`
- Structured audit entries in `workflow_events`
- "Healing" policy: retry primary after cooldown window (default 60s)

**Out:**

- Multi-key rotation within a single provider (that's spec 016)
- Cost-optimized routing (always fixed priority in v1)
- Mid-stream switch inside a single SDK call (switch at node boundary only — after failure)
- Global circuit-breaker across projects

## Files to Create / Modify

### Create

| Path                                               | Purpose                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `packages/providers/src/failover/executor.ts`      | `FailoverExecutor` implementing `IAgentProvider` |
| `packages/providers/src/failover/health.ts`        | Rolling-window health tracker (in-memory)        |
| `packages/providers/src/failover/classifier.ts`    | Map SDK errors → `FailoverReason`                |
| `packages/providers/src/failover/types.ts`         | Interfaces below                                 |
| `packages/providers/src/failover/executor.test.ts` |                                                  |

### Modify

| Path                                                    | Change                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/core/src/config/config-loader.ts`             | Parse `assistants.failover` block                          |
| `packages/core/src/config/schema.ts`                    | Zod for failover config                                    |
| `packages/providers/src/registry.ts`                    | Wrap providers in `FailoverExecutor` when chain configured |
| `packages/workflows/src/event-emitter.ts`               | `WORKFLOW_EVENT_TYPES` adds `provider.failover`            |
| `packages/web/src/components/workflows/RunTimeline.tsx` | Render failover events                                     |

## New Interfaces / Types

```ts
export type FailoverReason = 'rate_limit' | 'auth_error' | 'timeout' | 'server_error' | 'network';

export interface FailoverConfig {
  chain: string[]; // e.g. ['claude', 'pi-ai:openai', 'pi-ai:google']
  timeoutMs: number; // per-provider attempt cap (default 120000)
  cooldownMs: number; // heal window for primary (default 60000)
}

export interface ProviderHealth {
  providerId: string;
  successCount: number;
  failureCount: number;
  lastFailureAt: string | null;
  lastFailureReason: FailoverReason | null;
  isInCooldown: boolean;
}

export interface IFailoverExecutor extends IAgentProvider {
  getHealth(): ProviderHealth[];
}
```

## Database Changes

None. Health is in-memory per server process (failover is reactive; no durable state needed). Audit lives in existing `workflow_events` table.

## Tests Required

- `failover/classifier.test.ts`: every known SDK error maps to a reason
- `failover/executor.test.ts`:
  - Primary fails with 429 → second provider succeeds → result returned
  - All providers fail → original error re-thrown with aggregated context
  - Streaming: partial output from primary is discarded when switch happens (node restarts on secondary)
  - Cooldown elapsed → next call tries primary first again
- `health.test.ts`: rolling window correctness
- Integration: fixture workflow runs a prompt node through mock failing primary, asserts `provider.failover` SSE event emitted

## Acceptance Criteria

- [ ] `.archon/config.yaml` with `failover.chain: [claude, pi-ai:openai]` is parsed and applied
- [ ] Forced 429 from primary switches to secondary within `timeoutMs`
- [ ] `provider.failover` event appears in SSE stream and run timeline
- [ ] After `cooldownMs` the primary is retried first on the next node
- [ ] Chain exhaustion surfaces a clear `AllProvidersFailedError` with per-provider reasons
- [ ] `bun run validate` green
