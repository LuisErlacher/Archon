/**
 * Pi-AI Agent Provider
 *
 * Implements IAgentProvider using @mariozechner/pi-agent-core's Agent class.
 * Unlike Claude and Codex which run as subprocesses, pi-ai runs in-process as a library.
 * Supports multiple LLM providers via @mariozechner/pi-ai (Anthropic, OpenAI, Google, Mistral,
 * Bedrock, Vertex, Groq, xAI, ZAI, Ollama, vLLM, and others).
 *
 * Features:
 * - System prompt injection (including discovered skills)
 * - Thinking/reasoning level control (off → xhigh)
 * - Tool filtering (allowed_tools / denied_tools)
 * - Hook adapters (PreToolUse → beforeToolCall, PostToolUse → afterToolCall)
 * - Skill discovery from .pi/skills/ and .agents/skills/
 * - Retry with exponential backoff for transient failures
 * - Stream idle watchdog for stalled connections
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
import {
  getModel,
  getEnvApiKey,
  streamSimple,
  Type,
  type Model,
  type Api,
} from '@mariozechner/pi-ai';
import type {
  IAgentProvider,
  SendQueryOptions,
  MessageChunk,
  ProviderCapabilities,
} from '../types';
import { parsePiAiConfig } from './config';
import { PI_AI_CAPABILITIES } from './capabilities';
import { discoverSkills, buildSkillSystemPrompt } from './skills';
import { createLogger } from '@archon/paths';
import { randomUUID } from 'crypto';
import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve, isAbsolute } from 'path';
import { spawn } from 'child_process';

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('provider.pi-ai');
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

// ─── Session Storage ─────────────────────────────────────────────────────────

const sessions = new Map<string, AgentMessage[]>();

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_TOOL_OUTPUT = 50_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const STREAM_IDLE_TIMEOUT_MS = 30_000;
const GLOBAL_PROMPT_TIMEOUT_MS = 5 * 60 * 1000;
/** Per-chunk timeout for the queue consumer (prevents stalls when the SSE stream hangs internally). */
const CHUNK_ITERATION_TIMEOUT_MS = 5 * 60 * 1000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_TOOL_OUTPUT) return output;
  return output.slice(0, MAX_TOOL_OUTPUT) + `\n... [truncated, ${output.length} total chars]`;
}

// ─── Async Queue ─────────────────────────────────────────────────────────────

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

// ─── Path Utils ──────────────────────────────────────────────────────────────

