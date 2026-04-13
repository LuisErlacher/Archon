import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createMockLogger } from '../test/mocks/logger';

// Mock @archon/paths first (before any imports that use it)
const mockLogger = createMockLogger();
mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
}));

// Mock pi-agent-core Agent class
let capturedListener: ((event: unknown, signal: AbortSignal) => Promise<void> | void) | null = null;
const mockUnsubscribe = mock(() => {});
const mockSubscribeFn = mock((listener: unknown) => {
  capturedListener = listener as typeof capturedListener;
  return mockUnsubscribe;
});
const mockPromptFn = mock(() => Promise.resolve());
const mockAbortFn = mock(() => {});
const MockAgent = mock(
  () =>
    ({
      subscribe: mockSubscribeFn,
      prompt: mockPromptFn,
      abort: mockAbortFn,
      state: { messages: [] },
    }) as unknown
);
mock.module('@mariozechner/pi-agent-core', () => ({
  Agent: MockAgent,
}));

// Mock pi-ai
const mockGetModel = mock(
  (provider: string, modelId: string) => ({ id: modelId, provider }) as unknown
);
mock.module('@mariozechner/pi-ai', () => ({
  getModel: mockGetModel,
  getEnvApiKey: mock(() => 'test-key'),
  streamSimple: mock(async function* () {}),
  Type: {
    Object: mock((schema: unknown) => schema),
    String: mock((opts?: unknown) => ({ type: 'string', ...(opts as object) })),
    Optional: mock((schema: unknown) => schema),
    Number: mock((opts?: unknown) => ({ type: 'number', ...(opts as object) })),
    Boolean: mock((opts?: unknown) => ({ type: 'boolean', ...(opts as object) })),
  },
}));

// Import after all mocks
import { PiAiClient } from './pi-ai';

