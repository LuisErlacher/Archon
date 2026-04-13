/**
 * Gate execution engine — runs verification commands and parses real output.
 *
 * Gates execute independently of the AI agent, providing a trust boundary
 * between agent claims and actual verification results.
 */
import { execFileAsync } from '@archon/git';
import { createLogger } from '@archon/paths';
import type { QualityGateConfig, GateResult, TestResults } from '../schemas/gate';
import { getWorkflowEventEmitter } from '../event-emitter';
import { parseTestOutput, parseTypecheckOutput, parseLintOutput } from './parsers';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('gate.engine');
  return cachedLog;
}

// ---------------------------------------------------------------------------
// Built-in gate registry
// ---------------------------------------------------------------------------

interface BuiltInGate {
  command: string;
  parser: ((stdout: string) => TestResults) | null;
}

const BUILT_IN_GATES: Record<string, BuiltInGate> = {
  'test-suite': { command: 'bun run test', parser: parseTestOutput },
  typecheck: { command: 'bun run type-check', parser: null },
  lint: { command: 'bun run lint', parser: null },
};

// ---------------------------------------------------------------------------
// Single gate execution
// ---------------------------------------------------------------------------

const GATE_TIMEOUT_MS = 120_000;

/**
 * Execute a single quality gate by running its command and parsing output.
 */
