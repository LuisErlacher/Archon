import { describe, expect, test } from 'bun:test';
import {
  parseVitestOutput,
  parseJestOutput,
  parseTestOutput,
  parseTypecheckOutput,
  parseLintOutput,
} from './parsers';

describe('parseVitestOutput', () => {
  test('parses vitest passing output', () => {
    const stdout = `
 ✓ src/gates/parsers.test.ts (5 tests) 12ms
 Tests  5 passed (5)
 Duration  1.23s
`;
    const result = parseVitestOutput(stdout);
    expect(result.total).toBe(5);
    expect(result.passed).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  test('parses vitest mixed output', () => {
    const stdout = `
 ✓ src/a.test.ts (3 tests) 10ms
 ✗ src/b.test.ts (2 tests) 5ms
 Tests  3 passed | 2 failed | 1 skipped (6)
`;
    const result = parseVitestOutput(stdout);
    expect(result.total).toBe(6);
    expect(result.passed).toBe(3);
    expect(result.failed).toBe(2);
    expect(result.skipped).toBe(1);
  });

  test('parses vitest all failing', () => {
    const stdout = `
 Tests  3 failed (3)
`;
    const result = parseVitestOutput(stdout);
    expect(result.total).toBe(3);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(3);
  });

  test('parses bun test output', () => {
    const stdout = `
bun test v1.2.0

src/test.ts:
✓ should work [2.50ms]
✗ should fail [1.20ms]

3 pass, 1 fail, 0 skip
`;
    const result = parseVitestOutput(stdout);
    expect(result.total).toBe(4);
    expect(result.passed).toBe(3);
    expect(result.failed).toBe(1);
  });

  test('returns zeros for unparseable input', () => {
    const result = parseVitestOutput('random output with no test results');
    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failures).toEqual([]);
  });

  test('extracts failure names from FAIL lines', () => {
    const stdout = `
FAIL src/broken.test.ts > should work
FAIL src/broken.test.ts > should also work
Tests  1 passed | 2 failed (3)
`;
    const result = parseVitestOutput(stdout);
    expect(result.failures.length).toBe(2);
    expect(result.failures[0]!.name).toContain('src/broken.test.ts');
  });
});

describe('parseJestOutput', () => {
  test('parses jest passing output', () => {
    const stdout = `
Test Suites: 3 passed, 3 total
Tests:       10 passed, 10 total
`;
    const result = parseJestOutput(stdout);
    expect(result.total).toBe(10);
    expect(result.passed).toBe(10);
    expect(result.failed).toBe(0);
  });

  test('parses jest mixed output', () => {
    const stdout = `
Test Suites: 1 failed, 2 passed, 3 total
Tests:       2 failed, 8 passed, 10 total
`;
    const result = parseJestOutput(stdout);
    expect(result.total).toBe(10);
    expect(result.passed).toBe(8);
    expect(result.failed).toBe(2);
  });

  test('returns zeros for unparseable input', () => {
    const result = parseJestOutput('no jest output here');
    expect(result.total).toBe(0);
  });
});

describe('parseTestOutput', () => {
  test('auto-detects vitest format', () => {
    const result = parseTestOutput('Tests  5 passed (5)');
    expect(result.total).toBe(5);
    expect(result.passed).toBe(5);
  });

  test('auto-detects jest format', () => {
    const result = parseTestOutput('Tests:       3 passed, 3 total');
    expect(result.total).toBe(3);
    expect(result.passed).toBe(3);
  });

  test('returns zeros for empty input', () => {
    const result = parseTestOutput('');
    expect(result.total).toBe(0);
  });

  test('returns zeros for garbage input', () => {
    const result = parseTestOutput('lorem ipsum dolor sit amet');
    expect(result.total).toBe(0);
  });
});

describe('parseTypecheckOutput', () => {
  test('parses clean typecheck', () => {
    const result = parseTypecheckOutput('');
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  test('counts TypeScript errors', () => {
    const stdout = `
src/foo.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/bar.ts(20,3): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
Found 2 errors.
`;
    const result = parseTypecheckOutput(stdout);
    expect(result.errors).toBe(2);
  });

  test('uses Found N errors summary', () => {
    const stdout = 'Found 15 errors in 5 files.\n';
    const result = parseTypecheckOutput(stdout);
    expect(result.errors).toBe(15);
  });
});

describe('parseLintOutput', () => {
  test('parses clean lint', () => {
    const result = parseLintOutput('');
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  test('parses ESLint summary', () => {
    const stdout = `
/src/foo.ts
  10:5  error  Unexpected any  @typescript-eslint/no-explicit-any
  15:1  warning  Unexpected console statement  no-console

✖ 2 problems (1 error, 1 warning)
`;
    const result = parseLintOutput(stdout);
    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(1);
  });

  test('counts individual error/warning lines', () => {
    const stdout = `
/src/a.ts
  1:1  error  some error
  2:1  error  another error
  3:1  warning  a warning
`;
    const result = parseLintOutput(stdout);
    expect(result.errors).toBe(2);
    expect(result.warnings).toBe(1);
  });
});
