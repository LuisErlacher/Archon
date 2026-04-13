import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { WorkflowEmitterEvent } from '../event-emitter';

// ---------------------------------------------------------------------------
// Mock logger FIRST (before all other mocks)
// ---------------------------------------------------------------------------

const mockLogFn = mock(() => {});
const mockLogger = {
  info: mockLogFn,
  warn: mockLogFn,
  error: mockLogFn,
  debug: mockLogFn,
  trace: mockLogFn,
  fatal: mockLogFn,
  child: mock(() => mockLogger),
};

mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
}));

// ---------------------------------------------------------------------------
// Mock @archon/git for execFileAsync
// ---------------------------------------------------------------------------

const mockExecFileAsync = mock(
  async (
    _cmd: string,
    _args: string[],
    _opts: object
  ): Promise<{ stdout: string; stderr: string }> => ({
    stdout: '',
    stderr: '',
  })
);

mock.module('@archon/git', () => ({
  execFileAsync: mockExecFileAsync,
}));

// ---------------------------------------------------------------------------
// Mock event emitter
// ---------------------------------------------------------------------------

const emittedEvents: WorkflowEmitterEvent[] = [];
mock.module('../event-emitter', () => ({
  getWorkflowEventEmitter: () => ({
    emit: (event: WorkflowEmitterEvent) => {
      emittedEvents.push(event);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { executeGate, executeGates, formatGateFailureFeedback } from './engine';
import type { QualityGateConfig, GateResult } from '../schemas/gate';

beforeEach(() => {
  mockExecFileAsync.mockReset();
  mockLogFn.mockReset();
  emittedEvents.length = 0;
});

describe('executeGate', () => {
  test('returns passed for exit 0 command', async () => {
    mockExecFileAsync.mockResolvedValueOnce({
      stdout: 'Tests  5 passed (5)\n',
      stderr: '',
    });

    const config: QualityGateConfig = { type: 'test-suite', severity: 'p1', maxRetries: 0 };
    const result = await executeGate(config, '/tmp/test');

    expect(result.passed).toBe(true);
    expect(result.evidence.exitCode).toBe(0);
    expect(result.evidence.parsedResults?.total).toBe(5);
    expect(result.evidence.parsedResults?.passed).toBe(5);
  });

  test('returns failed for non-zero exit', async () => {
    const err = new Error('Command failed') as Error & {
      stdout: string;
      stderr: string;
      status: number;
    };
    err.stdout = 'Tests  1 passed | 2 failed (3)\n';
    err.stderr = '';
    err.status = 1;
    mockExecFileAsync.mockRejectedValueOnce(err);

    const config: QualityGateConfig = { type: 'test-suite', severity: 'p0', maxRetries: 0 };
    const result = await executeGate(config, '/tmp/test');

    expect(result.passed).toBe(false);
    expect(result.evidence.exitCode).toBe(1);
    expect(result.evidence.parsedResults?.failed).toBe(2);
    expect(result.error).toContain('exit code 1');
  });

  test('handles timeout', async () => {
    const err = new Error('timed out') as Error & {
      code: string;
      stdout: string;
      stderr: string;
      status: number;
    };
    err.code = 'ERR_CHILD_PROCESS_TIMEOUT';
    err.stdout = '';
    err.stderr = '';
    err.status = 1;
    mockExecFileAsync.mockRejectedValueOnce(err);

    const config: QualityGateConfig = { type: 'typecheck', severity: 'p1', maxRetries: 0 };
    const result = await executeGate(config, '/tmp/test');

    expect(result.passed).toBe(false);
    expect(result.error).toContain('timed out');
  });

  test('uses custom command when provided', async () => {
    mockExecFileAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const config: QualityGateConfig = {
      type: 'custom',
      name: 'my-check',
      command: 'npm run my-check',
      severity: 'p2',
      maxRetries: 0,
    };
    await executeGate(config, '/tmp/test');

    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'bash',
      ['-c', 'npm run my-check'],
      expect.objectContaining({ cwd: '/tmp/test' })
    );
  });
});

describe('executeGates', () => {
  test('runs all gates and returns aggregate', async () => {
    // First gate passes
    mockExecFileAsync.mockResolvedValueOnce({ stdout: 'Tests  5 passed (5)', stderr: '' });
    // Second gate fails
    const err = new Error('fail') as Error & { stdout: string; stderr: string; status: number };
    err.stdout = '';
    err.stderr = 'error';
    err.status = 1;
    mockExecFileAsync.mockRejectedValueOnce(err);

    const gates: QualityGateConfig[] = [
      { type: 'test-suite', severity: 'p1', maxRetries: 0 },
      { type: 'typecheck', severity: 'p0', maxRetries: 0 },
    ];

    const { results, blocked } = await executeGates(gates, '/tmp/test', 'run-1', 'node-1');

    expect(results.length).toBe(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
    expect(blocked).toBe(true);
  });

  test('p2 failure does not block', async () => {
    // p0 passes
    mockExecFileAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
    // p2 fails
    const err = new Error('fail') as Error & { stdout: string; stderr: string; status: number };
    err.stdout = '';
    err.stderr = '';
    err.status = 1;
    mockExecFileAsync.mockRejectedValueOnce(err);

    const gates: QualityGateConfig[] = [
      { type: 'typecheck', severity: 'p0', maxRetries: 0 },
      { type: 'lint', severity: 'p2', maxRetries: 0 },
    ];

    const { results, blocked } = await executeGates(gates, '/tmp/test', 'run-1', 'node-1');

    expect(results.length).toBe(2);
    expect(blocked).toBe(false);
  });

  test('emits gate events', async () => {
    mockExecFileAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const gates: QualityGateConfig[] = [{ type: 'typecheck', severity: 'p1', maxRetries: 0 }];

    await executeGates(gates, '/tmp/test', 'run-1', 'node-1');

    const started = emittedEvents.find(e => e.type === 'gate_started');
    const passed = emittedEvents.find(e => e.type === 'gate_passed');
    expect(started).toBeTruthy();
    expect(passed).toBeTruthy();
  });

  test('emits gate_blocked for p1 failure', async () => {
    const err = new Error('fail') as Error & { stdout: string; stderr: string; status: number };
    err.stdout = '';
    err.stderr = '';
    err.status = 1;
    mockExecFileAsync.mockRejectedValueOnce(err);

    const gates: QualityGateConfig[] = [{ type: 'lint', severity: 'p1', maxRetries: 0 }];

    await executeGates(gates, '/tmp/test', 'run-1', 'node-1');

    const blockedEvent = emittedEvents.find(e => e.type === 'gate_blocked');
    expect(blockedEvent).toBeTruthy();
  });
});

describe('formatGateFailureFeedback', () => {
  test('formats failed gate results', () => {
    const results: GateResult[] = [
      {
        gateId: 'test-suite:test-suite',
        gateName: 'test-suite',
        gateType: 'test-suite',
        severity: 'p1',
        passed: false,
        evidence: {
          stdout: 'Tests  1 passed | 2 failed (3)',
          exitCode: 1,
          parsedResults: {
            total: 3,
            passed: 1,
            failed: 2,
            skipped: 0,
            failures: [
              { name: 'should work', message: 'Expected true' },
              { name: 'should also work', message: '' },
            ],
          },
        },
        error: 'Gate command failed with exit code 1',
      },
    ];

    const feedback = formatGateFailureFeedback(results);
    expect(feedback).toContain('Quality gate verification failed');
    expect(feedback).toContain('test-suite');
    expect(feedback).toContain('1 passed');
    expect(feedback).toContain('2 failed');
    expect(feedback).toContain('should work');
  });

  test('returns empty string when all gates pass', () => {
    const results: GateResult[] = [
      {
        gateId: 'typecheck:typecheck',
        gateName: 'typecheck',
        gateType: 'typecheck',
        severity: 'p1',
        passed: true,
        evidence: { stdout: '', exitCode: 0 },
      },
    ];

    expect(formatGateFailureFeedback(results)).toBe('');
  });
});
