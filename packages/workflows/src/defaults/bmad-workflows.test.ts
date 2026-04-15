/**
 * Unit tests for BMAD (Build-Measure-Analyze-Deploy) workflow YAML parsing,
 * gate node structure/exit-code logic, and per-node provider override validation.
 *
 * Tasks: T-001, T-003, T-004
 *
 * Tests use inline YAML strings that represent the expected BMAD workflow
 * structures. The actual YAML files are created by impl tasks I-001..I-006.
 */
import { describe, it, expect, mock } from 'bun:test';

// Inline mock logger to suppress noisy output during tests
const mockLogger = {
  fatal: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  info: mock(() => undefined),
  debug: mock(() => undefined),
  trace: mock(() => undefined),
  child: mock(function () {
    return mockLogger;
  }),
  bindings: mock(() => ({ module: 'test' })),
  isLevelEnabled: mock(() => true),
  level: 'info',
};

// Mock @archon/paths: suppress logger + pass through real path/build utilities
const realArchonPaths = await import('@archon/paths');
mock.module('@archon/paths', () => ({
  ...realArchonPaths,
  createLogger: mock(() => mockLogger),
}));

// Bootstrap provider registry (needed by isModelCompatible in dag-node schema)
import { registerBuiltinProviders, clearRegistry } from '@archon/providers';
clearRegistry();
registerBuiltinProviders();

import { parseWorkflow } from '../loader';
import {
  isBashNode,
  isLoopNode,
  isApprovalNode,
  isPromptNode,
  isCommandNode,
  type DagNode,
} from '../schemas';

// ---------------------------------------------------------------------------
// Inline BMAD workflow YAML definitions (representative of impl I-001..I-006)
// ---------------------------------------------------------------------------

/** archon-bmad-create-story — story creation with AC + scope bounds, skill preloading */
const BMAD_CREATE_STORY_YAML = `name: archon-bmad-create-story
description: |
  BMAD story creation phase. Creates a well-scoped user story with acceptance criteria,
  scope bounds, and testable requirements. Uses skill preloading for story conventions.
nodes:
  - id: write-story
    prompt: |
      Read the specification and create a user story.
      Write the story to $ARTIFACTS_DIR/story.md with acceptance criteria and scope bounds.
    skills: [bmad-story-writing]
  - id: validate-scope
    depends_on: [write-story]
    bash: |
      STORY="$ARTIFACTS_DIR/story.md"
      if [ ! -f "$STORY" ]; then echo "story.md not found"; exit 1; fi
      if ! grep -qi "acceptance criteria" "$STORY"; then echo "Missing acceptance criteria"; exit 1; fi
      if ! grep -qi "scope" "$STORY"; then echo "Missing scope bounds"; exit 1; fi
      echo "Story validated successfully"
`;

/** archon-bmad-dev-story — implementation with test/lint/typecheck gates, loop for auto-retry */
const BMAD_DEV_STORY_YAML = `name: archon-bmad-dev-story
description: |
  BMAD development phase. Implements a story with deterministic test, lint, and typecheck
  gate nodes. Uses bash nodes for gates and loop pattern for auto-retry on failures.
provider: claude
nodes:
  - id: implement
    prompt: |
      Read the story from $ARTIFACTS_DIR/story.md and implement all acceptance criteria.
      Write all code changes following the acceptance criteria.
  - id: gate-test
    depends_on: [implement]
    bash: bun run test 2>&1; exit $?
  - id: gate-lint
    depends_on: [implement]
    bash: bun run lint 2>&1; exit $?
  - id: gate-typecheck
    depends_on: [implement]
    bash: bun run type-check 2>&1; exit $?
  - id: fix-and-retry
    depends_on: [gate-test, gate-lint, gate-typecheck]
    trigger_rule: one_success
    loop:
      prompt: |
        Some gates failed. Read $ARTIFACTS_DIR/story.md and fix the issues found by the gate checks.
      until: ALL_GATES_PASSED
      max_iterations: 5
      until_bash: |
        bun run test 2>&1 && bun run lint 2>&1 && bun run type-check 2>&1
  - id: commit-results
    depends_on: [fix-and-retry]
    prompt: |
      All gates passed. Write a summary to $ARTIFACTS_DIR/impl-summary.md.
`;

