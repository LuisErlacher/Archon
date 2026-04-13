import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { createQueryResult, mockPostgresDialect } from '../test/mocks/database';

const mockQuery = mock(() => Promise.resolve(createQueryResult([])));

// Mock logger before import
const mockLogger = {
  fatal: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  info: mock(() => undefined),
  debug: mock(() => undefined),
  trace: mock(() => undefined),
};
mock.module('@archon/paths', () => ({ createLogger: mock(() => mockLogger) }));

mock.module('./connection', () => ({
  pool: { query: mockQuery },
  getDialect: () => mockPostgresDialect,
}));

import {
  upsertNodeState,
  getNodeState,
  getNodeStates,
  getValidatedNodeOutputs,
  createTestResult,
  getTestResults,
} from './node-states';

describe('node-states', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockLogger.warn.mockClear();
  });

  describe('upsertNodeState', () => {
    test('inserts with all fields', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      await upsertNodeState({
        workflow_run_id: 'run-1',
        node_id: 'node-a',
        status: 'completed',
        output: 'result text',
        output_validated: true,
        gate_results: [
          { name: 'lint', passed: true, severity: 'p1', exitCode: 0, stdout: '', type: 'builtin' },
        ],
        attempt_count: 1,
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO remote_agent_node_states');
      expect(sql).toContain('ON CONFLICT');
      expect(params[1]).toBe('run-1');
      expect(params[2]).toBe('node-a');
      expect(params[3]).toBe('completed');
      expect(params[4]).toBe('result text');
      expect(params[5]).toBe(true);
      expect(params[6]).toBe(
        JSON.stringify([
          { name: 'lint', passed: true, severity: 'p1', exitCode: 0, stdout: '', type: 'builtin' },
        ])
      );
      expect(params[7]).toBe(1);
    });

    test('defaults optional fields', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      await upsertNodeState({
        workflow_run_id: 'run-1',
        node_id: 'node-a',
        status: 'skipped',
      });

      const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBe(''); // output defaults to ''
      expect(params[5]).toBe(false); // output_validated defaults to false
      expect(params[6]).toBe('[]'); // gate_results defaults to []
      expect(params[7]).toBe(0); // attempt_count defaults to 0
    });

    test('throws on DB error (callers use fire-and-forget catch)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection lost'));

      await expect(
        upsertNodeState({
          workflow_run_id: 'run-1',
          node_id: 'node-a',
          status: 'completed',
        })
      ).rejects.toThrow('connection lost');
    });
  });

  describe('getNodeState', () => {
    test('returns normalized row when found', async () => {
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'ns-1',
            workflow_run_id: 'run-1',
            node_id: 'node-a',
            status: 'completed',
            output: 'hello',
            output_validated: 1, // SQLite integer
            gate_results: '[]', // SQLite string
            attempt_count: 0,
            started_at: '2026-01-01T00:00:00Z',
            completed_at: '2026-01-01T00:01:00Z',
            updated_at: '2026-01-01T00:01:00Z',
          },
        ])
      );

      const result = await getNodeState('run-1', 'node-a');

      expect(result).not.toBeNull();
      expect(result!.output_validated).toBe(true); // Coerced from 1
      expect(result!.gate_results).toEqual([]); // Parsed from string
    });

    test('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await getNodeState('run-1', 'node-missing');

      expect(result).toBeNull();
    });

    test('normalizes SQLite boolean 0 to false', async () => {
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'ns-2',
            workflow_run_id: 'run-1',
            node_id: 'node-b',
            status: 'failed',
            output: '',
            output_validated: 0, // SQLite false
            gate_results: JSON.stringify([{ name: 'test', passed: false }]),
            attempt_count: 1,
            started_at: '2026-01-01T00:00:00Z',
            completed_at: null,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ])
      );

      const result = await getNodeState('run-1', 'node-b');

      expect(result!.output_validated).toBe(false);
      expect(result!.gate_results).toEqual([{ name: 'test', passed: false }]);
    });
  });

  describe('getNodeStates', () => {
    test('returns all rows normalized', async () => {
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'ns-1',
            workflow_run_id: 'run-1',
            node_id: 'node-a',
            status: 'completed',
            output: 'out-a',
            output_validated: 1,
            gate_results: '[]',
            attempt_count: 0,
            started_at: '2026-01-01T00:00:00Z',
            completed_at: '2026-01-01T00:01:00Z',
            updated_at: '2026-01-01T00:01:00Z',
          },
          {
            id: 'ns-2',
            workflow_run_id: 'run-1',
            node_id: 'node-b',
            status: 'failed',
            output: 'out-b',
            output_validated: 0,
            gate_results: '[]',
            attempt_count: 1,
            started_at: '2026-01-01T00:00:00Z',
            completed_at: null,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ])
      );

      const results = await getNodeStates('run-1');

      expect(results).toHaveLength(2);
      expect(results[0].output_validated).toBe(true);
      expect(results[1].output_validated).toBe(false);
    });
  });

  describe('getValidatedNodeOutputs', () => {
    test('returns map of nodeId to output for validated completed nodes', async () => {
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          { node_id: 'node-a', output: 'output-a' },
          { node_id: 'node-b', output: 'output-b' },
        ])
      );

      const outputs = await getValidatedNodeOutputs('run-1');

      expect(outputs).toBeInstanceOf(Map);
      expect(outputs.get('node-a')).toBe('output-a');
      expect(outputs.get('node-b')).toBe('output-b');
      expect(outputs.size).toBe(2);
    });

    test('returns empty map when no validated nodes', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      const outputs = await getValidatedNodeOutputs('run-1');

      expect(outputs.size).toBe(0);
    });
  });

  describe('createTestResult', () => {
    test('inserts with all fields', async () => {
      mockQuery.mockResolvedValueOnce(createQueryResult([]));

      await createTestResult({
        node_state_id: 'ns-1',
        suite_name: 'unit-tests',
        total: 10,
        passed: 8,
        failed: 1,
        skipped: 1,
        failures: [{ name: 'test-x', message: 'assertion failed' }],
        stdout: 'test output',
        exit_code: 1,
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO remote_agent_test_results');
      expect(params[1]).toBe('ns-1');
      expect(params[2]).toBe('unit-tests');
      expect(params[3]).toBe(10);
      expect(params[7]).toBe(JSON.stringify([{ name: 'test-x', message: 'assertion failed' }]));
    });

    test('throws on DB error (callers use fire-and-forget catch)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('disk full'));

      await expect(
        createTestResult({
          node_state_id: 'ns-1',
          suite_name: 'tests',
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          stdout: '',
          exit_code: 1,
        })
      ).rejects.toThrow('disk full');
    });
  });

  describe('getTestResults', () => {
    test('returns normalized rows', async () => {
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'tr-1',
            node_state_id: 'ns-1',
            suite_name: 'tests',
            total: 5,
            passed: 5,
            failed: 0,
            skipped: 0,
            failures: '[]', // SQLite string
            stdout: 'all passed',
            exit_code: 0,
            created_at: '2026-01-01T00:00:00Z',
          },
        ])
      );

      const results = await getTestResults('ns-1');

      expect(results).toHaveLength(1);
      expect(results[0].failures).toEqual([]); // Parsed from string
    });
  });

  describe('normalization edge cases', () => {
    test('handles corrupted JSON in gate_results gracefully', async () => {
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'ns-1',
            workflow_run_id: 'run-1',
            node_id: 'node-a',
            status: 'completed',
            output: '',
            output_validated: 1,
            gate_results: 'not-valid-json{',
            attempt_count: 0,
            started_at: '2026-01-01T00:00:00Z',
            completed_at: null,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ])
      );

      const result = await getNodeState('run-1', 'node-a');

      expect(result!.gate_results).toEqual([]); // Fallback to empty array
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    test('handles corrupted JSON in failures gracefully', async () => {
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'tr-1',
            node_state_id: 'ns-1',
            suite_name: 'tests',
            total: 1,
            passed: 0,
            failed: 1,
            skipped: 0,
            failures: '{broken',
            stdout: '',
            exit_code: 1,
            created_at: '2026-01-01T00:00:00Z',
          },
        ])
      );

      const results = await getTestResults('ns-1');

      expect(results[0].failures).toEqual([]); // Fallback
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    test('passes through already-parsed gate_results array', async () => {
      const gateResults = [{ name: 'lint', passed: true }];
      mockQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'ns-1',
            workflow_run_id: 'run-1',
            node_id: 'node-a',
            status: 'completed',
            output: '',
            output_validated: true, // Already boolean (PostgreSQL)
            gate_results: gateResults, // Already parsed (PostgreSQL)
            attempt_count: 0,
            started_at: '2026-01-01T00:00:00Z',
            completed_at: null,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ])
      );

      const result = await getNodeState('run-1', 'node-a');

      expect(result!.output_validated).toBe(true);
      expect(result!.gate_results).toEqual(gateResults);
    });
  });
});
