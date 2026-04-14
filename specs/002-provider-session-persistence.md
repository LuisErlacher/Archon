# Spec: Provider Session Persistence + SDK Provider Normalization

## Status: Draft

## Part A: Session Persistence in DB

### Problem

All three providers (Claude, Codex, Pi-AI) rely on ephemeral storage for session state:

| Provider | Session State Location                        | Lost on Container Restart? |
| -------- | --------------------------------------------- | -------------------------- |
| Claude   | `~/.claude/projects/.../*.jsonl` (filesystem) | **Yes**                    |
| Codex    | Thread state inside SDK (filesystem)          | **Yes**                    |
| Pi-AI    | `Map<string, AgentMessage[]>` (RAM)           | **Yes**                    |

The `remote_agent_sessions` table only stores `assistant_session_id` — a reference key. The actual session content (messages, tool calls, thinking) lives outside the DB. When a container dies:

1. The `assistant_session_id` becomes an orphan reference
2. Resume fails silently (providers start fresh)
3. Workflow re-execution loses all prior context
4. No compliance trail of what the agent did

### Goal

Persist **all provider output** (every `MessageChunk` streamed by every provider) into the database so that:

1. **Container-safe resume**: After container restart, providers can reconstruct conversation context from DB
2. **Workflow re-execution**: Resume workflows with full prior node context preserved
3. **Compliance/audit trail**: Complete record of every agent interaction (what was said, which tools ran, what they returned)
4. **Zero behavioral change**: Existing streaming UX, error handling, and retry logic unchanged for callers

## Part B: SDK Provider Normalization

### Problem

The current `PiAiProvider` is a single provider that internally routes to different LLM backends via `provider: 'google'` in config. This is confusing — users configure provider as `pi-ai` then must also specify `provider: google` inside it. To add a new LLM (e.g. Mistral), the user edits nested config instead of just picking a provider.

Additionally, the `PiAiProvider` reimplements ~300 lines of tool definitions (read, edit, write, bash, grep, find, ls) that the `@mariozechner/pi-coding-agent` SDK already provides as `createCodingTools(cwd)`. The SDK also provides `AuthStorage` (OAuth + API keys + env vars), `ModelRegistry` (model discovery), and `DefaultResourceLoader` (skills, context files).

### Goal

1. **Replace `PiAiProvider` with `PiAiGenericProvider`** — a generic, parameterized class that takes a pi-ai provider name and default model ID in the constructor
2. **Auto-register pi-ai powered providers** — Google, Mistral, Groq, xAI, OpenRouter, etc. as first-class providers in the registry, each backed by `PiAiGenericProvider`
3. **Use SDK utilities** — Replace manual tool definitions with `createCodingTools(cwd)` from `@mariozechner/pi-coding-agent`
4. **Support custom providers** — Users can add Ollama, vLLM, etc. via config with `baseUrl` + `apiProvider`
5. **Unified config** — `.archon/config.yaml` `assistants.google.model` instead of `assistants.pi-ai.provider: google`

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Provider Registry                                      │
│                                                                           │
│  ┌── Agent SDK Providers (subprocess, full coding agent) ─────────────┐ │
│  │                                                                     │ │
│  │  claude  → ClaudeProvider  (@anthropic-ai/claude-agent-sdk)        │ │
│  │  codex   → CodexProvider   (@openai/codex-sdk)                     │ │
│  │                                                                     │ │
│  │  These are SPECIALIZED — they have MCP, sandboxing, CLAUDE.md,     │ │
│  │  native session management. Keep them unchanged.                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌── Pi-AI Generic Providers (in-process, via pi-ai + pi-agent-core) ─┐ │
│  │                                                                     │ │
│  │  google       → PiAiGenericProvider('google', 'gemini-2.5-flash')  │ │
│  │  mistral      → PiAiGenericProvider('mistral', 'mistral-large-..') │ │
│  │  groq         → PiAiGenericProvider('groq', 'openai/gpt-oss-20b')  │ │
│  │  xai          → PiAiGenericProvider('xai', 'grok-code-fast-1')     │ │
│  │  openrouter   → PiAiGenericProvider('openrouter', 'z-ai/glm-4.5v') │ │
│  │  anthropic-pi → PiAiGenericProvider('anthropic', 'claude-sonnet-..')│ │
│  │  openai-pi    → PiAiGenericProvider('openai', 'gpt-4o-mini')       │ │
│  │  vertex       → PiAiGenericProvider('google-vertex', 'gemini-..')  │ │
│  │  bedrock      → PiAiGenericProvider('amazon-bedrock', 'claude-..') │ │
│  │  azure-openai → PiAiGenericProvider('azure-openai', 'gpt-4o-mini')│ │
│  │  cerebras     → PiAiGenericProvider('cerebras', 'gpt-oss-120b')   │ │
│  │  <custom>     → PiAiGenericProvider(custom, model, baseUrl)        │ │
│  │                                                                     │ │
│  │  All use: createCodingTools(cwd) from SDK, Agent from pi-agent-core│ │
│  │  All share: PiAiGenericProvider class, just different constructor  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌── Session Capture Layer (wraps ALL providers) ──────────────────────┐ │
│  │                                                                     │ │
│  │  captureSessionChunks(stream, store, { provider, sessionId, ... }) │ │
│  │  → yields chunks immediately                                        │ │
│  │  → persists to DB in background                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Session Capture Flow (all providers)

```
┌─────────────────────────────────────────────────────────────────┐
│  Caller (orchestrator / dag-executor)                            │
│                                                                  │
│  for await (msg of captureSessionChunks(                         │
│    aiClient.sendQuery(prompt, cwd, sessionId, opts),            │
│    chunkStore,                                                   │
│    { provider, sessionId, runId, nodeId }                        │
│  )) {                                                            │
│    // msg yielded immediately — no DB latency                    │
│    // chunk persisted in background (fire-and-forget)            │
│    handle(msg);                                                  │
│  }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL / SQLite                                            │
│                                                                 │
│  remote_agent_session_chunks (NEW TABLE)                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ session_id │ chunk_order │ chunk_type │ content │ ...     │ │
│  │ "sess_abc" │ 0           │ "assistant"│ "I'll…" │         │ │
│  │ "sess_abc" │ 1           │ "tool"     │ "read"  │         │ │
│  │ "sess_abc" │ 2           │ "tool_res" │ "file…" │         │ │
│  │ "sess_abc" │ 3           │ "result"   │ null    │         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  remote_agent_sessions (EXISTING — unchanged)                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ assistant_session_id = "sess_abc"  ← reference key        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Resume Strategy by Provider

When `resumeSessionId` is provided and the provider's native resume fails:

| Provider      | Native Resume                                    | DB Fallback                       | Fidelity |
| ------------- | ------------------------------------------------ | --------------------------------- | -------- |
| Claude        | `options.resume` → reads JSONL from `~/.claude/` | Inject summary into system prompt | ~90%     |
| Codex         | `codex.resumeThread()` → reads from SDK state    | Prefix prompt with context        | ~85%     |
| Pi-AI Generic | `AgentMessage[]` loaded directly from chunks     | Full reconstruction from DB       | ~95%     |

---

## Files to Create

### 1. `migrations/022_provider_session_chunks.sql`

```sql
-- Provider session chunk persistence for container-safe resume and compliance.
-- Every MessageChunk streamed by any provider is stored here.

CREATE TABLE IF NOT EXISTS remote_agent_session_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  chunk_order INTEGER NOT NULL,
  chunk_type VARCHAR(30) NOT NULL,
  content TEXT,
  tool_name VARCHAR(255),
  tool_input JSONB,
  tool_output TEXT,
  tool_call_id VARCHAR(255),
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DOUBLE PRECISION,
  metadata JSONB DEFAULT '{}',
  workflow_run_id UUID,
  node_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_chunks_session_order
  ON remote_agent_session_chunks(session_id, chunk_order ASC);

