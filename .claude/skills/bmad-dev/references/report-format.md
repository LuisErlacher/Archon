# Developer Agent Report Format

This document defines the standardized format for all developer agent reports returned to the orchestrator.

## Purpose

Structured reports enable:
1. **Programmatic parsing** by orchestrator
2. **Consistent state tracking** across workflows
3. **Clear handoffs** between agents
4. **Automated validation** of state transitions
5. **Audit trail** of implementation progress

## Report Types

### 1. Success Report
Used when workflow completes successfully without errors.

### 2. Error Report
Used when workflow encounters blocking errors or failures.

---

## SUCCESS REPORT TEMPLATE

```markdown
## Agent Report: {workflow-name}

**Status:** ✅ SUCCESS

**Workflow:** {workflow-name}
**Story:** {story-id}
**Executed:** {timestamp ISO 8601}
**Duration:** {minutes}m

**Implementation Summary:**
- {AC-001}: {Brief description of implementation}
- {AC-002}: {Brief description of implementation}
- {AC-N}: {Brief description of implementation}

**Files Modified:**
- {file-path-1} (+{lines} added, -{lines} removed)
- {file-path-2} (+{lines} added, -{lines} removed)

**Test Results:**
- Unit Tests: {passed}/{total} passing (100%)
- Integration Tests: {passed}/{total} passing (100%)
- E2E Tests: {passed}/{total} passing (100%)
- **Overall:** ✅ ALL TESTS PASSING (100%)

**Current State (after execution):**
- Story Status: {current-status}
- BACKLOG: {count} stories
- TODO: {story-id or "empty"}
- IN PROGRESS: {story-id or "empty"}
- DONE: {count} stories

**Next Action:**
{User DoD verification required OR story advanced to DONE}

**Quality Metrics:**
- TypeScript: ✅ No errors
- ESLint: ✅ Passing
- Code Coverage: {percentage}%
- Security: ✅ No vulnerabilities

**Notes:**
{Any important observations, architectural decisions, or tech debt}
```

### Success Report Field Definitions

#### Header Fields
- **Status**: Always "✅ SUCCESS" for successful completion
- **Workflow**: Exact workflow name (dev-story, story-done, review-story)
- **Story**: Story ID in format X.Y (e.g., "12.2")
- **Executed**: Timestamp in ISO 8601 format (e.g., "2025-11-04T10:30:00-03:00")
- **Duration**: Execution time in minutes (e.g., "45m")

#### Implementation Summary
List each acceptance criteria with brief implementation description:
- Format: `{AC-ID}: {implementation-description}`
- Example: `AC-001: Implemented phone validation for 4 formats using Zod schema`
- Keep descriptions to 1 line, specific and technical
- Order by AC number

#### Files Modified
List all files changed during implementation:
- Format: `{absolute-or-relative-path} (+{added} added, -{removed} removed)`
- Example: `apps/api/src/modules/clinical/dto/patient.dto.ts (+15 added, -3 removed)`
- Include net changes (lines added/removed)
- Group by module/component if many files

#### Test Results
Report test execution for all suites:
- **Unit Tests**: Component/function level tests
- **Integration Tests**: Module integration tests
- **E2E Tests**: End-to-end workflow tests
- **Overall**: MUST be "✅ ALL TESTS PASSING (100%)" for success report

Format: `{suite-name}: {passed}/{total} passing ({percentage}%)`

**Critical**: Success report ONLY valid if all tests 100% passing.

#### Current State
Snapshot of workflow status after execution:
- **Story Status**: Current status of the story being worked on
  - Possible values: "Ready", "In Progress", "In Review", "Done"
- **BACKLOG**: Number of stories in backlog (integer)
- **TODO**: Story ID currently in TODO or "empty"
- **IN PROGRESS**: Story ID currently in progress or "empty"
- **DONE**: Number of completed stories (integer)

This section allows orchestrator to validate state transitions.

#### Next Action
Clear instruction for what should happen next:
- Examples:
  - "User DoD verification required before marking story done"
  - "Story ready for review-story workflow"
  - "Advance TODO story to IN PROGRESS"
  - "No action needed, story complete"

#### Quality Metrics
Code quality validation results:
- **TypeScript**: Type checking status (✅ No errors / ❌ {count} errors)
- **ESLint**: Linting status (✅ Passing / ❌ {count} errors)
- **Code Coverage**: Percentage of code covered by tests
- **Security**: Vulnerability scan (✅ No vulnerabilities / ⚠️ {count} issues)

