# Spec 017 — Automatic Agent Team Configuration by Stack

**Issue:** #26
**Batch:** 6
**Prereqs:** 013
**Estimated effort:** M

## Goal

Once codebase discovery (spec 013) confirms a stack, auto-configure the agent team used by default workflows: Scrum Master (orchestration), Team Lead, and per-role Workers (dev, reviewer, QA). Each role receives (a) pre-loaded skills filtered by `stackTag` (from spec 012), (b) a cost-appropriate model, and (c) a role-specific `ContextPayload` (project context + skills + memory). Overridable per workflow.

## Scope

**In:**

- `TeamConfigResolver` that maps `DetectedStack` → `TeamConfig`
- Default mappings for common stacks (Node+React, Python+FastAPI, Go, Rust, Next.js)
- Role → model mapping (fast model for classification/routing, capable model for implementation)
- `ContextPayload` builder: project context + filtered skills + relevant memory
- API to view and override team config per project and per workflow
- UI page showing the resolved team with per-role model + skill list

**Out:**

- Automatic model benchmarking (static mapping in v1)
- Dynamic team resizing mid-run
- Fine-tuned per-file agent assignment (out of scope — DAG already expresses this)

## Files to Create / Modify

### Create

| Path                                                        | Purpose                                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| `packages/core/src/services/team-config/resolver.ts`        | `resolve(stack, overrides)`              |
| `packages/core/src/services/team-config/defaults.ts`        | Stack → TeamConfig presets               |
| `packages/core/src/services/team-config/context-builder.ts` | Build `ContextPayload` per role          |
| `packages/server/src/routes/schemas/team-config.schemas.ts` | Zod                                      |
| `packages/server/src/routes/team-config.ts`                 | `GET/PUT /api/codebases/:id/team-config` |
| `packages/web/src/routes/TeamConfigPage.tsx`                | View + edit resolved team                |
| `migrations/011_team_config.sql` + sqlite                   | Adds `codebases.team_config JSONB`       |

### Modify

| Path                                            | Change                                                          |
| ----------------------------------------------- | --------------------------------------------------------------- | ---------- | ---- | ----------- | ----- |
| `packages/workflows/src/executor.ts`            | When node declares `role:`, load `ContextPayload` from resolver |
| `packages/workflows/src/schemas/dag-node.ts`    | Add optional `role: 'dev'                                       | 'reviewer' | 'qa' | 'team_lead' | 'sm'` |
| `packages/core/src/services/skills/resolver.ts` | Accept `role` filter (already in spec 012 interface)            |
| `packages/core/src/services/discovery/index.ts` | On confirm, invoke team-config resolver to seed default         |

## New Interfaces / Types

```ts
export type AgentRole = 'sm' | 'team_lead' | 'dev' | 'reviewer' | 'qa';

export interface RoleConfig {
  providerId: string; // 'claude' | 'codex' | 'pi-ai:openai' | ...
  model: string; // e.g. 'sonnet', 'gpt-5.3-codex'
  maxSkills: number; // budget for SkillResolver
  additionalInstructions?: string;
}

export interface TeamConfig {
  roles: Record<AgentRole, RoleConfig>;
  autoResolvedFromStack: boolean;
  version: number;
}

export interface ContextPayload {
  projectContext: string; // from spec 013
  skills: Skill[]; // from spec 012
  memoryEntries: SharedMemoryEntry[]; // from spec 011, top-N by relevance
  role: AgentRole;
}

export interface ITeamConfigResolver {
  resolve(input: { stack: DetectedStack; overrides?: Partial<TeamConfig> }): TeamConfig;
}
```

## Database Changes

- `codebases.team_config JSONB NULL` (SQLite: TEXT JSON)

No new tables. `team_config` is a per-project document.

## Tests Required

- `team-config/defaults.test.ts`: every preset stack produces valid `TeamConfig` (all 5 roles populated)
- `team-config/resolver.test.ts`: overrides merge correctly; unknown stack falls back to `generic` preset
- `context-builder.test.ts`: context size bounded; skills filtered by role; memory trimmed to top N
- `routes/team-config.test.ts`: GET returns resolved config; PUT validates and persists
- `workflows/executor.test.ts`: node with `role: 'reviewer'` receives reviewer `ContextPayload`

## Acceptance Criteria

- [ ] Confirming discovery (spec 013) seeds a default `team_config` on the project
- [ ] Each of the 5 roles has a provider + model assigned
- [ ] Workflow node with `role:` loads matching skills (≤ `maxSkills`) and memory entries
- [ ] UI shows the resolved team; developer edits + saves override; override persists
- [ ] Workflow-level override (in YAML) wins over project-level config
- [ ] `bun run validate` green