CREATE INDEX idx_session_chunks_workflow
  ON remote_agent_session_chunks(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX idx_session_chunks_cleanup
  ON remote_agent_session_chunks(created_at);

COMMENT ON TABLE remote_agent_session_chunks IS
  'Full provider session history: every MessageChunk for container-safe resume and compliance.';
COMMENT ON COLUMN remote_agent_session_chunks.session_id IS
  'Matches remote_agent_sessions.assistant_session_id — the provider session key.';
COMMENT ON COLUMN remote_agent_session_chunks.chunk_type IS
  'MessageChunk discriminant: assistant, system, thinking, tool, tool_result, result, rate_limit.';
COMMENT ON COLUMN remote_agent_session_chunks.workflow_run_id IS
  'Optional: links chunk to a specific workflow run for audit queries.';
COMMENT ON COLUMN remote_agent_session_chunks.node_id IS
  'Optional: links chunk to a specific DAG node within a workflow run.';
```

**SQLite notes**: SQLite does not support `DEFAULT gen_random_uuid()`. Generate UUIDs in application code (see `DbSessionChunkStore`). For `NOW()`, the `getDialect()` abstraction handles it.

Also update `migrations/000_combined.sql` — append the same `CREATE TABLE` block at the end of the file (following the existing pattern in that file for fresh installs).

### 2. `packages/providers/src/session-store.ts`

Interface for chunk persistence. **No DB imports** — keeps `@archon/providers` DB-agnostic.

```typescript
/**
 * Abstraction for persisting provider session chunks.
 * Implemented by @archon/core (DB-backed) or in-memory (for tests).
 */
import type { MessageChunk } from './types';

/** Metadata for identifying where a chunk came from */
export interface ChunkContext {
  provider: string;
  sessionId: string;
  workflowRunId?: string;
  nodeId?: string;
}

/** A single persisted chunk row */
export interface PersistedChunk {
  id: string;
  session_id: string;
  provider: string;
  chunk_order: number;
  chunk_type: string;
  content: string | null;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output: string | null;
  tool_call_id: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  metadata: Record<string, unknown>;
  workflow_run_id: string | null;
  node_id: string | null;
  created_at: string;
}

export interface ISessionChunkStore {
  /** Persist a single chunk. Fire-and-forget — caller should .catch() errors. */
  saveChunk(ctx: ChunkContext, chunkOrder: number, chunk: MessageChunk): Promise<void>;

  /** Load all chunks for a session, ordered by chunk_order ASC. */
  loadChunks(sessionId: string): Promise<PersistedChunk[]>;

  /** Delete all chunks for a session. */
  deleteSession(sessionId: string): Promise<void>;

  /** Delete chunks older than N days. Returns count deleted. */
  cleanup(olderThanDays: number): Promise<number>;

  /** Get chunk count for a session (diagnostics). */
  getChunkCount(sessionId: string): Promise<number>;
}

// ─── Global Store Singleton ────────────────────────────────────────────────
// Providers access the store via getPersistStore() for DB fallback on resume.
// Set once at server/CLI startup via setPersistStore().

let persistStore: ISessionChunkStore | undefined;

/** Set the global persist store. Called once at server/CLI startup. */
export function setPersistStore(store: ISessionChunkStore): void {
  persistStore = store;
}

/** Get the global persist store. Returns undefined if not configured. */
export function getPersistStore(): ISessionChunkStore | undefined {
  return persistStore;
}
```

### 3. `packages/providers/src/session-capture.ts`

The stream interceptor. Wraps any `AsyncGenerator<MessageChunk>` and persists each chunk.

```typescript
/**
 * Transparent stream interceptor that persists every MessageChunk to the session store.
 * Yields chunks immediately — DB writes happen in background (fire-and-forget).
 */
import type { MessageChunk } from './types';
import type { ISessionChunkStore, ChunkContext, PersistedChunk } from './session-store';
import { createLogger } from '@archon/paths';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('session.capture');
  return cachedLog;
}

/**
 * Wraps a provider stream and captures every chunk to the session store.
 * Transparent: yields chunks unchanged while saving in background.
 *
 * The sessionId in the context is updated when a 'result' chunk arrives
 * (providers emit the final sessionId in the result chunk).
 */
export async function* captureSessionChunks(
  stream: AsyncGenerator<MessageChunk>,
  store: ISessionChunkStore,
  ctx: ChunkContext
): AsyncGenerator<MessageChunk> {
  let order = 0;
  let effectiveSessionId = ctx.sessionId;

  for await (const chunk of stream) {
    // Yield immediately — caller doesn't wait for DB write
    yield chunk;

    // Update sessionId from result chunk (providers emit the real ID here)
    if (chunk.type === 'result' && chunk.sessionId) {
      effectiveSessionId = chunk.sessionId;
    }

    // Skip persisting if we have no valid session ID yet
    if (!effectiveSessionId) continue;

    const chunkOrder = order++;
    const persistCtx: ChunkContext = {
      ...ctx,
      sessionId: effectiveSessionId,
    };

    // Fire-and-forget persistence
    store.saveChunk(persistCtx, chunkOrder, chunk).catch(err => {
      getLog().warn(
        {
          err: (err as Error).message,
          sessionId: effectiveSessionId,
          chunkOrder,
          chunkType: chunk.type,
        },
        'session_chunk.persist_failed'
      );
    });
  }
}

/** No-op session chunk store for when persistence is disabled. */
export class NoOpSessionChunkStore implements ISessionChunkStore {
  async saveChunk(): Promise<void> {
    /* no-op */
  }
  async loadChunks(): Promise<PersistedChunk[]> {
    return [];
  }
  async deleteSession(): Promise<void> {
    /* no-op */
  }
  async cleanup(): Promise<number> {
    return 0;
  }
  async getChunkCount(): Promise<number> {
    return 0;
  }
}

export type { ISessionChunkStore, ChunkContext, PersistedChunk } from './session-store';
```

### 4. `packages/providers/src/session-restore.ts`

Reconstructs session context from DB chunks for providers whose native resume failed.

```typescript
/**
 * Reconstructs session context from persisted chunks.
 * Used when a provider's native resume fails (container restart, filesystem gone).
 */
import type { ISessionChunkStore, PersistedChunk } from './session-store';
import { createLogger } from '@archon/paths';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('session.restore');
  return cachedLog;
}

/** Reconstructed session data for context injection */
export interface RestoredSession {
  /** All assistant text concatenated */
  assistantText: string;
  /** Tool call/result pairs */
  toolInteractions: Array<{
    toolName: string;
    input?: Record<string, unknown>;
    output?: string;
    toolCallId?: string;
  }>;
  /** Raw chunks (for providers that can reconstruct native state) */
  chunks: PersistedChunk[];
  /** Token usage from the last result chunk */
  lastUsage?: { input: number; output: number; cost?: number };
}

/** Load and reconstruct session context from DB chunks. */
export async function restoreSessionFromDB(
  store: ISessionChunkStore,
  sessionId: string
): Promise<RestoredSession | null> {
  const chunks = await store.loadChunks(sessionId);
  if (chunks.length === 0) {
    getLog().debug({ sessionId }, 'session_restore.no_chunks_found');
    return null;
  }

  getLog().info({ sessionId, chunkCount: chunks.length }, 'session_restore.loading_chunks');

  const assistantMessages: string[] = [];
  const toolInteractions: RestoredSession['toolInteractions'] = [];
  let lastUsage: RestoredSession['lastUsage'];

  for (const chunk of chunks) {
    switch (chunk.chunk_type) {
      case 'assistant':
        if (chunk.content) assistantMessages.push(chunk.content);
        break;
      case 'tool':
        toolInteractions.push({
          toolName: chunk.tool_name ?? 'unknown',
          input: chunk.tool_input ?? undefined,
          toolCallId: chunk.tool_call_id ?? undefined,
        });
        break;
      case 'tool_result': {
        const lastUnmatched = [...toolInteractions]
          .reverse()
          .find(t => !t.output && t.toolCallId === chunk.tool_call_id);
        if (lastUnmatched) lastUnmatched.output = chunk.tool_output ?? '';
        break;
      }
      case 'result':
        if (chunk.tokens_input != null && chunk.tokens_output != null) {
          lastUsage = {
            input: chunk.tokens_input,
            output: chunk.tokens_output,
            ...(chunk.cost_usd != null ? { cost: chunk.cost_usd } : {}),
          };
        }
        break;
    }
  }

  return { assistantText: assistantMessages.join('\n'), toolInteractions, chunks, lastUsage };
}

const MAX_SUMMARY_LENGTH = 6000;
const MAX_TOOL_OUTPUT_LENGTH = 500;
const MAX_TOOL_INTERACTIONS = 15;

/** Build a text summary of a restored session for injection into prompts. */
export function buildSessionSummary(restored: RestoredSession): string {
  const parts: string[] = [];
  parts.push('## Previous Session Context');
  parts.push('The following is a summary of a previous conversation that was interrupted.');
  parts.push('Use this context to continue helping the user.\n');

  if (restored.assistantText) {
    const text = restored.assistantText;
    parts.push('### Assistant Responses');
    parts.push(
      text.length > MAX_SUMMARY_LENGTH
        ? text.slice(0, MAX_SUMMARY_LENGTH) + '\n... [truncated]'
        : text
    );
  }

  if (restored.toolInteractions.length > 0) {
    parts.push('\n### Tools Used');
    const interactions = restored.toolInteractions.slice(-MAX_TOOL_INTERACTIONS);
    for (const tool of interactions) {
      parts.push(`- **${tool.toolName}**`);
      if (tool.output) {
        const output =
          tool.output.length > MAX_TOOL_OUTPUT_LENGTH
            ? tool.output.slice(0, MAX_TOOL_OUTPUT_LENGTH) + '...'
            : tool.output;
        parts.push(`  Result: ${output}`);
      }
    }
  }

  if (restored.lastUsage) {
    parts.push(
      `\n### Token Usage: ${restored.lastUsage.input} in, ${restored.lastUsage.output} out`
    );
  }

  return parts.join('\n');
}
```

### 5. `packages/providers/src/pi-ai/generic-provider.ts`

**The new `PiAiGenericProvider`** — replaces the old monolithic `PiAiProvider`. Parameterized by pi-ai provider name and default model. Uses SDK tools.

```typescript
/**
 * Pi-AI Generic Provider
 *
 * A parameterized provider backed by @mariozechner/pi-ai + @mariozechner/pi-agent-core.
 * Each instance targets a specific LLM provider (google, mistral, groq, etc.).
 * Tool definitions come from @mariozechner/pi-coding-agent's createCodingTools().
 *
 * Unlike Claude/Codex which run as subprocesses with full coding agent SDKs,
 * this runs in-process as a library — good for general LLM calls, but lacks
 * MCP, sandboxing, and native CLAUDE.md support that the specialized SDKs provide.
 */
import {
  Agent,
  type AgentEvent,
  type AgentMessage,
  type AgentTool,
  type BeforeToolCallContext,
  type BeforeToolCallResult,
  type AfterToolCallContext,
  type AfterToolCallResult,
  type ThinkingLevel,
} from '@mariozechner/pi-agent-core';
import { getModel, getEnvApiKey, streamSimple, type Model, type Api } from '@mariozechner/pi-ai';
import {
  createCodingTools,
  createReadOnlyTools,
  type defineTool,
} from '@mariozechner/pi-coding-agent';
import type { IAgentProvider, SendQueryOptions, MessageChunk } from '../types';
import { parsePiAiConfig } from './config';
import { PI_AI_GENERIC_CAPABILITIES } from './capabilities';
import { restoreSessionFromDB, buildSessionSummary } from '../session-restore';
import { getPersistStore } from '../session-store';
import { buildPiBeforeToolCall, buildPiAfterToolCall } from './hooks';
import { createLogger } from '@archon/paths';
import { randomUUID } from 'crypto';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('provider.pi-ai-generic');
  return cachedLog;
}

