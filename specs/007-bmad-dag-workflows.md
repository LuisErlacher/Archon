# Spec 007 — BMAD Workflows as Archon DAGs

**Issue:** #9
**Batch:** 3
**Prereqs:** spec 003, spec 004, spec 005, spec 006
**Estimated effort:** L

## Goal

Implement the BMAD methodology (brainstorming → PRD → architecture → epics → dev-story → code-review → qa-review → retrospective) as a set of Archon DAG workflow YAML files stored under `.archon/workflows/defaults/`. Each phase uses deterministic gate nodes that parse real stdout (tests, lint, typecheck) rather than trusting agent claims. Skills are preloaded via AgentDefinition wrapping where Claude is used. Maps to PRD FR4, FR9-FR15.

## Scope

### In scope

- 6 workflow YAML files (create-story, dev-story, code-review, qa-review, full-cycle, epic-orchestrator)
- Gate nodes for deterministic phase transitions (bash/script nodes parsing tool output)
- Skill preloading via per-node `skills:` for Claude
- Per-node `provider` overrides (e.g. Codex for code-review adversarial pass)
- Artifact handoff between phases via `$ARTIFACTS_DIR`

### Out of scope

- New workflow engine primitives (rely on existing DAG features)
- Skill authoring (assumes skills from spec 006 exist)
- Epic-level orchestration logic beyond YAML composition (see spec 009)

## Files to Create

| Path                                                            | Purpose                                             |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `.archon/workflows/defaults/archon-bmad-create-story.yaml`      | Story creation with AC + scope bounds               |
| `.archon/workflows/defaults/archon-bmad-dev-story.yaml`         | Implementation with test/lint gates                 |
| `.archon/workflows/defaults/archon-bmad-code-review.yaml`       | Adversarial review (opposite provider)              |
| `.archon/workflows/defaults/archon-bmad-qa-review.yaml`         | QA with real test execution                         |
| `.archon/workflows/defaults/archon-bmad-full-cycle.yaml`        | Orchestrates all phases for one story               |
| `.archon/workflows/defaults/archon-bmad-epic-orchestrator.yaml` | Sequences stories within an epic                    |
| `docs/bmad-workflows.md`                                        | Workflow authoring guide (inputs, artifacts, gates) |

## Files to Modify

| Path                                       | Change                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `packages/workflows/src/defaults/index.ts` | Register new bundled workflow files                            |
| `packages/workflows/src/validator.ts`      | Validate referenced skill directories exist when `skills:` set |

## New Interfaces / Types

No new TypeScript interfaces. Workflows use existing `DagNode` schema with node types: `prompt`, `command`, `bash`, `script`, `approval`, `loop`.

Gate node convention (bash/script):

```yaml
- id: tests-gate
  type: bash
  depends_on: [implement]
  script: |
    bun test 2>&1 | tee $ARTIFACTS_DIR/test.log
    grep -q "fail" $ARTIFACTS_DIR/test.log && exit 1 || exit 0
```

## Database Changes

None. Uses existing `workflow_runs` and `workflow_events` tables.

## Tests Required

- YAML load/validate each workflow via `parseWorkflow()` (unit)
- `loader.test.ts` cases asserting DAG structure (no cycles, required depends_on chains)
- Integration: run `archon-bmad-create-story` end-to-end against a fixture repo, assert artifact file produced
- Validator test: workflow referencing missing skill fails load with clear error

## Acceptance Criteria

- [ ] All 6 YAML files load without errors via `bun run cli validate workflows`
- [ ] `archon-bmad-full-cycle` runs end-to-end on a small fixture task, producing story.md → impl → review → qa artifacts
- [ ] Gate nodes fail the workflow when tests/lint fail (verified by test fixture with intentional failure)
- [ ] Code-review phase uses a different provider than dev-story (via per-node `provider:` override)
- [ ] Skills listed in `skills:` are preloaded; workflow fails if skill dir missing
- [ ] `GET /api/workflows` lists all 6 with `source: "bundled"`
