// Prevent auto-loaded ~/.archon/.env from enabling WEB_UI_PASSWORD auth in tests
delete process.env.WEB_UI_PASSWORD;

import { describe, test, expect, mock } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ConversationLockManager } from '@archon/core';
import type { WebAdapter } from '../adapters/web';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { validationErrorHook } from './openapi-defaults';
import { makeTestWorkflow, makeTestWorkflowWithSource } from '@archon/workflows/test-utils';

/** Test app factory: includes defaultHook to format validation errors as { error: string }. */
function createTestApp(): OpenAPIHono {
  return new OpenAPIHono({ defaultHook: validationErrorHook });
}

const mockDiscoverWorkflows = mock(async (_cwd: string) => ({
  workflows: [makeTestWorkflowWithSource({ name: 'deploy', description: 'Deploy app' }, 'bundled')],
  errors: [
    { filename: '/tmp/.archon/workflows/bad.md', error: 'invalid', errorType: 'parse_error' },
  ],
}));

// Default: returns a valid workflow. Use mockReturnValueOnce in tests that need a parse failure.
const mockParseWorkflow = mock((_content: string, _filename: string) => ({
  workflow: makeTestWorkflow({ name: 'test', description: 'Test workflow' }),
  error: null,
}));

mock.module('@archon/core', () => ({
  handleMessage: mock(async () => {}),
  getDatabaseType: () => 'sqlite',
  loadConfig: mock(async () => ({})),
  getWorkflowFolderSearchPaths: mock(() => ['.archon/workflows']),
  getCommandFolderSearchPaths: mock(() => ['.archon/commands', '.archon/commands/defaults']),
  getDefaultCommandsPath: mock(() => '/tmp/.archon-test-nonexistent/commands/defaults'),
  getDefaultWorkflowsPath: mock(() => '/tmp/.archon-test-nonexistent/workflows/defaults'),
  cloneRepository: mock(async () => {}),
  registerRepository: mock(async () => ({ success: true })),
  removeWorktree: mock(async () => ({ success: true })),
  ConversationNotFoundError: class extends Error {},
  getArchonWorkspacesPath: () => '/tmp/.archon/workspaces',
  createLogger: () => ({
    fatal: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    info: mock(() => undefined),
    debug: mock(() => undefined),
    trace: mock(() => undefined),
    child: mock(function (this: unknown) {
      return this;
    }),
    bindings: mock(() => ({ module: 'test' })),
    isLevelEnabled: mock(() => true),
    level: 'info',
  }),
}));

mock.module('@archon/workflows/workflow-discovery', () => ({
  discoverWorkflowsWithConfig: mockDiscoverWorkflows,
}));
mock.module('@archon/workflows/loader', () => ({
  parseWorkflow: mockParseWorkflow,
}));
mock.module('@archon/workflows/command-validation', () => ({
  isValidCommandName: mock(
    (name: string) =>
      !name.includes('/') &&
      !name.includes('\\') &&
      !name.includes('..') &&
      !!name &&
      !name.startsWith('.')
  ),
}));
mock.module('@archon/workflows/defaults', () => ({
  BUNDLED_WORKFLOWS: {
    'archon-assist': 'name: archon-assist\ndescription: Archon Assist\nnodes: []',
  },
  BUNDLED_COMMANDS: {
    'archon-assist': '# archon-assist command',
  },
  isBinaryBuild: mock(() => false),
}));

// Note: @archon/core/defaults/bundled-defaults and @archon/core/utils/commands are NOT mocked.
// The real implementations are used. isBinaryBuild() returns false in Bun test environment, and
// the filesystem paths used by the routes point to non-existent directories, so access/readFile/unlink
// calls naturally fail with ENOENT without needing to mock fs/promises (which would leak globally).