// ─── Error Classification ────────────────────────────────────────────────────

const RATE_LIMIT_PATTERNS = ['rate limit', 'rate_limit', 'too many requests', '429'];
const AUTH_PATTERNS = ['unauthorized', 'invalid api key', 'authentication', '401', '403'];

function classifyError(errorMessage: string): 'rate_limit' | 'auth' | 'unknown' {
  const msg = errorMessage.toLowerCase();
  if (RATE_LIMIT_PATTERNS.some(p => msg.includes(p))) return 'rate_limit';
  if (AUTH_PATTERNS.some(p => msg.includes(p))) return 'auth';
  return 'unknown';
}

// ─── Session Cache (LRU, in-process fast path) ───────────────────────────────

const MAX_CACHE_SIZE = 100;
const sessionCache = new Map<string, AgentMessage[]>();

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const STREAM_IDLE_TIMEOUT_MS = 30_000;
const GLOBAL_PROMPT_TIMEOUT_MS = 5 * 60 * 1000;

// ─── Async Queue ─────────────────────────────────────────────────────────────
// (Same as current PiAiProvider — keep verbatim)

function createAsyncQueue<T>(): {
  push: (v: T) => void;
  end: () => void;
  fail: (e: Error) => void;
  [Symbol.asyncIterator]: () => AsyncGenerator<T>;
} {
  const items: (T | null | Error)[] = [];
  let waiter: (() => void) | null = null;
  return {
    push(v: T): void {
      items.push(v);
      waiter?.();
      waiter = null;
    },
    end(): void {
      items.push(null);
      waiter?.();
      waiter = null;
    },
    fail(e: Error): void {
      items.push(e);
      waiter?.();
      waiter = null;
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<T> {
      while (true) {
        if (items.length === 0)
          await new Promise<void>(r => {
            waiter = r;
          });
        const item = items.shift();
        if (item === undefined || item === null) return;
        if (item instanceof Error) throw item;
        yield item;
      }
    },
  };
}

// ─── Persisted Chunks → AgentMessage[] Conversion ────────────────────────────

import type { PersistedChunk } from '../session-store';

function restoreAgentMessagesFromChunks(chunks: PersistedChunk[]): AgentMessage[] {
  const messages: AgentMessage[] = [];
  for (const chunk of chunks) {
    switch (chunk.chunk_type) {
      case 'assistant':
        if (chunk.content) {
          messages.push({
            role: 'assistant',
            content: [{ type: 'text', text: chunk.content }],
            timestamp: new Date(chunk.created_at).getTime(),
          });
        }
        break;
      case 'thinking':
        if (chunk.content) {
          messages.push({
            role: 'assistant',
            content: [{ type: 'thinking', thinking: chunk.content }],
            timestamp: new Date(chunk.created_at).getTime(),
          });
        }
        break;
      case 'tool':
        messages.push({
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              name: chunk.tool_name ?? 'unknown',
              arguments: chunk.tool_input ?? {},
              id: chunk.tool_call_id ?? randomUUID(),
            },
          ],
          timestamp: new Date(chunk.created_at).getTime(),
        });
        break;
      case 'tool_result':
        messages.push({
          role: 'toolResult',
          toolCallId: chunk.tool_call_id ?? '',
          toolName: chunk.tool_name ?? '',
          content: [{ type: 'text', text: chunk.tool_output ?? '' }],
          isError: false,
          timestamp: new Date(chunk.created_at).getTime(),
        });
        break;
    }
  }
  return messages;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export interface PiAiGenericProviderOptions {
  /** Retry base delay in ms (default 2000) */
  retryBaseDelayMs?: number;
  /** Custom tools in addition to the built-in coding tools */
  customTools?: AgentTool<unknown>[];
  /** Use read-only tools instead of full coding tools */
  readOnly?: boolean;
}

export class PiAiGenericProvider implements IAgentProvider {
  private readonly piProvider: string;
  private readonly defaultModel: string;
  private readonly retryBaseDelayMs: number;
  private readonly customTools: AgentTool<unknown>[];
  private readonly readOnly: boolean;

  constructor(piProvider: string, defaultModel: string, options?: PiAiGenericProviderOptions) {
    this.piProvider = piProvider;
    this.defaultModel = defaultModel;
    this.retryBaseDelayMs = options?.retryBaseDelayMs ?? RETRY_BASE_DELAY_MS;
    this.customTools = options?.customTools ?? [];
    this.readOnly = options?.readOnly ?? false;
  }

  getType(): string {
    return this.piProvider;
  }

  getCapabilities(): ProviderCapabilities {
    return PI_AI_GENERIC_CAPABILITIES;
  }

  async *sendQuery(
    prompt: string,
    cwd: string,
    resumeSessionId?: string,
    options?: SendQueryOptions
  ): AsyncGenerator<MessageChunk> {
    const log = getLog();

    const assistantConfig = options?.assistantConfig
      ? parsePiAiConfig(options.assistantConfig)
      : {};

    const modelId = options?.model ?? assistantConfig.model ?? this.defaultModel;

    log.info(
      { piProvider: this.piProvider, modelId, cwd, hasResumeSession: !!resumeSessionId },
      'query_started'
    );

    let model: Model<Api>;
    try {
      model = getModel(this.piProvider as never, modelId as never);
    } catch (err) {
      const errMsg = (err as Error).message;
      log.error({ err, piProvider: this.piProvider, modelId }, 'model_init_failed');
      throw new Error(
        `Failed to initialize pi-ai model: provider="${this.piProvider}", model="${modelId}". ${errMsg}`
      );
    }

    // ── Restore previous session ──────────────────────────────────────────
    let previousMessages: AgentMessage[] = [];

    if (resumeSessionId) {
      // Fast path: in-process cache
      const cached = sessionCache.get(resumeSessionId);
      if (cached) {
        previousMessages = cached;
        log.debug({ sessionId: resumeSessionId, messageCount: cached.length }, 'session.cache_hit');
      } else {
        // Slow path: DB restore
        const store = getPersistStore();
        if (store) {
          const restored = await restoreSessionFromDB(store, resumeSessionId);
          if (restored && restored.chunks.length > 0) {
            previousMessages = restoreAgentMessagesFromChunks(restored.chunks);
            log.info(
              { sessionId: resumeSessionId, chunkCount: restored.chunks.length },
              'session.db_restore_success'
            );
          } else {
            yield {
              type: 'system',
              content: '⚠️ Previous session data not found. Starting fresh.',
            };
          }
        }
      }
    }

    // ── Tools from SDK ────────────────────────────────────────────────────
    // Uses createCodingTools() from @mariozechner/pi-coding-agent
    // instead of the ~300 lines of manual tool definitions currently in provider.ts
    const baseTools = this.readOnly ? createReadOnlyTools(cwd) : createCodingTools(cwd);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tools: AgentTool<any>[] = [...baseTools, ...this.customTools];

    // Tool filtering from nodeConfig
    const nodeConfig = options?.nodeConfig;
    if (nodeConfig?.allowed_tools) {
      const allowed = new Set(nodeConfig.allowed_tools.map(t => t.toLowerCase()));
      tools = tools.filter(t => allowed.has(t.name.toLowerCase()));
    }
    if (nodeConfig?.denied_tools) {
      const denied = new Set(nodeConfig.denied_tools.map(t => t.toLowerCase()));
      tools = tools.filter(t => !denied.has(t.name.toLowerCase()));
    }

    // ── System prompt ─────────────────────────────────────────────────────
    const systemPromptParts: string[] = [];
    if (options?.systemPrompt) systemPromptParts.push(options.systemPrompt);
    if (nodeConfig?.systemPrompt) systemPromptParts.push(nodeConfig.systemPrompt as string);
    if (options?.outputFormat?.schema) {
      systemPromptParts.push(
        `You MUST respond with valid JSON matching this schema:\n\`\`\`json\n${JSON.stringify(options.outputFormat.schema, null, 2)}\n\`\`\``
      );
    }
    const systemPrompt = systemPromptParts.join('\n\n');

    // ── Thinking level ─────────────────────────────────────────────────────
    const thinkingLevel = (assistantConfig.thinkingLevel ?? 'off') as ThinkingLevel;

    // ── Hooks ──────────────────────────────────────────────────────────────
    const hooksConfig = nodeConfig?.hooks as Record<string, unknown> | undefined;
    const beforeToolCall = hooksConfig ? buildPiBeforeToolCall(hooksConfig) : undefined;
    const afterToolCall = hooksConfig ? buildPiAfterToolCall(hooksConfig) : undefined;

    // ── Retry loop ─────────────────────────────────────────────────────────
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (options?.abortSignal?.aborted) throw new Error('Query aborted');

      if (attempt > 0) {
        const delayMs = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
        log.info({ attempt, delayMs }, 'retry_started');
        await new Promise(r => setTimeout(r, delayMs));
      }

      try {
        yield* this.executeAttempt(
          prompt,
          model,
          tools,
          previousMessages,
          systemPrompt,
          thinkingLevel,
          beforeToolCall,
          afterToolCall,
          options
        );
        return;
      } catch (error) {
        const err = error as Error;
        if (options?.abortSignal?.aborted) throw new Error('Query aborted');

        const errorType = classifyError(err.message);
        log.error({ error: err.message, errorType, attempt }, 'attempt_failed');

        if (errorType === 'auth') {
          throw new Error(`Pi-AI auth error (provider=${this.piProvider}): ${err.message}`);
        }

        if (attempt < MAX_RETRIES) {
          lastError = err;
          continue;
        }

        throw new Error(
          `Pi-AI query failed after ${MAX_RETRIES + 1} attempts (provider=${this.piProvider}, model=${modelId}): ${err.message}`
        );
      }
    }