function resolvePath(cwd: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const readParams = Type.Object({
  path: Type.String({ description: 'File path to read' }),
  offset: Type.Optional(Type.Number({ description: 'Starting line number (0-based)' })),
  limit: Type.Optional(Type.Number({ description: 'Number of lines to read' })),
});

const editParams = Type.Object({
  path: Type.String({ description: 'File path to edit' }),
  old_string: Type.String({ description: 'Exact string to find and replace' }),
  new_string: Type.String({ description: 'Replacement string' }),
});

const writeParams = Type.Object({
  path: Type.String({ description: 'File path to write' }),
  content: Type.String({ description: 'File content to write' }),
});

const bashParams = Type.Object({
  command: Type.String({ description: 'Shell command to execute' }),
  timeout: Type.Optional(Type.Number({ description: 'Timeout in milliseconds (default 120000)' })),
});

const grepParams = Type.Object({
  pattern: Type.String({ description: 'Search pattern (regex)' }),
  path: Type.String({ description: 'Directory or file to search' }),
  case_insensitive: Type.Optional(Type.Boolean({ description: 'Case insensitive search' })),
});

const findParams = Type.Object({
  path: Type.String({ description: 'Directory to search in' }),
  pattern: Type.String({ description: 'Glob pattern to match' }),
});

const lsParams = Type.Object({
  path: Type.String({ description: 'Directory path to list' }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createCodingTools(cwd: string): AgentTool<any>[] {
  const readTool: AgentTool<typeof readParams> = {
    name: 'read',
    label: 'Read File',
    description: 'Read a file from the filesystem.',
    parameters: readParams,
    async execute(_toolCallId, params) {
      const fullPath = resolvePath(cwd, params.path);
      try {
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        const offset = params.offset ?? 0;
        const limit = params.limit ?? lines.length;
        const sliced = lines.slice(offset, offset + limit).join('\n');
        return { content: [{ type: 'text', text: truncateOutput(sliced) }], details: undefined };
      } catch (err) {
        const errMsg = (err as NodeJS.ErrnoException).message;
        getLog().error({ err, path: fullPath }, 'tool.read_failed');
        return {
          content: [{ type: 'text', text: `Error reading file "${params.path}": ${errMsg}` }],
          details: undefined,
        };
      }
    },
  };

  const editTool: AgentTool<typeof editParams> = {
    name: 'edit',
    label: 'Edit File',
    description: 'Replace a string in a file.',
    parameters: editParams,
    async execute(_toolCallId, params) {
      const fullPath = resolvePath(cwd, params.path);
      try {
        const content = await readFile(fullPath, 'utf-8');
        if (!content.includes(params.old_string)) {
          return {
            content: [{ type: 'text', text: `Error: old_string not found in ${params.path}` }],
            details: undefined,
          };
        }
        const newContent = content.replace(params.old_string, params.new_string);
        await writeFile(fullPath, newContent, 'utf-8');
        return {
          content: [{ type: 'text', text: `File updated: ${params.path}` }],
          details: undefined,
        };
      } catch (err) {
        const errMsg = (err as NodeJS.ErrnoException).message;
        getLog().error({ err, path: fullPath }, 'tool.edit_failed');
        return {
          content: [{ type: 'text', text: `Error editing file "${params.path}": ${errMsg}` }],
          details: undefined,
        };
      }
    },
  };

  const writeTool: AgentTool<typeof writeParams> = {
    name: 'write',
    label: 'Write File',
    description: 'Write content to a file, creating it if needed.',
    parameters: writeParams,
    async execute(_toolCallId, params) {
      const fullPath = resolvePath(cwd, params.path);
      try {
        await writeFile(fullPath, params.content, 'utf-8');
        return {
          content: [{ type: 'text', text: `File written: ${params.path}` }],
          details: undefined,
        };
      } catch (err) {
        const errMsg = (err as NodeJS.ErrnoException).message;
        getLog().error({ err, path: fullPath }, 'tool.write_failed');
        return {
          content: [{ type: 'text', text: `Error writing file "${params.path}": ${errMsg}` }],
          details: undefined,
        };
      }
    },
  };

  const bashTool: AgentTool<typeof bashParams> = {
    name: 'bash',
    label: 'Run Command',
    description: 'Execute a shell command and return stdout/stderr.',
    parameters: bashParams,
    async execute(_toolCallId, params) {
      const timeout = params.timeout ?? 120_000;
      return new Promise(resolvePromise => {
        const proc = spawn(params.command, { shell: true, cwd, timeout });
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        proc.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
        proc.on('close', code => {
          const output = truncateOutput(stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''));
          resolvePromise({
            content: [{ type: 'text', text: `Exit code: ${code}\n${output}` }],
            details: undefined,
          });
        });
        proc.on('error', (err: Error) => {
          resolvePromise({
            content: [{ type: 'text', text: `Error: ${err.message}` }],
            details: undefined,
          });
        });
      });
    },
  };

  const grepTool: AgentTool<typeof grepParams> = {
    name: 'grep',
    label: 'Search Content',
    description: 'Search for a pattern in files using ripgrep (rg) or grep.',
    parameters: grepParams,
    async execute(_toolCallId, params) {
      const searchPath = resolvePath(cwd, params.path);
      const args = params.case_insensitive
        ? ['-rni', params.pattern, searchPath]
        : ['-rn', params.pattern, searchPath];
      return new Promise(resolvePromise => {
        const proc = spawn('rg', args, { cwd, timeout: 30_000 });
        let output = '';
        proc.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        proc.stderr?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        proc.on('close', () => {
          resolvePromise({
            content: [{ type: 'text', text: truncateOutput(output || 'No matches found.') }],
            details: undefined,
          });
        });
        proc.on('error', () => {
          // rg not found, fall back to grep
          const grepProc = spawn('grep', args, { cwd, timeout: 30_000 });
          let grepOut = '';
          grepProc.stdout?.on('data', (data: Buffer) => {
            grepOut += data.toString();
          });
          grepProc.on('close', () => {
            resolvePromise({
              content: [{ type: 'text', text: truncateOutput(grepOut || 'No matches found.') }],
              details: undefined,
            });
          });
          grepProc.on('error', (grepErr: Error) => {
            getLog().warn({ err: grepErr }, 'tool.grep_fallback_failed');
            resolvePromise({
              content: [
                {
                  type: 'text',
                  text: `Search unavailable: neither rg nor grep found. ${grepErr.message}`,
                },
              ],
              details: undefined,
            });
          });
        });
      });
    },
  };

  const findTool: AgentTool<typeof findParams> = {
    name: 'find',
    label: 'Find Files',
    description: 'Find files matching a glob pattern.',
    parameters: findParams,
    async execute(_toolCallId, params) {
      const searchPath = resolvePath(cwd, params.path);
      try {
        const bunModule = await import('bun');
        const glob = new bunModule.Glob(params.pattern);
        const results: string[] = [];
        for await (const file of glob.scan({ cwd: searchPath })) {
          results.push(file);
          if (results.length >= 500) break;
        }
        return {
          content: [
            { type: 'text', text: results.length > 0 ? results.join('\n') : 'No files found.' },
          ],
          details: undefined,
        };
      } catch (err) {
        const errMsg = (err as NodeJS.ErrnoException).message;
        getLog().error({ err, path: searchPath }, 'tool.find_failed');
        return {
          content: [{ type: 'text', text: `Error finding files in "${params.path}": ${errMsg}` }],
          details: undefined,
        };
      }
    },
  };

  const lsTool: AgentTool<typeof lsParams> = {
    name: 'ls',
    label: 'List Directory',
    description: 'List files and directories in a path.',
    parameters: lsParams,
    async execute(_toolCallId, params) {
      const fullPath = resolvePath(cwd, params.path);
      try {
        const entries = await readdir(fullPath, { withFileTypes: true });
        const output = entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n');
        return {
          content: [{ type: 'text', text: output || '(empty directory)' }],
          details: undefined,
        };
      } catch (err) {
        const errMsg = (err as NodeJS.ErrnoException).message;
        getLog().error({ err, path: fullPath }, 'tool.ls_failed');
        return {
          content: [{ type: 'text', text: `Error listing directory "${params.path}": ${errMsg}` }],
          details: undefined,
        };
      }
    },
  };

  return [readTool, editTool, writeTool, bashTool, grepTool, findTool, lsTool];
}

// ─── Hook Adapters ───────────────────────────────────────────────────────────

/** Test if a tool name matches a pipe-separated regex pattern (e.g. "Write|Edit") */
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

// ─── Provider ────────────────────────────────────────────────────────────────

export class PiAiProvider implements IAgentProvider {
  private readonly retryBaseDelayMs: number;

  constructor(options?: { retryBaseDelayMs?: number }) {
    this.retryBaseDelayMs = options?.retryBaseDelayMs ?? RETRY_BASE_DELAY_MS;
  }

  getType(): string {
    return 'pi-ai';
  }

  getCapabilities(): ProviderCapabilities {
    return PI_AI_CAPABILITIES;
  }

  async *sendQuery(
    prompt: string,
    cwd: string,
    resumeSessionId?: string,
    options?: SendQueryOptions
  ): AsyncGenerator<MessageChunk> {
    const log = getLog();

    // Extract pi-ai specific config from assistantConfig + nodeConfig
    const assistantConfig = options?.assistantConfig
      ? parsePiAiConfig(options.assistantConfig)
      : {};

    const piProvider = assistantConfig.provider ?? 'anthropic';
    const modelId = options?.model ?? assistantConfig.model ?? 'claude-sonnet-4-20250514';

    log.info(
      {
        piProvider,
        modelId,
        cwd,
        hasResumeSession: !!resumeSessionId,
        hasSystemPrompt: !!options?.systemPrompt,
        thinkingLevel: assistantConfig.thinkingLevel ?? 'off',
        hasNodeConfig: !!options?.nodeConfig,
      },
      'query_started'
    );

    let model;
    try {
      model = getModel(piProvider as 'anthropic', modelId as 'claude-sonnet-4-20250514');
    } catch (err) {
      const errMsg = (err as Error).message;
      log.error({ err, piProvider, modelId }, 'pi_ai.model_init_failed');
      const enriched = new Error(
        `Failed to initialize pi-ai model: provider="${piProvider}", model="${modelId}". ${errMsg}`
      );
      enriched.cause = err;
      throw enriched;
    }

    const previousMessages = resumeSessionId ? (sessions.get(resumeSessionId) ?? []) : [];

    // ── Tool filtering (from nodeConfig) ────────────────────────────────────
    let tools = createCodingTools(cwd);
    const nodeConfig = options?.nodeConfig;
    if (nodeConfig?.allowed_tools) {
      const allowed = new Set(nodeConfig.allowed_tools.map(t => t.toLowerCase()));
      tools = tools.filter(t => allowed.has(t.name.toLowerCase()));
    }
    if (nodeConfig?.denied_tools) {
      const denied = new Set(nodeConfig.denied_tools.map(t => t.toLowerCase()));
      tools = tools.filter(t => !denied.has(t.name.toLowerCase()));
    }

    // ── Skill discovery ─────────────────────────────────────────────────────
    const skillPaths = nodeConfig?.skills ?? assistantConfig.skillPaths;
    const skills = await discoverSkills(cwd, skillPaths);
    const skillPrompt = buildSkillSystemPrompt(skills);

    // ── System prompt assembly ──────────────────────────────────────────────
    const systemPromptParts: string[] = [];
    if (options?.systemPrompt) systemPromptParts.push(options.systemPrompt);
    if (nodeConfig?.systemPrompt) systemPromptParts.push(nodeConfig.systemPrompt);
    if (skillPrompt) systemPromptParts.push(skillPrompt);
    if (options?.outputFormat?.schema) {
      const schemaStr = JSON.stringify(options.outputFormat.schema, null, 2);
      systemPromptParts.push(
        `You MUST respond with valid JSON matching this schema:\n\`\`\`json\n${schemaStr}\n\`\`\`\nDo not include any text outside the JSON object.`
      );
    }
    const systemPrompt = systemPromptParts.join('\n\n');

    // ── Thinking level ──────────────────────────────────────────────────────
    const thinkingLevel = (assistantConfig.thinkingLevel ?? 'off') as ThinkingLevel;

    // ── Hook adapters (raw YAML hooks — NOT SDK-wrapped) ────────────────────
    const hooksConfig = nodeConfig?.hooks as HooksConfig | undefined;
    const beforeToolCall = hooksConfig ? buildPiBeforeToolCall(hooksConfig) : undefined;
    const afterToolCall = hooksConfig ? buildPiAfterToolCall(hooksConfig) : undefined;

    // ── Retry loop ──────────────────────────────────────────────────────────
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (options?.abortSignal?.aborted) {
        throw new Error('Query aborted');
      }

      if (attempt > 0) {
        const delayMs = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
        log.info(
          { attempt, delayMs, piProvider, modelId, previousError: lastError?.message },
          'pi_ai.retry_started'
        );
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
        if (options?.abortSignal?.aborted) {
          throw new Error('Query aborted');
        }

        const errorType = classifyError(err.message);
        log.error(
          { error: err.message, errorType, piProvider, modelId, attempt, maxRetries: MAX_RETRIES },
          'pi_ai.attempt_failed'
        );

        if (errorType === 'auth') {
          const enriched = new Error(`Pi-AI auth error (provider=${piProvider}): ${err.message}`);
          enriched.cause = error;
          throw enriched;
        }

        if (attempt < MAX_RETRIES) {
          lastError = err;
          continue;
        }

        const enriched = new Error(
          `Pi-AI query failed after ${MAX_RETRIES + 1} attempts (provider=${piProvider}, model=${modelId}): ${err.message}`
        );
        enriched.cause = error;
        throw enriched;
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

    // ── Stream idle watchdog ────────────────────────────────────────────────
    let hasReceivedContent = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let streamEnded = false;

    const resetIdleTimer = (): void => {
      if (streamEnded) return;
      if (idleTimer) clearTimeout(idleTimer);
      if (!hasReceivedContent) return;
      idleTimer = setTimeout(() => {
        if (streamEnded) return;
        streamEnded = true;
        getLog().warn({ timeoutMs: STREAM_IDLE_TIMEOUT_MS }, 'pi_ai.stream_idle_timeout');
        const messages = agent.state?.messages ?? [];
        const newSessionId = randomUUID();
        sessions.set(newSessionId, messages);
        queue.push({ type: 'result', sessionId: newSessionId });
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
          sessions.set(newSessionId, event.messages);
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
      getLog().warn(
        { timeoutMs: GLOBAL_PROMPT_TIMEOUT_MS, hasReceivedContent },
        'pi_ai.global_prompt_timeout'
      );
      const messages = agent.state?.messages ?? [];
      const newSessionId = randomUUID();
      sessions.set(newSessionId, messages);
      queue.push({ type: 'result', sessionId: newSessionId });
      queue.end();
      unsubscribe();
      agent.abort();
    }, GLOBAL_PROMPT_TIMEOUT_MS);

    agent.prompt(prompt).catch((err: Error) => {
      streamEnded = true;
      clearTimeout(globalTimeout);
      if (idleTimer) clearTimeout(idleTimer);
      const errorType = classifyError(err.message);
      getLog().error({ error: err.message, errorType }, 'pi_ai.prompt_failed');
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

    // ── Queue consumer with per-chunk timeout ────────────────────────────────
    // The Agent SDK's agent.prompt() can hang indefinitely when the SSE stream
    // from the LLM provider (e.g. ZAI/GLM) stops sending events but doesn't close
    // the connection. The globalTimeout and idleTimer rely on setTimeout which
    // may not fire when the Agent's internal for-await loop blocks the event loop.
    //
    // This per-chunk Promise.race ensures we always break out: each queue.next()
    // call races against a fresh setTimeout, guaranteeing the timeout callback
    // executes even if the Agent is stuck inside streamSimple().
    // Use a discriminated union type so Promise.race result is properly typed
    type ChunkRaceResult =
      | { kind: 'chunk'; result: IteratorResult<MessageChunk> }
      | { kind: 'timeout' };

    const queueIterator = queue[Symbol.asyncIterator]();
    let chunkTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      while (true) {
        const raceResult: ChunkRaceResult = await Promise.race([
          queueIterator.next().then(r => ({ kind: 'chunk' as const, result: r })),
          new Promise<{ kind: 'timeout' }>(r => {
            chunkTimer = setTimeout(() => {
              r({ kind: 'timeout' });
            }, CHUNK_ITERATION_TIMEOUT_MS);
          }),
        ]);
        clearTimeout(chunkTimer);

        if (raceResult.kind === 'timeout') {
          // Per-chunk timeout fired — the Agent/stream is stuck
          getLog().warn(
            { timeoutMs: CHUNK_ITERATION_TIMEOUT_MS, hasReceivedContent },
            'pi_ai.chunk_iteration_timeout'
          );
          streamEnded = true;
          clearTimeout(globalTimeout);
          if (idleTimer) clearTimeout(idleTimer);
          // Force-save whatever we have so far
          const messages = agent.state?.messages ?? [];
          const newSessionId = randomUUID();
          sessions.set(newSessionId, messages);
          // Push a result chunk so the caller gets a sessionId
          yield { type: 'result', sessionId: newSessionId } as MessageChunk;
          unsubscribe();
          agent.abort();
          break;
        }

        if (raceResult.result.done) break;
        yield raceResult.result.value;
      }
    } finally {
      streamEnded = true;
      clearTimeout(chunkTimer);
      clearTimeout(globalTimeout);
      if (idleTimer) clearTimeout(idleTimer);
      requestOptions?.abortSignal?.removeEventListener('abort', abortHandler);
      unsubscribe();
    }
  }
}
