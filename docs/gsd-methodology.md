# GSD (Get-Shit-Done) Methodology Reference

Source: https://github.com/gsd-build/get-shit-done (v1.35.0)
Analyzed: 2026-04-13

## Core Concept

Spec-driven development que resolve "context rot" — degradação de qualidade conforme a context window enche. Usa artifacts (PROJECT.md, ROADMAP.md, STATE.md) como estado, não histórico de conversa.

## Development Flow

```
PRD/Idea → New Project (questioning) → ROADMAP.md (phases)
    ↓
For each Phase:
    Discuss → CONTEXT.md (decisions locked)
    Research → RESEARCH.md (4 parallel researchers)
    Plan → PLAN.md (planner + checker revision loop, max 3)
    Execute → SUMMARY.md (wave-based parallel, fresh context per executor)
    Code Review → REVIEW.md (+ auto-fix loop, max 3)
    Verify (UAT) → UAT.md (conversational testing)
    Ship → PR
    ↓
Transition → Update requirements, PROJECT.md evolution
Complete Milestone → Archive, tag, cleanup
New Milestone → Next ROADMAP.md
```

## Key Patterns for Archon

### 1. Four-Gate Taxonomy
| Gate | Purpose | Archon Equivalent |
|------|---------|-------------------|
| Pre-flight | Validate preconditions | `when:` conditions on nodes |
| Revision | Quality loop (max 3) | `loop:` node with `until_bash` + `max_iterations: 3` |
| Escalation | Human judgment needed | `approval:` node |
| Abort | Stop if continuing is harmful | Gate with `severity: p0` (blocker) |

### 2. Wave-Based Parallel Execution
Plans have `depends_on` → compute dependency graph → group into waves.
Independent plans run in parallel (fresh context each), dependent plans wait.
**Maps to:** Archon DAG `depends_on` + topological layer execution (already exists).

### 3. Revision Loop with Stall Detection
Plan-checker loops max 3x. If issue count doesn't decrease → escalate (don't loop forever).
**Maps to:** `loop:` node with `max_iterations: 3` + `until_bash:` checking improvement.

### 4. Artifact-Based State (not conversation)
Each phase produces artifacts: CONTEXT.md, RESEARCH.md, PLAN.md, SUMMARY.md, REVIEW.md, UAT.md.
Next phase reads previous artifacts. No context accumulation.
**Maps to:** `$nodeId.output` variable substitution + `$ARTIFACTS_DIR` for file artifacts + `context: fresh` per node.

### 5. Spec-Driven Execution
Executor reads PLAN.md literally. Doesn't improvise.
**Maps to:** `command:` nodes with structured prompts that load plan files from `$ARTIFACTS_DIR`.

### 6. Nyquist Validation Layer
Before execution, map test coverage per requirement. Each task has `verify:` command.
**Maps to:** Quality gates with `type: test` parsing stdout for pass/fail per requirement.

## Simplified Archon Adaptation

The GSD flow can be expressed as Archon DAG workflows:

### Phase: PRD → Roadmap (one-time)
```yaml
# archon-prd-to-roadmap.yaml
nodes:
  - id: analyze-prd
    prompt: "Read docs/PRD.md, extract all FRs and phases. Output structured JSON..."
    output_format: {type: object, properties: {phases: {type: array}}}
  - id: create-roadmap
    prompt: "Create ROADMAP.md from phases: $analyze-prd.output..."
    depends_on: [analyze-prd]
```

### Phase: Execute One Feature (repeatable)
```yaml
# archon-gsd-feature.yaml — GSD-inspired feature dev workflow
nodes:
  - id: research
    prompt: "Research implementation approach for: $ARGUMENTS. Read codebase..."
    context: fresh
  - id: plan
    prompt: "Create detailed plan from research: $research.output..."
    depends_on: [research]
    context: fresh
  - id: plan-check
    loop:
      prompt: "Review plan quality. If issues found, revise. Signal COMPLETE when plan is solid."
      until: COMPLETE
      max_iterations: 3
    depends_on: [plan]
  - id: execute
    loop:
      prompt: "Implement next task from plan. Commit each task. Signal COMPLETE when all done."
      until: COMPLETE
      max_iterations: 15
      until_bash: "bun run type-check"
    depends_on: [plan-check]
    context: fresh
    gates:
      - name: typecheck
        command: "bun run type-check"
        severity: p0
      - name: lint
        command: "bun run lint"
        severity: p1
  - id: validate
    bash: "bun run validate"
    depends_on: [execute]
  - id: review
    prompt: "Adversarial code review of changes: git diff $BASE_BRANCH...HEAD"
    depends_on: [validate]
    context: fresh
    denied_tools: [Write, Edit]
  - id: fix-review
    prompt: "Fix CRITICAL/HIGH findings from review: $review.output"
    depends_on: [review]
    context: fresh
    when: "$review.output contains 'CRITICAL' or 'HIGH'"
  - id: ship
    prompt: "Create PR with description, gates passed, trail of decisions"
    depends_on: [fix-review]
    context: fresh
```

## Key Differences: GSD vs Archon

| Aspect | GSD | Archon |
|--------|-----|--------|
| Runtime | Claude Code skills/commands | Archon DAG workflow engine |
| State | .planning/ directory (ROADMAP.md, STATE.md) | DB (workflow_runs, node_states) + $ARTIFACTS_DIR |
| Agents | 31 specialized agents (markdown) | Single agent per node via SDK |
| Parallelism | Wave-based subagent spawning | DAG topological layers (built-in) |
| Gates | 4-type taxonomy (pre-flight/revision/escalation/abort) | Quality gates (p0/p1/p2) + approval nodes |
| Context | Fresh per agent (200K budget) | `context: fresh` per node (configurable) |
| Revision loops | plan-checker (max 3) with stall detection | `loop:` node with `max_iterations` + `until_bash` |
| Resume | HANDOFF.json + .continue-here.md | Workflow resume (skip completed nodes) |
