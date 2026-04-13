/**
 * Test output parsers for quality gates.
 *
 * Pure functions that extract structured test results from stdout of
 * vitest/bun test, jest, typecheck, and lint commands.
 */
import type { TestResults } from '../schemas/gate';

// ---------------------------------------------------------------------------
// Vitest / Bun test parser
// ---------------------------------------------------------------------------

/**
 * Parse vitest or bun test stdout into structured test results.
 *
 * Handles formats:
 * - Vitest summary: `Tests  3 passed | 1 failed | 1 skipped (5)`
 * - Bun test: `3 pass, 1 fail, 1 skip` or `3 pass\n0 fail`
 * - Individual FAIL lines for failure extraction
 */
export function parseVitestOutput(stdout: string): TestResults {
  const result: TestResults = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

  // Try vitest summary format: "Tests  3 passed | 1 failed | 1 skipped (5)"
  const vitestSummary =
    /Tests\s+(?:(\d+)\s+passed)?(?:\s*\|\s*)?(?:(\d+)\s+failed)?(?:\s*\|\s*)?(?:(\d+)\s+skipped)?/.exec(
      stdout
    );
  if (vitestSummary) {
    result.passed = parseInt(vitestSummary[1] ?? '0', 10);
    result.failed = parseInt(vitestSummary[2] ?? '0', 10);
    result.skipped = parseInt(vitestSummary[3] ?? '0', 10);
    result.total = result.passed + result.failed + result.skipped;
    extractFailures(stdout, result);
    return result;
  }

  // Try bun test format: "3 pass, 1 fail" or "3 pass\n0 fail"
  const passMatch = /(\d+)\s+pass/.exec(stdout);
  const failMatch = /(\d+)\s+fail/.exec(stdout);
  const skipMatch = /(\d+)\s+skip/.exec(stdout);
  if (passMatch || failMatch) {
    result.passed = parseInt(passMatch?.[1] ?? '0', 10);
    result.failed = parseInt(failMatch?.[1] ?? '0', 10);
    result.skipped = parseInt(skipMatch?.[1] ?? '0', 10);
    result.total = result.passed + result.failed + result.skipped;
    extractFailures(stdout, result);
    return result;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Jest parser
// ---------------------------------------------------------------------------

/**
 * Parse jest stdout into structured test results.
 *
 * Handles format: "Tests: 1 failed, 3 passed, 4 total"
 */
export function parseJestOutput(stdout: string): TestResults {
  const result: TestResults = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

  // Jest summary: "Tests:       1 failed, 3 passed, 4 total"
  const jestTests =
    /Tests:\s+(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+skipped,?\s*)?(?:(\d+)\s+passed,?\s*)?(\d+)\s+total/.exec(
      stdout
    );
  if (jestTests) {
    result.failed = parseInt(jestTests[1] ?? '0', 10);
    result.skipped = parseInt(jestTests[2] ?? '0', 10);
    result.passed = parseInt(jestTests[3] ?? '0', 10);
    result.total = parseInt(jestTests[4] ?? '0', 10);
    extractFailures(stdout, result);
    return result;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Auto-detect parser
// ---------------------------------------------------------------------------

/**
 * Auto-detect test framework and parse stdout.
 * Tries vitest/bun format first, then jest. Returns zeros if unparseable.
 */
export function parseTestOutput(stdout: string): TestResults {
  // Try vitest/bun first
  const vitest = parseVitestOutput(stdout);
  if (vitest.total > 0) return vitest;

  // Try jest
  const jest = parseJestOutput(stdout);
  if (jest.total > 0) return jest;

  return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
}

// ---------------------------------------------------------------------------
// Typecheck parser
// ---------------------------------------------------------------------------

/**
 * Parse TypeScript type-check output for error/warning counts.
 */
export function parseTypecheckOutput(stdout: string): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;

  // Count "error TS" occurrences
  const errorMatches = stdout.match(/error TS\d+/g);
  if (errorMatches) errors = errorMatches.length;

  // Count "Found N errors" summary
  const foundErrors = /Found (\d+) errors?/.exec(stdout);
  if (foundErrors) errors = parseInt(foundErrors[1], 10);

  // Warnings are rare in tsc but count them
  const warningMatches = stdout.match(/warning TS\d+/g);
  if (warningMatches) warnings = warningMatches.length;

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Lint parser
// ---------------------------------------------------------------------------

/**
 * Parse ESLint output for error/warning counts.
 */
export function parseLintOutput(stdout: string): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;

  // ESLint summary: "X problems (Y errors, Z warnings)"
  const eslintSummary = /(\d+)\s+problems?\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/.exec(stdout);
  if (eslintSummary) {
    errors = parseInt(eslintSummary[2], 10);
    warnings = parseInt(eslintSummary[3], 10);
    return { errors, warnings };
  }

  // Fallback: count individual error/warning lines
  const errorLines = stdout.match(/\d+:\d+\s+error\s/g);
  const warningLines = stdout.match(/\d+:\d+\s+warning\s/g);
  if (errorLines) errors = errorLines.length;
  if (warningLines) warnings = warningLines.length;

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract failure names from test output (FAIL lines).
 */
function extractFailures(stdout: string, result: TestResults): void {
  // Match "FAIL" lines or "✗" lines with test names
  const failLines = stdout.match(/(?:FAIL|✗|✘|×)\s+(.+)/g);
  if (failLines) {
    for (const line of failLines.slice(0, 20)) {
      const nameMatch = /(?:FAIL|✗|✘|×)\s+(.+)/.exec(line);
      if (nameMatch) {
        result.failures.push({
          name: nameMatch[1].trim(),
          message: '',
        });
      }
    }
  }
}
