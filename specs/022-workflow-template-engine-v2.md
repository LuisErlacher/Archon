# Spec 022 — Workflow Template Engine v2 (DB-driven)

**Issue:** #21
**Batch:** 8
**Prereqs:** 005 (workflow storage)
**Estimated effort:** L
**Implementation Risk:** MEDIUM — cross-cutting change to workflow loading + UI; backward compatibility with YAML-on-disk must be preserved.

## Goal

Move workflow templates from YAML-on-disk to DB-backed `workflow_templates` with a versioned state machine (states, transitions, quality gates, agent roles). BMAD ships as the default seeded template. A visual ReactFlow builder edits templates bidirectionally.

## Scope

**In:**

- `workflow_templates` table with versioning.
- CRUD API for templates.
- BMAD seeded at startup if missing.
- Per-project quality-gate config (additive-only: can require more, never less — enforced in validator).
- Marco 0 UI: simplified list editor; full ReactFlow builder tracked as follow-up inside same spec's milestones.
- Agent-facing tool: `template.update` validated via Zod; direct DB/file edits forbidden.

**Out:**

- External platform mapping (spec 024).
- Live preview of running workflows against a template diff.
- Rollback of in-flight stories to a prior template version.

## Files to Create / Modify

- `packages/workflows/src/templates/schema.ts` — Zod schemas for template model.
- `packages/workflows/src/templates/store.ts` — `IWorkflowTemplateStore`.
- `packages/workflows/src/templates/validator.ts` — additive-only gate check.
- `packages/workflows/src/templates/seed-bmad.ts` — default template.
- `packages/server/src/routes/workflow-templates.ts` — CRUD routes.
- `packages/server/src/routes/schemas/workflow-template.schemas.ts`.
- `packages/web/src/routes/WorkflowTemplatesPage.tsx`.
- `packages/web/src/components/workflow-templates/TemplateListEditor.tsx`.
- `migrations/009_workflow_templates.sql` + SQLite equivalent.

## New Interfaces / Types

```ts
export const workflowStateSchema = z.object({
  id: z.string(), // "in-progress"
  label: z.string(),
  terminal: z.boolean().default(false),
});

export const workflowTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  qualityGates: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['tests', 'lint', 'coverage', 'custom']),
      params: z.record(z.unknown()).default({}),
      blocking: z.boolean().default(true),
    })
  ),
  agentRole: z.string().optional(),
  requiresHumanApproval: z.boolean().default(false),
});

export const workflowTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  version: z.number().int().positive(),
  states: z.array(workflowStateSchema),
  transitions: z.array(workflowTransitionSchema),
  metadata: z.record(z.unknown()).default({}),
});
```

## Database Changes

New table `workflow_templates`:

- `id UUID PK`
- `name TEXT NOT NULL`
- `version INT NOT NULL`
- `definition JSONB NOT NULL` -- serialized `workflowTemplateSchema`
- `created_at`, `updated_at`
- UNIQUE (`name`, `version`)

Extend `workflow_runs`:

- `template_id UUID NULL`
- `template_version INT NULL`

## Tests Required

- Unit: schema validation (invalid transitions rejected).
- Unit: additive-only validator — removing a gate on upgrade rejected; adding allowed.
- Unit: BMAD seeder idempotent.
- Integration: create → list → update (creates new version) → run links to version.
- Migration: existing YAML workflows still load and run unchanged.

## Acceptance Criteria

- Fresh install auto-seeds BMAD template.
- `PUT /api/workflow-templates/:id` creates a new version, never mutates prior.
- Validator rejects gate-removal with a clear error message referencing FR54.
- List editor UI can add/remove states and transitions and persists via API.
- Workflow runs record `template_id` and `template_version` for audit.
- Existing YAML workflow execution path unchanged (no regression).
