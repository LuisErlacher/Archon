# Spec 013 — Codebase Auto-Discovery & Project Context Generation

**Issue:** #11
**Batch:** 5
**Prereqs:** (none)
**Estimated effort:** M

## Goal

On project registration (or on demand) scan the repository, detect stack (languages, frameworks, test runners, build tools, DB), summarize structure (routes, components, entrypoints), and emit a `project-context.md` that every agent automatically receives. Developer reviews/edits before confirming. Must complete in < 5 min on repos up to 10k files.

## Scope

**In:**

- Filesystem scanner with heuristic detectors (package.json, pyproject.toml, Cargo.toml, go.mod, Dockerfile, composer.json, Gemfile)
- Framework detection (Next.js, React, Vue, Express, Hono, FastAPI, Django, Rails, etc.)
- Test runner + coverage detection
- Generation of `project-context.md` (stack, dependencies, routes, components, conventions)
- REST API to trigger discovery and fetch/edit the draft
- Web UI review + confirm screen
- Persist confirmed context to `codebases.project_context` column

**Out:**

- AST-based deep analysis (use glob + regex heuristics)
- Auto team config (lives in spec 017)
- Skill auto-generation (lives in spec 012 — triggered by confirm)
- Re-discovery on every commit (manual re-run only in v1)

## Files to Create / Modify

### Create

| Path                                                      | Purpose                                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/services/discovery/scanner.ts`         | Walk repo respecting `.gitignore`                                                                                      |
| `packages/core/src/services/discovery/detectors/`         | One module per ecosystem (node, python, rust, go, ruby, php, docker)                                                   |
| `packages/core/src/services/discovery/context-builder.ts` | Compose `project-context.md` from detector outputs                                                                     |
| `packages/core/src/services/discovery/index.ts`           | `discoverCodebase(path)` orchestrator                                                                                  |
| `packages/server/src/routes/schemas/discovery.schemas.ts` | Zod                                                                                                                    |
| `packages/server/src/routes/discovery.ts`                 | `POST /api/codebases/:id/discover`, `GET /api/codebases/:id/project-context`, `PUT /api/codebases/:id/project-context` |
| `packages/web/src/routes/DiscoveryReviewPage.tsx`         | Side-by-side diff + edit                                                                                               |
| `migrations/008_project_context.sql` / sqlite             | Adds `codebases.project_context TEXT`, `codebases.stack JSONB`                                                         |

### Modify

| Path                                 | Change                                                 |
| ------------------------------------ | ------------------------------------------------------ |
| `packages/core/src/db/codebases.ts`  | Read/write `project_context` and `stack` columns       |
| `packages/workflows/src/executor.ts` | Prepend `project_context` to each node's system prompt |

## New Interfaces / Types

```ts
export interface DetectedStack {
  languages: Array<{ name: string; files: number; percentage: number }>;
  frameworks: string[]; // 'nextjs', 'hono', 'fastapi'
  testRunners: string[]; // 'vitest', 'pytest'
  buildTools: string[]; // 'vite', 'turbo', 'uv'
  databases: string[]; // 'postgres', 'sqlite', 'redis'
  packageManagers: string[]; // 'bun', 'npm', 'uv', 'cargo'
  hasDocker: boolean;
  hasCI: boolean;
}

export interface DiscoveryResult {
  stack: DetectedStack;
  routes: Array<{ method: string; path: string; file: string }>;
  components: Array<{ name: string; file: string }>;
  entrypoints: string[];
  conventions: { naming: string | null; fileStructure: string[] };
  projectContextMarkdown: string; // draft .md body
  scanDurationMs: number;
  filesScanned: number;
}

export interface IDiscoveryService {
  discover(codebasePath: string, opts?: { timeoutMs?: number }): Promise<DiscoveryResult>;
}
```

## Database Changes

Alter `codebases`:

- `project_context TEXT NULL`
- `stack JSONB NULL` (SQLite: `TEXT NULL` storing JSON)
- `discovery_completed_at TIMESTAMPTZ NULL`

No new tables.

## Tests Required

- `detectors/node.test.ts`, `detectors/python.test.ts`, etc.: fixture repos → expected detections
- `scanner.test.ts`: respects `.gitignore`, stays under timeout, excludes `node_modules`/`.venv`/`dist`
- `context-builder.test.ts`: snapshot of generated markdown for known fixtures
- `routes/discovery.test.ts`: happy path, timeout handling, 404 for unknown codebase
- Perf: fixture repo of ~10k synthetic files completes in < 5 min on CI

## Acceptance Criteria

- [ ] `POST /api/codebases/:id/discover` returns a draft within 5 min on a 10k-file repo
- [ ] Draft includes stack, routes, components, conventions, dependencies sections
- [ ] Developer can edit and `PUT` the final `project-context.md`
- [ ] After confirm, all subsequent workflow runs receive `project_context` in the system prompt
- [ ] Rescan replaces draft but never overwrites a confirmed context without explicit save
- [ ] `bun run validate` green