    throw lastError ?? new Error('Pi-AI query failed after retries');
  }

  private async *executeAttempt(
    prompt: string,
    model: Model<Api>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: AgentTool<any>[],
    previousMessages: AgentMessage[],
    systemPrompt: string,
    thinkingLevel: ThinkingLevel,
    beforeToolCall:
      | ((
          ctx: BeforeToolCallContext,
          signal?: AbortSignal
        ) => Promise<BeforeToolCallResult | undefined>)
      | undefined,
    afterToolCall:
      | ((
          ctx: AfterToolCallContext,
          signal?: AbortSignal
        ) => Promise<AfterToolCallResult | undefined>)
      | undefined,
    requestOptions?: SendQueryOptions
  ): AsyncGenerator<MessageChunk> {
    const agent = new Agent({
      initialState: {
        model,
        tools,
        messages: previousMessages,
        systemPrompt,
        thinkingLevel,
      },
      streamFn: streamSimple,
      getApiKey: (provider: string): string | undefined => getEnvApiKey(provider),
      beforeToolCall,
      afterToolCall,
    });

    const queue = createAsyncQueue<MessageChunk>();
    let hasReceivedContent = false;
    let streamEnded = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = (): void => {
      if (streamEnded) return;
      if (idleTimer) clearTimeout(idleTimer);
      if (!hasReceivedContent) return;
      idleTimer = setTimeout(() => {
        if (streamEnded) return;
        streamEnded = true;
        getLog().warn({ timeoutMs: STREAM_IDLE_TIMEOUT_MS }, 'stream_idle_timeout');
        const msgs = agent.state?.messages ?? [];
        const sid = randomUUID();
        sessionCache.set(sid, msgs);
        queue.push({ type: 'result', sessionId: sid });
        queue.end();
        unsubscribe();
        agent.abort();
      }, STREAM_IDLE_TIMEOUT_MS);
    };

    const unsubscribe = agent.subscribe(async (event: AgentEvent) => {
      if (streamEnded) return;
      resetIdleTimer();

      switch (event.type) {
        case 'message_update': {
          const ame = event.assistantMessageEvent;
          if (ame.type === 'text_delta') {
            hasReceivedContent = true;
            queue.push({ type: 'assistant', content: ame.delta });
          } else if (ame.type === 'thinking_delta') {
            hasReceivedContent = true;
            queue.push({ type: 'thinking', content: ame.delta });
          }
          break;
        }
        case 'tool_execution_start':
          hasReceivedContent = true;
          queue.push({
            type: 'tool',
            toolName: event.toolName,
            toolInput: event.args as Record<string, unknown>,
            toolCallId: event.toolCallId,
          });
          break;
        case 'tool_execution_end':
          queue.push({
            type: 'tool_result',
            toolName: event.toolName,
            toolOutput:
              typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
            toolCallId: event.toolCallId,
          });
          break;
        case 'agent_end': {
          streamEnded = true;
          clearTimeout(globalTimeout);
          if (idleTimer) clearTimeout(idleTimer);
          const newSessionId = randomUUID();
          const msgs = event.messages;
          sessionCache.set(newSessionId, msgs);
          // Evict oldest entries if cache is too large
          if (sessionCache.size > MAX_CACHE_SIZE) {
            const oldest = sessionCache.keys().next().value;
            if (oldest) sessionCache.delete(oldest);
          }
          queue.push({ type: 'result', sessionId: newSessionId });
          queue.end();
          break;
        }
      }
    });

    const globalTimeout = setTimeout(() => {
      if (streamEnded) return;
      streamEnded = true;
      if (idleTimer) clearTimeout(idleTimer);
      getLog().warn({ timeoutMs: GLOBAL_PROMPT_TIMEOUT_MS }, 'global_prompt_timeout');
      const msgs = agent.state?.messages ?? [];
      const sid = randomUUID();
      sessionCache.set(sid, msgs);
      queue.push({ type: 'result', sessionId: sid });
      queue.end();
      unsubscribe();
      agent.abort();
    }, GLOBAL_PROMPT_TIMEOUT_MS);

    agent.prompt(prompt).catch((err: Error) => {
      streamEnded = true;
      clearTimeout(globalTimeout);
      if (idleTimer) clearTimeout(idleTimer);
      const errorType = classifyError(err.message);
      getLog().error({ error: err.message, errorType }, 'prompt_failed');
      if (errorType === 'rate_limit') {
        queue.push({ type: 'rate_limit', rateLimitInfo: { message: err.message } });
      }
      unsubscribe();
      queue.fail(err);
    });

    const abortHandler = (): void => {
      streamEnded = true;
      clearTimeout(globalTimeout);
      if (idleTimer) clearTimeout(idleTimer);
      unsubscribe();
      agent.abort();
      queue.fail(new Error('Query aborted'));
    };
    if (requestOptions?.abortSignal) {
      requestOptions.abortSignal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      for await (const chunk of queue) {
        yield chunk;
      }
    } finally {
      streamEnded = true;
      clearTimeout(globalTimeout);
      if (idleTimer) clearTimeout(idleTimer);
      requestOptions?.abortSignal?.removeEventListener('abort', abortHandler);
      unsubscribe();
    }
  }
}
```

**Key differences from the old `PiAiProvider`:**

| Aspect           | Old `PiAiProvider`                                          | New `PiAiGenericProvider`                             |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| Provider routing | Config: `provider: 'google'`                                | Constructor: `new PiAiGenericProvider('google', ...)` |
| Tool definitions | ~300 lines manual (read, edit, write, bash, grep, find, ls) | `createCodingTools(cwd)` — 1 line                     |
| Session storage  | `Map<string, AgentMessage[]>` — no eviction                 | LRU cache (max 100) + DB fallback                     |
| Session restore  | Cache only (lost on restart)                                | Cache → DB restore from persisted chunks              |
| Custom tools     | Not supported                                               | Constructor option `customTools`                      |
| Read-only mode   | Not supported                                               | Constructor option `readOnly`                         |

### 6. `packages/providers/src/pi-ai/generic-capabilities.ts`

```typescript
import type { ProviderCapabilities } from '../types';

export const PI_AI_GENERIC_CAPABILITIES: ProviderCapabilities = {
  sessionResume: true, // via DB restore
  mcp: false,
  hooks: true, // via beforeToolCall/afterToolCall
  skills: false, // removed from generic provider (keep in specialized claude/codex)
  toolRestrictions: true, // allowed_tools/denied_tools filtering
  structuredOutput: true, // via system prompt injection
  envInjection: false,
  costControl: false,
  effortControl: false,
  thinkingControl: true, // via thinkingLevel
  fallbackModel: false,
  sandbox: false,
};
```

### 7. `packages/providers/src/pi-ai/hooks.ts`

Extract hook adapters from the old `provider.ts` into their own file (no logic changes):

```typescript
/**
 * Hook adapters for Pi-AI Generic Provider.
 * Converts Archon YAML hook definitions to pi-agent-core beforeToolCall/afterToolCall callbacks.
 */

import type {
  BeforeToolCallContext,
  BeforeToolCallResult,
  AfterToolCallContext,
  AfterToolCallResult,
} from '@mariozechner/pi-agent-core';

/** Test if a tool name matches a pipe-separated regex pattern */
function matchesTool(matcher: string, toolName: string): boolean {
  try {
    return new RegExp(`^(?:${matcher})$`, 'i').test(toolName);
  } catch {
    return matcher.toLowerCase() === toolName.toLowerCase();
  }
}

interface HookMatcherEntry {
  matcher?: string;
  hooks?: unknown[];
  response?: {
    systemMessage?: string;
    hookSpecificOutput?: {
      hookEventName?: string;
      permissionDecision?: string;
      permissionDecisionReason?: string;
    };
  };
}

type HooksConfig = Partial<Record<string, HookMatcherEntry[]>>;

export function buildPiBeforeToolCall(
  hooks: HooksConfig
):
  | ((
      ctx: BeforeToolCallContext,
      signal?: AbortSignal
    ) => Promise<BeforeToolCallResult | undefined>)
  | undefined {
  const preToolUse = hooks.PreToolUse;
  if (!preToolUse || preToolUse.length === 0) return undefined;

  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;
    for (const entry of preToolUse) {
      if (entry.matcher && !matchesTool(entry.matcher, toolName)) continue;
      const hookOutput = entry.response?.hookSpecificOutput;
      if (hookOutput?.permissionDecision === 'deny') {
        return {
          block: true,
          reason: hookOutput.permissionDecisionReason ?? `Tool '${toolName}' blocked by hook`,
        };
      }
    }
    return undefined;
  };
}

export function buildPiAfterToolCall(
  hooks: HooksConfig
):
  | ((ctx: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>)
  | undefined {
  const postToolUse = hooks.PostToolUse;
  if (!postToolUse || postToolUse.length === 0) return undefined;

  return async (ctx: AfterToolCallContext): Promise<AfterToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;
    for (const entry of postToolUse) {
      if (entry.matcher && !matchesTool(entry.matcher, toolName)) continue;
      const systemMessage = entry.response?.systemMessage;
      if (systemMessage) {
        const existingText = ctx.result.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        return {
          content: [{ type: 'text', text: `${existingText}\n\n[System] ${systemMessage}` }],
        };
      }
    }
    return undefined;
  };
}
```

### 8. `packages/core/src/db/session-chunks.ts`

DB implementation of `ISessionChunkStore`.

```typescript
/**
 * Database-backed implementation of ISessionChunkStore.
 */
