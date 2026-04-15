# Spec 011 — Shared Memory (Cross-Agent Ephemeral Knowledge Store)

**Issue:** #16
**Batch:** 4
**Prereqs:** (none)
**Estimated effort:** M

## Goal

Provide a per-project, ephemeral key/value knowledge store that every agent in an epic can read and write. Entries live for the duration of the epic and are pruned by the post-epic pipeline (spec 014). Intentionally simpler than a graph model: flat entries + `relevanceScore` + LRU eviction. Distinct from skills — skills are persistent, memory is ephemeral.

## Scope

**In:**

- `SharedMemoryEntry` model with categories (architecture_decision, tech_debt, pattern, lesson_learned, convention)
- REST API under `/api/projects/:projectId/memory` (POST/GET/DELETE)
- Agent-facing tool to write entries during workflow execution
- Relevance-based search + deduplication by (projectId, key)
- LRU eviction at 500 entries per project
- Minimal Web UI (list, edit, delete) reusing existing shadcn tables

**Out:**

- Graph / embeddings / semantic search (YAGNI — may evolve later)
- Cross-project memory sharing
- Post-epic cleanup logic (lives in spec 014)
- Real-time pub/sub between agents (agents read on demand)

## Files to Create / Modify

### Create

| Path                                                          | Purpose                                            |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `packages/core/src/db/shared-memory.ts`                       | CRUD queries for `remote_agent_shared_memory`      |
| `packages/core/src/services/shared-memory.ts`                 | Service layer: write, search, dedupe, LRU evict    |
| `packages/server/src/routes/schemas/shared-memory.schemas.ts` | Zod schemas for request/response                   |
| `packages/server/src/routes/shared-memory.ts`                 | Hono routes (POST/GET/DELETE)                      |
| `packages/providers/src/tools/shared-memory-tool.ts`          | `write_shared_memory` tool exposed to Claude/Codex |
| `packages/web/src/routes/SharedMemoryPage.tsx`                | Minimal management UI                              |
| `migrations/006_shared_memory.sql`                            | Postgres migration                                 |
| `migrations/sqlite/006_shared_memory.sql`                     | SQLite migration                                   |

### Modify

| Path                                     | Change                                             |
| ---------------------------------------- | -------------------------------------------------- |
| `packages/server/src/routes/api.ts`      | Mount shared-memory routes                         |
| `packages/workflows/src/deps.ts`         | Add `ISharedMemoryStore` to `WorkflowDeps`         |
| `packages/providers/src/claude/index.ts` | Register shared-memory tool when projectId present |
| `packages/providers/src/codex/index.ts`  | Same as Claude                                     |

## New Interfaces / Types

```ts
// packages/core/src/types/shared-memory.ts
export type MemoryCategory =
  | 'architecture_decision'
  | 'tech_debt'
  | 'pattern'
  | 'lesson_learned'
  | 'convention';

export interface SharedMemoryEntry {
  id: string;
  projectId: string;
  epicId: string | null;
  key: string; // stable dedupe key
  category: MemoryCategory;
  content: string;
  source: 'agent' | 'human' | 'retro';
  createdBy: string; // agent id or user id
  relevanceScore: number; // 0..1
  tags: string[];
  createdAt: string;
  lastAccessedAt: string;
}

export interface ISharedMemoryStore {
  write(
    entry: Omit<SharedMemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt'>
  ): Promise<SharedMemoryEntry>;
  search(
    projectId: string,
    opts: { category?: MemoryCategory; tags?: string[]; limit?: number }
  ): Promise<SharedMemoryEntry[]>;
  delete(id: string): Promise<void>;
  evictLru(projectId: string, maxEntries: number): Promise<number>;
}
```

## Database Changes

New table `remote_agent_shared_memory`:

| Column             | Type                   | Notes            |
| ------------------ | ---------------------- | ---------------- |
| `id`               | UUID PK                |                  |
| `project_id`       | UUID FK `codebases.id` | cascade delete   |
| `epic_id`          | UUID NULL              | optional scope   |
| `key`              | TEXT                   | dedupe           |
| `category`         | TEXT                   | CHECK constraint |
| `content`          | TEXT                   |                  |
| `source`           | TEXT                   |                  |
| `created_by`       | TEXT                   |                  |
| `relevance_score`  | REAL                   | default 0.5      |
| `tags`             | JSONB / TEXT (sqlite)  |                  |
| `created_at`       | TIMESTAMPTZ            |                  |
| `last_accessed_at` | TIMESTAMPTZ            |                  |

Unique index: `(project_id, key)`. Secondary index: `(project_id, last_accessed_at DESC)` for LRU.

## Tests Required

- `packages/core/src/services/shared-memory.test.ts`: write, dedupe upsert, LRU evicts oldest, search by category+tags
- `packages/server/src/routes/shared-memory.test.ts`: 200/400/404 paths, Zod validation
- `packages/providers/src/tools/shared-memory-tool.test.ts`: tool correctly calls store; fails cleanly when `projectId` missing

## Acceptance Criteria

- [ ] Agent can call `write_shared_memory` tool and entry appears via `GET /api/projects/:id/memory`
- [ ] Writing the same `(projectId, key)` updates the existing row (no duplicates)
- [ ] Inserting the 501st entry evicts the least-recently-accessed entry for that project
- [ ] UI lists, filters by category, edits content, and deletes entries
- [ ] `bun run validate` green (type-check, lint, format, tests)