#### Notes
Additional context not captured elsewhere:
- Architectural decisions made
- Technical debt identified
- Performance considerations
- Security implications
- Dependencies added/updated

---

## ERROR REPORT TEMPLATE

```markdown
## Agent Report: {workflow-name}

**Status:** ❌ FAILED

**Workflow:** {workflow-name}
**Story:** {story-id}
**Failed At:** {step-description or AC-ID}
**Error:** {concise-error-message}

**Test Results:**
- Unit Tests: {passed}/{total} passing ({percentage}%)
- **FAILED TESTS:**
  - {test-name-1}: {failure-reason}
  - {test-name-2}: {failure-reason}

**Context:**
Attempting to implement {AC-ID}: {AC-description}

**Root Cause:**
{Technical explanation of why it failed}

**Recovery Options:**
1. {Option 1: Fix approach, what to change}
2. {Option 2: Alternative implementation}
3. {Option 3: Request correct-course workflow}

**Files Involved:**
- {file-path-1}: {what was being changed}
- {file-path-2}: {what was being changed}

**Diagnostic Info:**
- Story Context XML: {✅ loaded / ❌ missing}
- Required dependencies: {list}
- Environment: {local/staging/prod}

**Orchestrator Action Required:**
{Specific recommendation: re-run after fix, launch correct-course, or manual intervention}
```

### Error Report Field Definitions

#### Header Fields
- **Status**: Always "❌ FAILED" for errors
- **Workflow**: Exact workflow name
- **Story**: Story ID in format X.Y
- **Failed At**: Specific step or AC where failure occurred
- **Error**: Concise, parseable error message (1 line)

#### Test Results
Report test status when tests are the failure point:
- Show pass/fail ratio for each suite
- List **FAILED TESTS** section with:
  - Exact test name
  - Failure reason (assertion that failed, error thrown)
- Example:
  ```
  FAILED TESTS:
  - should validate phone with country code: Expected true, received false
  - should reject invalid format: TypeError: Cannot read property 'match' of undefined
  ```

#### Context
Describe what the workflow was attempting:
- Which AC was being implemented
- What change was being made
- Expected behavior

#### Root Cause
Technical analysis of WHY the failure occurred:
- Not just "test failed" but WHY the test failed
- Code issue, logic error, missing dependency
- Environmental factor, data issue
- Keep focused and technical

#### Recovery Options
Provide 2-3 concrete options for orchestrator:
1. **Fix approach**: What to change to resolve (e.g., "Update validation regex to handle format")
2. **Alternative**: Different implementation approach
3. **Escalation**: Request help (correct-course workflow, manual intervention)

Be specific enough that orchestrator can make informed decision.

#### Files Involved
List files that were being modified when failure occurred:
- Include what change was being attempted
- Example: `apps/api/src/validation/phone.ts: Adding country code validation`

#### Diagnostic Info
Environmental context for debugging:
- **Story Context XML**: Was it loaded successfully?
- **Required dependencies**: Were all dependencies available?
- **Environment**: Where was this executing? (local, CI, staging)

#### Orchestrator Action Required
Single, clear recommendation:
- "Re-run dev-story after fixing validation logic in phone.ts"
- "Launch correct-course workflow to clarify AC-003 requirements"
- "Manual intervention required: external API unavailable"

---

## Report Formatting Rules

### Markdown Formatting
1. Use `##` for main report header
2. Use `**bold**` for field labels
3. Use `-` for lists
4. Use ` ` for inline code/paths
5. Use ` ` for code blocks
6. Use ✅ and ❌ emoji for status (copyable for parsing)

### Consistency Requirements
1. **Always include all sections** even if empty
   - Empty files modified: "None"
   - Empty notes: "None"
2. **Use exact field labels** as shown in templates
   - Enables regex parsing: `**Status:** (✅ SUCCESS|❌ FAILED)`
3. **ISO 8601 timestamps** for executed field
   - Example: "2025-11-04T10:30:00-03:00"
4. **Consistent story ID format**: X.Y (no "DIGIL-", no other prefix)

### Parsing-Friendly Patterns
These patterns are used by orchestrator for parsing:

```python
# Extract status
status_pattern = r"\*\*Status:\*\* (✅ SUCCESS|❌ FAILED)"

# Extract story ID
story_pattern = r"\*\*Story:\*\* ([\d]+\.[\d]+)"

# Extract files modified
files_pattern = r"- (.+?) \(\+(\d+) added, -(\d+) removed\)"

# Extract test results
test_pattern = r"- (.+?): (\d+)/(\d+) passing \((\d+)%\)"

# Extract state
backlog_pattern = r"- BACKLOG: (\d+) stories"
todo_pattern = r"- TODO: (.+)"
in_progress_pattern = r"- IN PROGRESS: (.+)"
done_pattern = r"- DONE: (\d+) stories"
```