describe('PiAiClient', () => {
  let client: PiAiClient;

  beforeEach(() => {
    client = new PiAiClient();
    capturedListener = null;
    MockAgent.mockClear();
    mockSubscribeFn.mockClear();
    mockPromptFn.mockClear();
    mockAbortFn.mockClear();
    mockUnsubscribe.mockClear();
    mockGetModel.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    // Default: restore mock implementations
    mockSubscribeFn.mockImplementation((listener: unknown) => {
      capturedListener = listener as typeof capturedListener;
      return mockUnsubscribe;
    });
    mockPromptFn.mockImplementation(() => Promise.resolve());
  });

  describe('getType', () => {
    test('returns pi-ai', () => {
      expect(client.getType()).toBe('pi-ai');
    });
  });

  describe('sendQuery', () => {
    test('yields assistant text chunks', async () => {
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.(
          {
            type: 'message_update',
            message: {},
            assistantMessageEvent: {
              type: 'text_delta',
              delta: 'Hello!',
              contentIndex: 0,
              partial: {},
            },
          },
          signal
        );
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      const chunks = [];
      for await (const chunk of client.sendQuery('hi', '/tmp')) {
        chunks.push(chunk);
      }
      expect(chunks).toContainEqual({ type: 'assistant', content: 'Hello!' });
      expect(chunks.some(c => c.type === 'result')).toBe(true);
    });

    test('yields thinking chunks', async () => {
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.(
          {
            type: 'message_update',
            message: {},
            assistantMessageEvent: {
              type: 'thinking_delta',
              delta: 'Reasoning...',
              contentIndex: 0,
              partial: {},
            },
          },
          signal
        );
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      const chunks = [];
      for await (const chunk of client.sendQuery('think about this', '/tmp')) {
        chunks.push(chunk);
      }
      expect(chunks).toContainEqual({ type: 'thinking', content: 'Reasoning...' });
    });

    test('yields tool execution events', async () => {
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.(
          {
            type: 'tool_execution_start',
            toolCallId: 'tc1',
            toolName: 'bash',
            args: { command: 'ls' },
          },
          signal
        );
        await capturedListener?.(
          {
            type: 'tool_execution_end',
            toolCallId: 'tc1',
            toolName: 'bash',
            result: 'file1\nfile2',
            isError: false,
          },
          signal
        );
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      const chunks = [];
      for await (const chunk of client.sendQuery('list files', '/tmp')) {
        chunks.push(chunk);
      }
      expect(chunks).toContainEqual({
        type: 'tool',
        toolName: 'bash',
        toolInput: { command: 'ls' },
        toolCallId: 'tc1',
      });
      expect(chunks).toContainEqual({
        type: 'tool_result',
        toolName: 'bash',
        toolOutput: 'file1\nfile2',
        toolCallId: 'tc1',
      });
    });

    test('emits result event with session ID', async () => {
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      const chunks = [];
      for await (const chunk of client.sendQuery('test', '/tmp')) {
        chunks.push(chunk);
      }
      const resultChunk = chunks.find(c => c.type === 'result');
      expect(resultChunk).toBeDefined();
      expect(resultChunk?.type).toBe('result');
      if (resultChunk?.type === 'result') {
        expect(typeof resultChunk.sessionId).toBe('string');
        expect(resultChunk.sessionId.length).toBeGreaterThan(0);
      }
    });

    test('resumes session with saved messages', async () => {
      // First query to save a session
      const savedMessages = [{ role: 'user', content: 'previous message' }];
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.({ type: 'agent_end', messages: savedMessages }, signal);
      });

      let sessionId = '';
      for await (const chunk of client.sendQuery('first', '/tmp')) {
        if (chunk.type === 'result') sessionId = chunk.sessionId;
      }
      expect(sessionId).not.toBe('');

      // Second query resuming with sessionId
      MockAgent.mockClear();
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of client.sendQuery('second', '/tmp', sessionId)) {
        // consume
      }

      // Verify Agent was created with previous messages (calls[0] after mockClear)
      expect(MockAgent).toHaveBeenCalled();
      const agentOptions = MockAgent.mock.calls[0]?.[0] as {
        initialState?: { messages?: unknown[] };
      };
      expect(agentOptions?.initialState?.messages).toEqual(savedMessages);
    });

    test('uses default provider and model when no options', async () => {
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of client.sendQuery('test', '/tmp')) {
        // consume
      }

      expect(mockGetModel).toHaveBeenCalledWith('anthropic', 'claude-sonnet-4-20250514');
    });

    test('uses custom provider and model from options', async () => {
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of client.sendQuery('test', '/tmp', undefined, {
        piAiProvider: 'openai',
        model: 'gpt-4o',
      })) {
        // consume
      }

      expect(mockGetModel).toHaveBeenCalledWith('openai', 'gpt-4o');
    });

    test('calls agent.abort() when abort signal fires', async () => {
      const abortController = new AbortController();

      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.(
          {
            type: 'message_update',
            message: {},
            assistantMessageEvent: {
              type: 'text_delta',
              delta: 'partial',
              contentIndex: 0,
              partial: {},
            },
          },
          signal
        );
        // Abort before agent_end
        abortController.abort();
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of client.sendQuery('test', '/tmp', undefined, {
        abortSignal: abortController.signal,
      })) {
        // consume
      }

      expect(mockAbortFn).toHaveBeenCalled();
    });

    test('propagates prompt errors through the generator', async () => {
      mockPromptFn.mockImplementation(async () => {
        throw new Error('API connection failed');
      });

      const chunks: unknown[] = [];
      let caughtError: Error | null = null;
      try {
        for await (const chunk of client.sendQuery('test', '/tmp')) {
          chunks.push(chunk);
        }
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toBe('API connection failed');
    });

    test('stringifies non-string tool results', async () => {
      mockPromptFn.mockImplementation(async () => {
        const signal = new AbortController().signal;
        await capturedListener?.(
          {
            type: 'tool_execution_end',
            toolCallId: 'tc1',
            toolName: 'read',
            result: { content: [{ type: 'text', text: 'file content' }] },
            isError: false,
          },
          signal
        );
        await capturedListener?.({ type: 'agent_end', messages: [] }, signal);
      });

      const chunks = [];
      for await (const chunk of client.sendQuery('test', '/tmp')) {
        chunks.push(chunk);
      }
      const toolResult = chunks.find(c => c.type === 'tool_result');
      expect(toolResult).toBeDefined();
      if (toolResult?.type === 'tool_result') {
        expect(typeof toolResult.toolOutput).toBe('string');
      }
    });
  });
});