mock.module('@archon/core/db/conversations', () => ({}));
mock.module('@archon/core/db/isolation-environments', () => ({}));
mock.module('@archon/core/db/workflows', () => ({}));
mock.module('@archon/core/db/workflow-events', () => ({}));
mock.module('@archon/core/db/messages', () => ({}));

const mockUpsertWorkflowDefinition = mock(async (data: { name: string }) => ({
  id: 'test-uuid',
  name: data.name,
  description: null,
  definition: '{}',
  source: 'user',
  codebase_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));
const mockGetWorkflowDefinition = mock(async () => null);
const mockListWorkflowDefinitions = mock(async () => []);
const mockDeleteWorkflowDefinition = mock(async () => false);
mock.module('@archon/core/db/workflow-definitions', () => ({
  upsertWorkflowDefinition: mockUpsertWorkflowDefinition,
  getWorkflowDefinition: mockGetWorkflowDefinition,
  listWorkflowDefinitions: mockListWorkflowDefinitions,
  deleteWorkflowDefinition: mockDeleteWorkflowDefinition,
}));

const mockListCodebases = mock(async () => [{ default_cwd: '/tmp/project' }]);
mock.module('@archon/core/db/codebases', () => ({
  listCodebases: mockListCodebases,
}));

import { registerApiRoutes } from './api';

describe('GET /api/workflows', () => {
  test('returns a flat workflows array from discoverWorkflows result', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows');
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      workflows: Array<{ workflow: { name: string }; source: string }> & { workflows?: unknown };
      errors: unknown[];
    };

    expect(Array.isArray(body.workflows)).toBe(true);
    expect(body.workflows[0]?.workflow.name).toBe('deploy');
    expect(body.workflows[0]?.source).toBe('bundled');
    expect(body.workflows.workflows).toBeUndefined();
    expect(mockDiscoverWorkflows).toHaveBeenCalledWith(
      '/tmp/project',
      expect.any(Function),
      expect.objectContaining({ getDbWorkflows: expect.any(Function) })
    );
    expect(body.errors).toBeDefined();
    expect(Array.isArray(body.errors)).toBe(true);
  });
});

describe('POST /api/workflows/validate', () => {
  test('returns valid:true for valid definition', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: { name: 'my-workflow', description: 'test', nodes: [] } }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  test('returns valid:false with errors for invalid definition', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockParseWorkflow.mockReturnValueOnce({
      workflow: null,
      error: { filename: 'test.yaml', error: 'parse error', errorType: 'validation_error' },
    });

    const response = await app.request('/api/workflows/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: { name: 'my-workflow', description: 'bad' } }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { valid: boolean; errors: string[] };
    expect(body.valid).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test('returns 400 for missing definition', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other: 'data' }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('definition');
  });

  test('returns 400 for malformed JSON body', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all {{{',
    });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/workflows/:name', () => {
  test('returns 400 for invalid name (path traversal)', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/..secret');
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Invalid workflow name');
  });

  test('returns 404 when workflow not found', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // No cwd → no readFile attempt → checks BUNDLED_WORKFLOWS → not there → 404
    mockListCodebases.mockImplementationOnce(async () => []);

    const response = await app.request('/api/workflows/nonexistent-workflow');
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('nonexistent-workflow');
  });

  test('returns bundled workflow with source:bundled', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // No cwd → no readFile attempt → checks BUNDLED_WORKFLOWS → archon-assist found
    mockListCodebases.mockImplementationOnce(async () => []);

    const response = await app.request('/api/workflows/archon-assist');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { source: string; filename: string; workflow: unknown };
    expect(body.source).toBe('bundled');
    expect(body.filename).toBe('archon-assist.yaml');
    expect(body.workflow).toBeDefined();
  });

  test('returns project workflow with source:project when file exists on disk', async () => {
    const testDir = join(tmpdir(), `wf-get-test-${Date.now()}`);
    const workflowDir = join(testDir, '.archon', 'workflows');
    await mkdir(workflowDir, { recursive: true });
    await writeFile(
      join(workflowDir, 'custom.yaml'),
      'name: custom\ndescription: My custom\nnodes:\n  - id: plan\n    command: plan\n'
    );

    try {
      const app = createTestApp();
      registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

      mockListCodebases.mockImplementationOnce(async () => [{ default_cwd: testDir }]);
      const response = await app.request(`/api/workflows/custom?cwd=${testDir}`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        source: string;
        filename: string;
        workflow: { name: string };
      };
      expect(body.source).toBe('project');
      expect(body.filename).toBe('custom.yaml');
      expect(body.workflow).toBeDefined();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('returns WorkflowDefinition shape with expected top-level fields', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockListCodebases.mockImplementationOnce(async () => []);

    const response = await app.request('/api/workflows/archon-assist');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      workflow: Record<string, unknown>;
    };
    const wf = body.workflow;
    // Guard against silent spec drift if engine's workflowBaseSchema drops or renames fields
    expect(typeof wf['name']).toBe('string');
    expect(typeof wf['description']).toBe('string');
    expect(Array.isArray(wf['nodes'])).toBe(true);
  });
});

