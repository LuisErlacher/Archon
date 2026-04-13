/**
 * REST API routes for the Archon Web UI.
 * Provides conversation, codebase, and SSE streaming endpoints.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { cors } from 'hono/cors';
import type { WebAdapter } from '../adapters/web';
import { rm, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { readFileSync } from 'fs';
import { normalize, join, sep, basename } from 'path';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import type { Context } from 'hono';
import type {
  ConversationLockManager,
  AttachedFile,
  HandleMessageContext,
  GlobalConfig,
} from '@archon/core';
import {
  handleMessage,
  getDatabaseType,
  loadConfig,
  toSafeConfig,
  updateGlobalConfig,
  cloneRepository,
  registerRepository,
  ConversationNotFoundError,
  generateAndSetTitle,
  EnvLeakError,
  scanPathForSensitiveKeys,
} from '@archon/core';
import { removeWorktree, toRepoPath, toWorktreePath } from '@archon/git';
import {
  createLogger,
  getWorkflowFolderSearchPaths,
  getCommandFolderSearchPaths,
  getDefaultCommandsPath,
  getDefaultWorkflowsPath,
  getArchonWorkspacesPath,
  getRunArtifactsPath,
  getArchonHome,
  isDocker,
  checkForUpdate,
  BUNDLED_IS_BINARY,
} from '@archon/paths';
import { discoverWorkflowsWithConfig } from '@archon/workflows/workflow-discovery';
import type { WorkflowWithSource } from '@archon/workflows/schemas/workflow';
import { parseWorkflow } from '@archon/workflows/loader';
import { isValidCommandName } from '@archon/workflows/command-validation';
import { BUNDLED_WORKFLOWS, BUNDLED_COMMANDS, isBinaryBuild } from '@archon/workflows/defaults';
import {
  RESUMABLE_WORKFLOW_STATUSES,
  TERMINAL_WORKFLOW_STATUSES,
} from '@archon/workflows/schemas/workflow-run';
import type { ApprovalContext } from '@archon/workflows/schemas/workflow-run';
import { findMarkdownFilesRecursive } from '@archon/core/utils/commands';

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('api');
  return cachedLog;
}
import * as conversationDb from '@archon/core/db/conversations';
import * as codebaseDb from '@archon/core/db/codebases';
import * as usersDb from '@archon/core/db/users';
import * as envVarDb from '@archon/core/db/env-vars';
import * as isolationEnvDb from '@archon/core/db/isolation-environments';
import * as workflowDb from '@archon/core/db/workflows';
import * as workflowDefinitionsDb from '@archon/core/db/workflow-definitions';
import * as workflowEventDb from '@archon/core/db/workflow-events';
import * as messageDb from '@archon/core/db/messages';
import * as nodeStateDb from '@archon/core/db/node-states';
import { errorSchema } from './schemas/common.schemas';
import { updateCheckResponseSchema } from './schemas/system.schemas';
import {
  workflowListResponseSchema,
  validateWorkflowBodySchema,
  validateWorkflowResponseSchema,
  getWorkflowResponseSchema,
  saveWorkflowBodySchema,
  deleteWorkflowResponseSchema,
  commandListResponseSchema,
  workflowRunListResponseSchema,
  workflowRunDetailSchema,
  workflowRunByWorkerResponseSchema,
  cancelWorkflowRunResponseSchema,
  workflowRunActionResponseSchema,
  workflowRunStatusSchema,
  dashboardRunsResponseSchema,
  runWorkflowBodySchema,
  dashboardRunsQuerySchema,
  workflowRunsQuerySchema,
  approveWorkflowRunBodySchema,
  rejectWorkflowRunBodySchema,
  importWorkflowBodySchema,
  importWorkflowResponseSchema,
  workflowRunSummarySchema,
  nodeCompleteBodySchema,
  nodeGateResultBodySchema,
  nodeActionResponseSchema,
  workflowEventsQuerySchema,
  workflowEventsResponseSchema,
  workflowTimelineResponseSchema,
} from './schemas/workflow.schemas';
import {
  runSummaryResponseSchema,
  storeGateResultBodySchema,
  storeGateResultResponseSchema,
} from './schemas/gate.schemas';
import {
  conversationListResponseSchema,
  listConversationsQuerySchema,
  conversationIdParamsSchema,
  conversationSchema,
  createConversationBodySchema,
  createConversationResponseSchema,
  updateConversationBodySchema,
  successResponseSchema,
  messageListResponseSchema,
  listMessagesQuerySchema,
  dispatchResponseSchema,
} from './schemas/conversation.schemas';
import {
  codebaseListResponseSchema,
  codebaseSchema,
  codebaseIdParamsSchema,
  addCodebaseBodySchema,
  updateCodebaseBodySchema,
  deleteCodebaseResponseSchema,
  codebaseEnvVarsResponseSchema,
  setEnvVarBodySchema,
  codebaseEnvVarParamsSchema,
  envVarMutationResponseSchema,
} from './schemas/codebase.schemas';
import {
  updateAssistantConfigBodySchema,
  updateAssistantConfigResponseSchema,
  configResponseSchema,
  codebaseEnvironmentsResponseSchema,
} from './schemas/config.schemas';
import { getValidatedBody } from './utils';
import {
  loginBodySchema,
  loginResponseSchema,
  authStatusResponseSchema,
} from './schemas/auth.schemas';

// Read app version once at module load (root package.json is 4 levels up from src/routes/)
let appVersion = 'unknown';
try {
  const pkgContent = readFileSync(join(import.meta.dir, '../../../../package.json'), 'utf-8');
  const pkg = JSON.parse(pkgContent) as { version?: string };
  appVersion = pkg.version ?? 'unknown';
} catch (err) {
  // package.json not found (binary build or unusual install)
  getLog().debug(
    { err, path: join(import.meta.dir, '../../../../package.json') },
    'api.version_read_failed'
  );
}

type WorkflowSource = 'project' | 'bundled' | 'db';

// =========================================================================
// OpenAPI route configs (module-scope — pure config, no runtime dependencies)
// =========================================================================

/** Helper to build a JSON error response entry for createRoute configs. */
function jsonError(description: string): {
  content: { 'application/json': { schema: typeof errorSchema } };
  description: string;
} {
  return { content: { 'application/json': { schema: errorSchema } }, description };
}

const cwdQuerySchema = z.object({ cwd: z.string().optional() });

