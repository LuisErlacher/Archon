# Spec 020 — Dev Stack Sidecars per Project Pod

**Issue:** #38
**Batch:** 7
**Prereqs:** 018
**Estimated effort:** L
**Implementation Risk:** HIGH — infrastructure/lifecycle coupling; misconfigured sidecars leak ports or exhaust host resources. Recommend HUMAN implementer; GLM-generated sidecar orchestration code must be reviewed by a human before merge.

## Goal

Allow each project container to spin up optional sidecar services (postgres, redis, elasticsearch, custom images) as part of its pod lifecycle. Sidecars share the agent container's network namespace so the app can reach `localhost:5432` etc.

## Scope

**In:**

- Stack config in `.archon/config.yaml` under `stack.services[]`.
- Auto-detect hint from `docker-compose.yml` (services list only; user confirms via Web UI).
- Lifecycle: sidecars spawn before agent container, stop after.
- Health checks per sidecar; spawn fails fast if any service unhealthy after timeout.
- Resource limits per sidecar (CPU, memory).
- Sidecar log streaming multiplexed into existing log stream.

**Out:**

- Cross-project shared services.
- Persistent sidecar volumes across pod restarts (start ephemeral; volumes are a follow-up).
- Kubernetes pod-spec translation (Docker network-sharing only for Phase 1).

## Files to Create / Modify

- `packages/isolation/src/sidecar/manager.ts` — new sidecar orchestrator.
- `packages/isolation/src/sidecar/detector.ts` — reads docker-compose.yml for hints.
- `packages/isolation/src/providers/container.ts` — wire sidecar lifecycle into spawn/destroy.
- `packages/core/src/config/config-loader.ts` — extend schema with `stack`.
- `packages/server/src/routes/environments.ts` — expose `/api/codebases/:id/stack` GET/PUT.
- `packages/web/src/routes/ProjectStackPage.tsx` — UI for listing/editing services.

## New Interfaces / Types

```ts
export interface StackService {
  name: string; // "postgres", "redis"
  image: string; // "postgres:17-alpine"
  env?: Record<string, string>;
  ports?: number[]; // exposed inside shared netns
  healthCheck?: { cmd: string[]; intervalMs: number; timeoutMs: number; retries: number };
  resourceLimits?: { cpus: number; memoryMb: number };
}

export interface StackConfig {
  services: StackService[];
}

export interface SidecarStatus {
  name: string;
  containerId: string;
  status: 'starting' | 'healthy' | 'unhealthy' | 'stopped';
  lastError?: string;
}
```

## Database Changes

Extend `isolation_environments`:

- `sidecars JSONB NULL` — snapshot of `SidecarStatus[]` at last update.

## Tests Required

- Unit: config parser — valid/invalid stack definitions.
- Unit: detector — reads a fixture docker-compose.yml and returns candidate services.
- Integration (`HAS_DOCKER=1`): spawn pod with postgres sidecar; agent container can `pg_isready -h localhost`; destroy removes both containers.
- Failure: unhealthy sidecar (bad env) causes spawn to fail with classified error listing which service failed.
- Resource leak: destroy must remove all sidecars even if agent container already gone.

## Acceptance Criteria

- `PUT /api/codebases/:id/stack` persists config and validates schema.
- Spawn creates all sidecars before the agent container; destroy tears them down in reverse order.
- Sidecar logs appear in `GET /api/codebases/:id/environment/logs` tagged by service name.
- Dashboard shows sidecar health indicators per project.
- Spawn timeout (default 120s) aborts and cleans up partially-started pods.
