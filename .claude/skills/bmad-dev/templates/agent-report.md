# Agent Report Template

Use this template when returning reports to orchestrator after workflow execution.

---

## SUCCESS REPORT

Copy and fill in the template below for successful workflow completion:

```markdown
## Agent Report: {{workflow-name}}

**Status:** ✅ SUCCESS

**Workflow:** {{workflow-name}}
**Story:** {{story-id}}
**Executed:** {{timestamp-iso8601}}
**Duration:** {{minutes}}m

**Implementation Summary:**
- {{AC-001}}: {{implementation-description}}
- {{AC-002}}: {{implementation-description}}
- {{AC-N}}: {{implementation-description}}

**Files Modified:**
- {{file-path-1}} (+{{lines-added}} added, -{{lines-removed}} removed)
- {{file-path-2}} (+{{lines-added}} added, -{{lines-removed}} removed)

**Test Results:**
- Unit Tests: {{passed}}/{{total}} passing (100%)
- Integration Tests: {{passed}}/{{total}} passing (100%)
- E2E Tests: {{passed}}/{{total}} passing (100%)
- **Overall:** ✅ ALL TESTS PASSING (100%)

**Current State (after execution):**
- Story Status: {{status}}
- BACKLOG: {{count}} stories
- TODO: {{story-id or "empty"}}
- IN PROGRESS: {{story-id or "empty"}}
- DONE: {{count}} stories

**Next Action:**
{{next-action-description}}

**Quality Metrics:**
- TypeScript: ✅ No errors
- ESLint: ✅ Passing
- Code Coverage: {{percentage}}%
- Security: ✅ No vulnerabilities

**Notes:**
{{additional-observations}}
```

### Field Replacement Guide

Replace all `{{placeholder}}` values:

- `{{workflow-name}}`: dev-story, story-done, or review-story
- `{{story-id}}`: X.Y format (e.g., "12.2")
- `{{timestamp-iso8601}}`: ISO 8601 with timezone (e.g., "2025-11-04T10:30:00-03:00")
- `{{minutes}}`: Total execution time in minutes (e.g., "42")
- `{{AC-XXX}}`: Acceptance criteria ID (e.g., "AC-001")
- `{{implementation-description}}`: 1-line technical description
- `{{file-path}}`: Absolute or relative path to file
- `{{lines-added}}`: Number of lines added
- `{{lines-removed}}`: Number of lines removed
- `{{passed}}`: Number of tests passed
- `{{total}}`: Total number of tests
- `{{status}}`: Story status (Ready, In Progress, In Review, Done)
- `{{count}}`: Integer count
- `{{next-action-description}}`: Clear instruction for what happens next
- `{{percentage}}`: Code coverage percentage (e.g., "94")
- `{{additional-observations}}`: Any important notes

---

## ERROR REPORT

Copy and fill in the template below for failed workflow execution:

```markdown
## Agent Report: {{workflow-name}}

**Status:** ❌ FAILED

**Workflow:** {{workflow-name}}
**Story:** {{story-id}}
**Failed At:** {{failure-point}}
**Error:** {{error-message}}

**Test Results:**
- Unit Tests: {{passed}}/{{total}} passing ({{percentage}}%)
- **FAILED TESTS:**
  - {{test-name-1}}: {{failure-reason}}
  - {{test-name-2}}: {{failure-reason}}

**Context:**
{{what-was-being-attempted}}

**Root Cause:**
{{technical-explanation}}

**Recovery Options:**
1. {{option-1}}
2. {{option-2}}
3. {{option-3}}

**Files Involved:**
- {{file-path-1}}: {{change-description}}
- {{file-path-2}}: {{change-description}}

**Diagnostic Info:**
- Story Context XML: {{✅ loaded / ❌ missing}}
- Required dependencies: {{list}}
- Environment: {{local/staging/prod}}

**Orchestrator Action Required:**
{{specific-recommendation}}
```

### Field Replacement Guide (Error Report)

- `{{failure-point}}`: Specific step or AC where failure occurred
- `{{error-message}}`: Concise, 1-line error description
- `{{percentage}}`: Test pass percentage (e.g., "92")
- `{{test-name}}`: Exact test name from test suite
- `{{failure-reason}}`: Why the test failed (assertion, exception)
- `{{what-was-being-attempted}}`: Context of what was happening
- `{{technical-explanation}}`: Root cause analysis
- `{{option-N}}`: Concrete recovery option
- `{{change-description}}`: What change was being made to file
- `{{list}}`: Comma-separated list of dependencies
- `{{specific-recommendation}}`: Clear next action for orchestrator

---

## Quick Start Examples

### Example 1: dev-story Success

```markdown
## Agent Report: dev-story

**Status:** ✅ SUCCESS

**Workflow:** dev-story
**Story:** 12.2
**Executed:** 2025-11-04T14:30:00-03:00
**Duration:** 38m

**Implementation Summary:**
- AC-001: Implemented phone validation supporting 4 Brazilian formats with Zod
- AC-002: Added phone formatter utility to shared library for consistent display
- AC-003: Integrated validation into patient DTO with localized error messages

**Files Modified:**
- packages/shared/src/validators/phone.validator.ts (+42 added, -0 removed)
- packages/shared/src/utils/phone.formatter.ts (+28 added, -0 removed)
- apps/api/src/modules/clinical/dto/patient.dto.ts (+12 added, -2 removed)
- apps/api/src/modules/clinical/dto/patient.dto.spec.ts (+56 added, -0 removed)

**Test Results:**
- Unit Tests: 28/28 passing (100%)
- Integration Tests: 9/9 passing (100%)
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
- Code Coverage: 96%
- Security: ✅ No vulnerabilities

**Notes:**
Phone validation added to shared library for reuse. Considered performance - validation completes in <50ms for all formats.
```

