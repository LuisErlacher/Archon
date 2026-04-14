/**
 * Pi-AI Assistant Client
 *
 * Implements IAssistantClient using @mariozechner/pi-agent-core's Agent class.
 * Unlike Claude and Codex which run as subprocesses, pi-ai runs in-process as a library.
 * Supports multiple LLM providers via @mariozechner/pi-ai (Anthropic, OpenAI, Google, Mistral,
 * Bedrock, Vertex, Groq, xAI, Ollama, vLLM, and others).
 *
 * Features:
 * - System prompt injection (including discovered skills)
 * - Thinking/reasoning level control (off → xhigh)
 * - Tool filtering (allowed_tools / denied_tools)
 * - Hook adapters (PreToolUse → beforeToolCall, PostToolUse → afterToolCall)
 * - Skill discovery from .pi/skills/ and .agents/skills/
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
import { getModel, getEnvApiKey, streamSimple, Type } from '@mariozechner/pi-ai';
import type { IAssistantClient, MessageChunk, AssistantRequestOptions } from '../types';
import { discoverSkills, buildSkillSystemPrompt } from './pi-ai-skills';
import { createLogger } from '@archon/paths';
import { randomUUID } from 'crypto';
import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve, isAbsolute } from 'path';
import { spawn } from 'child_process';

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('client.pi-ai');
  return cachedLog;
}

const RATE_LIMIT_PATTERNS = ['rate limit', 'rate_limit', 'too many requests', '429'];
const AUTH_PATTERNS = ['unauthorized', 'invalid api key', 'authentication', '401', '403'];

function classifyError(errorMessage: string): 'rate_limit' | 'auth' | 'unknown' {
  const msg = errorMessage.toLowerCase();
  if (RATE_LIMIT_PATTERNS.some(p => msg.includes(p))) return 'rate_limit';
  if (AUTH_PATTERNS.some(p => msg.includes(p))) return 'auth';
  return 'unknown';
}

/**
 * In-memory session storage. Sessions are keyed by UUID and contain
 * the AgentMessage history for resumption. Lost on server restart — acceptable
 * for the initial implementation (YAGNI).
 */
const sessions = new Map<string, AgentMessage[]>();

/** Max tool output length (characters) before truncation */
const MAX_TOOL_OUTPUT = 50_000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_TOOL_OUTPUT) return output;
  return output.slice(0, MAX_TOOL_OUTPUT) + `\n... [truncated, ${output.length} total chars]`;
}

/**
 * Async queue bridge: converts callback-based Agent.subscribe() events
 * to an AsyncGenerator for IAssistantClient.sendQuery().
 */
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

function resolvePath(cwd: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
}

// TypeBox parameter schemas for tools (defined before createCodingTools to preserve top-to-bottom readability)
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
// Map workflow YAML hooks (PreToolUse/PostToolUse with matcher + response)
// to pi-agent-core's beforeToolCall/afterToolCall callbacks.