/** archon-bmad-code-review — adversarial review with codex provider override */
const BMAD_CODE_REVIEW_YAML = `name: archon-bmad-code-review
description: |
  BMAD adversarial code review phase. Uses codex provider override for an adversarial
  second opinion. Writes review to $ARTIFACTS_DIR/review.md.
provider: claude
nodes:
  - id: review-code
    prompt: |
      Perform an adversarial code review of the changes in the current branch.
      Focus on security, performance, and correctness issues.
      Write the review to $ARTIFACTS_DIR/review.md.
    provider: codex
  - id: summarize-review
    depends_on: [review-code]
    prompt: |
      Read $ARTIFACTS_DIR/review.md and create an actionable summary with priorities.
      Write to $ARTIFACTS_DIR/review-summary.md.
  - id: validate-review
    depends_on: [summarize-review]
    bash: |
      if [ ! -f "$ARTIFACTS_DIR/review.md" ]; then echo "review.md missing"; exit 1; fi
      if [ ! -f "$ARTIFACTS_DIR/review-summary.md" ]; then echo "review-summary.md missing"; exit 1; fi
      echo "Review artifacts validated"
`;

/** archon-bmad-qa-review — QA with real test execution gates */
const BMAD_QA_REVIEW_YAML = `name: archon-bmad-qa-review
description: |
  BMAD QA review phase. Runs real tests and parses coverage.
  Uses bash gate nodes for deterministic quality checks.
nodes:
  - id: write-qa-tests
    prompt: |
      Read $ARTIFACTS_DIR/story.md and write comprehensive QA tests for all acceptance criteria.
  - id: gate-tests-pass
    depends_on: [write-qa-tests]
    bash: bun run test 2>&1; exit $?
  - id: gate-coverage
    depends_on: [write-qa-tests]
    bash: |
      bun run test --coverage 2>&1 | grep -oE '[0-9]+%' | head -1 | grep -qE '^[89][0-9]%|100%' || exit 1
      echo "Coverage gate passed"
  - id: qa-report
    depends_on: [gate-tests-pass, gate-coverage]
    prompt: |
      Write a QA report to $ARTIFACTS_DIR/qa-report.md summarizing test results and coverage.
`;

/** archon-bmad-full-cycle — orchestrates all BMAD phases for one story */
const BMAD_FULL_CYCLE_YAML = `name: archon-bmad-full-cycle
description: |
  BMAD full development cycle for a single story. Orchestrates story creation,
  implementation with gates, adversarial code review, and QA review phases in sequence.
provider: claude
nodes:
  - id: create-story
    prompt: |
      Create a user story for: $ARGUMENTS
      Write to $ARTIFACTS_DIR/story.md with acceptance criteria and scope bounds.
  - id: implement
    depends_on: [create-story]
    prompt: |
      Read $ARTIFACTS_DIR/story.md and implement all acceptance criteria.
  - id: gate-test
    depends_on: [implement]
    bash: bun run test 2>&1; exit $?
  - id: code-review
    depends_on: [gate-test]
    provider: codex
    prompt: |
      Perform adversarial code review of the implementation.
      Write to $ARTIFACTS_DIR/review.md.
  - id: qa-review
    depends_on: [code-review]
    prompt: |
      Read $ARTIFACTS_DIR/review.md and run QA verification.
      Write to $ARTIFACTS_DIR/qa-report.md.
  - id: gate-qa
    depends_on: [qa-review]
    bash: bun run test 2>&1; exit $?
`;

/** archon-bmad-epic-orchestrator — sequences stories within an epic via loop node */
const BMAD_EPIC_ORCHESTRATOR_YAML = `name: archon-bmad-epic-orchestrator
description: |
  BMAD epic orchestrator. Sequences stories within an epic by reading
  an epic manifest from $ARTIFACTS_DIR/epic.json and iterating over stories.
provider: claude
interactive: true
nodes:
  - id: init-epic
    prompt: |
      Read the epic manifest from $ARTIFACTS_DIR/epic.json.
      Initialize progress tracking in $ARTIFACTS_DIR/epic-progress.json.
  - id: process-stories
    depends_on: [init-epic]
    loop:
      prompt: |
        Read $ARTIFACTS_DIR/epic.json to get the next story.
        Process the story through the full BMAD development cycle.
        Update $ARTIFACTS_DIR/epic-progress.json with the result.
      until: ALL_STORIES_COMPLETE
      max_iterations: 20
      fresh_context: true
      until_bash: |
        grep -q '"status":"complete"' "$ARTIFACTS_DIR/epic-progress.json" 2>/dev/null
  - id: epic-summary
    depends_on: [process-stories]
    prompt: |
      Read all story results from $ARTIFACTS_DIR/ and create an epic summary.
      Write to $ARTIFACTS_DIR/epic-summary.md.
`;

