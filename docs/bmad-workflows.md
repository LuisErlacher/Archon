# BMAD Workflows — Authoring Guide

This guide covers the six BMAD (Build-Measure-Analyze-Deploy) methodology workflows bundled with Archon. Each workflow is a DAG-based YAML definition that orchestrates AI agents through structured software development phases.

## Overview

| Workflow | Purpose | Nodes | Provider |
|---|---|---|---|
| `archon-bmad-create-story` | Story creation with acceptance criteria | 2 | Default |
| `archon-bmad-dev-story` | Implementation with deterministic gates | 6 | Claude |
| `archon-bmad-code-review` | Adversarial code review | 3 | Claude + Codex |
| `archon-bmad-qa-review` | QA with test execution gates | 4 | Default |
| `archon-bmad-full-cycle` | Full lifecycle for one story | 6 | Claude + Codex |
| `archon-bmad-epic-orchestrator` | Multi-story epic sequencing | 3 | Claude |

## Quick Start

```bash
# Create a story from a specification
bun run cli workflow run archon-bmad-create-story "Add user authentication"

# Implement a story (reads from $ARTIFACTS_DIR/story.md)
bun run cli workflow run archon-bmad-dev-story

# Run adversarial code review
bun run cli workflow run archon-bmad-code-review

# Run QA review
bun run cli workflow run archon-bmad-qa-review

# Full cycle: create → implement → review → QA
bun run cli workflow run archon-bmad-full-cycle "Add user authentication"

# Epic: process multiple stories from epic.json
bun run cli workflow run archon-bmad-epic-orchestrator
```

## Key Concepts

### Artifact Handoff (`$ARTIFACTS_DIR`)

All BMAD workflows use `$ARTIFACTS_DIR` for inter-phase artifact handoff. Each workflow run gets a unique artifacts directory at `~/.archon/workspaces/owner/repo/artifacts/runs/{run-id}/`.

**Standard artifacts:**

| Artifact | Produced by | Consumed by |
|---|---|---|
| `story.md` | create-story | dev-story, qa-review |
| `impl-summary.md` | dev-story | code-review |
| `review.md` | code-review | full-cycle (qa-review) |
| `review-summary.md` | code-review | — |
| `qa-report.md` | qa-review | — |
| `epic.json` | User (pre-placed) | epic-orchestrator |
| `epic-progress.json` | epic-orchestrator | epic-orchestrator (loop) |
| `epic-summary.md` | epic-orchestrator | — |

### Deterministic Gates (Bash Nodes)

Gate nodes use bash scripts with exit codes — no AI involved. This ensures deterministic pass/fail decisions based on real tool output.

```yaml
- id: gate-test
  depends_on: [implement]
  bash: bun run test 2>&1; exit $?
```

**Gate behavior:**
- Exit code 0 → gate passes, downstream nodes execute
- Exit code non-zero → gate fails, triggers retry or stops

**Available gates:**
- **test**: `bun run test`
- **lint**: `bun run lint`
- **typecheck**: `bun run type-check`
- **coverage**: Parses coverage output for threshold enforcement

### Loop + until_bash Pattern

The `loop` node with `until_bash` enables auto-retry cycles. The agent fixes code, then the gate re-runs automatically.

```yaml
- id: fix-and-retry
  depends_on: [gate-test, gate-lint, gate-typecheck]
  trigger_rule: one_success
  loop:
    prompt: |
      Some gates failed. Fix the issues found by the gate checks.
    until: ALL_GATES_PASSED
    max_iterations: 5
    until_bash: |
      bun run test 2>&1 && bun run lint 2>&1 && bun run type-check 2>&1
```

**Parameters:**
- `max_iterations`: Safety limit (5 for dev-story, 20 for epic-orchestrator)
- `until_bash`: Bash script that exits 0 when the loop should stop
- `fresh_context`: Clears conversation history each iteration (used in epic-orchestrator)

### Provider Overrides

BMAD workflows use per-node `provider:` overrides to leverage different AI providers for specific phases:

```yaml
# Workflow-level default
provider: claude

nodes:
  # This node uses Codex instead of Claude
  - id: review-code
    provider: codex
    prompt: Perform an adversarial code review...
```

**Why Codex for code review:** The adversarial review benefits from a different AI perspective, reducing blind spots from the same model that wrote the code.

## Workflow Details

### archon-bmad-create-story