describe('GET /api/workflows/:name - cwd validation', () => {
  test('returns 400 when cwd is not a registered codebase path', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // default mock returns /tmp/project; /etc/secrets is not registered
    const response = await app.request('/api/workflows/archon-assist?cwd=/etc/secrets');
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Invalid cwd');
  });
});

describe('PUT /api/workflows/:name', () => {
  test('returns 400 for invalid name', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/..secret', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: { name: 'test' } }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Invalid workflow name');
  });

  test('returns 400 for missing definition', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/my-workflow', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other: 'data' }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('definition');
  });

  test('saves workflow to database and returns source:db', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockParseWorkflow.mockReturnValueOnce({
      workflow: makeTestWorkflow({ name: 'my-workflow', description: 'test' }),
      error: null,
    });

    const response = await app.request('/api/workflows/my-workflow', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definition: {
          name: 'my-workflow',
          description: 'test',
          nodes: [{ id: 'n1', command: 'assist' }],
        },
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { workflow: object; source: string };
    expect(body.source).toBe('db');
  });

  test('returns 400 when definition fails validation', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockParseWorkflow.mockReturnValueOnce({
      workflow: null,
      error: {
        filename: 'test.yaml',
        error: 'missing required fields',
        errorType: 'validation_error',
      },
    });

    const response = await app.request('/api/workflows/my-workflow', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: { name: 'my-workflow', description: 'bad' } }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; detail: string };
    expect(body.error).toContain('invalid');
    expect(body.detail).toBeDefined();
  });

  test('saves valid workflow to DB and returns parsed workflow with source:db', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/my-workflow', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definition: {
          name: 'my-workflow',
          description: 'Test',
          nodes: [{ id: 'plan', command: 'plan' }],
        },
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      workflow: { name: string };
      filename: string;
      source: string;
    };
    expect(body.workflow).toBeDefined();
    expect(body.filename).toBe('my-workflow.yaml');
    expect(body.source).toBe('db');
  });
});