### Example 2: dev-story Test Failure

```markdown
## Agent Report: dev-story

**Status:** ❌ FAILED

**Workflow:** dev-story
**Story:** 12.2
**Failed At:** Unit tests - phone validation
**Error:** 2 tests failing in phone.validator.spec.ts

**Test Results:**
- Unit Tests: 26/28 passing (93%)
- **FAILED TESTS:**
  - should validate international format with +55: Expected true, received false
  - should handle missing country code: TypeError: Cannot read property 'match' of undefined

**Context:**
Implementing AC-001 phone validation. Tests validate 4 supported formats including international (+55) and formats without country code.

**Root Cause:**
Regex pattern `/^(\d{2})?(\d{11})$/` doesn't account for + prefix in international format. Validation code throws TypeError when country code group is undefined instead of handling null case.

**Recovery Options:**
1. Update regex to `/^(\+)?(\d{2})?(\d{11})$/` to support optional + prefix
2. Add null check: `const countryCode = match[1] ?? null` before using
3. Re-run tests after fixes

**Files Involved:**
- packages/shared/src/validators/phone.validator.ts: Implementing validation logic
- packages/shared/src/validators/phone.validator.spec.ts: Test suite

**Diagnostic Info:**
- Story Context XML: ✅ loaded
- Required dependencies: zod@3.22.4 available
- Environment: local

**Orchestrator Action Required:**
Re-run dev-story after fixing regex pattern and null handling
```

### Example 3: story-done Success

```markdown
## Agent Report: story-done

**Status:** ✅ SUCCESS

**Workflow:** story-done
**Story:** 12.2
**Executed:** 2025-11-04T15:45:00-03:00
**Duration:** 3m

**Implementation Summary:**
- Validated all ACs satisfied and tasks complete
- Confirmed all tests passing 100%
- Updated story status to Done
- Advanced workflow queue

**Files Modified:**
- docs/stories/story-12.2-atualizar-dtos-validacao-backend.md (+2 added, -1 removed)
- docs/bmm-workflow-status.md (+3 added, -3 removed)

**Test Results:**
- Unit Tests: 28/28 passing (100%)
- Integration Tests: 9/9 passing (100%)
- E2E Tests: 3/3 passing (100%)
- **Overall:** ✅ ALL TESTS PASSING (100%)

**Current State (after execution):**
- Story Status: Done
- BACKLOG: 7 stories
- TODO: 12.4
- IN PROGRESS: 12.3
- DONE: 6 stories

**Next Action:**
Queue advanced: 12.3 moved to IN PROGRESS, 12.4 moved to TODO. Ready for dev-story on 12.3.

**Quality Metrics:**
- TypeScript: ✅ No errors
- ESLint: ✅ Passing
- Code Coverage: 96%
- Security: ✅ No vulnerabilities

**Notes:**
Story completed successfully with 5 story points. Total epic progress: 6/14 stories done (43%).
```

---

## Report Quality Checklist

Before submitting report, verify:

- [ ] All `{{placeholders}}` replaced with actual values
- [ ] Status emoji correct (✅ or ❌)
- [ ] Timestamp in ISO 8601 format with timezone
- [ ] Story ID in X.Y format
- [ ] Files listed with actual line counts
- [ ] Test results show exact numbers
- [ ] Current State section complete and accurate
- [ ] Next Action is clear and specific
- [ ] For errors: Root cause analysis included
- [ ] For errors: At least 2 recovery options provided
- [ ] Markdown formatting correct (no syntax errors)
- [ ] Report is parseable by orchestrator regex patterns

---

## Common Mistakes to Avoid

❌ **Don't**:
- Leave `{{placeholders}}` in final report
- Use vague descriptions ("did stuff", "fixed things")
- Skip test results section
- Mark as SUCCESS with tests < 100%
- Provide generic recovery options ("try again", "fix it")
- Include PII (patient names, emails, phones) in notes

✅ **Do**:
- Be specific and technical
- Include exact file paths and line numbers
- Map changes to specific AC IDs
- Provide actionable recovery options
- Test that report parses correctly
- Keep notes focused and relevant

---

## Template Selection Guide

**Use SUCCESS template when:**
- ✅ All workflow steps completed
- ✅ All tests passing 100%
- ✅ No blocking errors encountered
- ✅ Output files created/updated as expected
- ✅ Ready to hand back to orchestrator

**Use ERROR template when:**
- ❌ Workflow cannot continue (blocker)
- ❌ Tests failing (< 100%)
- ❌ Missing required files/context
- ❌ Unclear requirements
- ❌ External dependency unavailable

**When in doubt**: Use ERROR template. Better to report blockers early than mark incomplete work as success.

---

## Integration Notes

This template is designed for:
1. **Orchestrator parsing**: Consistent format enables regex extraction
2. **Audit trail**: Reports stored for retrospective analysis
3. **User visibility**: Clear status updates
4. **Automated decisions**: Structured data enables orchestrator automation

**Quality reports = Better automation**