import type { MessageChunk } from '@archon/providers/types';
import type {
  ISessionChunkStore,
  ChunkContext,
  PersistedChunk,
} from '@archon/providers/session-store';
import { pool, getDialect } from './connection';
import { createLogger } from '@archon/paths';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('db.session-chunks');
  return cachedLog;
}

/** Convert a MessageChunk + context into INSERT parameters. */
function chunkToRow(ctx: ChunkContext, chunkOrder: number, chunk: MessageChunk): unknown[] {
  const id = crypto.randomUUID();
  const dialect = getDialect();

  // Helper to build the row based on chunk type
  let chunkType: string;
  let content: string | null = null;
  let toolName: string | null = null;
  let toolInput: string | null = null;
  let toolOutput: string | null = null;
  let toolCallId: string | null = null;
  let tokensInput: number | null = null;
  let tokensOutput: number | null = null;
  let costUsd: number | null = null;
  const metadata: Record<string, unknown> = {};

  switch (chunk.type) {
    case 'assistant':
      chunkType = 'assistant';
      content = chunk.content;
      break;
    case 'system':
      chunkType = 'system';
      content = chunk.content;
      break;
    case 'thinking':
      chunkType = 'thinking';
      content = chunk.content;
      break;
    case 'tool':
      chunkType = 'tool';
      toolName = chunk.toolName;
      toolInput = chunk.toolInput ? JSON.stringify(chunk.toolInput) : null;
      toolCallId = chunk.toolCallId ?? null;
      break;
    case 'tool_result':
      chunkType = 'tool_result';
      toolName = chunk.toolName;
      toolOutput = chunk.toolOutput;
      toolCallId = chunk.toolCallId ?? null;
      break;
    case 'result':
      chunkType = 'result';
      tokensInput = chunk.tokens?.input ?? null;
      tokensOutput = chunk.tokens?.output ?? null;
      costUsd = chunk.cost ?? null;
      if (chunk.sessionId) metadata.sessionId = chunk.sessionId;
      if (chunk.isError) {
        metadata.isError = true;
        if (chunk.errorSubtype) metadata.errorSubtype = chunk.errorSubtype;
      }
      if (chunk.stopReason) metadata.stopReason = chunk.stopReason;
      if (chunk.numTurns) metadata.numTurns = chunk.numTurns;
      if (chunk.structuredOutput) metadata.structuredOutput = chunk.structuredOutput;
      if (chunk.modelUsage) metadata.modelUsage = chunk.modelUsage;
      break;
    case 'rate_limit':
      chunkType = 'rate_limit';
      metadata.rateLimitInfo = chunk.rateLimitInfo;
      break;
    case 'workflow_dispatch':
      chunkType = 'workflow_dispatch';
      metadata.workerConversationId = chunk.workerConversationId;
      metadata.workflowName = chunk.workflowName;
      break;
    default:
      chunkType = 'unknown';
      metadata.raw = JSON.stringify(chunk);
      break;
  }

  return [
    id,
    ctx.sessionId,
    ctx.provider,
    chunkOrder,
    chunkType,
    content,
    toolName,
    toolInput,
    toolOutput,
    toolCallId,
    tokensInput,
    tokensOutput,
    costUsd,
    JSON.stringify(metadata),
    ctx.workflowRunId ?? null,
    ctx.nodeId ?? null,
  ];
}

export class DbSessionChunkStore implements ISessionChunkStore {
  async saveChunk(ctx: ChunkContext, chunkOrder: number, chunk: MessageChunk): Promise<void> {
    const params = chunkToRow(ctx, chunkOrder, chunk);
    const dialect = getDialect();
    await pool.query(
      `INSERT INTO remote_agent_session_chunks
       (id, session_id, provider, chunk_order, chunk_type, content,
        tool_name, tool_input, tool_output, tool_call_id,
        tokens_input, tokens_output, cost_usd, metadata,
        workflow_run_id, node_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, ${dialect.now()})`,
      params
    );
  }

  async loadChunks(sessionId: string): Promise<PersistedChunk[]> {
    const result = await pool.query<PersistedChunk>(
      `SELECT * FROM remote_agent_session_chunks
       WHERE session_id = $1 ORDER BY chunk_order ASC`,
      [sessionId]
    );
    return result.rows;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await pool.query('DELETE FROM remote_agent_session_chunks WHERE session_id = $1', [sessionId]);
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const dialect = getDialect();
    const result = await pool.query(
      `DELETE FROM remote_agent_session_chunks
       WHERE created_at < ${dialect.nowMinusDays(1)}`,
      [olderThanDays]
    );
    const count = result.rowCount;
    if (count > 0) {
      getLog().info(
        { deletedCount: count, retentionDays: olderThanDays },
        'chunks.cleanup_completed'
      );
    }
    return count;
  }

  async getChunkCount(sessionId: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM remote_agent_session_chunks WHERE session_id = $1',
      [sessionId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}
```

### 9. `packages/core/src/db/session-chunks.test.ts`

```typescript
import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { createQueryResult, mockPostgresDialect } from '../test/mocks/database';

const mockQuery = mock(() => Promise.resolve(createQueryResult([])));

mock.module('./connection', () => ({
  pool: { query: mockQuery },
  getDatabase: () => ({}),
  getDialect: () => mockPostgresDialect,
}));

import { DbSessionChunkStore } from './session-chunks';
import type { MessageChunk } from '@archon/providers/types';

describe('DbSessionChunkStore', () => {
  let store: DbSessionChunkStore;

  beforeEach(() => {
    mockQuery.mockClear();
    store = new DbSessionChunkStore();
  });

  describe('saveChunk', () => {
    test('persists assistant chunk with correct fields', async () => {
      const chunk: MessageChunk = { type: 'assistant', content: 'Hello!' };
      await store.saveChunk({ provider: 'claude', sessionId: 'sess_1' }, 0, chunk);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const params = mockQuery.mock.calls[0][0][1] as unknown[];
      expect(params[1]).toBe('sess_1');
      expect(params[2]).toBe('claude');
      expect(params[3]).toBe(0);
      expect(params[4]).toBe('assistant');
      expect(params[5]).toBe('Hello!');
    });

    test('persists tool chunk with input and call ID', async () => {
      const chunk: MessageChunk = {
        type: 'tool',
        toolName: 'read',
        toolInput: { path: '/src/index.ts' },
        toolCallId: 'call_123',
      };
      await store.saveChunk({ provider: 'google', sessionId: 'sess_2' }, 1, chunk);

      const params = mockQuery.mock.calls[0][0][1] as unknown[];
      expect(params[4]).toBe('tool');
      expect(params[6]).toBe('read');
      expect(params[7]).toBe('{"path":"/src/index.ts"}');
      expect(params[9]).toBe('call_123');
    });

    test('persists result chunk with token usage, cost, and metadata', async () => {
      const chunk: MessageChunk = {
        type: 'result',
        sessionId: 'new_sess',
        tokens: { input: 1500, output: 800 },
        cost: 0.05,
        stopReason: 'stop',
      };
      await store.saveChunk({ provider: 'codex', sessionId: 'sess_old' }, 5, chunk);

      const params = mockQuery.mock.calls[0][0][1] as unknown[];
      expect(params[4]).toBe('result');
      expect(params[10]).toBe(1500);
      expect(params[11]).toBe(800);
      expect(params[12]).toBe(0.05);
      const metadata = JSON.parse(params[13] as string);
      expect(metadata.sessionId).toBe('new_sess');
      expect(metadata.stopReason).toBe('stop');
    });

    test('persists with workflow and node context', async () => {
      const chunk: MessageChunk = { type: 'assistant', content: 'Working...' };
      await store.saveChunk(
        { provider: 'claude', sessionId: 'sess_4', workflowRunId: 'run_abc', nodeId: 'implement' },
        0,
        chunk
      );

      const params = mockQuery.mock.calls[0][0][1] as unknown[];
      expect(params[14]).toBe('run_abc');
      expect(params[15]).toBe('implement');
    });
  });

  describe('loadChunks', () => {
    test('returns chunks ordered by chunk_order', async () => {
      // ... (same pattern as shown in Part A)
    });
  });

  describe('deleteSession', () => {
    test('deletes by session_id', async () => {
      await store.deleteSession('sess_1');
      const query = mockQuery.mock.calls[0][0][0] as string;
      expect(query).toContain('DELETE FROM remote_agent_session_chunks');
    });
  });

  describe('getChunkCount', () => {
    test('returns count from query', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([{ count: '42' }]));
      const count = await store.getChunkCount('sess_1');
      expect(count).toBe(42);
    });
  });
});
```

### 10. Test files for session-capture and session-restore

These are the same as shown in the original spec — see `packages/providers/src/session-capture.test.ts` and `packages/providers/src/session-restore.test.ts` at the bottom of this document.

---

## Files to Modify

### 11. `packages/providers/src/types.ts`

Add `GenericProviderDefaults` for config type safety:

```typescript
// Add after PiAiProviderDefaults:

