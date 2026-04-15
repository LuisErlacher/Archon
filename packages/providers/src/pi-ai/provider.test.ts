import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { createMockLogger } from '../test/mocks/logger';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';

// Mock logger
const mockLogger = createMockLogger();
mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
  getArchonSessionsPath: mock(() => '/mock/sessions'),
}));

// Track subscribe callback to simulate agent events
let capturedSubscribeCb: ((event: any) => Promise<void>) | null = null;
const mockAgentAbort = mock(() => {});
const mockAgentPrompt = mock(() => Promise.resolve());
const mockAgentSubscribe = mock((cb: (event: any) => Promise<void>) => {
  capturedSubscribeCb = cb;
  return mock(() => {}); // unsubscribe
});

// Mock @mariozechner/pi-agent-core
mock.module('@mariozechner/pi-agent-core', () => ({
  Agent: mock(function (_opts: unknown) {
    return {
      subscribe: mockAgentSubscribe,
      prompt: mockAgentPrompt,
      abort: mockAgentAbort,
    };
  }),
}));

// Mock @mariozechner/pi-ai
const mockGetModel = mock(() => ({}));
mock.module('@mariozechner/pi-ai', () => ({
  getModel: mockGetModel,
  getEnvApiKey: mock(() => 'test-key'),
  streamSimple: mock(() => {}),
  Type: {
    Object: (schema: unknown) => schema,
    String: (opts: unknown) => ({ ...opts, type: 'string' }),
    Number: (opts: unknown) => ({ ...opts, type: 'number' }),
    Boolean: (opts: unknown) => ({ ...opts, type: 'boolean' }),
    Optional: (schema: unknown) => schema,
  },
}));

import { PiAiProvider } from './provider';

// Access the module-level memorySessions map via a helper.
// We import the module and test through the public API only.
// For in-memory tests, we use the provider's behavior.

/**
 * Helper: run a query and simulate agent_end event.
 * Returns the result chunk with sessionId.
 */
async function runQueryAndEnd(
  provider: PiAiProvider,
  options?: {
    persistSession?: boolean;
    resumeSessionId?: string;
  }
): Promise<{ sessionId?: string; chunks: any[] }> {
  capturedSubscribeCb = null;
  const chunks: any[] = [];

  const gen = provider.sendQuery('test prompt', '/tmp', options?.resumeSessionId, {
    persistSession: options?.persistSession,
  });

  // Start consuming the generator
  const iterPromise = (async () => {
    for await (const chunk of gen) {
      chunks.push(chunk);
    }
  })();

  // Wait for subscribe to be called
  await new Promise(r => setTimeout(r, 10));

  if (!capturedSubscribeCb) {
    throw new Error('subscribe callback not captured');
  }

  // Simulate agent_end event
  await capturedSubscribeCb({
    type: 'agent_end',
    messages: [
      { role: 'user', content: 'test prompt' },
      { role: 'assistant', content: 'test response' },
    ],
  });

  // Wait for generator to complete
  await iterPromise;

  const resultChunk = chunks.find(c => c.type === 'result');
  return { sessionId: resultChunk?.sessionId, chunks };
}

describe('PiAiProvider session persistence', () => {
  let provider: PiAiProvider;
  let tempDir: string;

  beforeEach(async () => {
    provider = new PiAiProvider({ retryBaseDelayMs: 1 });
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
    mockAgentAbort.mockClear();
    mockAgentPrompt.mockClear();
    mockAgentSubscribe.mockClear();
    capturedSubscribeCb = null;

    // Create temp dir for file-based session tests
    tempDir = join(
      tmpdir(),
      `pi-ai-provider-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('session save on agent_end (default persistSession)', () => {
    test('saves session to file by default and returns sessionId', async () => {
      const { sessionId, chunks } = await runQueryAndEnd(provider);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(chunks.some(c => c.type === 'result')).toBe(true);
    });
  });

  describe('persistSession: false (in-memory)', () => {
    test('uses in-memory storage and returns sessionId', async () => {
      const { sessionId } = await runQueryAndEnd(provider, {
        persistSession: false,
      });

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    test('in-memory session can be resumed within same provider instance', async () => {
      // First query: creates session with persistSession: false
      const { sessionId: firstId } = await runQueryAndEnd(provider, {
        persistSession: false,
      });

      expect(firstId).toBeDefined();

      // Second query: resume with the same session ID
      // The provider should load from memorySessions
      capturedSubscribeCb = null;
      const gen = provider.sendQuery('follow-up', '/tmp', firstId, {
        persistSession: false,
      });

      const chunks: any[] = [];
      const iterPromise = (async () => {
        for await (const chunk of gen) {
          chunks.push(chunk);
        }
      })();

      await new Promise(r => setTimeout(r, 10));

      // Simulate agent_end
      await capturedSubscribeCb!({
        type: 'agent_end',
        messages: [
          { role: 'user', content: 'test prompt' },
          { role: 'assistant', content: 'test response' },
          { role: 'user', content: 'follow-up' },
          { role: 'assistant', content: 'follow-up response' },
        ],
      });

      await iterPromise;

      const resultChunk = chunks.find(c => c.type === 'result');
      expect(resultChunk).toBeDefined();
      expect(resultChunk.sessionId).toBeDefined();
    });
  });

  describe('session persistence with file store', () => {
    test('session IDs are UUIDs', async () => {
      const { sessionId } = await runQueryAndEnd(provider);

      // UUID v4 format: 8-4-4-4-12 hex chars
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(sessionId).toMatch(uuidPattern);
    });
  });

  describe('multiple queries produce unique sessions', () => {
    test('two sequential queries produce different session IDs', async () => {
      const first = await runQueryAndEnd(provider);
      const second = await runQueryAndEnd(provider);

      expect(first.sessionId).toBeDefined();
      expect(second.sessionId).toBeDefined();
      expect(first.sessionId).not.toBe(second.sessionId);
    });
  });

  describe('getType and getCapabilities', () => {
    test('getType returns pi-ai', () => {
      expect(provider.getType()).toBe('pi-ai');
    });

    test('getCapabilities returns valid structure', () => {
      const caps = provider.getCapabilities();
      expect(caps.sessionResume).toBe(true);
      expect(caps.hooks).toBe(true);
      expect(caps.skills).toBe(true);
      expect(caps.thinkingControl).toBe(true);
    });
  });
});
