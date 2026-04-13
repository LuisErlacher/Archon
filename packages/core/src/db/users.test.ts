import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { createQueryResult, mockPostgresDialect } from '../test/mocks/database';

const mockQuery = mock(() => Promise.resolve(createQueryResult([])));

mock.module('./connection', () => ({
  pool: { query: mockQuery },
  getDialect: () => mockPostgresDialect,
}));

mock.module('@archon/paths', () => ({
  createLogger: () => ({
    info: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    debug: mock(() => undefined),
    fatal: mock(() => undefined),
    trace: mock(() => undefined),
  }),
}));

import { createUser, getUserByUsername, getUserById, countUsers, isMember } from './users';

describe('users db', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  describe('countUsers', () => {
    test('returns 0 when table is empty — PostgreSQL returns count as string', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([{ count: '0' }]));
      expect(await countUsers()).toBe(0);
    });

    test('returns correct value when count is a numeric string', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([{ count: '5' }]));
      expect(await countUsers()).toBe(5);
    });

    test('returns correct value when count is already a number', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([{ count: 3 }]));
      expect(await countUsers()).toBe(3);
    });

    test('returns 0 when rows array is empty', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));
      expect(await countUsers()).toBe(0);
    });
  });

  describe('createUser', () => {
    test('returns the created user row', async () => {
      const mockRow = {
        id: 'uuid-1',
        username: 'alice',
        password_hash: 'h',
        display_name: null,
        role: 'admin',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      mockQuery.mockResolvedValueOnce(createQueryResult([mockRow]));
      const result = await createUser({ username: 'alice', password_hash: 'h', role: 'admin' });
      expect(result.username).toBe('alice');
      expect(result.role).toBe('admin');
    });

    test('throws with descriptive message when INSERT returns no row', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));
      await expect(createUser({ username: 'alice', password_hash: 'h' })).rejects.toThrow(
        'Failed to create user: INSERT succeeded but no row returned'
      );
    });
  });

  describe('getUserByUsername', () => {
    test('returns null when user not found', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));
      expect(await getUserByUsername('nobody')).toBeNull();
    });

    test('returns user when found', async () => {
      const mockRow = {
        id: 'uuid-1',
        username: 'alice',
        password_hash: 'h',
        display_name: null,
        role: 'user',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      mockQuery.mockResolvedValueOnce(createQueryResult([mockRow]));
      const result = await getUserByUsername('alice');
      expect(result?.username).toBe('alice');
    });
  });

  describe('getUserById', () => {
    test('returns null when user not found', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));
      expect(await getUserById('non-existent')).toBeNull();
    });
  });

  describe('isMember', () => {
    test('returns true when membership row exists', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([{ count: '1' }]));
      expect(await isMember('user-1', 'codebase-1')).toBe(true);
    });

    test('returns false when no membership', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([{ count: '0' }]));
      expect(await isMember('user-1', 'codebase-1')).toBe(false);
    });
  });
});