export interface GenericProviderDefaults {
  [key: string]: unknown;
  /** Default model ID for this provider (pi-ai format, e.g. 'gemini-2.5-flash') */
  model?: string;
  /** Custom base URL (for Ollama, vLLM, LiteLLM, etc.) */
  baseUrl?: string;
  /** Which pi-ai API to use (for custom providers with OpenAI-compatible APIs) */
  apiProvider?: string;
  /** API key override — falls back to pi-ai env var detection */
  apiKey?: string;
  /** Thinking/reasoning level */
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  /** Extra skill discovery paths */
  skillPaths?: string[];
  /** Use read-only tools instead of full coding tools */
  readOnly?: boolean;
}
```

### 12. `packages/providers/src/index.ts`

Add exports for all new modules:

```typescript
// Session persistence
export type { ISessionChunkStore, ChunkContext, PersistedChunk } from './session-store';
export { captureSessionChunks, NoOpSessionChunkStore } from './session-capture';
export { restoreSessionFromDB, buildSessionSummary } from './session-restore';
export type { RestoredSession } from './session-restore';

// Pi-AI Generic Provider (replaces old PiAiProvider)
export { PiAiGenericProvider } from './pi-ai/generic-provider';
export type { PiAiGenericProviderOptions } from './pi-ai/generic-provider';
export { PI_AI_GENERIC_CAPABILITIES } from './pi-ai/generic-capabilities';
export { buildPiBeforeToolCall, buildPiAfterToolCall } from './pi-ai/hooks';

// Config types
export type { GenericProviderDefaults } from './types';
```

### 13. `packages/providers/package.json`

Add subpath exports and `pi-coding-agent` dependency:

```jsonc
{
  // Add to "dependencies":
  "@mariozechner/pi-coding-agent": "^0.66.1",

  // Add to "exports":
  "./session-store": "./src/session-store.ts",
  "./session-capture": "./src/session-capture.ts",
  "./session-restore": "./src/session-restore.ts",

  // Update "scripts.test" to include new test files:
  "test": "bun test src/claude/provider.test.ts && bun test src/codex/provider.test.ts && bun test src/registry.test.ts && bun test src/session-capture.test.ts && bun test src/session-restore.test.ts && bun test src/codex/binary-guard.test.ts && bun test src/codex/binary-resolver.test.ts && bun test src/codex/binary-resolver-dev.test.ts && bun test src/claude/binary-resolver.test.ts && bun test src/claude/binary-resolver-dev.test.ts",
}
```

### 14. `packages/providers/src/registry.ts`

Replace the `pi-ai` entry with auto-registered generic providers:

```typescript
import { PiAiGenericProvider } from './pi-ai/generic-provider';
import { PI_AI_GENERIC_CAPABILITIES } from './pi-ai/generic-capabilities';

/** Provider entries auto-registered from pi-ai */
const PI_AI_PROVIDERS = [
  {
    id: 'google',
    piProvider: 'google',
    defaultModel: 'gemini-2.5-flash',
    display: 'Google Gemini',
  },
  {
    id: 'anthropic-pi',
    piProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    display: 'Anthropic (Pi-AI)',
  },
  { id: 'openai-pi', piProvider: 'openai', defaultModel: 'gpt-4o-mini', display: 'OpenAI (Pi-AI)' },
  {
    id: 'mistral',
    piProvider: 'mistral',
    defaultModel: 'mistral-large-latest',
    display: 'Mistral',
  },
  { id: 'groq', piProvider: 'groq', defaultModel: 'openai/gpt-oss-20b', display: 'Groq' },
  { id: 'cerebras', piProvider: 'cerebras', defaultModel: 'gpt-oss-120b', display: 'Cerebras' },
  { id: 'xai', piProvider: 'xai', defaultModel: 'grok-code-fast-1', display: 'xAI' },
  {
    id: 'openrouter',
    piProvider: 'openrouter',
    defaultModel: 'z-ai/glm-4.5v',
    display: 'OpenRouter',
  },
  {
    id: 'vertex',
    piProvider: 'google-vertex',
    defaultModel: 'gemini-2.5-flash',
    display: 'Google Vertex AI',
  },
  {
    id: 'bedrock',
    piProvider: 'amazon-bedrock',
    defaultModel: 'anthropic.claude-sonnet-4-20250514-v1:0',
    display: 'Amazon Bedrock',
  },
  {
    id: 'azure-openai',
    piProvider: 'azure-openai',
    defaultModel: 'gpt-4o-mini',
    display: 'Azure OpenAI',
  },
];

export function registerBuiltinProviders(): void {
  // 1. Claude and Codex — specialized agent SDK providers
  const agentSdkProviders: ProviderRegistration[] = [
    {
      id: 'claude',
      displayName: 'Claude (Anthropic)',
      factory: () => new ClaudeProvider(),
      capabilities: CLAUDE_CAPABILITIES,
      isModelCompatible: (model: string): boolean => {
        const aliases = ['sonnet', 'opus', 'haiku'];
        return aliases.includes(model) || model.startsWith('claude-') || model === 'inherit';
      },
      builtIn: true,
    },
    {
      id: 'codex',
      displayName: 'Codex (OpenAI)',
      factory: () => new CodexProvider(),
      capabilities: CODEX_CAPABILITIES,
      isModelCompatible: (model: string): boolean => {
        const claudeAliases = ['sonnet', 'opus', 'haiku'];
        return (
          !claudeAliases.includes(model) && !model.startsWith('claude-') && model !== 'inherit'
        );
      },
      builtIn: true,
    },
  ];

  for (const entry of agentSdkProviders) {
    if (!registry.has(entry.id)) registry.set(entry.id, entry);
  }

  // 2. Pi-AI generic providers — each backed by PiAiGenericProvider
  for (const p of PI_AI_PROVIDERS) {
    if (registry.has(p.id)) continue;
    registry.set(p.id, {
      id: p.id,
      displayName: p.display,
      factory: () => new PiAiGenericProvider(p.piProvider, p.defaultModel),
      capabilities: PI_AI_GENERIC_CAPABILITIES,
      isModelCompatible: () => true, // pi-ai accepts any model
      builtIn: true,
    });
    getLog().debug({ provider: p.id, piProvider: p.piProvider }, 'pi_ai_provider.registered');
  }
}

/**
 * Register a custom pi-ai provider at runtime.
 * Used for Ollama, vLLM, LiteLLM, etc. configured via .archon/config.yaml.
 */
export function registerCustomProvider(entry: ProviderRegistration): void {
  registerProvider(entry);
}
```

### 15. `packages/core/src/config/config-types.ts`

Add `GenericProviderDefaults` to the config types:

```typescript
// Update imports:
import type {
  ClaudeProviderDefaults,
  CodexProviderDefaults,
  GenericProviderDefaults, // NEW
  ProviderDefaultsMap,
} from '@archon/providers/types';

export type {
  ClaudeProviderDefaults,
  CodexProviderDefaults,
  GenericProviderDefaults,
  ProviderDefaultsMap,
};

export type AssistantDefaultsConfig = ProviderDefaultsMap & {
  claude?: ClaudeProviderDefaults;
  codex?: CodexProviderDefaults;
  // Generic providers can be added freely:
  // google?: GenericProviderDefaults;
  // mistral?: GenericProviderDefaults;
  // ollama?: GenericProviderDefaults & { baseUrl: string };
};
```

### 16. `packages/core/src/db/index.ts`

```typescript
// Add:
export * as sessionChunkDb from './session-chunks';
export * from './session-chunks';
```

### 17. `packages/core/src/services/cleanup-service.ts`

Extend `CleanupReport` and cleanup logic:

```typescript
export interface CleanupReport {
  removed: string[];
  skipped: { id: string; reason: string }[];
  errors: { id: string; error: string }[];
  sessionsDeleted: number;
  chunksDeleted: number; // NEW
}

// In runScheduledCleanup(), after session cleanup:
try {
  const { DbSessionChunkStore } = await import('../db/session-chunks');
  const chunkStore = new DbSessionChunkStore();
  report.chunksDeleted = await chunkStore.cleanup(SESSION_RETENTION_DAYS);
  if (report.chunksDeleted > 0) {
    getLog().info({ chunksDeleted: report.chunksDeleted }, 'chunks_cleanup_completed');
  }
} catch (error) {
  getLog().error({ err: error }, 'chunk_cleanup_failed');
  report.errors.push({ id: 'chunk-cleanup', error: (error as Error).message });
}
```

Initialize `chunksDeleted: 0` in the default report object.

### 18. `packages/core/src/orchestrator/orchestrator-agent.ts`

Wrap provider streams with `captureSessionChunks` in both `handleStreamMode` and `handleBatchMode`:

```typescript
import { captureSessionChunks, NoOpSessionChunkStore } from '@archon/providers';
import type { ISessionChunkStore } from '@archon/providers';

// At module level or function start:
const chunkStore: ISessionChunkStore = getPersistStore() ?? new NoOpSessionChunkStore();

// In handleStreamMode — wrap the raw generator:
const rawStream = aiClient.sendQuery(
  fullPrompt,
  cwd,
  session.assistant_session_id ?? undefined,
  requestOptions
);
const stream = captureSessionChunks(rawStream, chunkStore, {
  provider: conversation.ai_assistant_type,
  sessionId: session.assistant_session_id ?? crypto.randomUUID(),
});

for await (const msg of stream) {
  // ... existing handling unchanged ...
}
```

Same pattern in `handleBatchMode`.

### 19. `packages/workflows/src/deps.ts`

```typescript
import type { ISessionChunkStore } from '@archon/providers/session-store';

export interface WorkflowDeps {
  // ... existing fields ...
  /** Session chunk store for persisting provider output. Optional — defaults to NoOp. */
  chunkStore?: ISessionChunkStore;
}
```

### 20. `packages/workflows/src/dag-executor.ts`

Wrap provider streams in `executeNodeInternal` and loop/approval nodes:

```typescript
import { captureSessionChunks, NoOpSessionChunkStore } from '@archon/providers';