/** Map of all 6 BMAD workflow YAML strings for iteration */
const ALL_BMAD_WORKFLOWS: Record<string, string> = {
  'archon-bmad-create-story': BMAD_CREATE_STORY_YAML,
  'archon-bmad-dev-story': BMAD_DEV_STORY_YAML,
  'archon-bmad-code-review': BMAD_CODE_REVIEW_YAML,
  'archon-bmad-qa-review': BMAD_QA_REVIEW_YAML,
  'archon-bmad-full-cycle': BMAD_FULL_CYCLE_YAML,
  'archon-bmad-epic-orchestrator': BMAD_EPIC_ORCHESTRATOR_YAML,
};

// ===========================================================================
// T-001: Unit tests for BMAD workflow YAML parsing via parseWorkflow()
// ===========================================================================

describe('BMAD Workflows — T-001: YAML parsing via parseWorkflow()', () => {
  describe('all 6 BMAD workflows parse successfully', () => {
    for (const [name, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
      it(`should parse ${name} without errors`, () => {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        expect(result.error).toBeNull();
        expect(result.workflow).not.toBeNull();
      });
    }
  });

  describe('workflow metadata', () => {
    it('should have correct name for each BMAD workflow', () => {
      for (const [name, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        expect(result.workflow?.name).toBe(name);
      }
    });

    it('should have non-empty description for each BMAD workflow', () => {
      for (const [, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
        const result = parseWorkflow(yaml, 'test.yaml');
        expect(result.workflow?.description).toBeTruthy();
        expect(result.workflow!.description.length).toBeGreaterThan(10);
      }
    });

    it('should have at least 2 nodes in each BMAD workflow', () => {
      for (const [name, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        expect(result.workflow?.nodes.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('DAG structure validation', () => {
    it('should have unique node IDs in each workflow', () => {
      for (const [name, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        const ids = result.workflow!.nodes.map(n => n.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }
    });

    it('should have valid depends_on references in all nodes', () => {
      for (const [name, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        const allIds = new Set(result.workflow!.nodes.map(n => n.id));
        for (const node of result.workflow!.nodes) {
          for (const dep of node.depends_on ?? []) {
            expect(allIds.has(dep)).toBe(true);
          }
        }
      }
    });

    it('should not contain cycles in any workflow DAG', () => {
      // parseWorkflow already validates no cycles; if it parses without error, it's acyclic
      for (const [name, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        expect(result.error).toBeNull();
      }
    });
  });

  describe('node types', () => {
    it('create-story should have prompt and bash nodes', () => {
      const result = parseWorkflow(BMAD_CREATE_STORY_YAML, 'archon-bmad-create-story.yaml');
      const nodes = result.workflow!.nodes;

      const promptNodes = nodes.filter(n => isPromptNode(n));
      const bashNodes = nodes.filter(n => isBashNode(n));

      expect(promptNodes.length).toBeGreaterThanOrEqual(1);
      expect(bashNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('dev-story should have prompt, bash, and loop nodes', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const nodes = result.workflow!.nodes;

      const promptNodes = nodes.filter(n => isPromptNode(n));
      const bashNodes = nodes.filter(n => isBashNode(n));
      const loopNodes = nodes.filter(n => isLoopNode(n));

      expect(promptNodes.length).toBeGreaterThanOrEqual(1);
      expect(bashNodes.length).toBeGreaterThanOrEqual(3); // gate-test, gate-lint, gate-typecheck
      expect(loopNodes.length).toBe(1); // fix-and-retry
    });

    it('code-review should have prompt and bash nodes', () => {
      const result = parseWorkflow(BMAD_CODE_REVIEW_YAML, 'archon-bmad-code-review.yaml');
      const nodes = result.workflow!.nodes;

      expect(nodes.filter(n => isPromptNode(n)).length).toBeGreaterThanOrEqual(2);
      expect(nodes.filter(n => isBashNode(n)).length).toBeGreaterThanOrEqual(1);
    });

    it('qa-review should have prompt and bash gate nodes', () => {
      const result = parseWorkflow(BMAD_QA_REVIEW_YAML, 'archon-bmad-qa-review.yaml');
      const nodes = result.workflow!.nodes;

      expect(nodes.filter(n => isPromptNode(n)).length).toBeGreaterThanOrEqual(2);
      expect(nodes.filter(n => isBashNode(n)).length).toBeGreaterThanOrEqual(2); // tests + coverage
    });

    it('full-cycle should have prompt and bash nodes in pipeline', () => {
      const result = parseWorkflow(BMAD_FULL_CYCLE_YAML, 'archon-bmad-full-cycle.yaml');
      const nodes = result.workflow!.nodes;

      expect(nodes.filter(n => isPromptNode(n)).length).toBeGreaterThanOrEqual(4);
      expect(nodes.filter(n => isBashNode(n)).length).toBeGreaterThanOrEqual(2); // gate-test + gate-qa
    });

    it('epic-orchestrator should have prompt and loop nodes', () => {
      const result = parseWorkflow(
        BMAD_EPIC_ORCHESTRATOR_YAML,
        'archon-bmad-epic-orchestrator.yaml'
      );
      const nodes = result.workflow!.nodes;

      expect(nodes.filter(n => isPromptNode(n)).length).toBeGreaterThanOrEqual(2);
      expect(nodes.filter(n => isLoopNode(n)).length).toBe(1); // process-stories
    });
  });

  describe('$ARTIFACTS_DIR references', () => {
    it('all BMAD workflows should reference $ARTIFACTS_DIR in at least one node', () => {
      for (const [name, yaml] of Object.entries(ALL_BMAD_WORKFLOWS)) {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        const nodes = result.workflow!.nodes;

        const hasArtifactsRef = nodes.some(node => {
          if (isBashNode(node) && node.bash.includes('$ARTIFACTS_DIR')) return true;
          if (isPromptNode(node) && node.prompt.includes('$ARTIFACTS_DIR')) return true;
          if (isLoopNode(node) && node.loop.prompt.includes('$ARTIFACTS_DIR')) return true;
          return false;
        });

        expect(hasArtifactsRef).toBe(true);
      }
    });

    it('create-story should reference $ARTIFACTS_DIR/story.md', () => {
      const result = parseWorkflow(BMAD_CREATE_STORY_YAML, 'archon-bmad-create-story.yaml');
      const promptNode = result.workflow!.nodes.find(n => isPromptNode(n));
      expect(promptNode).toBeDefined();
      expect((promptNode as { prompt: string }).prompt).toContain('$ARTIFACTS_DIR/story.md');
    });

    it('dev-story bash gates should reference bun commands', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const bashNodes = result.workflow!.nodes.filter(n => isBashNode(n)) as Array<{
        id: string;
        bash: string;
      }>;

      const bashContent = bashNodes.map(n => n.bash).join('\n');
      expect(bashContent).toContain('bun run test');
      expect(bashContent).toContain('bun run lint');
      expect(bashContent).toContain('bun run type-check');
    });
  });

  describe('edge cases', () => {
    it('should reject BMAD workflow YAML missing name', () => {
      const invalidYaml = `description: Missing name
nodes:
  - id: test
    prompt: test
`;
      const result = parseWorkflow(invalidYaml, 'invalid.yaml');
      expect(result.error).not.toBeNull();
      expect(result.error?.error).toContain('name');
    });

    it('should reject BMAD workflow YAML missing description', () => {
      const invalidYaml = `name: missing-desc
nodes:
  - id: test
    prompt: test
`;
      const result = parseWorkflow(invalidYaml, 'invalid.yaml');
      expect(result.error).not.toBeNull();
      expect(result.error?.error).toContain('description');
    });

    it('should reject BMAD workflow YAML with missing nodes', () => {
      const invalidYaml = `name: no-nodes
description: No nodes field
`;
      const result = parseWorkflow(invalidYaml, 'invalid.yaml');
      expect(result.error).not.toBeNull();
      expect(result.error?.error).toContain('nodes');
    });

    it('should reject BMAD workflow YAML with duplicate node IDs', () => {
      const invalidYaml = `name: dup-ids
description: Duplicate IDs
nodes:
  - id: dup
    prompt: first
  - id: dup
    prompt: second
`;
      const result = parseWorkflow(invalidYaml, 'invalid.yaml');
      expect(result.error).not.toBeNull();
      expect(result.error?.error).toContain('Duplicate');
    });

    it('should reject BMAD workflow YAML with invalid depends_on reference', () => {
      const invalidYaml = `name: bad-dep
description: Invalid depends_on
nodes:
  - id: step1
    prompt: first
  - id: step2
    prompt: second
    depends_on: [nonexistent]
`;
      const result = parseWorkflow(invalidYaml, 'invalid.yaml');
      expect(result.error).not.toBeNull();
      expect(result.error?.error).toContain('unknown node');
    });

    it('should reject BMAD workflow YAML with cycle in depends_on', () => {
      const invalidYaml = `name: cycle
description: Has a cycle
nodes:
  - id: a
    prompt: a
    depends_on: [b]
  - id: b
    prompt: b
    depends_on: [a]
`;
      const result = parseWorkflow(invalidYaml, 'invalid.yaml');
      expect(result.error).not.toBeNull();
      expect(result.error?.error).toContain('Cycle');
    });
  });
});

// ===========================================================================
// T-003: Unit tests for BMAD gate node structure and exit-code logic
// ===========================================================================

describe('BMAD Workflows — T-003: Gate node structure and exit-code logic', () => {
  describe('bash gate nodes are deterministic (no AI fields)', () => {
    it('dev-story gate nodes should not have AI-specific fields after parsing', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const bashNodes = result.workflow!.nodes.filter(n => isBashNode(n));

      for (const node of bashNodes) {
        // Bash nodes should not have AI fields after parsing (they're stripped)
        expect(node.provider).toBeUndefined();
        expect(node.model).toBeUndefined();
        expect(node.skills).toBeUndefined();
        expect(node.output_format).toBeUndefined();
        expect(node.allowed_tools).toBeUndefined();
        expect(node.denied_tools).toBeUndefined();
        expect(node.hooks).toBeUndefined();
        expect(node.mcp).toBeUndefined();
      }
    });

    it('qa-review gate nodes should not have AI-specific fields after parsing', () => {
      const result = parseWorkflow(BMAD_QA_REVIEW_YAML, 'archon-bmad-qa-review.yaml');
      const bashNodes = result.workflow!.nodes.filter(n => isBashNode(n));

      for (const node of bashNodes) {
        expect(node.provider).toBeUndefined();
        expect(node.model).toBeUndefined();
        expect(node.skills).toBeUndefined();
        expect(node.output_format).toBeUndefined();
      }
    });

    it('code-review validate-review node should not have AI-specific fields after parsing', () => {
      const result = parseWorkflow(BMAD_CODE_REVIEW_YAML, 'archon-bmad-code-review.yaml');
      const validateNode = result.workflow!.nodes.find(n => n.id === 'validate-review');
      expect(validateNode).toBeDefined();
      expect(isBashNode(validateNode!)).toBe(true);

      if (isBashNode(validateNode!)) {
        expect(validateNode.provider).toBeUndefined();
        expect(validateNode.model).toBeUndefined();
        expect(validateNode.skills).toBeUndefined();
      }
    });

    it('full-cycle gate nodes should not have AI-specific fields after parsing', () => {
      const result = parseWorkflow(BMAD_FULL_CYCLE_YAML, 'archon-bmad-full-cycle.yaml');
      const bashNodes = result.workflow!.nodes.filter(n => isBashNode(n));

      for (const node of bashNodes) {
        expect(node.provider).toBeUndefined();
        expect(node.model).toBeUndefined();
        expect(node.skills).toBeUndefined();
      }
    });
  });

  describe('$ARTIFACTS_DIR usage in bash gate scripts', () => {
    it('create-story validate-scope gate should reference $ARTIFACTS_DIR', () => {
      const result = parseWorkflow(BMAD_CREATE_STORY_YAML, 'archon-bmad-create-story.yaml');
      const validateNode = result.workflow!.nodes.find(n => n.id === 'validate-scope');
      expect(validateNode).toBeDefined();
      expect(isBashNode(validateNode!)).toBe(true);

      if (isBashNode(validateNode!)) {
        expect(validateNode.bash).toContain('$ARTIFACTS_DIR');
        expect(validateNode.bash).toContain('story.md');
      }
    });

    it('code-review validate-review gate should reference $ARTIFACTS_DIR', () => {
      const result = parseWorkflow(BMAD_CODE_REVIEW_YAML, 'archon-bmad-code-review.yaml');
      const validateNode = result.workflow!.nodes.find(n => n.id === 'validate-review');
      expect(validateNode).toBeDefined();

      if (isBashNode(validateNode!)) {
        expect(validateNode.bash).toContain('$ARTIFACTS_DIR');
        expect(validateNode.bash).toContain('review.md');
      }
    });

    it('qa-review coverage gate should parse coverage output', () => {
      const result = parseWorkflow(BMAD_QA_REVIEW_YAML, 'archon-bmad-qa-review.yaml');
      const coverageNode = result.workflow!.nodes.find(n => n.id === 'gate-coverage');
      expect(coverageNode).toBeDefined();

      if (isBashNode(coverageNode!)) {
        expect(coverageNode.bash).toContain('exit 1');
        expect(coverageNode.bash).toMatch(/coverage/i);
      }
    });
  });

  describe('exit code logic in bash gate scripts', () => {
    it('dev-story test gate should propagate exit code from test runner', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const gateTest = result.workflow!.nodes.find(n => n.id === 'gate-test');
      expect(gateTest).toBeDefined();

      if (isBashNode(gateTest!)) {
        // Exit code propagation: "command; exit $?" means exit 0 on pass, non-zero on fail
        expect(gateTest.bash).toContain('exit $?' as string);
      }
    });

    it('dev-story lint gate should propagate exit code from linter', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const gateLint = result.workflow!.nodes.find(n => n.id === 'gate-lint');
      expect(gateLint).toBeDefined();

      if (isBashNode(gateLint!)) {
        expect(gateLint.bash).toContain('exit $?');
      }
    });

    it('dev-story typecheck gate should propagate exit code', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const gateTypecheck = result.workflow!.nodes.find(n => n.id === 'gate-typecheck');
      expect(gateTypecheck).toBeDefined();

      if (isBashNode(gateTypecheck!)) {
        expect(gateTypecheck.bash).toContain('exit $?');
      }
    });

    it('create-story scope validation gate should exit 1 on missing artifacts', () => {
      const result = parseWorkflow(BMAD_CREATE_STORY_YAML, 'archon-bmad-create-story.yaml');
      const validateNode = result.workflow!.nodes.find(n => n.id === 'validate-scope');
      expect(validateNode).toBeDefined();

      if (isBashNode(validateNode!)) {
        expect(validateNode.bash).toContain('exit 1');
      }
    });

    it('qa-review coverage gate should exit 1 when coverage is below threshold', () => {
      const result = parseWorkflow(BMAD_QA_REVIEW_YAML, 'archon-bmad-qa-review.yaml');
      const gateCoverage = result.workflow!.nodes.find(n => n.id === 'gate-coverage');
      expect(gateCoverage).toBeDefined();

      if (isBashNode(gateCoverage!)) {
        expect(gateCoverage.bash).toContain('exit 1');
      }
    });
  });

  describe('dev-story has test/lint/typecheck gates', () => {
    it('should have gate-test, gate-lint, and gate-typecheck as separate bash nodes', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const nodeIds = result.workflow!.nodes.map(n => n.id);

      expect(nodeIds).toContain('gate-test');
      expect(nodeIds).toContain('gate-lint');
      expect(nodeIds).toContain('gate-typecheck');

      for (const gateId of ['gate-test', 'gate-lint', 'gate-typecheck']) {
        const node = result.workflow!.nodes.find(n => n.id === gateId)!;
        expect(isBashNode(node)).toBe(true);
      }
    });

    it('all gate nodes should depend on the implement node', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');

      for (const gateId of ['gate-test', 'gate-lint', 'gate-typecheck']) {
        const node = result.workflow!.nodes.find(n => n.id === gateId)!;
        expect(node.depends_on).toContain('implement');
      }
    });

    it('gate nodes should run concurrently (all depend on implement, not each other)', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');

      const gateIds = new Set(['gate-test', 'gate-lint', 'gate-typecheck']);
      for (const gateId of gateIds) {
        const node = result.workflow!.nodes.find(n => n.id === gateId)!;
        // Gate nodes should only depend on implement, not on other gates
        const nonImplementDeps = (node.depends_on ?? []).filter(d => d !== 'implement');
        const otherGateDeps = nonImplementDeps.filter(d => gateIds.has(d));
        expect(otherGateDeps).toHaveLength(0);
      }
    });
  });

  describe('loop + until_bash gate pattern', () => {
    it('dev-story fix-and-retry should be a loop node with until_bash', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const loopNode = result.workflow!.nodes.find(n => n.id === 'fix-and-retry');

      expect(loopNode).toBeDefined();
      expect(isLoopNode(loopNode!)).toBe(true);

      if (isLoopNode(loopNode!)) {
        expect(loopNode.loop.until_bash).toBeDefined();
        expect(loopNode.loop.until_bash).toContain('bun run test');
        expect(loopNode.loop.max_iterations).toBeGreaterThan(0);
      }
    });

    it('epic-orchestrator process-stories should be a loop node with until_bash', () => {
      const result = parseWorkflow(
        BMAD_EPIC_ORCHESTRATOR_YAML,
        'archon-bmad-epic-orchestrator.yaml'
      );
      const loopNode = result.workflow!.nodes.find(n => n.id === 'process-stories');

      expect(loopNode).toBeDefined();
      expect(isLoopNode(loopNode!)).toBe(true);

      if (isLoopNode(loopNode!)) {
        expect(loopNode.loop.until_bash).toBeDefined();
        expect(loopNode.loop.until_bash).toContain('$ARTIFACTS_DIR');
        expect(loopNode.loop.max_iterations).toBeGreaterThan(0);
      }
    });

    it('epic-orchestrator loop should use fresh_context', () => {
      const result = parseWorkflow(
        BMAD_EPIC_ORCHESTRATOR_YAML,
        'archon-bmad-epic-orchestrator.yaml'
      );
      const loopNode = result.workflow!.nodes.find(n => n.id === 'process-stories');

      if (isLoopNode(loopNode!)) {
        expect(loopNode.loop.fresh_context).toBe(true);
      }
    });
  });
});

// ===========================================================================
// T-004: Unit tests for per-node provider override validation in BMAD workflows
// ===========================================================================

describe('BMAD Workflows — T-004: Per-node provider override validation', () => {
  describe('code-review uses codex provider override', () => {
    it('code-review review-code node should have provider: codex', () => {
      const result = parseWorkflow(BMAD_CODE_REVIEW_YAML, 'archon-bmad-code-review.yaml');
      const reviewNode = result.workflow!.nodes.find(n => n.id === 'review-code');

      expect(reviewNode).toBeDefined();
      expect(reviewNode!.provider).toBe('codex');
    });

    it('code-review summarize-review node should not have explicit provider (inherits)', () => {
      const result = parseWorkflow(BMAD_CODE_REVIEW_YAML, 'archon-bmad-code-review.yaml');
      const summarizeNode = result.workflow!.nodes.find(n => n.id === 'summarize-review');

      expect(summarizeNode).toBeDefined();
      // No explicit per-node provider — inherits from workflow level (claude)
      expect(summarizeNode!.provider).toBeUndefined();
    });
  });

  describe('full-cycle has codex provider on code-review node', () => {
    it('full-cycle code-review node should have provider: codex', () => {
      const result = parseWorkflow(BMAD_FULL_CYCLE_YAML, 'archon-bmad-full-cycle.yaml');
      const codeReviewNode = result.workflow!.nodes.find(n => n.id === 'code-review');

      expect(codeReviewNode).toBeDefined();
      expect(codeReviewNode!.provider).toBe('codex');
    });

    it('full-cycle other prompt nodes should not have explicit provider', () => {
      const result = parseWorkflow(BMAD_FULL_CYCLE_YAML, 'archon-bmad-full-cycle.yaml');
      const nonReviewPromptNodes = result.workflow!.nodes.filter(
        n => isPromptNode(n) && n.id !== 'code-review'
      );

      for (const node of nonReviewPromptNodes) {
        expect(node.provider).toBeUndefined();
      }
    });
  });

  describe('dev-story inherits workflow-level provider', () => {
    it('dev-story should have workflow-level provider: claude', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      expect(result.workflow!.provider).toBe('claude');
    });

    it('dev-story prompt nodes should not have explicit per-node provider', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const promptNodes = result.workflow!.nodes.filter(n => isPromptNode(n));

      for (const node of promptNodes) {
        expect(node.provider).toBeUndefined();
      }
    });

    it('dev-story loop node should not have explicit per-node provider', () => {
      const result = parseWorkflow(BMAD_DEV_STORY_YAML, 'archon-bmad-dev-story.yaml');
      const loopNodes = result.workflow!.nodes.filter(n => isLoopNode(n));

      for (const node of loopNodes) {
        expect(node.provider).toBeUndefined();
      }
    });
  });

  describe('qa-review uses default provider', () => {
    it('qa-review should not have workflow-level provider specified', () => {
      const result = parseWorkflow(BMAD_QA_REVIEW_YAML, 'archon-bmad-qa-review.yaml');
      // No explicit provider — uses system default
      expect(result.workflow!.provider).toBeUndefined();
    });

    it('qa-review prompt nodes should not have explicit per-node provider', () => {
      const result = parseWorkflow(BMAD_QA_REVIEW_YAML, 'archon-bmad-qa-review.yaml');
      const promptNodes = result.workflow!.nodes.filter(n => isPromptNode(n));

      for (const node of promptNodes) {
        expect(node.provider).toBeUndefined();
      }
    });
  });

  describe('provider/model compatibility validation', () => {
    it('should reject codex provider with claude model in BMAD workflow', () => {
      const invalidYaml = `name: bad-provider-model
description: Invalid provider/model pairing
provider: claude
nodes:
  - id: review
    prompt: Do a review
    provider: codex
    model: sonnet
`;
      const result = parseWorkflow(invalidYaml, 'invalid.yaml');
      expect(result.error).not.toBeNull();
      expect(result.error?.error).toContain('not compatible');
    });

    it('should accept codex provider with compatible codex model', () => {
      const validYaml = `name: valid-provider-model
description: Valid provider/model pairing
provider: claude
nodes:
  - id: review
    prompt: Do a review
    provider: codex
    model: gpt-4
`;
      const result = parseWorkflow(validYaml, 'valid.yaml');
      expect(result.error).toBeNull();
      expect(result.workflow).not.toBeNull();
    });

    it('code-review workflow should parse without provider/model errors', () => {
      const result = parseWorkflow(BMAD_CODE_REVIEW_YAML, 'archon-bmad-code-review.yaml');
      expect(result.error).toBeNull();
    });

    it('full-cycle workflow should parse without provider/model errors', () => {
      const result = parseWorkflow(BMAD_FULL_CYCLE_YAML, 'archon-bmad-full-cycle.yaml');
      expect(result.error).toBeNull();
    });
  });

  describe('epic-orchestrator interactive flag', () => {
    it('epic-orchestrator should have interactive: true', () => {
      const result = parseWorkflow(
        BMAD_EPIC_ORCHESTRATOR_YAML,
        'archon-bmad-epic-orchestrator.yaml'
      );
      expect(result.workflow!.interactive).toBe(true);
    });

    it('other BMAD workflows should not have interactive set', () => {
      const nonInteractiveWorkflows = {
        'archon-bmad-create-story': BMAD_CREATE_STORY_YAML,
        'archon-bmad-dev-story': BMAD_DEV_STORY_YAML,
        'archon-bmad-code-review': BMAD_CODE_REVIEW_YAML,
        'archon-bmad-qa-review': BMAD_QA_REVIEW_YAML,
        'archon-bmad-full-cycle': BMAD_FULL_CYCLE_YAML,
      };

      for (const [name, yaml] of Object.entries(nonInteractiveWorkflows)) {
        const result = parseWorkflow(yaml, `${name}.yaml`);
        expect(result.workflow!.interactive).toBeUndefined();
      }
    });
  });
});

// ===========================================================================
// Type guard helper — isPromptNode (reused from schemas but not exported as guard)
// ===========================================================================

function isPromptNode(node: DagNode): boolean {
  return 'prompt' in node && typeof node.prompt === 'string';
}

function isCommandNode(node: DagNode): boolean {
  return 'command' in node && typeof node.command === 'string';
}