describe('DELETE /api/workflows/:name', () => {
  test('returns 400 for bundled default name', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // archon-assist is in the real BUNDLED_WORKFLOWS
    const response = await app.request('/api/workflows/archon-assist', { method: 'DELETE' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('archon-assist');
  });

  test('returns 404 when workflow file not found', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // Uses real unlink on a path that definitely does not exist → natural ENOENT → 404
    const response = await app.request('/api/workflows/test-nonexistent-workflow-xyz', {
      method: 'DELETE',
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('test-nonexistent-workflow-xyz');
  });

  test('returns 404 when workflow not found in database', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockDeleteWorkflowDefinition.mockResolvedValueOnce(false);

    const response = await app.request('/api/workflows/nonexistent-workflow', {
      method: 'DELETE',
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('nonexistent-workflow');
  });

  test('removes DB workflow and returns deleted:true', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockDeleteWorkflowDefinition.mockResolvedValueOnce(true);
    const response = await app.request('/api/workflows/to-delete', {
      method: 'DELETE',
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { deleted: boolean; name: string };
    expect(body.deleted).toBe(true);
    expect(body.name).toBe('to-delete');
  });
});

describe('GET /api/workflows - cwd validation', () => {
  test('returns 400 when cwd is not a registered codebase path', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // default mock returns /tmp/project; /etc is not registered
    const response = await app.request('/api/workflows?cwd=/etc');
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Invalid cwd');
  });

  test('accepts cwd matching a registered codebase path', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // default mock returns /tmp/project
    const response = await app.request('/api/workflows?cwd=/tmp/project');
    expect(response.status).toBe(200);
  });
});

describe('PUT /api/workflows/:name - DB storage', () => {
  test('ignores cwd param and saves to DB (cwd no longer relevant)', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/my-workflow?cwd=/etc/secrets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: { name: 'my-workflow', description: 'test', nodes: [] } }),
    });
    // PUT now saves to DB regardless of cwd
    expect(response.status).toBe(200);
    const body = (await response.json()) as { source: string };
    expect(body.source).toBe('db');
  });
});

describe('DELETE /api/workflows/:name - DB storage', () => {
  test('ignores cwd param and deletes from DB', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // Not found in DB → 404
    mockDeleteWorkflowDefinition.mockResolvedValueOnce(false);
    const response = await app.request('/api/workflows/some-workflow?cwd=/etc/secrets', {
      method: 'DELETE',
    });
    expect(response.status).toBe(404);
  });
});

describe('GET /api/commands - cwd validation', () => {
  test('returns 400 when cwd is not a registered codebase path', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/commands?cwd=/etc/secrets');
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Invalid cwd');
  });
});

describe('GET /api/commands', () => {
  test('returns commands array', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/commands');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { commands: Array<{ name: string; source: string }> };
    expect(Array.isArray(body.commands)).toBe(true);
  });

  test('includes bundled commands with source:bundled', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/commands');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { commands: Array<{ name: string; source: string }> };
    // archon-assist is in the real BUNDLED_COMMANDS
    const archonAssist = body.commands.find(c => c.name === 'archon-assist');
    expect(archonAssist).toBeDefined();
    expect(archonAssist?.source).toBe('bundled');
  });
});

describe('POST /api/workflows/import', () => {
  test('imports valid YAML and returns source:db', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockParseWorkflow.mockReturnValueOnce({
      workflow: makeTestWorkflow({ name: 'imported-wf', description: 'from import' }),
      error: null,
    });

    const response = await app.request('/api/workflows/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: 'name: imported-wf\ndescription: from import\nnodes: []' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { source: string; workflow: { name: string } };
    expect(body.source).toBe('db');
    expect(body.workflow.name).toBe('imported-wf');
    expect(mockUpsertWorkflowDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'imported' })
    );
  });

  test('returns 400 when YAML fails parsing', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockParseWorkflow.mockReturnValueOnce({
      workflow: null,
      error: { filename: 'import.yaml', error: 'bad yaml', errorType: 'validation_error' as const },
    });

    const response = await app.request('/api/workflows/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: 'not: valid: yaml: here' }),
    });

    expect(response.status).toBe(400);
  });

  test('returns 400 when yaml field is empty', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const response = await app.request('/api/workflows/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: '' }),
    });

    expect(response.status).toBe(400);
  });

  test('returns 500 when DB upsert fails', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockParseWorkflow.mockReturnValueOnce({
      workflow: makeTestWorkflow({ name: 'my-wf', description: 'test' }),
      error: null,
    });
    mockUpsertWorkflowDefinition.mockRejectedValueOnce(new Error('DB connection lost'));

    const response = await app.request('/api/workflows/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: 'name: my-wf\nnodes: []' }),
    });

    expect(response.status).toBe(500);
  });
});

