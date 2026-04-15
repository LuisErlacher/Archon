# Spec 018 — Dynamic Container Orchestration

**Issue:** #40
**Batch:** 7
**Prereqs:** Phase 1 Docker deployment (already exists)
**Estimated effort:** XL
**Implementation Risk:** HIGH — core infrastructure change. Touches isolation, networking, lifecycle, security. Recommend HUMAN implementer; do not merge GLM-generated code blindly. GLM can draft scaffolding but a human must review every diff.

## Goal

Allow Archon server to dynamically spawn, manage, and destroy containerized project environments via REST API. Replaces (or augments) the current worktree-based isolation with per-project containers that host the Agent SDK, worktrees, and dev-stack sidecars.

## Scope

**In:**

- `IContainerProvider` interface with `DockerProvider` (dockerode) implementation.
- Lifecycle endpoints under `/api/codebases/:id/environment`.
- Extend `isolation_environments` table to track container ID, status, ports.
- Agent SDK runs inside container; server communicates over HTTP/SSE via mapped port.
- Session hibernate/resume hook (Pattern 3 from Claude Agent SDK docs).

**Out:**

- Kubernetes provider (stub only; full impl in a later spec).
- E2B / Modal / Fly Machines providers.
- Credential proxy (spec 019).
- Dev-stack sidecars (spec 020).

## Files to Create / Modify

- `packages/isolation/src/providers/container.ts` — new `DockerContainerProvider`.
- `packages/isolation/src/types.ts` — add `IContainerProvider`, `ContainerConfig`, `ContainerEnvironment`, `ContainerStatus`.
- `packages/isolation/src/factory.ts` — register container provider alongside worktree.
- `packages/server/src/routes/environments.ts` — new route module for env lifecycle.
- `packages/server/src/routes/schemas/environment.schemas.ts` — Zod schemas.
- `packages/core/src/db/isolation-environments.ts` — extend queries for container fields.
- `migrations/008_container_environments.sql` (PG) + SQLite equivalent.

## New Interfaces / Types

```ts
export interface ContainerConfig {
  codebaseId: string;
  image: string; // default: archon/agent-runtime:latest
  repoMountPath: string;
  envVars: Record<string, string>; // non-secret only; secrets via proxy (019)
  resourceLimits: { cpus: number; memoryMb: number; pidsLimit: number };
  exposedPorts: number[];
}

export interface ContainerEnvironment {
  id: string; // archon env id
  containerId: string; // docker/k8s id
  status: ContainerStatus;
  ports: Record<number, number>; // container to host
  createdAt: Date;
}

export type ContainerStatus = 'spawning' | 'running' | 'hibernated' | 'failed' | 'destroyed';

export interface IContainerProvider {
  spawn(config: ContainerConfig): Promise<ContainerEnvironment>;
  destroy(containerId: string): Promise<void>;
  run(
    containerId: string,
    cmd: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  getStatus(containerId: string): Promise<ContainerStatus>;
  streamLogs(containerId: string): AsyncIterable<string>;
}
```

Note: the `run` method above is implemented internally via dockerode's container run API (no shell invocation), matching the project's `execFileAsync` safety rule.

## Database Changes

Extend `isolation_environments`:

- `container_id TEXT NULL`
- `container_status TEXT NULL`
- `container_image TEXT NULL`
- `port_mappings JSONB NULL`
- `hibernated_at TIMESTAMP NULL`

Index on `container_status` for cleanup queries.

## Tests Required

- Unit: `DockerContainerProvider` with mocked dockerode — spawn, destroy, run, status.
- Unit: route handlers with mocked provider; assert 400 on invalid config, 404 on missing codebase.
- Integration (gated by `HAS_DOCKER=1`): real spawn of a busybox container, run `echo hi`, destroy.
- Failure cases: image pull failure, port conflict, OOM kill — all must surface classified errors.

## Acceptance Criteria

- `POST /api/codebases/:id/environment` spawns a container and returns `{ id, status:'running', ports }` within 30s for cached images.
- `POST .../environment/run` executes a command via dockerode and streams stdout.
- `DELETE .../environment` destroys the container; DB row marked `destroyed`.
- Cleanup job removes containers whose last_used > 7 days.
- No credentials appear in logs, events, or API responses (enforced via log redactor test).
- Worktree isolation still works when `ARCHON_ISOLATION=worktree` (default unchanged).
