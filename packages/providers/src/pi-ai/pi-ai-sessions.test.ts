import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { PiAiSessionStore } from './pi-ai-sessions';

// Mock logger to suppress noisy output during tests
import { mock } from 'bun:test';
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
  fatal: mock(() => {}),
  trace: mock(() => {}),
  child: mock(() => mockLogger),
};
mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
  getArchonSessionsPath: mock(() => '/mock/sessions'),
}));

describe('PiAiSessionStore', () => {
  let tempDir: string;
  let store: PiAiSessionStore;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `pi-ai-sessions-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(tempDir, { recursive: true });
    store = new PiAiSessionStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('save and load', () => {
    test('persists messages across save/load calls', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      await store.save('session-1', messages as any);
      const loaded = await store.load('session-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.length).toBe(2);
      expect(loaded![0]).toEqual(messages[0]);
      expect(loaded![1]).toEqual(messages[1]);
    });

    test('returns null for missing session', async () => {
      const loaded = await store.load('nonexistent');
      expect(loaded).toBeNull();
    });

    test('returns empty array for empty file', async () => {
      await writeFile(join(tempDir, 'empty-session.json'), '', 'utf-8');
      const loaded = await store.load('empty-session');
      expect(loaded).toEqual([]);
    });

    test('handles corrupt JSON gracefully returning null lines skipped', async () => {
      const messages = [{ role: 'user' as const, content: 'Valid message' }];

      // Write a file with one valid line and one corrupt line
      const content = JSON.stringify(messages[0]) + '\n{corrupt json\n';
      await writeFile(join(tempDir, 'corrupt-session.json'), content, 'utf-8');

      const loaded = await store.load('corrupt-session');

      // Should return the one valid message (corrupt line is skipped with warning)
      expect(loaded).not.toBeNull();
      expect(loaded!.length).toBe(1);
      expect(loaded![0]).toEqual(messages[0]);
    });

    test('creates sessions directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'nested', 'sessions');
      const nestedStore = new PiAiSessionStore(nestedDir);

      await nestedStore.save('nested-session', [{ role: 'user', content: 'test' }] as any);

      expect(existsSync(nestedDir)).toBe(true);
      const loaded = await nestedStore.load('nested-session');
      expect(loaded).not.toBeNull();
    });
  });

  describe('atomic writes', () => {
    test('uses temp file + rename pattern (no leftover .tmp files)', async () => {
      await store.save('atomic-test', [{ role: 'user', content: 'atomic' }] as any);

      // Session file should exist
      expect(existsSync(join(tempDir, 'atomic-test.json'))).toBe(true);
      // No temp file should remain
      expect(existsSync(join(tempDir, 'atomic-test.json.tmp'))).toBe(false);
    });
  });

  describe('delete', () => {
    test('removes session file', async () => {
      await store.save('to-delete', [{ role: 'user', content: 'bye' }] as any);
      expect(existsSync(join(tempDir, 'to-delete.json'))).toBe(true);

      await store.delete('to-delete');
      expect(existsSync(join(tempDir, 'to-delete.json'))).toBe(false);
    });

    test('does not throw for nonexistent session', async () => {
      await expect(store.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('cleanup', () => {
    test('removes files older than threshold', async () => {
      // Create an "old" file by writing and then modifying mtime
      const oldPath = join(tempDir, 'old-session.json');
      await writeFile(oldPath, JSON.stringify({ role: 'user', content: 'old' }), 'utf-8');

      // Set mtime to 10 days ago
      const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const fs = await import('fs/promises');
      await fs.utimes(oldPath, new Date(oldTime), new Date(oldTime));

      // Create a "new" file
      await store.save('new-session', [{ role: 'user', content: 'new' }] as any);

      // Cleanup files older than 7 days
      const deleted = await store.cleanup(7);

      expect(deleted).toBe(1);
      expect(existsSync(oldPath)).toBe(false);
      expect(existsSync(join(tempDir, 'new-session.json'))).toBe(true);
    });

    test('returns 0 when no files are old enough', async () => {
      await store.save('fresh-session', [{ role: 'user', content: 'fresh' }] as any);

      const deleted = await store.cleanup(30);
      expect(deleted).toBe(0);
    });

    test('returns 0 when sessions directory does not exist', async () => {
      const missingStore = new PiAiSessionStore(join(tempDir, 'does-not-exist'));
      const deleted = await missingStore.cleanup(7);
      expect(deleted).toBe(0);
    });
  });
});