describe('GET /api/workflows/:name/export', () => {
  test('returns YAML from DB when workflow exists in DB', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const wf = makeTestWorkflow({ name: 'my-wf', description: 'test' });
    mockGetWorkflowDefinition.mockResolvedValueOnce({
      id: 'uuid-1',
      name: 'my-wf',
      description: 'test',
      definition: JSON.stringify(wf),
      source: 'user' as const,
      codebase_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    const response = await app.request('/api/workflows/my-wf/export');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/yaml');
    const yamlText = await response.text();
    expect(yamlText).toBeTruthy();
  });

  test('returns 404 when workflow not found in DB or filesystem', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // DB returns null (default mock already returns null)
    // discoverWorkflowsWithConfig returns empty list
    mockDiscoverWorkflows.mockResolvedValueOnce({ workflows: [], errors: [] });

    const response = await app.request('/api/workflows/does-not-exist/export');
    expect(response.status).toBe(404);
  });

  test('falls back to filesystem when DB lookup returns null', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    // DB returns null (default mock)
    // Filesystem has the workflow
    mockDiscoverWorkflows.mockResolvedValueOnce({
      workflows: [
        makeTestWorkflowWithSource({ name: 'deploy', description: 'Deploy app' }, 'bundled'),
      ],
      errors: [],
    });

    const response = await app.request('/api/workflows/deploy/export');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/yaml');
  });
});

describe('GET /api/workflows/:name - DB source', () => {
  test('returns workflow with source:db when found in database', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    const wf = makeTestWorkflow({ name: 'db-workflow', description: 'from db' });
    mockGetWorkflowDefinition.mockResolvedValueOnce({
      id: 'uuid-1',
      name: 'db-workflow',
      description: 'from db',
      definition: JSON.stringify(wf),
      source: 'user' as const,
      codebase_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    mockParseWorkflow.mockReturnValueOnce({ workflow: wf, error: null });

    const response = await app.request('/api/workflows/db-workflow');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { source: string; workflow: { name: string } };
    expect(body.source).toBe('db');
    expect(body.workflow.name).toBe('db-workflow');
  });

  test('returns 500 when DB record contains invalid workflow definition', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockGetWorkflowDefinition.mockResolvedValueOnce({
      id: 'uuid-1',
      name: 'corrupt-workflow',
      description: null,
      definition: '{"corrupt":true}',
      source: 'user' as const,
      codebase_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    mockParseWorkflow.mockReturnValueOnce({
      workflow: null,
      error: {
        filename: 'corrupt-workflow.yaml',
        error: 'invalid schema',
        errorType: 'validation_error' as const,
      },
    });

    const response = await app.request('/api/workflows/corrupt-workflow');
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('DB workflow is invalid');
  });
});

describe('DELETE /api/workflows/:name - DB error handling', () => {
  test('returns 500 when DB delete throws', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockDeleteWorkflowDefinition.mockRejectedValueOnce(new Error('DB connection lost'));

    const response = await app.request('/api/workflows/my-workflow', { method: 'DELETE' });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Failed to delete workflow');
  });
});

describe('PUT /api/workflows/:name - mock call assertion', () => {
  test('calls upsertWorkflowDefinition with name and source:user', async () => {
    const app = createTestApp();
    registerApiRoutes(app, {} as WebAdapter, {} as ConversationLockManager);

    mockParseWorkflow.mockReturnValueOnce({
      workflow: makeTestWorkflow({ name: 'my-workflow', description: 'test' }),
      error: null,
    });
    mockUpsertWorkflowDefinition.mockClear();

    await app.request('/api/workflows/my-workflow', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: { name: 'my-workflow', description: 'test', nodes: [] } }),
    });

    expect(mockUpsertWorkflowDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-workflow',
        source: 'user',
      })
    );
  });
});
