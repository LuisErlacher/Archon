import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { createQueryResult, mockPostgresDialect } from '../test/mocks/database';
import type { WorkflowDefinitionRecord } from './workflow-definitions';

const mockQuery = mock(() => Promise.resolve(createQueryResult([])));

mock.module('./connection', () => ({
  pool: { query: mockQuery },
  getDialect: () => mockPostgresDialect,
}));

import {
  upsertWorkflowDefinition,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  deleteWorkflowDefinition,
} from './workflow-definitions';

const mockRecord: WorkflowDefinitionRecord = {
  id: 'uuid-1',
  name: 'my-workflow',
  description: 'Test workflow',
  definition: '{"name":"my-workflow","nodes":[]}',
  source: 'user',
  codebase_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('workflow-definitions database', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(() => Promise.resolve(createQueryResult([])));
  });

  describe('upsertWorkflowDefinition', () => {
    test('inserts a new workflow definition and returns the record', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([mockRecord]));

      const result = await upsertWorkflowDefinition({
        name: 'my-workflow',
        description: 'Test workflow',
        definition: '{"name":"my-workflow","nodes":[]}',
      });

      expect(result.name).toBe('my-workflow');
      expect(result.source).toBe('user'); // default
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (name) DO UPDATE SET'),
        expect.arrayContaining(['my-workflow'])
      );
    });

    test('uses provided source when specified as imported', async () => {
      const importedRecord = { ...mockRecord, source: 'imported' as const };
      mockQuery.mockResolvedValueOnce(createQueryResult([importedRecord]));

      const result = await upsertWorkflowDefinition({
        name: 'my-workflow',
        definition: '{"name":"my-workflow","nodes":[]}',
        source: 'imported',
      });

      expect(result.source).toBe('imported');
    });

    test('throws and logs when DB query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(upsertWorkflowDefinition({ name: 'fail', definition: '{}' })).rejects.toThrow(
        'DB connection lost'
      );
    });

    test('throws when upsert returns no rows', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        upsertWorkflowDefinition({ name: 'my-workflow', definition: '{}' })
      ).rejects.toThrow('Upsert returned no rows');
    });
  });

  describe('getWorkflowDefinition', () => {
    test('returns null when workflow not found', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await getWorkflowDefinition('nonexistent');
      expect(result).toBeNull();
    });

    test('returns the record when found', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([mockRecord]));

      const result = await getWorkflowDefinition('my-workflow');
      expect(result?.name).toBe('my-workflow');
      expect(result?.source).toBe('user');
    });

    test('throws and logs when DB query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(getWorkflowDefinition('my-workflow')).rejects.toThrow('Connection timeout');
    });
  });

  describe('listWorkflowDefinitions', () => {
    test('lists all without WHERE clause when codebaseId is omitted', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([mockRecord]));

      const result = await listWorkflowDefinitions();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('my-workflow');
      const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('WHERE');
      expect(sql).toContain('ORDER BY name ASC');
    });

    test('applies codebaseId filter when provided', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      await listWorkflowDefinitions('codebase-1');

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('WHERE (codebase_id = $1 OR codebase_id IS NULL)');
      expect(params).toContain('codebase-1');
    });

    test('throws and logs when DB query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Pool exhausted'));

      await expect(listWorkflowDefinitions()).rejects.toThrow('Pool exhausted');
    });
  });

  describe('deleteWorkflowDefinition', () => {
    test('returns false when no rows were deleted', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([], 0));

      const result = await deleteWorkflowDefinition('nonexistent');
      expect(result).toBe(false);
    });

    test('returns true when row was deleted', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([], 1));

      const result = await deleteWorkflowDefinition('my-workflow');
      expect(result).toBe(true);
    });
  });
});
