# Spec 012 — Skills System (Auto-Generation, Management, Evolution)

**Issue:** #13
**Batch:** 5
**Prereqs:** 011
**Estimated effort:** L

## Goal

Auto-generate, version, and serve reusable skills derived from (a) codebase patterns and (b) human corrections during agent runs. Skills are tagged by `stackTag` (backend/frontend/infra/test) and `roleTarget` (dev/reviewer/qa), carry a confidence score, and are filtered into agent context at execution time via a Skill Resolver. Distinct from shared memory (spec 011) — skills are persistent and cross-epic; memory is ephemeral.

## Scope

**In:**

- `Skill` model with stackTag, roleTarget, confidence, source, version, evolution log
- Auto-gen from patterns (post-discovery) and from human corrections (post-blocker)
- Skill-creator agent invoked by post-epic pipeline (spec 014 will call it)
- Skill Resolver: filters by stack + role + confidence, budgets max N skills per agent
- Web UI for CRUD + pending-review queue

**Out:**

- Skill execution / ML training loops
- Cross-project skill sharing (future)
- Automatic deprecation of skills (manual disable only in v1)

## Files to Create / Modify

### Create

| Path                                                             | Purpose                                            |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| `packages/core/src/db/skills.ts`                                 | CRUD for `remote_agent_skills` + `skill_evolution` |
| `packages/core/src/services/skills/resolver.ts`                  | `SkillResolver.resolve(ctx)` filter + priority     |
| `packages/core/src/services/skills/auto-gen-patterns.ts`         | Pattern-driven skill extraction                    |
| `packages/core/src/services/skills/auto-gen-corrections.ts`      | Correction-driven skill extraction                 |
| `packages/workflows/src/agents/skill-creator.ts`                 | Agent definition (runs via Claude provider)        |
| `packages/server/src/routes/schemas/skills.schemas.ts`           | Zod schemas                                        |
| `packages/server/src/routes/skills.ts`                           | REST API                                           |
| `packages/web/src/routes/SkillsPage.tsx`                         | Management UI (grouped by stack/role)              |
| `packages/web/src/components/skills/SkillCard.tsx`               | Card with confidence bar                           |
| `migrations/007_skills.sql` / `migrations/sqlite/007_skills.sql` | Schema                                             |

### Modify

| Path                                          | Change                                         |
| --------------------------------------------- | ---------------------------------------------- |
| `packages/workflows/src/executor.ts`          | Inject resolved skills into `ContextPayload`   |
| `packages/providers/src/claude/index.ts`      | Attach skills as `AgentDefinition` wrappers    |
| `packages/providers/src/codex/index.ts`       | Inject skills as system-prompt prelude         |
| `packages/core/src/services/shared-memory.ts` | Read lesson_learned entries for correction gen |

## New Interfaces / Types

```ts
export type StackTag = 'backend' | 'frontend' | 'infra' | 'test';
export type RoleTarget = 'dev' | 'reviewer' | 'qa';
export type SkillSource = 'pattern_detection' | 'human_correction' | 'retro';

export interface Skill {
  id: string;
  projectId: string;
  name: string;
  description: string;
  content: string; // markdown body injected into prompt
  stackTag: StackTag;
  roleTarget: RoleTarget;
  confidence: number; // 0..1
  source: SkillSource;
  version: number;
  status: 'active' | 'pending_review' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface SkillEvolution {
  id: string;
  skillId: string;
  fromVersion: number;
  toVersion: number;
  diff: string;
  reason: string;
  createdAt: string;
}

export interface SkillResolver {
  resolve(ctx: {
    projectId: string;
    stack: StackTag;
    role: RoleTarget;
    budget: number;
  }): Promise<Skill[]>;
}
```

## Database Changes

Table `remote_agent_skills` (columns: id, project_id, name, description, content, stack_tag, role_target, confidence, source, version, status, created_at, updated_at). Unique index `(project_id, name, version)`.

Table `remote_agent_skill_evolution` (id, skill_id FK, from_version, to_version, diff, reason, created_at).

Threshold constant: `SKILL_CONFIDENCE_THRESHOLD = 0.6` — below threshold `status = 'pending_review'`.

## Tests Required

- `skills/resolver.test.ts`: stack+role filter, priority (specific > generic, higher confidence first), budget cap
- `skills/auto-gen-patterns.test.ts`: given fixture project-context → generates expected skills
- `skills/auto-gen-corrections.test.ts`: human correction entry → skill with `source='human_correction'`
- `routes/skills.test.ts`: CRUD, status transitions, cannot delete active skill without disable first
- `workflows/executor.test.ts`: ensure resolved skills appear in `ContextPayload`

## Acceptance Criteria

- [ ] New project triggers pattern-based skill auto-gen after discovery (spec 013)
- [ ] Human correction during a run produces a skill entry with `pending_review` when confidence < 0.6
- [ ] Workflow execution logs show `skills.resolved_completed` with resolved IDs
- [ ] Skill version increments on edit and evolution log entry is written
- [ ] UI shows confidence bars, source, evolution history; supports disable/delete
- [ ] `bun run validate` green