// In executeNodeInternal, around line 590:
const chunkStore = deps.chunkStore ?? new NoOpSessionChunkStore();
const rawStream = aiClient.sendQuery(finalPrompt, cwd, resumeSessionId, nodeOptionsWithAbort);
const capturedStream = captureSessionChunks(rawStream, chunkStore, {
  provider,
  sessionId: resumeSessionId ?? crypto.randomUUID(),
  workflowRunId: workflowRun.id,
  nodeId: node.id,
});

for await (const msg of withIdleTimeout(capturedStream, ...)) {
```

Same pattern for loop nodes (~line 1574) and approval nodes (~line 2472).

### 21. Claude Provider — Add DB fallback on resume failure

In `packages/providers/src/claude/provider.ts`, in the catch block of the retry loop:

```typescript
import { restoreSessionFromDB, buildSessionSummary } from '../session-restore';
import { getPersistStore } from '../session-store';

// In the catch block, after classifying the error:
if (resumeSessionId && attempt === 0) {
  const errMessage = (err as Error).message.toLowerCase();
  if (errMessage.includes('session') || errMessage.includes('not found') || errMessage.includes('resume')) {
    const store = getPersistStore();
    if (store) {
      const restored = await restoreSessionFromDB(store, resumeSessionId);
      if (restored) {
        const summary = buildSessionSummary(restored);
        // Append summary to system prompt
        options.systemPrompt = {
          type: 'text',
          text: `${originalSystemPrompt}\n\n${summary}`,
        };
        delete options.resume;
        getLog().info({ sessionId: resumeSessionId }, 'claude.db_restore_fallback');
        yield { type: 'system', content: '⚠️ Session restored from database (container restart).' };
        continue; // retry without resume, with injected context
      }
    }
  }
}
```

### 22. Codex Provider — Add DB fallback on resume failure

In `packages/providers/src/codex/provider.ts`:

```typescript
import { restoreSessionFromDB, buildSessionSummary } from '../session-restore';
import { getPersistStore } from '../session-store';

// In the catch block when resumeThread fails:
const store = getPersistStore();
if (store) {
  const restored = await restoreSessionFromDB(store, resumeSessionId);
  if (restored) {
    const summary = buildSessionSummary(restored);
    prompt = `${summary}\n\n---\n\n${prompt}`;
    getLog().info({ sessionId: resumeSessionId }, 'codex.db_restore_fallback');
  }
}
```

### 23. Server Startup — Initialize Chunk Store

Wherever `registerBuiltinProviders()` is called:

```typescript
import { registerBuiltinProviders, setPersistStore } from '@archon/providers';
import { DbSessionChunkStore } from '@archon/core/db/session-chunks';

// Before registering providers:
const chunkStore = new DbSessionChunkStore();
setPersistStore(chunkStore);
registerBuiltinProviders();
```

### 24. Deprecate Old `PiAiProvider`

The old `packages/providers/src/pi-ai/provider.ts` becomes **deprecated**. Keep it for one release cycle with a deprecation notice, then remove:

```typescript
/**
 * @deprecated Use PiAiGenericProvider instead.
 * This provider will be removed in the next major version.
 * Providers are now registered individually (google, mistral, etc.)
 * instead of as a single 'pi-ai' provider with nested config.
 */
```

Remove the `pi-ai` entry from `registerBuiltinProviders()` in the registry.

---

## Task Order

### Phase 1: Foundation (no existing code changes)

| Task   | Description                                                                                         | Files                                                                              | Test                          |
| ------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------- |
| **T1** | Create migration SQL                                                                                | `migrations/022_provider_session_chunks.sql`, update `migrations/000_combined.sql` | Run migration against test DB |
| **T2** | Create `ISessionChunkStore` interface + `PersistedChunk` type + `setPersistStore`/`getPersistStore` | `packages/providers/src/session-store.ts`                                          | Type-check only               |
| **T3** | Create `captureSessionChunks()` + `NoOpSessionChunkStore`                                           | `packages/providers/src/session-capture.ts`                                        | `session-capture.test.ts`     |
| **T4** | Create `restoreSessionFromDB()` + `buildSessionSummary()`                                           | `packages/providers/src/session-restore.ts`                                        | `session-restore.test.ts`     |
| **T5** | Create `DbSessionChunkStore` (DB implementation)                                                    | `packages/core/src/db/session-chunks.ts`                                           | `session-chunks.test.ts`      |

### Phase 2: SDK Provider Normalization (new provider class)

| Task    | Description                                      | Files                                                  | Test                   |
| ------- | ------------------------------------------------ | ------------------------------------------------------ | ---------------------- |
| **T6**  | Add `@mariozechner/pi-coding-agent` dependency   | `packages/providers/package.json`                      | `bun install` succeeds |
| **T7**  | Create `PiAiGenericProvider` using SDK tools     | `packages/providers/src/pi-ai/generic-provider.ts`     | Type-check             |
| **T8**  | Create `PI_AI_GENERIC_CAPABILITIES`              | `packages/providers/src/pi-ai/generic-capabilities.ts` | Type-check             |
| **T9**  | Extract hooks into `hooks.ts`                    | `packages/providers/src/pi-ai/hooks.ts`                | Type-check             |
| **T10** | Update registry to auto-register pi-ai providers | `packages/providers/src/registry.ts`                   | `registry.test.ts`     |
| **T11** | Add `GenericProviderDefaults` to types           | `packages/providers/src/types.ts`                      | Type-check             |
| **T12** | Update config types in core                      | `packages/core/src/config/config-types.ts`             | Type-check             |
| **T13** | Deprecate old `PiAiProvider`                     | `packages/providers/src/pi-ai/provider.ts`             | Existing tests pass    |

### Phase 3: Integration (modify existing code)

| Task    | Description                                           | Files                                                                | Test                 |
| ------- | ----------------------------------------------------- | -------------------------------------------------------------------- | -------------------- |
| **T14** | Update exports and package.json                       | `packages/providers/src/index.ts`, `packages/providers/package.json` | `bun run type-check` |
| **T15** | Wire chunk store into server/CLI startup              | Server entry + CLI entry                                             | Store initialized    |
| **T16** | Add `chunkStore` to `WorkflowDeps`                    | `packages/workflows/src/deps.ts`                                     | Type-check           |
| **T17** | Wrap orchestrator streams with `captureSessionChunks` | `packages/core/src/orchestrator/orchestrator-agent.ts`               | Existing tests pass  |
| **T18** | Wrap dag-executor streams with `captureSessionChunks` | `packages/workflows/src/dag-executor.ts`                             | Existing tests pass  |
| **T19** | Extend cleanup service for chunks                     | `packages/core/src/services/cleanup-service.ts`                      | Existing tests pass  |
| **T20** | Add DB fallback to Claude provider                    | `packages/providers/src/claude/provider.ts`                          | Existing tests pass  |
| **T21** | Add DB fallback to Codex provider                     | `packages/providers/src/codex/provider.ts`                           | Existing tests pass  |

### Phase 4: Validation

| Task    | Description                                      | Command                                                                                                               |
| ------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **T22** | Full type-check                                  | `bun run type-check`                                                                                                  |
| **T23** | Full lint + format                               | `bun run lint && bun run format:check`                                                                                |
| **T24** | All tests pass                                   | `bun run test`                                                                                                        |
| **T25** | Full validation                                  | `bun run validate`                                                                                                    |
| **T26** | Manual: Verify chunks persisted                  | `sqlite3 ~/.archon/archon.db "SELECT session_id, chunk_order, chunk_type FROM remote_agent_session_chunks LIMIT 20;"` |
| **T27** | Manual: Verify provider list shows new providers | `GET /api/providers` returns google, mistral, groq, etc.                                                              |
| **T28** | Manual: Verify resume after container restart    | Restart server → send follow-up → context preserved                                                                   |

---

## Test Files to Create

### `packages/providers/src/session-capture.test.ts`

```typescript
import { describe, test, expect, mock } from 'bun:test';
import { captureSessionChunks, NoOpSessionChunkStore } from './session-capture';
import type { MessageChunk } from './types';
import type { ISessionChunkStore, ChunkContext } from './session-store';

class InMemoryChunkStore implements ISessionChunkStore {
  chunks: Array<{ ctx: ChunkContext; order: number; chunk: MessageChunk }> = [];
  async saveChunk(ctx: ChunkContext, order: number, chunk: MessageChunk): Promise<void> {
    this.chunks.push({ ctx, order, chunk });
  }
  async loadChunks(): Promise<never[]> {
    return [];
  }
  async deleteSession(): Promise<void> {}
  async cleanup(): Promise<number> {
    return 0;
  }
  async getChunkCount(): Promise<number> {
    return this.chunks.length;
  }
}

async function* mockStream(chunks: MessageChunk[]): AsyncGenerator<MessageChunk> {
  for (const chunk of chunks) yield chunk;
}

describe('captureSessionChunks', () => {
  test('yields all chunks unchanged', async () => {
    const store = new InMemoryChunkStore();
    const input: MessageChunk[] = [
      { type: 'assistant', content: 'Hello' },
      { type: 'tool', toolName: 'read', toolInput: { path: 'x.ts' }, toolCallId: 'c1' },
      { type: 'result', sessionId: 'sess_final' },
    ];
    const output: MessageChunk[] = [];
    for await (const msg of captureSessionChunks(mockStream(input), store, {
      provider: 'claude',
      sessionId: 'sess_init',
    })) {
      output.push(msg);
    }
    expect(output).toEqual(input);
  });

  test('persists chunks with correct order', async () => {
    const store = new InMemoryChunkStore();
    const input: MessageChunk[] = [
      { type: 'assistant', content: 'A' },
      { type: 'assistant', content: 'B' },
      { type: 'result', sessionId: 'sess_1' },
    ];
    for await (const _ of captureSessionChunks(mockStream(input), store, {
      provider: 'google',
      sessionId: 's0',
    })) {
    }
    expect(store.chunks).toHaveLength(3);
    expect(store.chunks[0].order).toBe(0);
    expect(store.chunks[1].order).toBe(1);
    expect(store.chunks[2].order).toBe(2);
  });

  test('updates sessionId from result chunk', async () => {
    const store = new InMemoryChunkStore();
    const input: MessageChunk[] = [
      { type: 'assistant', content: 'Hello' },
      { type: 'result', sessionId: 'sess_new' },
    ];
    for await (const _ of captureSessionChunks(mockStream(input), store, {
      provider: 'claude',
      sessionId: 'sess_old',
    })) {
    }
    expect(store.chunks[0].ctx.sessionId).toBe('sess_old');
    expect(store.chunks[1].ctx.sessionId).toBe('sess_new');
  });

  test('handles empty stream', async () => {
    const store = new InMemoryChunkStore();
    const output: MessageChunk[] = [];
    for await (const msg of captureSessionChunks(mockStream([]), store, {
      provider: 'test',
      sessionId: 's1',
    })) {
      output.push(msg);
    }
    expect(output).toHaveLength(0);
    expect(store.chunks).toHaveLength(0);
  });

  test('continues yielding even if saveChunk fails', async () => {
    const failingStore = new InMemoryChunkStore();
    failingStore.saveChunk = mock(async () => {
      throw new Error('DB down');
    });
    const input: MessageChunk[] = [
      { type: 'assistant', content: 'A' },
      { type: 'assistant', content: 'B' },
    ];
    const output: MessageChunk[] = [];
    for await (const msg of captureSessionChunks(mockStream(input), failingStore, {
      provider: 'test',
      sessionId: 's1',
    })) {
      output.push(msg);
    }
    expect(output).toHaveLength(2);
  });
});

describe('NoOpSessionChunkStore', () => {
  test('all methods are no-ops', async () => {
    const store = new NoOpSessionChunkStore();
    await store.saveChunk({ provider: 'x', sessionId: 'y' }, 0, {
      type: 'assistant',
      content: 'test',
    });
    expect(await store.loadChunks('y')).toEqual([]);
    await store.deleteSession('y');
    expect(await store.cleanup(30)).toBe(0);
    expect(await store.getChunkCount('y')).toBe(0);
  });
});
```

### `packages/providers/src/session-restore.test.ts`

```typescript
import { describe, test, expect } from 'bun:test';
import { restoreSessionFromDB, buildSessionSummary } from './session-restore';
import type { ISessionChunkStore, PersistedChunk } from './session-store';

class PreloadedChunkStore implements ISessionChunkStore {
  private data: Map<string, PersistedChunk[]>;
  constructor(data: Map<string, PersistedChunk[]>) {
    this.data = data;
  }
  async saveChunk(): Promise<void> {}
  async loadChunks(sessionId: string): Promise<PersistedChunk[]> {
    return this.data.get(sessionId) ?? [];
  }
  async deleteSession(): Promise<void> {}
  async cleanup(): Promise<number> {
    return 0;
  }
  async getChunkCount(sessionId: string): Promise<number> {
    return this.data.get(sessionId)?.length ?? 0;
  }
}

function makeChunk(
  overrides: Partial<PersistedChunk> & {
    session_id: string;
    chunk_order: number;
    chunk_type: string;
  }
): PersistedChunk {
  return {
    id: crypto.randomUUID(),
    provider: 'test',
    content: null,
    tool_name: null,
    tool_input: null,
    tool_output: null,
    tool_call_id: null,
    tokens_input: null,
    tokens_output: null,
    cost_usd: null,
    metadata: {},
    workflow_run_id: null,
    node_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('restoreSessionFromDB', () => {
  test('returns null for empty session', async () => {
    const store = new PreloadedChunkStore(new Map());
    expect(await restoreSessionFromDB(store, 'unknown')).toBeNull();
  });

  test('reconstructs assistant text from chunks', async () => {
    const store = new PreloadedChunkStore(
      new Map([
        [
          's1',
          [
            makeChunk({
              session_id: 's1',
              chunk_order: 0,
              chunk_type: 'assistant',
              content: 'Hello',
            }),
            makeChunk({
              session_id: 's1',
              chunk_order: 1,
              chunk_type: 'assistant',
              content: ' World',
            }),
          ],
        ],
      ])
    );
    const result = await restoreSessionFromDB(store, 's1');
    expect(result!.assistantText).toBe('Hello\n World');
  });

  test('reconstructs tool interactions with result pairing', async () => {
    const store = new PreloadedChunkStore(
      new Map([
        [
          's1',
          [
            makeChunk({
              session_id: 's1',
              chunk_order: 0,
              chunk_type: 'tool',
              tool_name: 'read',
              tool_input: { path: 'x.ts' },
              tool_call_id: 'c1',
            }),
            makeChunk({
              session_id: 's1',
              chunk_order: 1,
              chunk_type: 'tool_result',
              tool_name: 'read',
              tool_output: 'file contents',
              tool_call_id: 'c1',
            }),
          ],
        ],
      ])
    );
    const result = await restoreSessionFromDB(store, 's1');
    expect(result!.toolInteractions).toHaveLength(1);
    expect(result!.toolInteractions[0].toolName).toBe('read');
    expect(result!.toolInteractions[0].input).toEqual({ path: 'x.ts' });
    expect(result!.toolInteractions[0].output).toBe('file contents');
  });

  test('extracts token usage from last result chunk', async () => {
    const store = new PreloadedChunkStore(
      new Map([
        [
          's1',
          [
            makeChunk({ session_id: 's1', chunk_order: 0, chunk_type: 'assistant', content: 'Hi' }),
            makeChunk({
              session_id: 's1',
              chunk_order: 1,
              chunk_type: 'result',
              tokens_input: 1000,
              tokens_output: 500,
              cost_usd: 0.03,
            }),
          ],
        ],
      ])
    );
    const result = await restoreSessionFromDB(store, 's1');
    expect(result!.lastUsage).toEqual({ input: 1000, output: 500, cost: 0.03 });
  });
});

describe('buildSessionSummary', () => {
  test('includes assistant text and tool interactions', () => {
    const summary = buildSessionSummary({
      assistantText: 'I analyzed the code and found a bug.',
      toolInteractions: [
        { toolName: 'read', output: 'const x = 1;' },
        { toolName: 'edit', output: 'File updated' },
      ],
      chunks: [],
    });
    expect(summary).toContain('Previous Session Context');
    expect(summary).toContain('I analyzed the code');
    expect(summary).toContain('read');
    expect(summary).toContain('edit');
  });

  test('truncates long assistant text', () => {
    const summary = buildSessionSummary({
      assistantText: 'x'.repeat(10_000),
      toolInteractions: [],
      chunks: [],
    });
    expect(summary).toContain('[truncated]');
  });

  test('limits tool interactions to last 15', () => {
    const tools = Array.from({ length: 20 }, (_, i) => ({
      toolName: `tool_${i}`,
      output: `result_${i}`,
    }));
    const summary = buildSessionSummary({ assistantText: '', toolInteractions: tools, chunks: [] });
    expect(summary).toContain('tool_5');
    expect(summary).not.toContain('tool_4');
  });
});
```

---

## Key Design Decisions

1. **Fire-and-forget persistence**: `saveChunk` is async but callers `.catch()` and don't `await` in the hot path. Zero latency impact on streaming.

2. **No schema changes to existing tables**: `remote_agent_session_chunks` is additive. `assistant_session_id` remains the link key.

3. **Provider-agnostic capture**: `captureSessionChunks` works with any `MessageChunk` stream regardless of provider.

4. **Graceful degradation**: `NoOpSessionChunkStore` if not configured. If `saveChunk` fails, stream continues.

5. **No changes to `IAgentProvider` interface**: Store injected at caller level (orchestrator/dag-executor).

6. **Pi-AI gets special treatment**: Directly reconstructs `AgentMessage[]` from chunks (~95% fidelity). Claude/Codex get text summary injection (~85-90%).

7. **Claude and Codex stay specialized**: Their agent SDKs provide MCP, sandboxing, CLAUDE.md. Not replaced by pi-ai.

8. **GenericProvider is parameterized**: One class, many instances — `PiAiGenericProvider('google', 'gemini-2.5-flash')`, `PiAiGenericProvider('mistral', 'mistral-large-latest')`.

9. **SDK tools replace manual definitions**: `createCodingTools(cwd)` from `@mariozechner/pi-coding-agent` replaces ~300 lines of hand-rolled tool code. Same tools, maintained upstream.

10. **Old `PiAiProvider` deprecated, not deleted**: One-release deprecation cycle for backward compatibility.

## Validation Checklist

```bash
# 1-5: Automated
bun run type-check
bun run lint
bun run format:check
bun run test
bun run validate

# 6: New providers show up in registry
curl http://localhost:3090/api/providers
# Should include: google, mistral, groq, xai, openrouter, vertex, bedrock, azure-openai, cerebras

# 7: Chunks are persisted
sqlite3 ~/.archon/archon.db "SELECT session_id, chunk_order, chunk_type, substr(content, 1, 50) FROM remote_agent_session_chunks ORDER BY created_at DESC LIMIT 20;"

# 8: Resume after restart
# - Send message, note session_id from DB
# - Restart server
# - Send follow-up, verify "db_restore_fallback" in logs and context preserved
```