Creates a well-scoped user story with acceptance criteria and scope bounds.

**Nodes:**
1. `write-story` — AI writes story.md with AC and scope bounds (uses `skills: [bmad-story-writing]`)
2. `validate-scope` — Bash gate verifies story.md has required sections

**Input:** `$ARGUMENTS` (specification or feature description)
**Output:** `$ARTIFACTS_DIR/story.md`

### archon-bmad-dev-story

Implements a story with deterministic test, lint, and typecheck gates.

**Nodes:**
1. `implement` — AI reads story.md and implements acceptance criteria
2. `gate-test` — Bash gate runs `bun run test`
3. `gate-lint` — Bash gate runs `bun run lint`
4. `gate-typecheck` — Bash gate runs `bun run type-check`
5. `fix-and-retry` — Loop node for auto-retry when gates fail
6. `commit-results` — AI writes implementation summary

**Input:** `$ARTIFACTS_DIR/story.md`
**Output:** `$ARTIFACTS_DIR/impl-summary.md`

**Gate concurrency:** gate-test, gate-lint, and gate-typecheck run in parallel (all depend on `implement`, not each other).

### archon-bmad-code-review

Adversarial code review using Codex provider for an independent second opinion.

**Nodes:**
1. `review-code` — Codex performs adversarial review (security, performance, correctness)
2. `summarize-review` — Claude creates actionable summary with priorities
3. `validate-review` — Bash gate verifies review artifacts exist

**Input:** Current git branch changes
**Output:** `$ARTIFACTS_DIR/review.md`, `$ARTIFACTS_DIR/review-summary.md`

### archon-bmad-qa-review

QA review with real test execution and coverage gates.

**Nodes:**
1. `write-qa-tests` — AI writes comprehensive QA tests from story.md
2. `gate-tests-pass` — Bash gate runs `bun run test`
3. `gate-coverage` — Bash gate checks coverage ≥ 80%
4. `qa-report` — AI writes QA summary report

**Input:** `$ARTIFACTS_DIR/story.md`
**Output:** `$ARTIFACTS_DIR/qa-report.md`

### archon-bmad-full-cycle

Orchestrates the complete BMAD lifecycle for a single story in one workflow run.

**Nodes:**
1. `create-story` — Creates story from `$ARGUMENTS`
2. `implement` — Implements acceptance criteria
3. `gate-test` — Bash gate for tests
4. `code-review` — Codex adversarial review
5. `qa-review` — QA verification
6. `gate-qa` — Final bash gate

**Input:** `$ARGUMENTS` (feature description)
**Output:** `$ARTIFACTS_DIR/story.md`, `review.md`, `qa-report.md`

### archon-bmad-epic-orchestrator

Sequences multiple stories within an epic. Uses `interactive: true` for foreground execution.

**Nodes:**
1. `init-epic` — Reads epic.json manifest, initializes progress tracking
2. `process-stories` — Loop node iterating over stories with `fresh_context: true`
3. `epic-summary` — Creates epic-level summary

**Input:** `$ARTIFACTS_DIR/epic.json` (pre-placed by user)
**Output:** `$ARTIFACTS_DIR/epic-progress.json`, `$ARTIFACTS_DIR/epic-summary.md`

**Epic manifest format:**
```json
{
  "stories": [
    { "id": "S001", "title": "Add authentication", "status": "pending" },
    { "id": "S002", "title": "Add authorization", "status": "pending" }
  ]
}
```

## Composing Workflows

### Single story
```
archon-bmad-full-cycle → complete lifecycle for one story
```

### Individual phases
```
archon-bmad-create-story → archon-bmad-dev-story → archon-bmad-code-review → archon-bmad-qa-review
```

### Multi-story epic
```
archon-bmad-epic-orchestrator → processes each story through full cycle
```

## Writing Custom BMAD Workflows

Follow these conventions when creating new BMAD-compatible workflows:

1. **Always use `$ARTIFACTS_DIR`** for intermediate artifacts
2. **Use bash gates** for deterministic pass/fail decisions (not AI judgment)
3. **Set `exit $?`** to propagate exit codes from commands
4. **Use `loop` + `until_bash`** for auto-retry patterns
5. **Use `provider: codex`** for adversarial/review nodes
6. **Set `interactive: true`** for workflows that need human approval gates
7. **Use `fresh_context: true`** in loop nodes to prevent context overflow on long iterations
