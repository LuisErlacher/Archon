/**
 * Project workflow YAML validation tests.
 *
 * Validates that the project's own .archon/workflows/*.yaml files are
 * well-formed and follow expected conventions (tool restrictions, node IDs, etc.).
 */
import { describe, it, expect, beforeAll, mock } from 'bun:test';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

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

const realArchonPaths = await import('@archon/paths');
mock.module('@archon/paths', () => ({
  ...realArchonPaths,
  createLogger: mock(() => mockLogger),
}));

import { discoverWorkflows } from './workflow-discovery';

// Resolve the project root (3 levels up from this file)
const PROJECT_ROOT = join(import.meta.dir, '..', '..', '..');
const WORKFLOWS_DIR = join(PROJECT_ROOT, '.archon', 'workflows');

describe('Project workflow YAML validation', () => {
  let workflowNames: string[];

  beforeAll(async () => {
    const files = await readdir(WORKFLOWS_DIR);
    workflowNames = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  });

  it('discovers all project workflow YAMLs without parse errors', async () => {
    const result = await discoverWorkflows(PROJECT_ROOT, { loadDefaults: false });
    // Placeholder files (comment-only without 'name:') generate parse errors — that's expected
    const realYamls: string[] = [];
    for (const name of workflowNames) {
      const content = await readFile(join(WORKFLOWS_DIR, name), 'utf-8');
      if (content.includes('name:')) {
        realYamls.push(name);
      }
    }

    // Check all real workflow files were loaded (by workflow name, not filename)
    const discoveredNames = result.workflows.map(w => w.workflow.name);
    for (const filename of realYamls) {
      // Workflow name should match filename minus .yaml/.yml
      const expectedName = filename.replace(/\.(yaml|yml)$/, '');
      expect(discoveredNames).toContain(expectedName);
    }
  });

  describe('archon-gsd-feature-pi tool restrictions', () => {
    it('research node has explicit allowed_tools', async () => {
      const content = await readFile(join(WORKFLOWS_DIR, 'archon-gsd-feature-pi.yaml'), 'utf-8');
      // Research node should have allowed_tools (not open-ended permissions)
      expect(content).toContain('allowed_tools: [Read, Write, Grep, Glob, Bash]');
      // Should NOT have denied_tools on research node
      expect(content).not.toMatch(/id: research[\s\S]*?denied_tools/);
    });

    it('review node has explicit allowed_tools', async () => {
      const content = await readFile(join(WORKFLOWS_DIR, 'archon-gsd-feature-pi.yaml'), 'utf-8');
      // Review node should have allowed_tools
      const reviewSection = content.slice(content.indexOf('id: review'));
      expect(reviewSection).toContain('allowed_tools');
    });
  });

  describe('archon-gsd-autonomous-pi tool restrictions', () => {
    it('batch-research node does NOT have denied_tools', async () => {
      const content = await readFile(join(WORKFLOWS_DIR, 'archon-gsd-autonomous-pi.yaml'), 'utf-8');
      expect(content).not.toContain('denied_tools');
    });

    it('review node does NOT have denied_tools', async () => {
      const content = await readFile(join(WORKFLOWS_DIR, 'archon-gsd-autonomous-pi.yaml'), 'utf-8');
      expect(content).not.toContain('denied_tools');
    });
  });

  describe('until_bash gate correctness', () => {
    it('no until_bash contains echo EXIT (which masks failures)', async () => {
      const files = await readdir(WORKFLOWS_DIR);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of yamlFiles) {
        const content = await readFile(join(WORKFLOWS_DIR, file), 'utf-8');
        // until_bash should NOT contain "echo EXIT:$?" which always succeeds
        const echoExitMatches = content.match(/until_bash:.*echo EXIT/);
        expect(echoExitMatches).toBeNull();
      }
    });
  });
});