export async function executeGate(config: QualityGateConfig, cwd: string): Promise<GateResult> {
  const builtIn = BUILT_IN_GATES[config.type];
  const command = config.command ?? builtIn?.command ?? config.type;
  const gateName = config.name ?? config.type;
  const gateId = `${config.type}:${gateName}`;

  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', command], {
      cwd,
      timeout: GATE_TIMEOUT_MS,
    });

    const combinedOutput = stdout + (stderr ? '\n' + stderr : '');

    // Parse results based on gate type
    let parsedResults: TestResults | undefined;
    if (config.type === 'test-suite') {
      parsedResults = parseTestOutput(combinedOutput);
    }

    return {
      gateId,
      gateName,
      gateType: config.type,
      severity: config.severity,
      passed: true,
      evidence: {
        stdout: combinedOutput.slice(0, 10_000),
        exitCode: 0,
        parsedResults,
      },
    };
  } catch (error) {
    const err = error as Error & {
      code?: string;
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    const stdout = (err.stdout ?? '') + (err.stderr ? '\n' + err.stderr : '');
    const exitCode = err.status ?? 1;

    // Parse results even from failed commands
    let parsedResults: TestResults | undefined;
    if (config.type === 'test-suite') {
      parsedResults = parseTestOutput(stdout);
    }

    // Determine if this is a timeout
    const isTimeout =
      err.code === 'ERR_CHILD_PROCESS_TIMEOUT' || err.message?.includes('timed out');

    return {
      gateId,
      gateName,
      gateType: config.type,
      severity: config.severity,
      passed: false,
      evidence: {
        stdout: stdout.slice(0, 10_000),
        exitCode,
        parsedResults,
      },
      error: isTimeout
        ? `Gate timed out after ${GATE_TIMEOUT_MS}ms`
        : `Gate command failed with exit code ${exitCode}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Multi-gate execution
// ---------------------------------------------------------------------------

/**
 * Execute all gates for a node sequentially. Emits events for each gate.
 * Returns aggregate results and whether any p0/p1 gate blocked the node.
 */
export async function executeGates(
  gates: QualityGateConfig[],
  cwd: string,
  runId: string,
  nodeId: string
): Promise<{ results: GateResult[]; blocked: boolean }> {
  const emitter = getWorkflowEventEmitter();
  const results: GateResult[] = [];
  let blocked = false;

  for (const gate of gates) {
    const gateName = gate.name ?? gate.type;

    emitter.emit({
      type: 'gate_started',
      runId,
      nodeId,
      gateName,
      gateType: gate.type,
      severity: gate.severity,
    });

    const result = await executeGate(gate, cwd);
    results.push(result);

    if (result.passed) {
      emitter.emit({
        type: 'gate_passed',
        runId,
        nodeId,
        gateName: result.gateName,
        gateType: result.gateType,
        evidence: {
          exitCode: result.evidence.exitCode,
          parsedResults: result.evidence.parsedResults
            ? {
                total: result.evidence.parsedResults.total,
                passed: result.evidence.parsedResults.passed,
                failed: result.evidence.parsedResults.failed,
                skipped: result.evidence.parsedResults.skipped,
              }
            : undefined,
        },
      });
      getLog().info({ runId, nodeId, gateName, gateType: gate.type }, 'gate.execute_passed');
    } else {
      const isBlocking = gate.severity === 'p0' || gate.severity === 'p1';

      emitter.emit({
        type: 'gate_failed',
        runId,
        nodeId,
        gateName: result.gateName,
        gateType: result.gateType,
        severity: gate.severity,
        evidence: {
          exitCode: result.evidence.exitCode,
          stdout: result.evidence.stdout.slice(0, 2000),
          parsedResults: result.evidence.parsedResults,
        },
      });

      if (isBlocking) {
        blocked = true;
        emitter.emit({
          type: 'gate_blocked',
          runId,
          nodeId,
          gateName: result.gateName,
          message: `${gate.severity.toUpperCase()} gate "${gateName}" failed — node blocked`,
        });
        getLog().warn(
          { runId, nodeId, gateName, severity: gate.severity, exitCode: result.evidence.exitCode },
          'gate.execute_blocked'
        );
      } else {
        getLog().warn(
          { runId, nodeId, gateName, severity: gate.severity },
          'gate.execute_failed_non_blocking'
        );
      }
    }
  }

  return { results, blocked };
}

// ---------------------------------------------------------------------------
// Feedback formatting
// ---------------------------------------------------------------------------

/**
 * Format failed gate results as human-readable feedback for loop injection.
 * Includes actual test failure names and error counts.
 */
export function formatGateFailureFeedback(results: GateResult[]): string {
  const failedGates = results.filter(r => !r.passed);
  if (failedGates.length === 0) return '';

  const lines: string[] = ['Quality gate verification failed:'];

  for (const gate of failedGates) {
    lines.push(`\n[${gate.severity.toUpperCase()}] ${gate.gateName} (${gate.gateType}):`);

    if (gate.error) {
      lines.push(`  Error: ${gate.error}`);
    }

    const parsed = gate.evidence.parsedResults;
    if (parsed) {
      lines.push(
        `  Results: ${parsed.passed} passed, ${parsed.failed} failed, ${parsed.skipped} skipped (${parsed.total} total)`
      );
      if (parsed.failures.length > 0) {
        lines.push('  Failed tests:');
        for (const f of parsed.failures.slice(0, 10)) {
          lines.push(`    - ${f.name}${f.message ? ': ' + f.message : ''}`);
        }
        if (parsed.failures.length > 10) {
          lines.push(`    ... and ${parsed.failures.length - 10} more`);
        }
      }
    } else if (gate.gateType === 'typecheck') {
      const tc = parseTypecheckOutput(gate.evidence.stdout);
      if (tc.errors > 0) {
        lines.push(`  TypeScript errors: ${tc.errors}`);
      }
    } else if (gate.gateType === 'lint') {
      const lint = parseLintOutput(gate.evidence.stdout);
      if (lint.errors > 0 || lint.warnings > 0) {
        lines.push(`  Lint: ${lint.errors} errors, ${lint.warnings} warnings`);
      }
    }

    // Include truncated stdout for context
    if (gate.evidence.stdout.length > 0) {
      const truncated = gate.evidence.stdout.slice(-500);
      lines.push(`  Output (last 500 chars):\n${truncated}`);
    }
  }

  return lines.join('\n');
}