const getWorkflowsRoute = createRoute({
  method: 'get',
  path: '/api/workflows',
  tags: ['Workflows'],
  summary: 'List available workflows',
  request: { query: cwdQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowListResponseSchema } },
      description: 'OK',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

const validateWorkflowRoute = createRoute({
  method: 'post',
  path: '/api/workflows/validate',
  tags: ['Workflows'],
  summary: 'Validate a workflow definition without saving',
  request: {
    body: {
      content: { 'application/json': { schema: validateWorkflowBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: validateWorkflowResponseSchema } },
      description: 'Validation result',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

const importWorkflowRoute = createRoute({
  method: 'post',
  path: '/api/workflows/import',
  tags: ['Workflows'],
  summary: 'Import a workflow from raw YAML text into the database',
  request: {
    body: {
      content: { 'application/json': { schema: importWorkflowBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: importWorkflowResponseSchema } },
      description: 'Imported workflow',
    },
    400: jsonError('Invalid YAML'),
  },
});

const exportWorkflowRoute = createRoute({
  method: 'get',
  path: '/api/workflows/{name}/export',
  tags: ['Workflows'],
  summary: 'Export a workflow as YAML text',
  request: {
    params: z.object({ name: z.string() }),
    query: cwdQuerySchema,
  },
  responses: {
    200: {
      content: { 'text/yaml': { schema: z.string() } },
      description: 'YAML export',
    },
    404: jsonError('Not found'),
  },
});

const getWorkflowRoute = createRoute({
  method: 'get',
  path: '/api/workflows/{name}',
  tags: ['Workflows'],
  summary: 'Fetch a single workflow definition',
  request: {
    params: z.object({ name: z.string() }),
    query: cwdQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: getWorkflowResponseSchema } },
      description: 'Workflow definition',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const saveWorkflowRoute = createRoute({
  method: 'put',
  path: '/api/workflows/{name}',
  tags: ['Workflows'],
  summary: 'Save (create or update) a workflow',
  request: {
    params: z.object({ name: z.string() }),
    query: cwdQuerySchema,
    body: { content: { 'application/json': { schema: saveWorkflowBodySchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: getWorkflowResponseSchema } },
      description: 'Saved workflow',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

const deleteWorkflowRoute = createRoute({
  method: 'delete',
  path: '/api/workflows/{name}',
  tags: ['Workflows'],
  summary: 'Delete a user-defined workflow',
  request: {
    params: z.object({ name: z.string() }),
    query: cwdQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: deleteWorkflowResponseSchema } },
      description: 'Deleted',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const getCommandsRoute = createRoute({
  method: 'get',
  path: '/api/commands',
  tags: ['Commands'],
  summary: 'List available command names for the workflow node palette',
  request: { query: cwdQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: commandListResponseSchema } },
      description: 'OK',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

// =========================================================================
// Conversation route configs
// =========================================================================

const getConversationsRoute = createRoute({
  method: 'get',
  path: '/api/conversations',
  tags: ['Conversations'],
  summary: 'List conversations',
  request: { query: listConversationsQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: conversationListResponseSchema } },
      description: 'OK',
    },
    500: jsonError('Server error'),
  },
});

const getConversationRoute = createRoute({
  method: 'get',
  path: '/api/conversations/{id}',
  tags: ['Conversations'],
  summary: 'Get a conversation by platform conversation ID',
  request: { params: conversationIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: conversationSchema } },
      description: 'Conversation',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const createConversationRoute = createRoute({
  method: 'post',
  path: '/api/conversations',
  tags: ['Conversations'],
  summary: 'Create a new conversation',
  request: {
    body: {
      content: { 'application/json': { schema: createConversationBodySchema } },
      required: false,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: createConversationResponseSchema } },
      description: 'Created conversation',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

const updateConversationRoute = createRoute({
  method: 'patch',
  path: '/api/conversations/{id}',
  tags: ['Conversations'],
  summary: 'Update a conversation (title)',
  request: {
    params: conversationIdParamsSchema,
    body: {
      content: { 'application/json': { schema: updateConversationBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: successResponseSchema } },
      description: 'Updated',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const deleteConversationRoute = createRoute({
  method: 'delete',
  path: '/api/conversations/{id}',
  tags: ['Conversations'],
  summary: 'Soft-delete a conversation',
  request: { params: conversationIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: successResponseSchema } },
      description: 'Deleted',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const listMessagesRoute = createRoute({
  method: 'get',
  path: '/api/conversations/{id}/messages',
  tags: ['Conversations'],
  summary: 'List message history for a conversation',
  request: {
    params: conversationIdParamsSchema,
    query: listMessagesQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: messageListResponseSchema } },
      description: 'Message list',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

// Body validation is handled manually in the handler (multipart vs JSON branching).
// Declaring both content types in the OpenAPI route causes @hono/zod-openapi to
// validate JSON bodies against the multipart schema. We keep `request.body` empty
// and document the schemas via the OpenAPI spec comments instead.
const sendMessageRoute = createRoute({
  method: 'post',
  path: '/api/conversations/{id}/message',
  tags: ['Conversations'],
  summary: 'Send a message (JSON or multipart with file uploads)',
  description:
    'Accepts `application/json` with `{ message: string }` or `multipart/form-data` ' +
    'with a `message` field and optional file attachments (max 5 files, 10 MB each).',
  request: {
    params: conversationIdParamsSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: dispatchResponseSchema } },
      description: 'Accepted',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

// =========================================================================
// Codebase route configs
// =========================================================================

const listCodebasesRoute = createRoute({
  method: 'get',
  path: '/api/codebases',
  tags: ['Codebases'],
  summary: 'List registered codebases',
  responses: {
    200: {
      content: { 'application/json': { schema: codebaseListResponseSchema } },
      description: 'OK',
    },
    500: jsonError('Server error'),
  },
});

const getCodebaseRoute = createRoute({
  method: 'get',
  path: '/api/codebases/{id}',
  tags: ['Codebases'],
  summary: 'Get a codebase by ID',
  request: { params: codebaseIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: codebaseSchema } },
      description: 'Codebase',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const addCodebaseRoute = createRoute({
  method: 'post',
  path: '/api/codebases',
  tags: ['Codebases'],
  summary: 'Register a codebase (clone from URL or register local path)',
  request: {
    body: {
      content: { 'application/json': { schema: addCodebaseBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: codebaseSchema } },
      description: 'Codebase already existed',
    },
    201: {
      content: { 'application/json': { schema: codebaseSchema } },
      description: 'Codebase created',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

const updateCodebaseRoute = createRoute({
  method: 'patch',
  path: '/api/codebases/{id}',
  tags: ['Codebases'],
  summary: 'Update codebase consent flags (e.g. allow_env_keys)',
  request: {
    params: codebaseIdParamsSchema,
    body: {
      content: { 'application/json': { schema: updateCodebaseBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: codebaseSchema } },
      description: 'Updated codebase',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const deleteCodebaseRoute = createRoute({
  method: 'delete',
  path: '/api/codebases/{id}',
  tags: ['Codebases'],
  summary: 'Delete a codebase and clean up associated resources',
  request: { params: codebaseIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: deleteCodebaseResponseSchema } },
      description: 'Deleted',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

// =========================================================================
// Codebase env var route configs
// =========================================================================

const listEnvVarsRoute = createRoute({
  method: 'get',
  path: '/api/codebases/{id}/env',
  tags: ['Codebases'],
  summary: 'List env vars for a codebase',
  request: { params: codebaseIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: codebaseEnvVarsResponseSchema } },
      description: 'Env vars for codebase',
    },
    404: jsonError('Codebase not found'),
  },
});

const setEnvVarRoute = createRoute({
  method: 'put',
  path: '/api/codebases/{id}/env',
  tags: ['Codebases'],
  summary: 'Set (upsert) an env var for a codebase',
  request: {
    params: codebaseIdParamsSchema,
    body: { content: { 'application/json': { schema: setEnvVarBodySchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: envVarMutationResponseSchema } },
      description: 'Env var set',
    },
    404: jsonError('Codebase not found'),
  },
});

const deleteEnvVarRoute = createRoute({
  method: 'delete',
  path: '/api/codebases/{id}/env/{key}',
  tags: ['Codebases'],
  summary: 'Delete an env var from a codebase',
  request: { params: codebaseEnvVarParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: envVarMutationResponseSchema } },
      description: 'Env var deleted',
    },
    404: jsonError('Codebase not found'),
  },
});

// =========================================================================
// Workflow run route configs
// =========================================================================

const runWorkflowRoute = createRoute({
  method: 'post',
  path: '/api/workflows/{name}/run',
  tags: ['Workflows'],
  summary: 'Run a workflow via the orchestrator',
  request: {
    params: z.object({ name: z.string() }),
    body: {
      content: { 'application/json': { schema: runWorkflowBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: dispatchResponseSchema } },
      description: 'Accepted',
    },
    400: jsonError('Bad request'),
    500: jsonError('Server error'),
  },
});

const getDashboardRunsRoute = createRoute({
  method: 'get',
  path: '/api/dashboard/runs',
  tags: ['Workflows'],
  summary: 'List enriched workflow runs for the Command Center dashboard',
  request: { query: dashboardRunsQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: dashboardRunsResponseSchema } },
      description: 'OK',
    },
    500: jsonError('Server error'),
  },
});

const getWorkflowRunByWorkerRoute = createRoute({
  method: 'get',
  path: '/api/workflows/runs/by-worker/{platformId}',
  tags: ['Workflows'],
  summary: 'Look up a workflow run by its worker conversation platform ID',
  request: { params: z.object({ platformId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunByWorkerResponseSchema } },
      description: 'Workflow run',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const listWorkflowRunsRoute = createRoute({
  method: 'get',
  path: '/api/workflows/runs',
  tags: ['Workflows'],
  summary: 'List workflow runs',
  request: { query: workflowRunsQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunListResponseSchema } },
      description: 'OK',
    },
    500: jsonError('Server error'),
  },
});

const cancelWorkflowRunRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/cancel',
  tags: ['Workflows'],
  summary: 'Cancel a workflow run',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: cancelWorkflowRunResponseSchema } },
      description: 'Cancelled',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const resumeWorkflowRunRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/resume',
  tags: ['Workflows'],
  summary: 'Resume a failed workflow run (re-run auto-resumes from completed nodes)',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunActionResponseSchema } },
      description: 'Resumed',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const abandonWorkflowRunRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/abandon',
  tags: ['Workflows'],
  summary: 'Abandon a workflow run (mark as failed)',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunActionResponseSchema } },
      description: 'Abandoned',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const approveWorkflowRunRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/approve',
  tags: ['Workflows'],
  summary: 'Approve a paused workflow run',
  request: {
    params: z.object({ runId: z.string() }),
    body: { content: { 'application/json': { schema: approveWorkflowRunBodySchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunActionResponseSchema } },
      description: 'Approved',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const rejectWorkflowRunRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/reject',
  tags: ['Workflows'],
  summary: 'Reject a paused workflow run',
  request: {
    params: z.object({ runId: z.string() }),
    body: { content: { 'application/json': { schema: rejectWorkflowRunBodySchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunActionResponseSchema } },
      description: 'Rejected',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const deleteWorkflowRunRoute = createRoute({
  method: 'delete',
  path: '/api/workflows/runs/{runId}',
  tags: ['Workflows'],
  summary: 'Delete a workflow run and its events',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunActionResponseSchema } },
      description: 'Deleted',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const getWorkflowRunRoute = createRoute({
  method: 'get',
  path: '/api/workflows/runs/{runId}',
  tags: ['Workflows'],
  summary: 'Get workflow run details with events',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunDetailSchema } },
      description: 'Workflow run detail',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const getWorkflowRunSummaryRoute = createRoute({
  method: 'get',
  path: '/api/workflows/runs/{runId}/summary',
  tags: ['Workflows'],
  summary: 'Get lightweight workflow run summary with node counts',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowRunSummarySchema } },
      description: 'Workflow run summary',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const nodeCompleteRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/nodes/{nodeId}/complete',
  tags: ['Workflows'],
  summary: 'Mark a workflow DAG node as completed',
  request: {
    params: z.object({ runId: z.string(), nodeId: z.string() }),
    body: { content: { 'application/json': { schema: nodeCompleteBodySchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: nodeActionResponseSchema } },
      description: 'Node marked as completed',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const nodeGateResultRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/nodes/{nodeId}/gate-result',
  tags: ['Workflows'],
  summary: 'Record quality gate result for a workflow DAG node',
  request: {
    params: z.object({ runId: z.string(), nodeId: z.string() }),
    body: { content: { 'application/json': { schema: nodeGateResultBodySchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: nodeActionResponseSchema } },
      description: 'Gate result recorded',
    },
    400: jsonError('Bad request'),
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

// =========================================================================
// Audit trail route configs
// =========================================================================

const getWorkflowRunEventsRoute = createRoute({
  method: 'get',
  path: '/api/workflows/runs/{runId}/events',
  tags: ['Workflows'],
  summary: 'List workflow run events with pagination',
  request: {
    params: z.object({ runId: z.string() }),
    query: workflowEventsQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowEventsResponseSchema } },
      description: 'Paginated workflow events',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const getWorkflowRunTimelineRoute = createRoute({
  method: 'get',
  path: '/api/workflows/runs/{runId}/timeline',
  tags: ['Workflows'],
  summary: 'Get computed timeline for a workflow run',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: workflowTimelineResponseSchema } },
      description: 'Workflow run timeline',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

// =========================================================================
// Config / health route configs
// =========================================================================

const getConfigRoute = createRoute({
  method: 'get',
  path: '/api/config',
  tags: ['System'],
  summary: 'Get read-only configuration (safe subset)',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: configResponseSchema,
        },
      },
      description: 'Configuration',
    },
    500: jsonError('Server error'),
  },
});

const patchAssistantConfigRoute = createRoute({
  method: 'patch',
  path: '/api/config/assistants',
  tags: ['System'],
  summary: 'Update assistant configuration',
  request: {
    body: {
      content: { 'application/json': { schema: updateAssistantConfigBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: updateAssistantConfigResponseSchema } },
      description: 'Updated configuration',
    },
    400: jsonError('Invalid request body'),
    500: jsonError('Server error'),
  },
});

const getCodebaseEnvironmentsRoute = createRoute({
  method: 'get',
  path: '/api/codebases/{id}/environments',
  tags: ['Codebases'],
  summary: 'List isolation environments for a codebase',
  request: { params: codebaseIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: codebaseEnvironmentsResponseSchema } },
      description: 'List of isolation environments',
    },
    404: jsonError('Codebase not found'),
    500: jsonError('Server error'),
  },
});

const getHealthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  tags: ['System'],
  summary: 'Health check',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              status: z.string(),
              adapter: z.string(),
              concurrency: z.record(z.unknown()),
              runningWorkflows: z.number(),
              version: z.string().optional(),
              is_docker: z.boolean(),
            })
            .openapi('HealthResponse'),
        },
      },
      description: 'Health status',
    },
  },
});

const getUpdateCheckRoute = createRoute({
  method: 'get',
  path: '/api/update-check',
  tags: ['System'],
  summary: 'Check for available updates',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: updateCheckResponseSchema,
        },
      },
      description: 'Update check result',
    },
  },
});

// =========================================================================
// Gate & node state route definitions
// =========================================================================

const getRunSummaryRoute = createRoute({
  method: 'get',
  path: '/api/workflows/runs/{runId}/summary',
  tags: ['Workflows'],
  summary: 'Get run summary with node states, gate results, and test evidence',
  request: { params: z.object({ runId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: runSummaryResponseSchema } },
      description: 'Run summary',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const storeGateResultRoute = createRoute({
  method: 'post',
  path: '/api/workflows/runs/{runId}/nodes/{nodeId}/gate-result',
  tags: ['Workflows'],
  summary: 'Store a gate execution result for a node',
  request: {
    params: z.object({ runId: z.string(), nodeId: z.string() }),
    body: {
      content: { 'application/json': { schema: storeGateResultBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: storeGateResultResponseSchema } },
      description: 'Gate result stored',
    },
    404: jsonError('Not found'),
    500: jsonError('Server error'),
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Login with password and receive a Bearer token',
  request: {
    body: {
      content: { 'application/json': { schema: loginBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: loginResponseSchema } },
      description: 'Token issued',
    },
    400: jsonError('Password required'),
    401: jsonError('Invalid password'),
    404: jsonError('Auth not configured'),
  },
});

const authStatusRoute = createRoute({
  method: 'get',
  path: '/api/auth/status',
  tags: ['Auth'],
  summary: 'Check whether password auth is enabled',
  responses: {
    200: {
      content: { 'application/json': { schema: authStatusResponseSchema } },
      description: 'Auth status',
    },
  },
});

/**
 * Register all /api/* routes on the Hono app.
 */
export function registerApiRoutes(
  app: OpenAPIHono,
  webAdapter: WebAdapter,
  lockManager: ConversationLockManager
): void {
  function apiError(
    c: Context,
    status: 400 | 404 | 422 | 500,
    message: string,
    detail?: string
  ): Response {
    return c.json({ error: message, ...(detail ? { detail } : {}) }, status);
  }

  function getUserId(c: Context): { userId: string | undefined; isAdmin: boolean } {
    const userId = c.get('userId') as string | undefined;
    const userRole = c.get('userRole') as string | undefined;
    // When JWT_SECRET is unset, authMiddleware is effectively disabled: no userId is
    // injected into the context. We fall back to isAdmin=true so that existing tests
    // and local dev setups without auth configured continue to work.
    // WARNING: In production, JWT_SECRET must be set — without it every caller is treated as admin.
    return { userId, isAdmin: !userId || userRole === 'admin' };
  }

  /**
   * Validate that a caller-supplied `cwd` is rooted at a registered codebase path.
   * This prevents path traversal — callers cannot read/write outside known project roots.
   */
  async function validateCwd(cwd: string): Promise<boolean> {
    const codebases = await codebaseDb.listCodebases();
    const normalizedCwd = normalize(cwd);
    return codebases.some(cb => {
      const base = normalize(cb.default_cwd);
      return normalizedCwd === base || normalizedCwd.startsWith(base + sep);
    });
  }

  // CORS for Web UI — allow-all is fine for a single-developer tool.
  // Override with WEB_UI_ORIGIN env var to restrict if exposing publicly.
  app.use('/api/*', cors({ origin: process.env.WEB_UI_ORIGIN || '*' }));

  // Optional Web UI auth. When WEB_UI_PASSWORD is set, all /api/* requests must
  // carry a Bearer token. Routes that must remain public (health, login, status,
  // SSE streams) are explicitly exempted.
  const webUiPassword = process.env.WEB_UI_PASSWORD;
  if (webUiPassword) {
    const expectedToken = createHmac('sha256', webUiPassword)
      .update('archon-web-session')
      .digest('hex');

    app.use('/api/*', async (c, next) => {
      const path = new URL(c.req.url).pathname;
      if (
        path === '/api/health' ||
        path.startsWith('/api/auth/') ||
        path.startsWith('/api/stream/')
      ) {
        return next();
      }
      const authHeader = c.req.header('Authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      // Use timing-safe comparison to prevent token oracle timing attacks.
      // Pad the incoming token to expectedToken length before comparing.
      const expectedBuf = Buffer.from(expectedToken, 'utf8');
      const tokenBuf = Buffer.alloc(expectedBuf.length, 0);
      Buffer.from(token, 'utf8').copy(tokenBuf, 0, 0, Math.min(token.length, expectedBuf.length));
      if (token.length !== expectedToken.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
        getLog().warn({ path, tokenPrefix: token.slice(0, 8) || '(empty)' }, 'auth.token_rejected');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      return next();
    });
  }

  // Shared lock/dispatch/error handling for message and workflow endpoints
  /** Maximum allowed upload size per file (10 MB) */
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  /** Maximum number of files per message (enforced server-side) */
  const MAX_FILES_PER_MESSAGE = 5;
  /**
   * Binary (non-text) MIME types explicitly allowed for upload.
   * All text/* types are accepted separately via isAllowedUploadType().
   */
  const ALLOWED_UPLOAD_BINARY_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    // application/json is a structured text type browsers may report for .json files
    'application/json',
  ]);

  /** Extensions accepted when browser reports an empty MIME type (code/config files). */
  const ALLOWED_UPLOAD_EXTENSIONS = new Set([
    '.md',
    '.txt',
    '.csv',
    '.xml',
    '.html',
    '.htm',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.cfg',
    '.conf',
    '.env',
    '.log',
    '.css',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.py',
    '.rb',
    '.go',
    '.java',
    '.c',
    '.cpp',
    '.cc',
    '.cxx',
    '.h',
    '.hpp',
    '.cs',
    '.php',
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
    '.rs',
    '.swift',
    '.kt',
    '.scala',
    '.r',
    '.sql',
  ]);

  /** Returns true if the MIME type is allowed for upload. */
  function isAllowedUploadType(mimeType: string, fileName: string): boolean {
    // All text/* types are acceptable (covers .md, .py, .rs, .go, .sh, .yaml, etc.)
    if (mimeType.startsWith('text/')) return true;
    if (ALLOWED_UPLOAD_BINARY_MIME_TYPES.has(mimeType)) return true;
    // Browsers assign empty MIME types to many code/config extensions — fall back to extension
    if (!mimeType) {
      const dotIndex = fileName.lastIndexOf('.');
      if (dotIndex !== -1) {
        return ALLOWED_UPLOAD_EXTENSIONS.has(fileName.slice(dotIndex).toLowerCase());
      }
    }
    return false;
  }

  async function dispatchToOrchestrator(
    conversationId: string,
    message: string,
    extraContext?: Omit<HandleMessageContext, 'isolationHints'>,
    filesToCleanup?: { files: AttachedFile[]; uploadDir: string }
  ): Promise<{ accepted: boolean; status: string }> {
    const result = await lockManager.acquireLock(conversationId, async () => {
      // Emit lock:true at handler start so the UI knows processing has begun.
      // Fire-and-forget — if no SSE stream is connected yet, the event is buffered.
      webAdapter.emitLockEvent(conversationId, true);
      try {
        await handleMessage(webAdapter, conversationId, message, {
          isolationHints: { workflowType: 'thread', workflowId: conversationId },
          ...extraContext,
        });
      } catch (error) {
        getLog().error({ err: error, conversationId }, 'handle_message_failed');
        try {
          await webAdapter.emitSSE(
            conversationId,
            JSON.stringify({
              type: 'error',
              message: `Failed to process message: ${(error as Error).message ?? 'unknown error'}. Try /reset if the problem persists.`,
              classification: 'transient',
              timestamp: Date.now(),
            })
          );
        } catch (sseError) {
          getLog().error({ err: sseError, conversationId }, 'sse_error_emit_failed');
        }
      } finally {
        await webAdapter.emitLockEvent(conversationId, false);
        // Clean up uploaded files AFTER handleMessage completes so the AI subprocess
        // has had a chance to read them. Doing this in the HTTP handler's finally block
        // would delete files while the fire-and-forget lock handler is still running.
        if (filesToCleanup) {
          for (const f of filesToCleanup.files) {
            await unlink(f.path).catch((err: NodeJS.ErrnoException) => {
              if (err.code !== 'ENOENT') {
                getLog().warn({ err, filePath: f.path, conversationId }, 'upload.cleanup_failed');
              }
            });
          }
          // Remove the now-empty upload directory for this conversation.
          await rm(filesToCleanup.uploadDir, { recursive: true, force: true }).catch(
            (err: NodeJS.ErrnoException) => {
              if (err.code !== 'ENOENT') {
                getLog().warn(
                  { err, uploadDir: filesToCleanup.uploadDir, conversationId },
                  'upload.dir_cleanup_failed'
                );
              }
            }
          );
        }
      }
    });

    if (result.status === 'queued-conversation' || result.status === 'queued-capacity') {
      // Intentionally fire-and-forget: the lock-acquire signal (locked: true) is sent
      // optimistically so the UI shows a queued state immediately. It is not awaited
      // because we want the HTTP response to return before the SSE write completes.
      // The lock-release signal (locked: false) IS awaited inside the task callback
      // above to guarantee ordering — all tool results and flush must precede the
      // release event on the SSE stream.
      webAdapter.emitLockEvent(conversationId, true);
    }

    return { accepted: true, status: result.status };
  }

  // GET /api/conversations - List conversations (scoped by user)
  registerOpenApiRoute(getConversationsRoute, async c => {
    try {
      const platformType = c.req.query('platform') ?? undefined;
      const codebaseId = c.req.query('codebaseId') ?? undefined;
      const { userId, isAdmin } = getUserId(c);
      const conversations =
        isAdmin || !userId
          ? await conversationDb.listConversations(50, platformType, codebaseId, true)
          : await conversationDb.listConversationsForUser(
              userId,
              50,
              platformType,
              codebaseId,
              true
            );
      return c.json(conversations);
    } catch (error) {
      getLog().error({ err: error }, 'list_conversations_failed');
      return apiError(c, 500, 'Failed to list conversations');
    }
  });

  // GET /api/conversations/:id - Get single conversation by platform conversation ID
  registerOpenApiRoute(getConversationRoute, async c => {
    const platformId = c.req.param('id') ?? '';
    try {
      const conv = await conversationDb.findConversationByPlatformId(platformId);
      if (!conv) {
        return apiError(c, 404, 'Conversation not found');
      }
      // Ownership check: non-admin users can only access their own conversations.
      // Return 404 (not 403) to avoid leaking existence of other users' conversations.
      const { userId, isAdmin } = getUserId(c);
      if (!isAdmin && userId && conv.user_id !== userId) {
        return apiError(c, 404, 'Conversation not found');
      }
      return c.json(conv);
    } catch (error) {
      getLog().error({ err: error, platformId }, 'get_conversation_failed');
      return apiError(c, 500, 'Failed to get conversation');
    }
  });

  // POST /api/conversations - Create new conversation
  // Accepts optional `message` field for atomic create+send (avoids ghost "Untitled" entries)
  registerOpenApiRoute(createConversationRoute, async c => {
    try {
      const { codebaseId, message } = getValidatedBody(c, createConversationBodySchema);

      // Validate codebase exists if provided
      if (codebaseId) {
        const codebase = await codebaseDb.getCodebase(codebaseId);
        if (!codebase) {
          return apiError(c, 400, 'Codebase not found', `No codebase with id "${codebaseId}"`);
        }
      }

      const conversationId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const conversation = await conversationDb.getOrCreateConversation(
        'web',
        conversationId,
        codebaseId
      );
      webAdapter.setConversationDbId(conversation.platform_conversation_id, conversation.id);

      // Set user_id on the conversation for ownership scoping
      const { userId } = getUserId(c);
      if (userId) {
        await conversationDb.setConversationUserId(conversation.id, userId);
      }

      // If message provided, dispatch it atomically (avoids ghost "Untitled" conversations)
      if (message) {
        try {
          await messageDb.addMessage(conversation.id, 'user', message);
        } catch (e: unknown) {
          // Log only (no SSE warning) — the SSE stream isn't connected yet for new conversations.
          // The existing /message endpoint emits a warning because the stream is guaranteed to be active.
          getLog().error({ err: e, conversationId: conversation.id }, 'message_persistence_failed');
        }

        // Set placeholder title immediately so the sidebar never shows "Untitled conversation"
        const placeholderTitle = message.length > 60 ? message.slice(0, 60) + '...' : message;
        await conversationDb.updateConversationTitle(conversation.id, placeholderTitle);

        // Generate proper AI title for non-command messages (fire-and-forget, overwrites placeholder)
        if (!message.startsWith('/')) {
          void generateAndSetTitle(
            conversation.id,
            message,
            conversation.ai_assistant_type,
            getArchonWorkspacesPath()
          );
        }

        const result = await dispatchToOrchestrator(conversation.platform_conversation_id, message);

        return c.json({
          conversationId: conversation.platform_conversation_id,
          id: conversation.id,
          dispatched: true,
          ...result,
        });
      }

      return c.json({ conversationId: conversation.platform_conversation_id, id: conversation.id });
    } catch (error) {
      getLog().error({ err: error }, 'create_conversation_failed');
      return apiError(c, 500, 'Failed to create conversation');
    }
  });

  // PATCH /api/conversations/:id - Update conversation (title)
  registerOpenApiRoute(updateConversationRoute, async c => {
    const platformId = c.req.param('id') ?? '';
    const { title } = getValidatedBody(c, updateConversationBodySchema);
    try {
      const conv = await conversationDb.findConversationByPlatformId(platformId);
      if (!conv) {
        return apiError(c, 404, 'Conversation not found');
      }
      // Ownership check: non-admin users can only modify their own conversations.
      const { userId, isAdmin } = getUserId(c);
      if (!isAdmin && userId && conv.user_id !== userId) {
        return apiError(c, 404, 'Conversation not found');
      }
      if (title !== undefined) {
        await conversationDb.updateConversationTitle(conv.id, title.slice(0, 255));
      }
      return c.json({ success: true });
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        return apiError(c, 404, 'Conversation not found');
      }
      getLog().error({ err: error }, 'update_conversation_failed');
      return apiError(c, 500, 'Failed to update conversation');
    }
  });

  // DELETE /api/conversations/:id - Soft delete
  registerOpenApiRoute(deleteConversationRoute, async c => {
    const platformId = c.req.param('id') ?? '';
    try {
      const conv = await conversationDb.findConversationByPlatformId(platformId);
      if (!conv) {
        return apiError(c, 404, 'Conversation not found');
      }
      // Ownership check: non-admin users can only delete their own conversations.
      const { userId, isAdmin } = getUserId(c);
      if (!isAdmin && userId && conv.user_id !== userId) {
        return apiError(c, 404, 'Conversation not found');
      }
      await conversationDb.softDeleteConversation(conv.id);
      return c.json({ success: true });
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        return apiError(c, 404, 'Conversation not found');
      }
      getLog().error({ err: error }, 'delete_conversation_failed');
      return apiError(c, 500, 'Failed to delete conversation');
    }
  });

  // GET /api/conversations/:id/messages - Message history
  registerOpenApiRoute(listMessagesRoute, async c => {
    const platformConversationId = c.req.param('id') ?? '';
    const limit = Math.min(Number(c.req.query('limit') ?? '200'), 500);
    try {
      const conv = await conversationDb.findConversationByPlatformId(platformConversationId);
      if (!conv) {
        return apiError(c, 404, 'Conversation not found');
      }
      const messages = await messageDb.listMessages(conv.id, limit);
      // Normalize metadata: PostgreSQL JSONB auto-deserializes to object,
      // but frontend expects JSON string. SQLite returns string already.
      return c.json(
        messages.map(m => ({
          ...m,
          metadata: typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata),
        }))
      );
    } catch (error) {
      getLog().error({ err: error }, 'list_messages_failed');
      return apiError(c, 500, 'Failed to list messages');
    }
  });

  // POST /api/conversations/:id/message - Send message
  // Manual body parsing: multipart uses parseBody(), JSON uses req.json().
  registerOpenApiRoute(sendMessageRoute, async c => {
    const conversationId = c.req.param('id') ?? '';

    // Reject conversation IDs that could be used for path traversal when building
    // the upload directory. Web conversation IDs are alphanumeric with hyphens only.
    if (!/^[\w-]+$/.test(conversationId)) {
      return c.json({ error: 'Invalid conversation ID' }, 400);
    }

    let message: string;
    const savedFiles: AttachedFile[] = [];
    let uploadDir = '';

    const contentType = c.req.header('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      let body: Record<string, string | File | (string | File)[]>;
      try {
        body = await c.req.parseBody({ all: true });
      } catch (parseErr: unknown) {
        getLog().warn({ err: parseErr, conversationId }, 'upload.parse_failed');
        return c.json({ error: 'Invalid multipart form data' }, 400);
      }

      const rawMessage = body.message;
      if (typeof rawMessage !== 'string' || !rawMessage) {
        return c.json({ error: 'message must be a non-empty string' }, 400);
      }
      message = rawMessage;

      const rawFiles = body.files;
      let fileList: (string | File)[];
      if (Array.isArray(rawFiles)) {
        fileList = rawFiles;
      } else if (rawFiles !== undefined) {
        fileList = [rawFiles];
      } else {
        fileList = [];
      }

      // Enforce server-side file count limit
      const fileEntries = fileList.filter((e): e is File => e instanceof File);
      if (fileEntries.length > MAX_FILES_PER_MESSAGE) {
        return c.json({ error: `Maximum ${String(MAX_FILES_PER_MESSAGE)} files per message` }, 400);
      }

      const archonHome = getArchonHome();
      uploadDir = join(archonHome, 'artifacts', 'uploads', conversationId);

      // Guard against path traversal in conversationId (belt-and-suspenders after regex above)
      if (!uploadDir.startsWith(archonHome + sep)) {
        return c.json({ error: 'Invalid conversation ID' }, 400);
      }

      // Validate all files before writing any to disk
      for (const entry of fileEntries) {
        const displayName = basename(entry.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        // Server-side MIME type allowlist (client-side accept= is not a security boundary;
        // entry.type is the Content-Type supplied by the client and is not verified against
        // actual file contents — suitable for a single-developer self-hosted tool)
        if (!isAllowedUploadType(entry.type, entry.name)) {
          return c.json(
            { error: `File "${displayName}" has an unsupported type: ${entry.type}` },
            400
          );
        }
        if (entry.size > MAX_UPLOAD_BYTES) {
          return c.json({ error: `File "${displayName}" exceeds the 10 MB size limit` }, 400);
        }
      }

      // Write files; on any failure clean up already-written files and surface the error
      try {
        await mkdir(uploadDir, { recursive: true });
        for (const entry of fileEntries) {
          const fileId = randomUUID();
          const safeName = basename(entry.name).replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = join(uploadDir, `${fileId}_${safeName}`);
          await writeFile(filePath, Buffer.from(await entry.arrayBuffer()));
          // Normalise MIME: strip parameters to prevent prompt injection via crafted Content-Type
          const normalizedMime =
            entry.type.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
          savedFiles.push({
            path: filePath,
            // Use safeName for display to avoid prompt injection via crafted filenames
            name: safeName || fileId,
            mimeType: normalizedMime,
            size: entry.size,
          });
        }
      } catch (writeErr: unknown) {
        // Roll back any files written before the failure
        for (const f of savedFiles) {
          await unlink(f.path).catch((err: NodeJS.ErrnoException) => {
            if (err.code !== 'ENOENT') {
              getLog().warn({ err, filePath: f.path, conversationId }, 'upload.rollback_failed');
            }
          });
        }
        getLog().error({ err: writeErr, conversationId }, 'upload.write_failed');
        return c.json({ error: 'Failed to save uploaded file. Check available disk space.' }, 500);
      }

      getLog().info({ conversationId, fileCount: savedFiles.length }, 'message.files_uploaded');
    } else {
      let body: { message?: unknown };
      try {
        body = await c.req.json();
      } catch (parseErr: unknown) {
        getLog().warn({ err: parseErr, conversationId }, 'message.json_parse_failed');
        return c.json({ error: 'Invalid JSON in request body' }, 400);
      }

      if (typeof body.message !== 'string' || !body.message) {
        return c.json({ error: 'message must be a non-empty string' }, 400);
      }
      message = body.message;
    }

    // Look up conversation for message persistence
    let conv: Awaited<ReturnType<typeof conversationDb.findConversationByPlatformId>> = null;
    try {
      conv = await conversationDb.findConversationByPlatformId(conversationId);
    } catch (e: unknown) {
      getLog().error({ err: e, conversationId }, 'conversation_lookup_failed');
    }

    // Persist user message and pass DB ID to adapter for assistant message persistence
    if (conv) {
      // Omit path from persisted metadata — the on-disk file is ephemeral and will be
      // deleted after the AI processes it; storing stale paths would confuse future readers.
      const meta =
        savedFiles.length > 0
          ? { files: savedFiles.map(f => ({ name: f.name, mimeType: f.mimeType, size: f.size })) }
          : undefined;
      try {
        await messageDb.addMessage(conv.id, 'user', message, meta);
      } catch (e: unknown) {
        getLog().error({ err: e, conversationId: conv.id }, 'message_persistence_failed');
        try {
          await webAdapter.emitSSE(
            conversationId,
            JSON.stringify({
              type: 'warning',
              message: 'Message could not be saved to history',
              timestamp: Date.now(),
            })
          );
        } catch (sseErr: unknown) {
          getLog().error({ err: sseErr, conversationId: conv?.id }, 'sse_warning_double_failure');
        }
      }
      webAdapter.setConversationDbId(conversationId, conv.id);
    }

    // Pass savedFiles to dispatchToOrchestrator so cleanup happens inside the lock handler,
    // AFTER handleMessage completes — not in the HTTP handler's finally block where the
    // fire-and-forget lock callback may still be running and the AI has not yet read the files.
    let extraContext: Omit<HandleMessageContext, 'isolationHints'> | undefined;
    let filesToCleanup: { files: AttachedFile[]; uploadDir: string } | undefined;
    if (savedFiles.length > 0) {
      extraContext = { attachedFiles: savedFiles };
      filesToCleanup = { files: savedFiles, uploadDir };
    }
    const result = await dispatchToOrchestrator(
      conversationId,
      message,
      extraContext,
      filesToCleanup
    );
    return c.json(result);
  });

  // GET /api/stream/__dashboard__ — multiplexed dashboard SSE (all workflow events)
  // IMPORTANT: Must be registered before /api/stream/:conversationId to avoid param capture.
  app.get('/api/stream/__dashboard__', async c => {
    return streamSSE(c, async stream => {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
      });

      webAdapter.registerStream('__dashboard__', stream);
      getLog().debug({ streamId: '__dashboard__' }, 'dashboard_sse_opened');

      stream.onAbort(() => {
        getLog().debug({ streamId: '__dashboard__' }, 'dashboard_sse_disconnected');
        webAdapter.removeStream('__dashboard__', stream);
      });

      try {
        while (true) {
          await stream.sleep(30000);
          if (!stream.closed) {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
            });
          }
        }
      } catch (e: unknown) {
        const msg = (e as Error).message ?? '';
        if (!msg.includes('aborted') && !msg.includes('closed') && !msg.includes('cancel')) {
          getLog().warn({ err: e as Error }, 'dashboard_sse_heartbeat_error');
        }
      } finally {
        webAdapter.removeStream('__dashboard__', stream);
        getLog().debug({ streamId: '__dashboard__' }, 'dashboard_sse_closed');
      }
    });
  });

  // GET /api/stream/:conversationId - SSE streaming
  app.get('/api/stream/:conversationId', async c => {
    const conversationId = c.req.param('conversationId');

    return streamSSE(c, async stream => {
      // Send initial heartbeat immediately to flush HTTP headers.
      // Without this, EventSource stays in CONNECTING state until the first write.
      await stream.writeSSE({
        data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
      });

      webAdapter.registerStream(conversationId, stream);
      getLog().debug({ conversationId }, 'sse_stream_opened');

      stream.onAbort(() => {
        getLog().debug({ conversationId }, 'sse_client_disconnected');
        webAdapter.removeStream(conversationId, stream);
      });

      try {
        while (true) {
          await stream.sleep(30000);
          if (!stream.closed) {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
            });
          }
        }
      } catch (e: unknown) {
        // stream.sleep() throws when client disconnects — expected behavior.
        // Log unexpected errors for debugging.
        const msg = (e as Error).message ?? '';
        if (!msg.includes('aborted') && !msg.includes('closed') && !msg.includes('cancel')) {
          getLog().warn({ err: e as Error, conversationId }, 'sse_heartbeat_error');
        }
      } finally {
        webAdapter.removeStream(conversationId, stream);
        getLog().debug({ conversationId }, 'sse_stream_closed');
      }
    });
  });

  // GET /api/codebases - List codebases (scoped by user membership)
  registerOpenApiRoute(listCodebasesRoute, async c => {
    try {
      const { userId, isAdmin } = getUserId(c);
      const codebases =
        isAdmin || !userId
          ? await codebaseDb.listCodebases()
          : await codebaseDb.listCodebasesForUser(userId);

      // Deduplicate by repository_url (keep most recently updated)
      const normalizeUrl = (url: string): string => url.replace(/\.git$/, '');
      const seen = new Map<string, (typeof codebases)[number]>();
      const deduped: (typeof codebases)[number][] = [];
      for (const cb of codebases) {
        if (!cb.repository_url) {
          deduped.push(cb);
          continue;
        }
        const key = normalizeUrl(cb.repository_url);
        const existing = seen.get(key);
        if (!existing || cb.updated_at > existing.updated_at) {
          seen.set(key, cb);
        }
      }
      deduped.push(...seen.values());
      deduped.sort((a, b) => a.name.localeCompare(b.name));

      return c.json(
        deduped.map(cb => {
          let commands = cb.commands;
          if (typeof commands === 'string') {
            try {
              commands = JSON.parse(commands);
            } catch (parseErr) {
              getLog().error({ err: parseErr, codebaseId: cb.id }, 'corrupted_commands_json');
              commands = {};
            }
          }
          return { ...cb, commands };
        })
      );
    } catch (error) {
      getLog().error({ err: error }, 'list_codebases_failed');
      return apiError(c, 500, 'Failed to list codebases');
    }
  });

  // GET /api/codebases/:id - Codebase detail
  registerOpenApiRoute(getCodebaseRoute, async c => {
    try {
      const codebase = await codebaseDb.getCodebase(c.req.param('id') ?? '');
      if (!codebase) {
        return apiError(c, 404, 'Codebase not found');
      }
      let commands = codebase.commands;
      if (typeof commands === 'string') {
        try {
          commands = JSON.parse(commands);
        } catch (parseErr) {
          getLog().error({ err: parseErr, codebaseId: codebase.id }, 'corrupted_commands_json');
          commands = {};
        }
      }
      return c.json({ ...codebase, commands });
    } catch (error) {
      getLog().error({ err: error }, 'get_codebase_failed');
      return apiError(c, 500, 'Failed to get codebase');
    }
  });

  // POST /api/codebases - Add a project (clone from URL or register local path)
  registerOpenApiRoute(addCodebaseRoute, async c => {
    const body = getValidatedBody(c, addCodebaseBodySchema);

    try {
      // .refine() guarantees exactly one of url/path is present
      const result = body.url
        ? await cloneRepository(body.url, body.allowEnvKeys)
        : await registerRepository(body.path ?? '', body.allowEnvKeys);

      // Fetch the full codebase record for a consistent response
      const codebase = await codebaseDb.getCodebase(result.codebaseId);
      if (!codebase) {
        return apiError(c, 500, 'Codebase created but not found');
      }

      // Auto-add creator as owner of the project
      const { userId } = getUserId(c);
      if (userId) {
        try {
          await usersDb.createProjectMember(userId, result.codebaseId, 'owner');
        } catch (e) {
          const err = e as Error & { code?: string };
          // PostgreSQL unique violation: 23505; SQLite: UNIQUE constraint failed
          const isDuplicate =
            err.code === '23505' || (err.message?.includes('UNIQUE constraint failed') ?? false);
          if (!isDuplicate) {
            // Unexpected error — log for debugging but don't fail the codebase creation
            getLog().warn(
              { err, userId, codebaseId: result.codebaseId },
              'codebase.owner_membership_failed'
            );
          }
        }
      }

      return c.json(codebase, result.alreadyExisted ? 200 : 201);
    } catch (error) {
      if (error instanceof EnvLeakError) {
        const path = body.url ?? body.path ?? '';
        const files = error.report.findings.map(f => f.file);
        getLog().warn({ path, files }, 'add_codebase_env_leak_refused');
        return apiError(c, 422, error.message);
      }
      getLog().error({ err: error }, 'add_codebase_failed');
      return apiError(
        c,
        500,
        `Failed to add codebase: ${(error as Error).message ?? 'unknown error'}`
      );
    }
  });

  // PATCH /api/codebases/:id - Update consent flags
  registerOpenApiRoute(updateCodebaseRoute, async c => {
    const id = c.req.param('id') ?? '';
    const body = getValidatedBody(c, updateCodebaseBodySchema);
    try {
      const codebase = await codebaseDb.getCodebase(id);
      if (!codebase) {
        return apiError(c, 404, 'Codebase not found');
      }

      // Capture scanner findings for the audit log (best-effort — path may be gone)
      let files: string[] = [];
      let keys: string[] = [];
      let scanStatus: 'ok' | 'skipped' = 'ok';
      try {
        const report = scanPathForSensitiveKeys(codebase.default_cwd);
        files = report.findings.map(f => f.file);
        keys = Array.from(new Set(report.findings.flatMap(f => f.keys)));
      } catch (scanErr) {
        scanStatus = 'skipped';
        getLog().warn(
          { err: scanErr, codebaseId: id, path: codebase.default_cwd },
          'env_leak_consent_scan_skipped'
        );
      }

      await codebaseDb.updateCodebaseAllowEnvKeys(id, body.allowEnvKeys);

      // Audit log: emitted unconditionally on every grant/revoke. `scanStatus`
      // distinguishes "scanned and these are the findings" from "could not
      // scan, files/keys are empty for that reason" — important for later
      // security review of the audit trail.
      getLog().warn(
        {
          codebaseId: id,
          name: codebase.name,
          path: codebase.default_cwd,
          files,
          keys,
          scanStatus,
          actor: 'user-ui',
        },
        body.allowEnvKeys ? 'env_leak_consent_granted' : 'env_leak_consent_revoked'
      );

      const updated = await codebaseDb.getCodebase(id);
      if (!updated) {
        return apiError(c, 500, 'Codebase updated but not found');
      }
      let commands = updated.commands;
      if (typeof commands === 'string') {
        try {
          commands = JSON.parse(commands);
        } catch (parseErr) {
          getLog().error({ err: parseErr, codebaseId: id }, 'corrupted_commands_json');
          commands = {};
        }
      }
      return c.json({ ...updated, commands });
    } catch (error) {
      getLog().error({ err: error, codebaseId: id }, 'update_codebase_failed');
      return apiError(c, 500, 'Failed to update codebase');
    }
  });

  // DELETE /api/codebases/:id - Delete a project and clean up
  registerOpenApiRoute(deleteCodebaseRoute, async c => {
    const id = c.req.param('id') ?? '';
    try {
      const codebase = await codebaseDb.getCodebase(id);
      if (!codebase) {
        return apiError(c, 404, 'Codebase not found');
      }

      // Clean up isolation environments (worktrees)
      const environments = await isolationEnvDb.listByCodebase(id);
      for (const env of environments) {
        try {
          await removeWorktree(toRepoPath(codebase.default_cwd), toWorktreePath(env.working_path));
          getLog().info({ path: env.working_path }, 'worktree_removed');
        } catch (wtErr) {
          // Worktree may already be gone — log but continue
          getLog().warn({ err: wtErr, path: env.working_path }, 'worktree_remove_failed');
        }
        await isolationEnvDb.updateStatus(env.id, 'destroyed');
      }

      // Delete from database (unlinks conversations and sessions)
      await codebaseDb.deleteCodebase(id);

      // Remove workspace directory from disk — only for Archon-managed repos
      const workspacesRoot = normalize(getArchonWorkspacesPath());
      const normalizedCwd = normalize(codebase.default_cwd);
      if (
        normalizedCwd.startsWith(workspacesRoot + '/') ||
        normalizedCwd.startsWith(workspacesRoot + '\\')
      ) {
        try {
          await rm(normalizedCwd, { recursive: true, force: true });
          getLog().info({ path: normalizedCwd }, 'workspace_removed');
        } catch (rmErr) {
          // Directory may not exist — log but don't fail
          getLog().warn({ err: rmErr, path: codebase.default_cwd }, 'workspace_remove_failed');
        }
      } else {
        getLog().info({ path: codebase.default_cwd }, 'external_repo_skip_deletion');
      }

      return c.json({ success: true });
    } catch (error) {
      getLog().error({ err: error }, 'delete_codebase_failed');
      return apiError(c, 500, 'Failed to delete codebase');
    }
  });

  // GET /api/codebases/:id/env - List env var keys for a codebase (values never returned)
  registerOpenApiRoute(listEnvVarsRoute, async c => {
    const id = c.req.param('id') ?? '';
    try {
      const codebase = await codebaseDb.getCodebase(id);
      if (!codebase) return apiError(c, 404, 'Codebase not found');
      const envVars = await envVarDb.getCodebaseEnvVars(id);
      return c.json({ keys: Object.keys(envVars) });
    } catch (error) {
      getLog().error({ err: error, codebaseId: id }, 'list_env_vars_failed');
      return apiError(c, 500, 'Failed to list env vars');
    }
  });

  // PUT /api/codebases/:id/env - Set (upsert) an env var
  registerOpenApiRoute(setEnvVarRoute, async c => {
    const id = c.req.param('id') ?? '';
    try {
      const body = getValidatedBody(c, setEnvVarBodySchema);
      const codebase = await codebaseDb.getCodebase(id);
      if (!codebase) return apiError(c, 404, 'Codebase not found');
      await envVarDb.setCodebaseEnvVar(id, body.key, body.value);
      return c.json({ success: true });
    } catch (error) {
      getLog().error({ err: error, codebaseId: id }, 'set_env_var_failed');
      return apiError(c, 500, 'Failed to set env var');
    }
  });

  // DELETE /api/codebases/:id/env/:key - Delete an env var
  registerOpenApiRoute(deleteEnvVarRoute, async c => {
    const id = c.req.param('id') ?? '';
    const key = c.req.param('key') ?? '';
    try {
      const codebase = await codebaseDb.getCodebase(id);
      if (!codebase) return apiError(c, 404, 'Codebase not found');
      await envVarDb.deleteCodebaseEnvVar(id, key);
      return c.json({ success: true });
    } catch (error) {
      getLog().error({ err: error, codebaseId: id, key }, 'delete_env_var_failed');
      return apiError(c, 500, 'Failed to delete env var');
    }
  });

  /**
   * Register a route with OpenAPI spec generation and input validation.
   * Zod validates inputs (query, params, body) at runtime via defaultHook.
   * Response schemas are used for OpenAPI spec generation only — output is not
   * validated at runtime. The `as never` cast bypasses TypedResponse constraints.
   */
  function registerOpenApiRoute(
    route: ReturnType<typeof createRoute>,
    handler: (c: Context) => Response | Promise<Response>
  ): void {
    app.openapi(route, handler as never);
  }

  // Serve OpenAPI spec
  app.doc('/api/openapi.json', {
    openapi: '3.0.0',
    info: { title: 'Archon API', version: '1.0.0' },
  });

  // =========================================================================
  // Workflow endpoints
  // =========================================================================

  // GET /api/workflows - Discover available workflows
  registerOpenApiRoute(getWorkflowsRoute, async c => {
    try {
      const cwd = c.req.query('cwd');
      let workingDir = cwd;

      // Validate caller-supplied cwd against registered codebase paths
      if (cwd) {
        if (!(await validateCwd(cwd))) {
          return apiError(c, 400, 'Invalid cwd: must match a registered codebase path');
        }
      } else {
        // Fallback to first codebase's default_cwd
        const codebases = await codebaseDb.listCodebases();
        if (codebases.length > 0) {
          workingDir = codebases[0].default_cwd;
        }
      }

      if (!workingDir) {
        return c.json({ workflows: [] });
      }

      const getDbWorkflows = async (): Promise<WorkflowWithSource[]> => {
        const records = await workflowDefinitionsDb.listWorkflowDefinitions();
        const results: WorkflowWithSource[] = [];
        for (const record of records) {
          const parsed = parseWorkflow(record.definition, `${record.name}.yaml`);
          if (parsed.error) {
            getLog().warn(
              { name: record.name, err: parsed.error.error },
              'workflow.db_record_parse_failed'
            );
            continue;
          }
          results.push({ workflow: parsed.workflow, source: 'db' });
        }
        return results;
      };

      const result = await discoverWorkflowsWithConfig(workingDir, loadConfig, { getDbWorkflows });
      return c.json({
        workflows: result.workflows.map(ws => ({ workflow: ws.workflow, source: ws.source })),
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      // Workflow discovery can fail if cwd is stale or deleted — return empty with warning
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err }, 'workflow_discovery_failed');
      return apiError(c, 500, `Workflow discovery failed: ${err.message}`);
    }
  });

  // POST /api/workflows/:name/run - Run a workflow via the orchestrator
  registerOpenApiRoute(runWorkflowRoute, async c => {
    const workflowName = c.req.param('name') ?? '';
    if (!isValidCommandName(workflowName)) {
      return apiError(c, 400, 'Invalid workflow name');
    }
    try {
      const { conversationId, message } = getValidatedBody(c, runWorkflowBodySchema);
      // Persist user message and register DB ID (same as message endpoint)
      let conv: Awaited<ReturnType<typeof conversationDb.findConversationByPlatformId>> = null;
      try {
        conv = await conversationDb.findConversationByPlatformId(conversationId);
      } catch (e: unknown) {
        getLog().error({ err: e, conversationId }, 'conversation_lookup_failed');
      }
      if (conv) {
        try {
          await messageDb.addMessage(conv.id, 'user', message);
        } catch (e: unknown) {
          getLog().error({ err: e, conversationId: conv.id }, 'message_persistence_failed');
        }
        webAdapter.setConversationDbId(conversationId, conv.id);
        // Generate title for sidebar (fire-and-forget)
        if (!conv.title) {
          void generateAndSetTitle(
            conv.id,
            message,
            conv.ai_assistant_type,
            getArchonWorkspacesPath(),
            workflowName
          );
        }
      }

      const fullMessage = `/workflow run ${workflowName} ${message}`;
      const result = await dispatchToOrchestrator(conversationId, fullMessage);
      return c.json(result);
    } catch (error) {
      getLog().error({ err: error }, 'run_workflow_failed');
      return apiError(c, 500, 'Failed to run workflow');
    }
  });

  // GET /api/dashboard/runs - Enriched workflow runs for Command Center
  // Supports server-side search, status/date filtering, and offset pagination.
  registerOpenApiRoute(getDashboardRunsRoute, async c => {
    try {
      const rawStatus = c.req.query('status');
      type DashboardRunStatus = (typeof workflowRunStatusSchema)['_type'];
      const status: DashboardRunStatus | undefined =
        rawStatus && (workflowRunStatusSchema.options as readonly string[]).includes(rawStatus)
          ? (rawStatus as DashboardRunStatus)
          : undefined;
      const codebaseId = c.req.query('codebaseId') ?? undefined;
      const search = c.req.query('search')?.trim() || undefined;
      const after = c.req.query('after') ?? undefined;
      const before = c.req.query('before') ?? undefined;
      const limitRaw = Number(c.req.query('limit'));
      const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(1, limitRaw), 200);
      const offsetRaw = Number(c.req.query('offset'));
      const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw);

      const result = await workflowDb.listDashboardRuns({
        status,
        codebaseId,
        search,
        after,
        before,
        limit,
        offset,
      });
      return c.json(result);
    } catch (error) {
      getLog().error({ err: error }, 'list_dashboard_runs_failed');
      return apiError(c, 500, 'Failed to list dashboard runs');
    }
  });

  // POST /api/workflows/runs/:runId/cancel - Cancel a workflow run
  registerOpenApiRoute(cancelWorkflowRunRoute, async c => {
    try {
      const runId = c.req.param('runId') ?? '';
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      if (run.status !== 'running' && run.status !== 'pending' && run.status !== 'paused') {
        return apiError(c, 400, `Cannot cancel workflow in '${run.status}' status`);
      }
      await workflowDb.cancelWorkflowRun(runId);
      return c.json({ success: true, message: `Cancelled workflow: ${run.workflow_name}` });
    } catch (error) {
      getLog().error({ err: error }, 'cancel_workflow_run_api_failed');
      return apiError(c, 500, 'Failed to cancel workflow run');
    }
  });

  // POST /api/workflows/runs/:runId/resume - Resume a workflow run
  registerOpenApiRoute(resumeWorkflowRunRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      if (!RESUMABLE_WORKFLOW_STATUSES.includes(run.status)) {
        return apiError(c, 400, `Cannot resume workflow in '${run.status}' status`);
      }
      // Run is already failed — the next invocation on the same path auto-resumes
      const pathInfo = run.working_path ? ` at \`${run.working_path}\`` : '';
      return c.json({
        success: true,
        message: `Workflow run ready to resume: ${run.workflow_name}${pathInfo}. Re-run the workflow to auto-resume from completed nodes.`,
      });
    } catch (error) {
      getLog().error({ err: error, runId }, 'api.workflow_run_resume_failed');
      return apiError(c, 500, 'Failed to resume workflow run');
    }
  });

  // POST /api/workflows/runs/:runId/abandon - Abandon a workflow run
  registerOpenApiRoute(abandonWorkflowRunRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      if (TERMINAL_WORKFLOW_STATUSES.includes(run.status)) {
        return apiError(c, 400, `Cannot abandon workflow in '${run.status}' status`);
      }
      await workflowDb.cancelWorkflowRun(runId);
      return c.json({ success: true, message: `Abandoned workflow: ${run.workflow_name}` });
    } catch (error) {
      getLog().error({ err: error, runId }, 'api.workflow_run_abandon_failed');
      return apiError(c, 500, 'Failed to abandon workflow run');
    }
  });

  // POST /api/workflows/runs/:runId/approve - Approve a paused workflow run
  registerOpenApiRoute(approveWorkflowRunRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      if (run.status !== 'paused') {
        return apiError(c, 400, `Cannot approve workflow in '${run.status}' status`);
      }
      const body = (await c.req.json().catch(() => ({}))) as { comment?: string };
      const comment = body.comment ?? 'Approved';
      const approval = run.metadata.approval as ApprovalContext | undefined;
      if (!approval?.nodeId) {
        return apiError(c, 400, 'Workflow run is paused but missing approval context');
      }
      // For interactive loops, do NOT write node_completed — the executor writes it when
      // the AI emits the completion signal (actual loop exit). Writing it here would cause
      // the resume to skip the loop node entirely via priorCompletedNodes.
      if (approval.type !== 'interactive_loop') {
        const nodeOutput = approval.captureResponse === true ? comment : '';
        await workflowEventDb.createWorkflowEvent({
          workflow_run_id: runId,
          event_type: 'node_completed',
          step_name: approval.nodeId,
          data: { node_output: nodeOutput, approval_decision: 'approved' },
        });
      }
      await workflowEventDb.createWorkflowEvent({
        workflow_run_id: runId,
        event_type: 'approval_received',
        step_name: approval.nodeId,
        data: { decision: 'approved', comment },
      });
      // For interactive loops, store user input; for standard approvals, mark as approved
      // and clear any rejection state.
      const metadataUpdate =
        approval.type === 'interactive_loop'
          ? { loop_user_input: comment }
          : { approval_response: 'approved', rejection_reason: '', rejection_count: 0 };
      await workflowDb.updateWorkflowRun(runId, {
        status: 'failed',
        metadata: metadataUpdate,
      });
      return c.json({
        success: true,
        message: `Workflow approved: ${run.workflow_name}. Send a message to continue the workflow.`,
      });
    } catch (error) {
      getLog().error({ err: error, runId }, 'api.workflow_run_approve_failed');
      return apiError(c, 500, 'Failed to approve workflow run');
    }
  });

  // POST /api/workflows/runs/:runId/reject - Reject a paused workflow run
  registerOpenApiRoute(rejectWorkflowRunRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      if (run.status !== 'paused') {
        return apiError(c, 400, `Cannot reject workflow in '${run.status}' status`);
      }
      const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
      const reason = body.reason ?? 'Rejected';
      const approval = run.metadata.approval as ApprovalContext | undefined;
      await workflowEventDb.createWorkflowEvent({
        workflow_run_id: runId,
        event_type: 'approval_received',
        step_name: approval?.nodeId ?? 'unknown',
        data: { decision: 'rejected', reason },
      });

      const hasOnReject = approval?.onRejectPrompt !== undefined;
      if (hasOnReject) {
        const currentCount = (run.metadata.rejection_count as number | undefined) ?? 0;
        const maxAttempts = approval?.onRejectMaxAttempts ?? 3;
        if (currentCount + 1 >= maxAttempts) {
          await workflowDb.cancelWorkflowRun(runId);
          return c.json({
            success: true,
            message: `Workflow rejected and cancelled (max attempts reached): ${run.workflow_name}`,
          });
        }
        await workflowDb.updateWorkflowRun(runId, {
          status: 'failed',
          metadata: { rejection_reason: reason, rejection_count: currentCount + 1 },
        });
        return c.json({
          success: true,
          message: `Workflow rejected: ${run.workflow_name}. On-reject prompt will run on resume.`,
        });
      }

      await workflowDb.cancelWorkflowRun(runId);
      return c.json({
        success: true,
        message: `Workflow rejected: ${run.workflow_name}`,
      });
    } catch (error) {
      getLog().error({ err: error, runId }, 'api.workflow_run_reject_failed');
      return apiError(c, 500, 'Failed to reject workflow run');
    }
  });

  // DELETE /api/workflows/runs/:runId - Delete a workflow run
  registerOpenApiRoute(deleteWorkflowRunRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      if (!TERMINAL_WORKFLOW_STATUSES.includes(run.status)) {
        return apiError(
          c,
          400,
          `Cannot delete workflow in '${run.status}' status — cancel it first`
        );
      }
      await workflowDb.deleteWorkflowRun(runId);
      return c.json({ success: true, message: `Deleted workflow run: ${run.workflow_name}` });
    } catch (error) {
      getLog().error({ err: error, runId }, 'api.workflow_run_delete_failed');
      return apiError(c, 500, 'Failed to delete workflow run');
    }
  });

  // GET /api/workflows/runs/:runId/summary - Lightweight run summary with node counts
  registerOpenApiRoute(getWorkflowRunSummaryRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) return apiError(c, 404, 'Workflow run not found');
      const events = await workflowEventDb.listWorkflowEvents(runId);
      const nodesCompleted = events.filter(e => e.event_type === 'node_completed').length;
      const nodesFailed = events.filter(e => e.event_type === 'node_failed').length;
      return c.json({
        id: run.id,
        workflow_name: run.workflow_name,
        status: run.status,
        started_at: run.started_at instanceof Date ? run.started_at.toISOString() : run.started_at,
        completed_at:
          run.completed_at instanceof Date ? run.completed_at.toISOString() : run.completed_at,
        last_activity_at:
          run.last_activity_at instanceof Date
            ? run.last_activity_at.toISOString()
            : run.last_activity_at,
        nodes_completed: nodesCompleted,
        nodes_failed: nodesFailed,
        nodes_total: typeof run.metadata.total_nodes === 'number' ? run.metadata.total_nodes : null,
      });
    } catch (error) {
      getLog().error({ err: error, runId }, 'api.workflow_run_summary_failed');
      return apiError(c, 500, 'Failed to get workflow run summary');
    }
  });

  // POST /api/workflows/runs/:runId/nodes/:nodeId/complete - Mark a DAG node as completed
  registerOpenApiRoute(nodeCompleteRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    const nodeId = c.req.param('nodeId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) return apiError(c, 404, 'Workflow run not found');
      if (run.status !== 'running') {
        return apiError(c, 400, `Cannot complete node on workflow in '${run.status}' status`);
      }
      const body = getValidatedBody(c, nodeCompleteBodySchema);
      await workflowEventDb.createWorkflowEvent({
        workflow_run_id: runId,
        event_type: 'node_completed',
        step_name: nodeId,
        data: { node_output: body.output ?? '' },
      });
      if (run.conversation_id) {
        await webAdapter.emitSSE(
          run.conversation_id,
          JSON.stringify({ type: 'node_completed', runId, nodeId, timestamp: Date.now() })
        );
      }
      return c.json({ success: true, message: `Node '${nodeId}' marked as completed` });
    } catch (error) {
      getLog().error({ err: error, runId, nodeId }, 'api.node_complete_failed');
      return apiError(c, 500, 'Failed to mark node as completed');
    }
  });

  // POST /api/workflows/runs/:runId/nodes/:nodeId/gate-result - Record quality gate result
  registerOpenApiRoute(nodeGateResultRoute, async c => {
    const runId = c.req.param('runId') ?? '';
    const nodeId = c.req.param('nodeId') ?? '';
    try {
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) return apiError(c, 404, 'Workflow run not found');
      if (run.status !== 'running') {
        return apiError(c, 400, `Cannot record gate result on workflow in '${run.status}' status`);
      }
      const body = getValidatedBody(c, nodeGateResultBodySchema);
      await workflowEventDb.createWorkflowEvent({
        workflow_run_id: runId,
        event_type: body.passed ? 'node_completed' : 'node_failed',
        step_name: nodeId,
        data: { gate_passed: body.passed, gate_reason: body.reason ?? '' },
      });
      if (run.conversation_id) {
        await webAdapter.emitSSE(
          run.conversation_id,
          JSON.stringify({
            type: 'gate_result',
            runId,
            nodeId,
            passed: body.passed,
            timestamp: Date.now(),
          })
        );
      }
      const outcome = body.passed ? 'passed' : 'failed';
      return c.json({ success: true, message: `Quality gate ${outcome} for node '${nodeId}'` });
    } catch (error) {
      getLog().error({ err: error, runId, nodeId }, 'api.node_gate_result_failed');
      return apiError(c, 500, 'Failed to record gate result');
    }
  });

  // GET /api/workflows/runs - List workflow runs
  registerOpenApiRoute(listWorkflowRunsRoute, async c => {
    try {
      const conversationId = c.req.query('conversationId') ?? undefined;
      const rawStatus = c.req.query('status');
      type WorkflowRunStatus = (typeof workflowRunStatusSchema)['_type'];
      const status: WorkflowRunStatus | undefined =
        rawStatus && (workflowRunStatusSchema.options as readonly string[]).includes(rawStatus)
          ? (rawStatus as WorkflowRunStatus)
          : undefined;
      const codebaseId = c.req.query('codebaseId') ?? undefined;
      const limitRaw = Number(c.req.query('limit'));
      const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(1, limitRaw), 200);

      const runs = await workflowDb.listWorkflowRuns({
        conversationId,
        status,
        limit,
        codebaseId,
      });
      return c.json({ runs });
    } catch (error) {
      getLog().error({ err: error }, 'list_workflow_runs_failed');
      return apiError(c, 500, 'Failed to list workflow runs');
    }
  });

  // GET /api/workflows/runs/by-worker/:platformId - Look up run by worker conversation
  // Must be registered before :runId to avoid "by-worker" matching as a runId
  registerOpenApiRoute(getWorkflowRunByWorkerRoute, async c => {
    try {
      const platformId = c.req.param('platformId') ?? '';
      const run = await workflowDb.getWorkflowRunByWorkerPlatformId(platformId);
      if (!run) {
        return apiError(c, 404, 'No workflow run found for this worker');
      }
      return c.json({ run });
    } catch (error) {
      getLog().error({ err: error }, 'workflow_run_by_worker_lookup_failed');
      return apiError(c, 500, 'Failed to look up workflow run');
    }
  });

  // GET /api/workflows/runs/:runId - Get run details with events
  registerOpenApiRoute(getWorkflowRunRoute, async c => {
    try {
      const runId = c.req.param('runId') ?? '';
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      const events = await workflowEventDb.listWorkflowEvents(runId);

      // Look up the run's conversation platform ID.
      // For web runs (parent_conversation_id set): conversation_id is the worker conversation → set worker_platform_id
      // For CLI runs (no parent): conversation_id is the single conversation → set conversation_platform_id only
      let workerPlatformId: string | undefined;
      let conversationPlatformId: string | undefined;
      if (run.conversation_id) {
        const conv = await conversationDb.getConversationById(run.conversation_id);
        if (run.parent_conversation_id) {
          // Web run: conversation_id points to the worker conversation
          workerPlatformId = conv?.platform_conversation_id;
        } else {
          // CLI run: conversation_id is the only conversation (no worker/parent split)
          conversationPlatformId = conv?.platform_conversation_id;
        }
      }

      // Look up parent conversation to get its platform_conversation_id for navigation
      let parentPlatformId: string | undefined;
      if (run.parent_conversation_id) {
        const parentConv = await conversationDb.getConversationById(run.parent_conversation_id);
        parentPlatformId = parentConv?.platform_conversation_id;
      }

      return c.json({
        run: {
          ...run,
          worker_platform_id: workerPlatformId,
          parent_platform_id: parentPlatformId,
          conversation_platform_id: conversationPlatformId ?? null,
        },
        events,
      });
    } catch (error) {
      getLog().error({ err: error }, 'get_workflow_run_failed');
      return apiError(c, 500, 'Failed to get workflow run');
    }
  });

  // GET /api/workflows/runs/:runId/summary - Run summary with node states + gate results
  registerOpenApiRoute(getRunSummaryRoute, async c => {
    try {
      const runId = c.req.param('runId') ?? '';
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      const nodeStates = await nodeStateDb.getNodeStates(runId);
      const nodes = await Promise.all(
        nodeStates.map(async ns => ({
          nodeState: ns,
          testResults: await nodeStateDb.getTestResults(ns.id),
        }))
      );
      return c.json({ runId, nodes });
    } catch (error) {
      getLog().error({ err: error }, 'get_run_summary_failed');
      return apiError(c, 500, 'Failed to get run summary');
    }
  });

  // GET /api/workflows/runs/:runId/events - Paginated events listing
  registerOpenApiRoute(getWorkflowRunEventsRoute, async c => {
    try {
      const runId = c.req.param('runId') ?? '';
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }

      const limitStr = c.req.query('limit');
      const offsetStr = c.req.query('offset');
      const eventType = c.req.query('event_type');

      const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200);
      const offset = Math.max(Number(offsetStr) || 0, 0);

      const [events, total] = await Promise.all([
        workflowEventDb.listWorkflowEventsPaginated(runId, limit, offset, eventType),
        workflowEventDb.countWorkflowEvents(runId, eventType),
      ]);

      return c.json({ events, total, limit, offset });
    } catch (error) {
      getLog().error({ err: error }, 'get_workflow_run_events_failed');
      return apiError(c, 500, 'Failed to get workflow run events');
    }
  });

  // GET /api/workflows/runs/:runId/timeline - Computed timeline view
  registerOpenApiRoute(getWorkflowRunTimelineRoute, async c => {
    try {
      const runId = c.req.param('runId') ?? '';
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }

      const events = await workflowEventDb.listWorkflowEvents(runId);

      // Build timeline from raw events
      interface TimelineEntry {
        timestamp: string;
        node_id: string | null;
        event: string;
        duration_ms: number | null;
        details: Record<string, unknown>;
      }

      const timeline: TimelineEntry[] = [];
      const nodeStartTimes = new Map<string, string>();

      for (const evt of events) {
        const nodeId = evt.step_name;

        if (
          evt.event_type === 'workflow_started' ||
          evt.event_type === 'workflow_completed' ||
          evt.event_type === 'workflow_failed' ||
          evt.event_type === 'workflow_cancelled'
        ) {
          timeline.push({
            timestamp: evt.created_at,
            node_id: null,
            event: evt.event_type,
            duration_ms: null,
            details: evt.data,
          });
          continue;
        }

        if (evt.event_type === 'node_started' && nodeId) {
          nodeStartTimes.set(nodeId, evt.created_at);
          timeline.push({
            timestamp: evt.created_at,
            node_id: nodeId,
            event: evt.event_type,
            duration_ms: null,
            details: evt.data,
          });
          continue;
        }

        if ((evt.event_type === 'node_completed' || evt.event_type === 'node_failed') && nodeId) {
          const startTime = nodeStartTimes.get(nodeId);
          const durationMs = startTime
            ? new Date(evt.created_at).getTime() - new Date(startTime).getTime()
            : null;
          timeline.push({
            timestamp: evt.created_at,
            node_id: nodeId,
            event: evt.event_type,
            duration_ms: durationMs,
            details: evt.data,
          });
          continue;
        }

        // All other events (gate_started, gate_completed, gate_failed, step_*, etc.)
        timeline.push({
          timestamp: evt.created_at,
          node_id: nodeId,
          event: evt.event_type,
          duration_ms: null,
          details: evt.data,
        });
      }

      // Compute total duration from first to last event
      let totalDurationMs: number | null = null;
      if (events.length >= 2) {
        const first = new Date(events[0].created_at).getTime();
        const last = new Date(events[events.length - 1].created_at).getTime();
        totalDurationMs = last - first;
      }

      return c.json({
        run_id: runId,
        workflow_name: run.workflow_name,
        status: run.status,
        timeline,
        total_duration_ms: totalDurationMs,
      });
    } catch (error) {
      getLog().error({ err: error }, 'get_workflow_run_timeline_failed');
      return apiError(c, 500, 'Failed to get workflow run timeline');
    }
  });

  // POST /api/workflows/runs/:runId/nodes/:nodeId/gate-result - Store gate result
  registerOpenApiRoute(storeGateResultRoute, async c => {
    try {
      const runId = c.req.param('runId') ?? '';
      const nodeId = c.req.param('nodeId') ?? '';
      const run = await workflowDb.getWorkflowRun(runId);
      if (!run) {
        return apiError(c, 404, 'Workflow run not found');
      }
      const body = getValidatedBody(c, storeGateResultBodySchema);

      // Get or create node state, then append gate result.
      // Cast body to GateResult: Zod validation applies .default([]) for failures,
      // so the runtime value always has failures populated. The type mismatch is
      // due to Zod input vs output types when using .default().
      const gateResult = body as import('@archon/workflows/schemas/gate').GateResult;
      const nodeState = await nodeStateDb.getNodeState(runId, nodeId);
      const existingResults = nodeState?.gate_results ?? [];
      await nodeStateDb.upsertNodeState({
        workflow_run_id: runId,
        node_id: nodeId,
        status: nodeState?.status ?? 'running',
        output: nodeState?.output,
        gate_results: [...existingResults, gateResult],
      });
      return c.json({ success: true });
    } catch (error) {
      getLog().error({ err: error }, 'store_gate_result_failed');
      return apiError(c, 500, 'Failed to store gate result');
    }
  });

  // POST /api/workflows/validate - Validate a workflow definition without saving
  // MUST be registered before GET /api/workflows/:name so "validate" is not treated as :name
  registerOpenApiRoute(validateWorkflowRoute, async c => {
    const { definition } = getValidatedBody(c, validateWorkflowBodySchema);

    let yamlContent: string;
    try {
      yamlContent = Bun.YAML.stringify(definition);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err }, 'workflow.serialize_failed');
      return apiError(c, 400, 'Failed to serialize workflow definition');
    }

    try {
      const result = parseWorkflow(yamlContent, 'validate-input.yaml');

      if (result.error) {
        return c.json({ valid: false, errors: [result.error.error] });
      }
      return c.json({ valid: true });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err }, 'workflow.validate_failed');
      return apiError(c, 500, 'Failed to validate workflow');
    }
  });

  // POST /api/workflows/import - Import a workflow from raw YAML into the database
  // MUST be registered before GET /api/workflows/:name so "import" is not treated as :name
  registerOpenApiRoute(importWorkflowRoute, async c => {
    const { yaml } = getValidatedBody(c, importWorkflowBodySchema);
    const parsed = parseWorkflow(yaml, 'import.yaml');
    if (parsed.error) {
      return apiError(c, 400, 'Invalid workflow YAML', parsed.error.error);
    }

    try {
      await workflowDefinitionsDb.upsertWorkflowDefinition({
        name: parsed.workflow.name,
        description: parsed.workflow.description ?? null,
        definition: JSON.stringify(parsed.workflow),
        source: 'imported',
        codebase_id: null,
      });

      return c.json({
        workflow: parsed.workflow,
        filename: `${parsed.workflow.name}.yaml`,
        source: 'db' as WorkflowSource,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err, name: parsed.workflow.name }, 'workflow.import_failed');
      return apiError(c, 500, 'Failed to import workflow');
    }
  });

  // GET /api/workflows/:name/export - Export a workflow as YAML text
  registerOpenApiRoute(exportWorkflowRoute, async c => {
    const name = c.req.param('name') ?? '';
    const cwd = c.req.query('cwd') ?? '';

    // Try DB first (highest priority)
    try {
      const dbRecord = await workflowDefinitionsDb.getWorkflowDefinition(name);
      if (dbRecord) {
        const definition = JSON.parse(dbRecord.definition) as unknown;
        const yaml = Bun.YAML.stringify(definition);
        return new Response(yaml, {
          headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
        });
      }
    } catch (err) {
      getLog().error({ err, name }, 'workflow.export_db_lookup_failed');
      getLog().info({ name }, 'workflow.export_falling_back_to_filesystem');
    }

    // Fall back to filesystem discovery
    try {
      const result = await discoverWorkflowsWithConfig(cwd || getArchonHome(), loadConfig);
      const entry = result.workflows.find(w => w.workflow.name === name);
      if (!entry) {
        return apiError(c, 404, `Workflow '${name}' not found`);
      }

      const yaml = Bun.YAML.stringify(entry.workflow);
      return new Response(yaml, {
        headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err, name }, 'workflow.export_failed');
      return apiError(c, 500, 'Failed to export workflow');
    }
  });

  // GET /api/workflows/:name - Fetch a single workflow definition
  registerOpenApiRoute(getWorkflowRoute, async c => {
    const name = c.req.param('name') ?? '';
    if (!isValidCommandName(name)) {
      return apiError(c, 400, 'Invalid workflow name');
    }

    try {
      const cwd = c.req.query('cwd');
      let workingDir = cwd;
      if (cwd) {
        if (!(await validateCwd(cwd))) {
          return apiError(c, 400, 'Invalid cwd: must match a registered codebase path');
        }
      } else {
        const codebases = await codebaseDb.listCodebases();
        if (codebases.length > 0) workingDir = codebases[0].default_cwd;
      }

      const filename = `${name}.yaml`;

      // 0. Try DB-stored workflow (highest priority)
      try {
        const dbRecord = await workflowDefinitionsDb.getWorkflowDefinition(name);
        if (dbRecord) {
          const result = parseWorkflow(dbRecord.definition, filename);
          if (result.error) {
            return apiError(c, 500, `DB workflow is invalid: ${result.error.error}`);
          }
          return c.json({
            workflow: result.workflow,
            filename,
            source: 'db' as WorkflowSource,
          });
        }
      } catch (err) {
        getLog().error({ err, name }, 'workflow.db_lookup_failed');
        getLog().info({ name }, 'workflow.db_lookup_falling_back_to_filesystem');
      }

      // 1. Try user-defined workflow in cwd
      if (workingDir) {
        const [workflowFolder] = getWorkflowFolderSearchPaths();
        const filePath = join(workingDir, workflowFolder, filename);
        try {
          const content = await readFile(filePath, 'utf-8');
          const result = parseWorkflow(content, filename);
          if (result.error) {
            return apiError(c, 500, `Workflow file is invalid: ${result.error.error}`);
          }
          return c.json({
            workflow: result.workflow,
            filename,
            source: 'project' as WorkflowSource,
          });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            getLog().error({ err, name }, 'workflow.fetch_failed');
            return apiError(c, 500, 'Failed to read workflow');
          }
        }
      }

      // 2. Fall back to bundled defaults (binary: embedded map; dev: also check filesystem)
      if (Object.hasOwn(BUNDLED_WORKFLOWS, name)) {
        const bundledContent = BUNDLED_WORKFLOWS[name];
        const result = parseWorkflow(bundledContent, filename);
        if (result.error) {
          return apiError(c, 500, `Bundled workflow is invalid: ${result.error.error}`);
        }
        return c.json({ workflow: result.workflow, filename, source: 'bundled' as WorkflowSource });
      }

      if (!isBinaryBuild()) {
        const defaultFilePath = join(getDefaultWorkflowsPath(), filename);
        try {
          const content = await readFile(defaultFilePath, 'utf-8');
          const result = parseWorkflow(content, filename);
          if (result.error) {
            return apiError(c, 500, `Default workflow is invalid: ${result.error.error}`);
          }
          return c.json({
            workflow: result.workflow,
            filename,
            source: 'bundled' as WorkflowSource,
          });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            getLog().error({ err, name }, 'workflow.fetch_default_failed');
            return apiError(c, 500, 'Failed to read default workflow');
          }
        }
      }

      return apiError(c, 404, `Workflow not found: ${name}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err, name }, 'workflow.get_failed');
      return apiError(c, 500, 'Failed to get workflow');
    }
  });

  // PUT /api/workflows/:name - Save (create or update) a workflow to database
  registerOpenApiRoute(saveWorkflowRoute, async c => {
    const name = c.req.param('name') ?? '';
    if (!isValidCommandName(name)) {
      return apiError(c, 400, 'Invalid workflow name');
    }

    const { definition } = getValidatedBody(c, saveWorkflowBodySchema);

    // Serialize and validate before saving
    let yamlContent: string;
    try {
      yamlContent = Bun.YAML.stringify(definition);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err, name }, 'workflow.serialize_failed');
      return apiError(c, 400, 'Failed to serialize workflow definition');
    }

    const parsed = parseWorkflow(yamlContent, `${name}.yaml`);
    if (parsed.error) {
      return apiError(c, 400, 'Workflow definition is invalid', parsed.error.error);
    }

    try {
      await workflowDefinitionsDb.upsertWorkflowDefinition({
        name,
        description: parsed.workflow.description ?? null,
        definition: JSON.stringify(parsed.workflow),
        source: 'user',
        codebase_id: null,
      });
      return c.json({
        workflow: parsed.workflow,
        filename: `${name}.yaml`,
        source: 'db' as WorkflowSource,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err, name }, 'workflow.definition_save_failed');
      return apiError(c, 500, 'Failed to save workflow');
    }
  });

  // DELETE /api/workflows/:name - Delete a DB-stored workflow
  registerOpenApiRoute(deleteWorkflowRoute, async c => {
    const name = c.req.param('name') ?? '';
    if (!isValidCommandName(name)) {
      return apiError(c, 400, 'Invalid workflow name');
    }

    // Refuse to delete bundled defaults
    if (Object.hasOwn(BUNDLED_WORKFLOWS, name)) {
      return apiError(c, 400, `Cannot delete bundled default workflow: ${name}`);
    }

    try {
      const deleted = await workflowDefinitionsDb.deleteWorkflowDefinition(name);
      if (!deleted) {
        return apiError(c, 404, `Workflow '${name}' not found in database`);
      }
      return c.json({ deleted: true, name });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err, name }, 'workflow.definition_delete_failed');
      return apiError(c, 500, 'Failed to delete workflow');
    }
  });

  // GET /api/commands - List available command names for the workflow node palette
  registerOpenApiRoute(getCommandsRoute, async c => {
    try {
      const cwd = c.req.query('cwd');
      let workingDir = cwd;
      if (cwd) {
        if (!(await validateCwd(cwd))) {
          return apiError(c, 400, 'Invalid cwd: must match a registered codebase path');
        }
      } else {
        const codebases = await codebaseDb.listCodebases();
        if (codebases.length > 0) workingDir = codebases[0].default_cwd;
      }

      // Collect commands: project-defined override bundled (same name wins)
      const commandMap = new Map<string, WorkflowSource>();

      // 1. Seed with bundled defaults
      for (const name of Object.keys(BUNDLED_COMMANDS)) {
        commandMap.set(name, 'bundled');
      }

      // 2. If not binary build, also check filesystem defaults
      if (!isBinaryBuild()) {
        try {
          const defaultsPath = getDefaultCommandsPath();
          const files = await findMarkdownFilesRecursive(defaultsPath);
          for (const { commandName } of files) {
            commandMap.set(commandName, 'bundled');
          }
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            getLog().error({ err }, 'commands.list_defaults_failed');
          }
          // ENOENT: defaults path missing — not an error
        }
      }

      // 3. Project-defined commands override bundled
      if (workingDir) {
        const searchPaths = getCommandFolderSearchPaths();
        for (const folder of searchPaths) {
          const dirPath = join(workingDir, folder);
          try {
            const files = await findMarkdownFilesRecursive(dirPath);
            for (const { commandName } of files) {
              commandMap.set(commandName, 'project');
            }
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
              getLog().error({ err, dirPath }, 'commands.list_project_failed');
            }
            // ENOENT: folder doesn't exist — skip
          }
        }
      }

      const commands = Array.from(commandMap.entries()).map(([name, source]) => ({ name, source }));
      return c.json({ commands });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      getLog().error({ err }, 'commands.list_failed');
      return apiError(c, 500, 'Failed to list commands');
    }
  });

  // GET /api/artifacts/:runId/* - Serve workflow artifact file contents
  // The wildcard captures the filename (e.g. "plan.md", "subdir/report.md").
  // Path traversal is blocked: any segment containing ".." is rejected.
  // NOTE: Uses app.get() instead of registerOpenApiRoute because:
  //  1. Wildcard path params (*) are not representable in OpenAPI 3.0
  //  2. Response is raw text/markdown, not JSON
  app.get('/api/artifacts/:runId/*', async c => {
    const runId = c.req.param('runId');
    // Hono wildcards match but don't capture — extract filename from the URL path.
    // c.req.path is NOT percent-decoded, so we decode it manually.
    const prefix = `/api/artifacts/${runId}/`;
    const rawEncoded = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : '';
    let rawFilename: string;
    try {
      rawFilename = decodeURIComponent(rawEncoded);
    } catch {
      return apiError(c, 400, 'Invalid filename');
    }

    // Block path traversal: reject if any segment is ".." or contains null bytes
    if (
      !rawFilename ||
      rawFilename.includes('\0') ||
      rawFilename.split('/').some(s => s === '..')
    ) {
      return apiError(c, 400, 'Invalid filename');
    }

    // Normalize and ensure relative (no leading slash)
    const filename = normalize(rawFilename).replace(/^[/\\]+/, '');
    if (!filename) {
      return apiError(c, 400, 'Invalid filename');
    }

    let run: Awaited<ReturnType<typeof workflowDb.getWorkflowRun>>;
    try {
      run = await workflowDb.getWorkflowRun(runId);
    } catch (error) {
      getLog().error({ err: error, runId }, 'artifacts.run_lookup_failed');
      return apiError(c, 500, 'Failed to look up workflow run');
    }

    if (!run?.working_path) {
      return apiError(c, 404, 'Workflow run not found');
    }

    // Derive owner/repo from working_path (must be under ~/.archon/workspaces/owner/repo/...)
    const normalizedWorkspacesPath = normalize(getArchonWorkspacesPath());
    const normalizedWorkingPath = normalize(run.working_path);
    if (!normalizedWorkingPath.startsWith(normalizedWorkspacesPath + sep)) {
      getLog().error(
        { runId, workingPath: run.working_path },
        'artifacts.working_path_outside_workspaces'
      );
      return apiError(c, 404, 'Artifact not available: working path not in workspaces');
    }
    const relative = normalizedWorkingPath.substring(normalizedWorkspacesPath.length + 1);
    const parts = relative.split(sep).filter(p => p.length > 0);
    if (parts.length < 2) {
      getLog().error({ runId, workingPath: run.working_path }, 'artifacts.owner_repo_parse_failed');
      return apiError(c, 404, 'Artifact not available: could not determine owner/repo');
    }
    const [owner, repo] = parts;

    const artifactDir = getRunArtifactsPath(owner, repo, runId);
    const filePath = join(artifactDir, filename);

    // Final safety check: ensure resolved path stays within artifact directory
    if (
      !normalize(filePath).startsWith(normalize(artifactDir) + sep) &&
      normalize(filePath) !== normalize(artifactDir)
    ) {
      getLog().warn({ runId, filename, filePath, artifactDir }, 'artifacts.path_escape_blocked');
      return apiError(c, 400, 'Invalid filename');
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return apiError(c, 404, 'Artifact file not found');
      }
      getLog().error({ err, runId, filename }, 'artifacts.read_failed');
      return apiError(c, 500, 'Failed to read artifact file');
    }

    const contentType = filename.endsWith('.md')
      ? 'text/markdown; charset=utf-8'
      : 'text/plain; charset=utf-8';
    return new Response(content, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  });

  // GET /api/config - Read-only configuration (safe subset only — no filesystem paths)
  registerOpenApiRoute(getConfigRoute, async c => {
    try {
      const config = await loadConfig();
      return c.json({
        config: toSafeConfig(config),
        database: getDatabaseType(),
      });
    } catch (error) {
      getLog().error({ err: error }, 'get_config_failed');
      return apiError(c, 500, 'Failed to get config');
    }
  });

  // PATCH /api/config/assistants - Update assistant configuration
  registerOpenApiRoute(patchAssistantConfigRoute, async c => {
    try {
      const body = getValidatedBody(c, updateAssistantConfigBodySchema);

      const updates: Partial<GlobalConfig> = {};
      if (body.assistant !== undefined) {
        updates.defaultAssistant = body.assistant;
      }
      if (body.claude !== undefined || body.codex !== undefined) {
        updates.assistants = {
          ...(body.claude ? { claude: body.claude } : {}),
          ...(body.codex ? { codex: body.codex } : {}),
        };
      }

      await updateGlobalConfig(updates);

      const config = await loadConfig();
      return c.json({
        config: toSafeConfig(config),
        database: getDatabaseType(),
      });
    } catch (error) {
      getLog().error({ err: error }, 'config.assistants_update_failed');
      return apiError(c, 500, 'Failed to update assistant configuration');
    }
  });

  // GET /api/codebases/:id/environments - List isolation environments for a codebase
  registerOpenApiRoute(getCodebaseEnvironmentsRoute, async c => {
    try {
      const { id } = c.req.param();
      const codebase = await codebaseDb.getCodebase(id);
      if (!codebase) {
        return apiError(c, 404, 'Codebase not found');
      }

      const environments = await isolationEnvDb.listByCodebaseWithAge(id);
      return c.json({ environments });
    } catch (error) {
      getLog().error({ err: error }, 'codebases.environments_list_failed');
      return apiError(c, 500, 'Failed to list environments');
    }
  });

  // GET /api/health - Health check with web adapter info
  registerOpenApiRoute(getHealthRoute, async c => {
    const stats = lockManager.getStats();
    const runningWorkflowRows = await workflowDb.getRunningWorkflows();

    // Merge lock-based and DB-based active tracking.
    // Background workflows bypass the lock manager, so we combine both sources.
    const lockActiveSet = new Set(stats.activeConversationIds);
    const backgroundConversationIds = runningWorkflowRows
      .map(r => r.conversation_id)
      .filter(id => !lockActiveSet.has(id));
    const allActiveIds = [...stats.activeConversationIds, ...backgroundConversationIds];

    return c.json({
      status: 'ok',
      adapter: 'web',
      concurrency: {
        ...stats,
        active: allActiveIds.length,
        activeConversationIds: allActiveIds,
      },
      runningWorkflows: runningWorkflowRows.length,
      version: appVersion,
      is_docker: isDocker(),
    });
  });

  registerOpenApiRoute(getUpdateCheckRoute, async c => {
    const noUpdate = {
      updateAvailable: false,
      currentVersion: appVersion,
      latestVersion: appVersion,
      releaseUrl: '',
    };
    if (!BUNDLED_IS_BINARY) return c.json(noUpdate);
    const result = await checkForUpdate(appVersion);
    return c.json(result ?? noUpdate);
  });

  // Auth: POST /api/auth/login
  registerOpenApiRoute(loginRoute, async c => {
    if (!webUiPassword) {
      return c.json({ error: 'Auth not configured' }, 404);
    }
    const body = getValidatedBody(c, loginBodySchema);
    // Hash both values with HMAC so buffers are always the same length — prevents
    // timing leaks from short-circuit length comparison.
    const providedHash = createHmac('sha256', 'archon-pw-compare').update(body.password).digest();
    const expectedHash = createHmac('sha256', 'archon-pw-compare').update(webUiPassword).digest();
    const matches = timingSafeEqual(providedHash, expectedHash);
    if (!matches) {
      getLog().warn({}, 'auth.login_failed');
      return c.json({ error: 'Invalid password' }, 401);
    }
    const token = createHmac('sha256', webUiPassword).update('archon-web-session').digest('hex');
    return c.json({ token });
  });

  // Auth: GET /api/auth/status
  registerOpenApiRoute(authStatusRoute, c => {
    return c.json({ enabled: Boolean(webUiPassword) });
  });
}
