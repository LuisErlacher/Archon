# Spec 024 — External Platform Integrations

**Issue:** #27
**Batch:** 9
**Prereqs:** none (integration layer sits beside workflow engine)
**Estimated effort:** L
**Implementation Risk:** MEDIUM — external API quirks (rate limits, auth, webhooks) cause flakiness. Mitigate with retries and dry-run mode.

## Goal

Bidirectional sync between Archon story state and external PM platforms (Linear, Azure DevOps, GitHub Projects). State mappings are per-template and per-platform, direction is configurable (in, out, bidirectional).

## Scope

**In:**

- `IExternalIntegration` interface with Linear, AzureDevOps, GitHubProjects providers.
- State-mapping config stored per workflow template.
- Outbound: on Archon story transition, create/update/close external item.
- Inbound: webhook endpoints create or update Archon stories.
- Per-integration credentials in `.archon/config.yaml` (resolved via proxy in container mode — spec 019).
- Dry-run mode (logs intended mutations without calling API).

**Out:**

- Jira (explicitly deferred — add in follow-up).
- Full bidirectional comment sync (state only for v1).
- Conflict resolution UI (last-write-wins with audit log).

## Files to Create / Modify

- `packages/integrations/` — new package `@archon/integrations` (matches monorepo pattern).
- `packages/integrations/src/types.ts` — `IExternalIntegration`, event types.
- `packages/integrations/src/linear/provider.ts`.
- `packages/integrations/src/azure-devops/provider.ts`.
- `packages/integrations/src/github-projects/provider.ts`.
- `packages/integrations/src/registry.ts`.
- `packages/server/src/routes/integrations.ts` — CRUD + webhook receivers.
- `packages/server/src/routes/schemas/integration.schemas.ts`.
- `packages/core/src/services/sync-service.ts` — subscribes to workflow events, dispatches to providers.
- `migrations/010_integrations.sql` + SQLite equivalent.

## New Interfaces / Types

```ts
export type SyncDirection = 'in' | 'out' | 'bidirectional';

export interface IntegrationConfig {
  id: string;
  platform: 'linear' | 'azure_devops' | 'github_projects';
  direction: SyncDirection;
  stateMap: Record<string, string>; // archonState → externalState
  credentialsRef: string; // key into proxy/config
  metadata: Record<string, unknown>; // e.g. projectId, teamId
}

export interface ExternalItemRef {
  integrationId: string;
  externalId: string;
  externalUrl: string;
}

export interface IExternalIntegration {
  upsertItem(
    storyId: string,
    state: string,
    payload: Record<string, unknown>
  ): Promise<ExternalItemRef>;
  closeItem(ref: ExternalItemRef): Promise<void>;
  handleWebhook(rawBody: string, headers: Record<string, string>): Promise<SyncInboundEvent | null>;
}

export interface SyncInboundEvent {
  integrationId: string;
  externalId: string;
  archonState: string; // mapped back via stateMap
  patch: Record<string, unknown>;
}
```

## Database Changes

New tables:

- `integrations` — one row per configured integration (`integrationConfigSchema`).
- `integration_links` — `story_id`, `integration_id`, `external_id`, `external_url`, `last_synced_at`.
- `integration_events` — audit log of every outbound/inbound sync, with success/error.

## Tests Required

- Unit: each provider with mocked HTTP client; state-map round-trip.
- Unit: webhook signature verification per platform (GitHub HMAC, Linear, AzDO).
- Unit: dry-run produces correct intended mutations with zero HTTP calls.
- Integration: end-to-end outbound — fake workflow event → provider called with expected payload.
- Failure: 429 rate limit triggers exponential backoff; 4xx surfaced in `integration_events` with classified message.

## Acceptance Criteria

- Creating an integration via API persists config and validates credentials with a test call.
- Story transition in Archon updates the linked external item within 5s (outbound).
- Webhook POST creates/updates Archon story within 2s (inbound).
- Dry-run mode togglable per integration; no external calls made when enabled.
- Audit log `integration_events` covers every attempted sync, including failures with classified error messages.
- Missing or invalid credentials fail fast with clear error naming the integration.