/** Test if a tool name matches a pipe-separated regex pattern (e.g. "Write|Edit") */
function matchesTool(matcher: string, toolName: string): boolean {
  try {
    return new RegExp(`^(?:${matcher})$`, 'i').test(toolName);
  } catch {
    // Invalid regex — fall back to exact match
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

/**
 * Build a `beforeToolCall` callback from workflow YAML PreToolUse hooks.
 * Supports `permissionDecision: deny` to block tool execution.
 */
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

/**
 * Build an `afterToolCall` callback from workflow YAML PostToolUse hooks.
 * Supports `systemMessage` to append steering text to tool output.
 */
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
        // Append the system message to the tool result content
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

// ─── Client ──────────────────────────────────────────────────────────────────

export class PiAiClient implements IAssistantClient {
  getType(): string {
    return 'pi-ai';
  }

  async *sendQuery(
    prompt: string,
    cwd: string,
    resumeSessionId?: string,
    requestOptions?: AssistantRequestOptions
  ): AsyncGenerator<MessageChunk> {
    const log = getLog();
    const piProvider = requestOptions?.piAiProvider ?? 'anthropic';
    const modelId = requestOptions?.model ?? 'claude-sonnet-4-20250514';

    log.info(
      {
        piProvider,
        modelId,
        cwd,
        hasResumeSession: !!resumeSessionId,
        hasSystemPrompt: !!requestOptions?.piSystemPrompt,
        thinkingLevel: requestOptions?.piThinkingLevel ?? 'off',
        hasTools: requestOptions?.tools !== undefined,
        hasDeniedTools: !!requestOptions?.disallowedTools,
        hasHooks: !!requestOptions?.hooks,
        hasSkillPaths: !!requestOptions?.piSkillPaths,
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

    // ── Tool filtering ──────────────────────────────────────────────────────
    let tools = createCodingTools(cwd);
    if (requestOptions?.tools !== undefined) {
      const allowed = new Set(requestOptions.tools.map(t => t.toLowerCase()));
      tools = tools.filter(t => allowed.has(t.name.toLowerCase()));
    }
    if (requestOptions?.disallowedTools) {
      const denied = new Set(requestOptions.disallowedTools.map(t => t.toLowerCase()));
      tools = tools.filter(t => !denied.has(t.name.toLowerCase()));
    }

    // ── Skill discovery ─────────────────────────────────────────────────────
    const skills = await discoverSkills(cwd, requestOptions?.piSkillPaths);
    const skillPrompt = buildSkillSystemPrompt(skills);

    // ── System prompt assembly ──────────────────────────────────────────────
    const systemPromptParts: string[] = [];
    if (requestOptions?.piSystemPrompt) systemPromptParts.push(requestOptions.piSystemPrompt);
    if (skillPrompt) systemPromptParts.push(skillPrompt);
    // If outputFormat is specified, add JSON instructions to system prompt
    // (pi-ai doesn't have native structured output — instruct via prompt)
    if (requestOptions?.outputFormat?.schema) {
      const schemaStr = JSON.stringify(requestOptions.outputFormat.schema, null, 2);
      systemPromptParts.push(
        `You MUST respond with valid JSON matching this schema:\n\`\`\`json\n${schemaStr}\n\`\`\`\nDo not include any text outside the JSON object.`
      );
    }
    const systemPrompt = systemPromptParts.join('\n\n');

    // ── Thinking level ──────────────────────────────────────────────────────
    const thinkingLevel = (requestOptions?.piThinkingLevel ?? 'off') as ThinkingLevel;

    // ── Hook adapters ───────────────────────────────────────────────────────
    const hooksConfig = requestOptions?.hooks as HooksConfig | undefined;
    const beforeToolCall = hooksConfig ? buildPiBeforeToolCall(hooksConfig) : undefined;
    const afterToolCall = hooksConfig ? buildPiAfterToolCall(hooksConfig) : undefined;

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

    const unsubscribe = agent.subscribe(async (event: AgentEvent) => {
      switch (event.type) {
        case 'message_update': {
          const ame = event.assistantMessageEvent;
          if (ame.type === 'text_delta') {
            queue.push({ type: 'assistant', content: ame.delta });
          } else if (ame.type === 'thinking_delta') {
            queue.push({ type: 'thinking', content: ame.delta });
          }
          break;
        }
        case 'tool_execution_start':
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
          const newSessionId = randomUUID();
          sessions.set(newSessionId, event.messages);
          queue.push({ type: 'result', sessionId: newSessionId });
          queue.end();
          break;
        }
      }
    });

    // Start the prompt (non-blocking)
    agent.prompt(prompt).catch((err: Error) => {
      const errorType = classifyError(err.message);
      log.error({ error: err.message, errorType, piProvider, modelId }, 'query_failed');
      if (errorType === 'rate_limit') {
        queue.push({ type: 'rate_limit', rateLimitInfo: { message: err.message } });
      }
      unsubscribe();
      queue.fail(err);
    });

    // Proactively fail the queue when the abort signal fires, so the for-await loop
    // terminates immediately rather than waiting for the agent to complete naturally.
    const abortHandler = (): void => {
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
      requestOptions?.abortSignal?.removeEventListener('abort', abortHandler);
      unsubscribe();
    }
  }
}