Maintain these patterns for automated parsing.

---

## Example Reports

### Example 1: Successful dev-story Execution

```markdown
## Agent Report: dev-story

**Status:** ✅ SUCCESS

**Workflow:** dev-story
**Story:** 12.2
**Executed:** 2025-11-04T10:30:00-03:00
**Duration:** 42m

**Implementation Summary:**
- AC-001: Implemented phone validation for 4 formats using Zod schema with custom regex
- AC-002: Added phone formatting utility function to shared library
- AC-003: Integrated validation into patient DTO with proper error messages

**Files Modified:**
- packages/shared/src/validators/phone.validator.ts (+45 added, -0 removed)
- packages/shared/src/utils/phone.formatter.ts (+32 added, -0 removed)
- apps/api/src/modules/clinical/dto/patient.dto.ts (+15 added, -3 removed)
- apps/api/src/modules/clinical/dto/patient.dto.spec.ts (+67 added, -0 removed)

**Test Results:**
- Unit Tests: 24/24 passing (100%)
- Integration Tests: 8/8 passing (100%)
- E2E Tests: 3/3 passing (100%)
- **Overall:** ✅ ALL TESTS PASSING (100%)

**Current State (after execution):**
- Story Status: In Review
- BACKLOG: 8 stories
- TODO: 12.3
- IN PROGRESS: 12.2
- DONE: 5 stories

**Next Action:**
User DoD verification required before running story-done workflow

**Quality Metrics:**
- TypeScript: ✅ No errors
- ESLint: ✅ Passing
- Code Coverage: 94%
- Security: ✅ No vulnerabilities

**Notes:**
Added phone validation to shared library for reuse across all modules. Consider extracting regex patterns to constants file for easier maintenance.
```

### Example 2: Failed dev-story with Test Failures

```markdown
## Agent Report: dev-story

**Status:** ❌ FAILED

**Workflow:** dev-story
**Story:** 12.2
**Failed At:** AC-001 implementation - phone validation tests
**Error:** 2 unit tests failing in phone.validator.spec.ts

**Test Results:**
- Unit Tests: 22/24 passing (92%)
- **FAILED TESTS:**
  - should validate phone with +55 country code: Expected true, received false
  - should handle phone without country code: TypeError: Cannot read property 'match' of undefined

**Context:**
Attempting to implement AC-001: Phone validation must support 4 formats including international format with + prefix

**Root Cause:**
Regex pattern in phone.validator.ts doesn't account for optional + prefix in country code. Additionally, validation throws error when country code is missing instead of handling gracefully.

**Recovery Options:**
1. Update regex pattern to: `/^(\+)?(\d{2})?(\d{11})$/` to handle optional + prefix
2. Add null check before regex match to handle missing country code case
3. Request correct-course workflow if AC-001 requirements need clarification on format priority

**Files Involved:**
- packages/shared/src/validators/phone.validator.ts: Implementing phone validation logic
- packages/shared/src/validators/phone.validator.spec.ts: Test suite with failing cases

**Diagnostic Info:**
- Story Context XML: ✅ loaded
- Required dependencies: zod@3.22.4 (available)
- Environment: local

**Orchestrator Action Required:**
Re-run dev-story after fixing regex pattern and null handling in phone.validator.ts
```

---

## Report Quality Checklist

Before returning report to orchestrator, verify:

- [ ] Status line present and correct (✅/❌)
- [ ] All required fields included
- [ ] Story ID in correct format (X.Y)
- [ ] Timestamp in ISO 8601 format
- [ ] Files listed with line changes
- [ ] Test results with exact numbers
- [ ] Current state section complete
- [ ] Next action is clear and specific
- [ ] Notes provide useful context
- [ ] Markdown formatting correct
- [ ] No placeholder text ({{variables}})
- [ ] Parseable by regex patterns

---

## Integration with Orchestrator

Orchestrator will:
1. **Parse status** to determine success/failure
2. **Extract story ID** to update workflow-status.md
3. **Validate state transition** using Current State section
4. **Read next action** to determine what to do
5. **Store report** for audit trail and retrospective

Report quality directly impacts orchestrator's ability to:
- Make automated decisions
- Advance workflow state machine
- Detect and recover from errors
- Provide meaningful user feedback

**Always prioritize report accuracy and completeness.**
