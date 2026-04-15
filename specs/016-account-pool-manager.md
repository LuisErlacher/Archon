# Spec 016 — Account Pool Manager (Credential Rotation & Scoring)

**Issue:** #12
**Batch:** 6
**Prereqs:** 015
**Estimated effort:** L

## Implementation Risk: HIGH

This spec handles **encrypted API credentials at rest**, **credential rotation under load**, and a **Web UI that displays account state**. Incorrect implementation can leak keys in logs/SSE, persist plaintext credentials, or hand an attacker a list of partial keys.

**Required before merge:**

- Human security review of encryption scheme (KMS/keyring choice, key derivation, IV handling)
- Human review of the masking layer (API responses, SSE events, logs, error messages)
- Threat-model review: at-rest, in-transit, in-memory, crash-dump, process-fork
- Confirm no plaintext key ever crosses `IAgentProvider` boundary except inside the proxy call
- Penetration test / static secret-scan on the final diff
- Explicit sign-off recorded in the PR description

## Goal

Manage multiple API keys per provider with a scoring algorithm, **proactive** swap every 30 s to pre-empt rate limits, and **reactive** swap within 5 s on 429/401. Keys encrypted at rest. Admin UI shows masked keys, scores, usage charts, and allows manual cooldown/force-rotate.

## Scope

**In:**

- `AccountPool` model: provider, encryptedKey, status (ACTIVE / COOLDOWN / DISABLED / RATE_LIMITED), score (0..1), 24 h usage stats, cooldown window
- Encrypted-at-rest storage (libsodium / Node `crypto.subtle` AES-256-GCM with KEK from env `ARCHON_POOL_KEY`)
- Scoring algorithm: latency, error rate, quota headroom, cost tier
- Proactive scheduler (30 s polling) picks top-scored ACTIVE key per provider
- Reactive swap on 429 / 401 / 400 within 5 s (integrates with spec 015 `FailoverExecutor`)
- Admin UI: masked keys (`sk-…abc12`), score bars, hourly usage, rotation timeline, force-cooldown button
- Per-provider timeout config (30 s – 120 s per NFR21)

**Out:**

- Automatic key provisioning / purchase
- Multi-tenant per-user key pools (single-developer assumption)
- Live key value display (always masked — even to admin)
- Streaming-mid-call key swap (switch between calls only)

## Files to Create / Modify

### Create

| Path                                                         | Purpose                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `packages/core/src/services/account-pool/store.ts`           | Encrypted CRUD                                                       |
| `packages/core/src/services/account-pool/crypto.ts`          | AES-256-GCM wrapper; KEK from env                                    |
| `packages/core/src/services/account-pool/scorer.ts`          | Scoring function                                                     |
| `packages/core/src/services/account-pool/manager.ts`         | `AccountPoolManager` — acquire/release/mark                          |
| `packages/core/src/services/account-pool/scheduler.ts`       | 30 s proactive scan                                                  |
| `packages/core/src/services/account-pool/masking.ts`         | Single source of truth for masking                                   |
| `packages/providers/src/failover/executor.ts`                | Call `pool.acquire()` before SDK call; `pool.markFailure()` on error |
| `packages/server/src/routes/schemas/account-pool.schemas.ts` | Zod (never surfaces raw key)                                         |
| `packages/server/src/routes/account-pool.ts`                 | Admin REST                                                           |
| `packages/web/src/routes/AccountPoolPage.tsx`                | UI (masked only)                                                     |
| `migrations/010_account_pool.sql` + sqlite                   | Schema                                                               |

### Modify

| Path                                      | Change                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `packages/paths/src/logger.ts`            | Add redaction list for any field containing `key` / `token` / `secret` |
| `packages/workflows/src/event-emitter.ts` | Never include raw key in events                                        |

## New Interfaces / Types

```ts
export type AccountStatus = 'active' | 'cooldown' | 'disabled' | 'rate_limited';

export interface AccountPoolEntry {
  id: string;
  providerId: string;
  keyFingerprint: string; // SHA-256 first 8 bytes, for identity
  maskedKey: string; // 'sk-ant-…abc12' — only this is returned
  status: AccountStatus;
  score: number; // 0..1
  latencyMsP50: number;
  errorRate24h: number;
  requestCount24h: number;
  cooldownUntil: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AccountPoolManager {
  acquire(providerId: string): Promise<{ entryId: string; decryptedKey: string }>; // key never persisted
  markSuccess(entryId: string, latencyMs: number): Promise<void>;
  markFailure(entryId: string, reason: FailoverReason): Promise<void>;
  forceCooldown(entryId: string, durationMs: number): Promise<void>;
}
```

`decryptedKey` MUST be used only to build the SDK call and never returned by any route, logged, or serialized.

## Database Changes

Table `remote_agent_account_pool`:

| Column              | Type             | Notes                             |
| ------------------- | ---------------- | --------------------------------- |
| `id`                | UUID PK          |                                   |
| `provider_id`       | TEXT             |                                   |
| `key_fingerprint`   | TEXT UNIQUE      | dedupe                            |
| `encrypted_key`     | BYTEA / BLOB     | AES-256-GCM ciphertext + IV + tag |
| `masked_key`        | TEXT             | display only                      |
| `status`            | TEXT             | CHECK                             |
| `score`             | REAL             |                                   |
| `latency_ms_p50`    | INT              |                                   |
| `error_rate_24h`    | REAL             |                                   |
| `request_count_24h` | INT              |                                   |
| `cooldown_until`    | TIMESTAMPTZ NULL |                                   |
| `last_used_at`      | TIMESTAMPTZ NULL |                                   |
| `created_at`        | TIMESTAMPTZ      |                                   |

Env: `ARCHON_POOL_KEY` (base64-encoded 32-byte KEK). Server refuses to start if set length invalid or absent while any encrypted rows exist.

## Tests Required

- `crypto.test.ts`: encrypt/decrypt round-trip; tamper detection (GCM tag mismatch); IV uniqueness
- `scorer.test.ts`: higher score for low-latency, low-error, unused-recently keys
- `manager.test.ts`: acquire returns highest-score ACTIVE; 429 moves to RATE_LIMITED + cooldownUntil
- `masking.test.ts`: every output path produces only masked form; fuzz with random key shapes
- `routes/account-pool.test.ts`: no raw key in any response body; 403 when `ARCHON_POOL_KEY` missing
- Logger redaction test: asserts raw key never appears in captured logs
- Security: explicit test that `SSE` event serialization drops raw key
- Integration: forced 429 triggers swap within < 5 s (measured)

## Acceptance Criteria

- [ ] Keys stored as AES-256-GCM ciphertext; `ARCHON_POOL_KEY` required
- [ ] Proactive 30 s scheduler selects top-scored ACTIVE key per provider
- [ ] Reactive 429 / 401 moves key to COOLDOWN and swaps in ≤ 5 s (p95)
- [ ] No raw key in any REST response, SSE event, log line, or error message (enforced by tests)
- [ ] Admin UI shows only masked keys + metrics; force-cooldown works
- [ ] **Security sign-off recorded in the PR** (see "Implementation Risk: HIGH" checklist)
- [ ] `bun run validate` green
