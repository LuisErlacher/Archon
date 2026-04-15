# Spec 019 — Credential Injection Proxy & Container Sandbox

**Issue:** #22, #39 (consolidated)
**Batch:** 7
**Prereqs:** 018
**Estimated effort:** XL
**Implementation Risk:** HIGH — security boundary. A bug here leaks API keys to agent-generated code. Recommend HUMAN implementer with security review; GLM output must not be merged without manual audit of every request/response path and network policy.

## Goal

Implement the Claude Agent SDK "proxy pattern" so agents never see raw credentials. A host-side proxy injects auth headers for allowlisted domains; the agent container runs with `--network none` and reaches the proxy over a mounted Unix socket.

## Scope

**In:**

- Host-side HTTP proxy (Hono) enforcing domain allowlist and injecting credentials.
- Unix socket transport between container and proxy.
- Container hardening flags (`--cap-drop ALL`, `--security-opt no-new-privileges`, `--read-only`, non-root user, seccomp profile, resource limits).
- Config schema in `.archon/config.yaml` for allowed domains and credential bindings.
- Audit log of all proxied requests (domain, timestamp, status — never body).

**Out:**

- Credential storage/rotation (use existing env + Account Pool).
- TLS mutual auth from container to proxy (socket perms only).
- Multi-tenant isolation between simultaneous proxies (single-dev tool; one proxy per host).

## Files to Create / Modify

- `packages/isolation/src/proxy/server.ts` — new proxy server.
- `packages/isolation/src/proxy/allowlist.ts` — domain matcher (supports wildcards).
- `packages/isolation/src/proxy/credentials.ts` — credential binding resolver.
- `packages/isolation/src/providers/container.ts` — add socket mount + hardening flags.
- `packages/core/src/config/config-loader.ts` — extend schema with `security.proxy`.
- `.archon/config.yaml` example block.

## New Interfaces / Types

```ts
export interface ProxyConfig {
  allowedDomains: string[]; // e.g. ["api.anthropic.com", "*.githubusercontent.com"]
  credentials: CredentialBinding[];
  socketPath: string; // host path, mounted into container
  auditLogPath?: string;
}

export interface CredentialBinding {
  domain: string; // exact or wildcard
  header: string; // e.g. "Authorization", "x-api-key"
  valueTemplate: string; // e.g. "Bearer ${env:GH_TOKEN}"
}

export interface ProxyAuditEntry {
  ts: Date;
  domain: string;
  method: string;
  path: string;
  status: number;
  credentialsInjected: boolean;
}
```

Container spawn (from spec 018) sets env inside container:

- `HTTPS_PROXY=http://unix:/var/run/archon-proxy.sock`
- `ANTHROPIC_BASE_URL=http://unix:/var/run/archon-proxy.sock`

## Database Changes

None (audit log is append-only JSONL on host; no DB schema change).

## Tests Required

- Unit: allowlist matcher — exact, wildcard, subdomain edge cases, deny by default.
- Unit: credential resolver — env var substitution, missing env → throw (fail fast).
- Unit: proxy rejects disallowed domains with 403; request body never logged.
- Integration (gated by `HAS_DOCKER=1`): container with `--network none` can reach `api.anthropic.com` via socket only; cannot reach `example.com`.
- Security: log redaction test — greps audit JSONL for any token prefix.
- Security: container escape attempt test — try to read host `/etc/passwd`, must fail.

## Acceptance Criteria

- Agent container has no direct internet (`curl https://example.com` fails).
- Allowed LLM + GitHub endpoints work transparently.
- API keys never appear in: container env, container logs, audit log bodies, SSE events, DB rows, HTTP responses.
- Missing credential binding for a request causes clear 502 with message "no credential configured for <domain>".
- Hardening flags verified by `docker inspect` in integration test.
