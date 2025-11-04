# Error Handling Guide - SM Workflows

## Overview

This guide provides comprehensive error scenarios, recovery strategies, and decision trees for handling failures in BMAD Scrum Master workflows. The goal is to enable automated or semi-automated recovery without manual debugging.

## Error Categories

### 1. File System Errors
- Missing required files
- File permission errors
- Corrupt file formats

### 2. Data Validation Errors
- Invalid workflow status
- Incomplete story sections
- Invalid state transitions

### 3. Dependency Errors
- Missing prerequisite workflows
- Unsatisfied workflow dependencies
- External resource unavailable

### 4. Execution Errors
- Workflow step failures
- Template rendering errors
- Variable resolution failures

## Common Error Scenarios

### Error 1: Missing PRD File

**Scenario:**
```
Workflow: create-story
Step: Load PRD
Error: File not found: docs/prd.md
```

**Root Cause:**
The PRD (Product Requirements Document) has not been created yet, or exists in a different location.

**Detection:**
```
Try to read {output_folder}/prd.md
If file not found:
  ERROR: Missing PRD
```

**Recovery Strategy:**

**Option 1 - Generate PRD First (RECOMMENDED):**
```
1. Report to orchestrator: "PRD missing, cannot create stories"
2. Orchestrator should:
   - Launch PM agent to generate PRD
   - Or prompt user to provide PRD
3. Retry create-story workflow after PRD exists
```

**Option 2 - Use Epic as PRD:**
```
1. Check if Epic file has sufficient detail
2. If yes, use Epic file as temporary PRD source
3. Flag story with note: "Generated without full PRD context"
4. Proceed with story creation
5. Recommend PRD creation for future stories
```

**Option 3 - Fail and Wait:**
```
1. Return error report
2. Wait for user to create PRD manually
3. Do not attempt to proceed
```

**Error Report Template:**
```markdown
**Status:** ❌ FAILED
**Failed At:** Step 1 - Load PRD
**Error:** File not found: docs/prd.md

**Root Cause:**
PRD has not been created yet. The create-story workflow requires PRD
to extract feature requirements and context for story creation.

**Recovery Options:**
1. Launch PM agent to generate PRD from project context
2. Use Epic file as temporary PRD source (limited context)
3. User creates PRD manually, then retry workflow

**Orchestrator Action Required:**
Launch PRD generation workflow or request user to create docs/prd.md
```

---

### Error 2: Corrupt workflow-status.md

**Scenario:**
```
Workflow: Any workflow that reads workflow-status.md
Step: Load workflow status
Error: YAML parse error at line 23: Invalid indentation
```

**Root Cause:**
The workflow-status.md file has been manually edited with syntax errors, or was corrupted during a previous workflow failure.

**Detection:**
```
Try to parse {output_folder}/bmm-workflow-status.md
If parse error:
  ERROR: Corrupt workflow status file
  Line: {error-line-number}
  Message: {parse-error-message}
```

**Recovery Strategy:**

**Option 1 - Auto-repair (IF SAFE):**
```
1. Attempt to identify common issues:
   - Indentation errors (spaces vs tabs)
   - Missing colons
   - Unclosed quotes
2. If issue is simple and fix is unambiguous:
   - Create backup: workflow-status.md.backup
   - Apply fix
   - Validate corrected YAML parses
   - Proceed with workflow
3. If repair successful, note in report
```

**Option 2 - Regenerate from Stories:**
```
1. Read all story files from {output_folder}/stories/
2. Extract story status from each file
3. Rebuild workflow-status.md from scratch
4. Validate new file parses correctly
5. Proceed with workflow
```

**Option 3 - Restore from Backup:**
```
1. Check for backup files (workflow-status.md.backup)
2. If found and valid:
   - Restore backup
   - Validate
   - Proceed with workflow
3. If not found or also corrupt:
   - Use Option 2 (regenerate)
```

**Option 4 - Fail and Request Manual Fix:**
```
1. Report exact parse error with line number
2. Suggest likely issue based on error type
3. Wait for user to fix manually
4. Do not attempt risky auto-repairs
```

**Error Report Template:**
```markdown
**Status:** ❌ FAILED
**Failed At:** Step 1 - Load Workflow Status
**Error:** YAML parse error at line 23: Invalid indentation

**Root Cause:**
The workflow-status.md file contains YAML syntax errors. This typically
occurs after manual editing. The parser failed at line 23 where a TODO
entry has incorrect indentation (4 spaces instead of 2).

**Recovery Options:**
1. Auto-repair: Fix indentation and validate (SAFE if error is obvious)
2. Regenerate: Rebuild workflow-status.md from existing story files
3. Restore: Use backup file if available
4. Manual: User fixes YAML syntax and retries workflow

**Orchestrator Action Required:**
Recommend Option 2 (regenerate from stories). If that fails, request
user to check line 23 of docs/bmm-workflow-status.md
```

---

### Error 3: Invalid State Transition

**Scenario:**
```
Workflow: story-ready
Step: Validate state transition
Error: Story is in IN PROGRESS, cannot move from TODO
```

**Root Cause:**
Workflow status and story file status are out of sync. The story was already advanced but workflow-status.md was not updated.

**Detection:**
```
Check story file status: "Ready" (in IN PROGRESS)
Check workflow-status.md TODO section: Contains this story
Mismatch detected → Invalid state
```

**Recovery Strategy:**

**Option 1 - Sync Status (RECOMMENDED):**
```
1. Determine authoritative source:
   - Story file is authoritative (has more recent timestamp)
2. Update workflow-status.md to match reality:
   - Remove story from TODO section
   - Add to IN PROGRESS section
3. Validate sync successful
4. Report sync action (not error)
5. Continue with workflow (no-op since already advanced)
```

**Option 2 - Report Conflict:**
```
1. Report state mismatch
2. Request orchestrator decision:
   - Trust story file status?
   - Trust workflow-status.md status?
3. Wait for orchestrator to resolve
4. Do not modify either file
```

**Option 3 - Rollback Story:**
```
1. If story file status is wrong (less recent):
   - Revert story Status to "Draft"
   - Proceed with story-ready workflow normally
2. Update both story and workflow-status.md
```

**Error Report Template:**
```markdown
**Status:** ⚠️ WARNING (Auto-recovered)

**Workflow:** story-ready
**Issue:** State mismatch detected

**Context:**
Story file shows Status="Ready" (already in IN PROGRESS), but
workflow-status.md shows story in TODO section. This indicates
a previous workflow execution updated the story but failed to
update workflow-status.md.

**Resolution Taken:**
Auto-sync workflow-status.md to match story file status:
- Removed story from TODO section
- Added to IN PROGRESS section
- Validated sync successful

**Files Modified:**
- docs/bmm-workflow-status.md (updated: sync state)

**Current State:**
- BACKLOG: 5 stories
- TODO: story-1.2 (advanced from BACKLOG)
- IN PROGRESS: story-1.1 (now synchronized)
- DONE: 0 stories

**Next Action:**
State now synchronized. Story already in correct state. No further
action needed for story-ready. Launch SM agent with story-context
workflow to generate context XML.
```

---

### Error 4: Story Missing Required Sections

**Scenario:**
```
Workflow: story-ready
Step: Validate story completeness
Error: Story missing sections: Acceptance Criteria, Tasks
```

**Root Cause:**
Story was manually created or edited, and required sections were not filled in.

**Detection:**
```
Read story file
Check for required sections:
- [ ] Acceptance Criteria (must have at least 1 AC)
- [ ] Tasks (must have at least 1 task)
- [ ] Dev Agent Record (can be empty but section must exist)

If any missing:
  ERROR: Incomplete story
```

**Recovery Strategy:**

**Option 1 - Fail with Specific Guidance:**
```
1. List all missing sections
2. Suggest correct-course workflow
3. Wait for story to be fixed
4. Do not attempt to auto-complete sections
```

**Option 2 - Generate Missing Sections (IF SAFE):**
```
1. If only missing Dev Agent Record section (empty template OK):
   - Add empty Dev Agent Record section
   - Proceed with workflow
2. If missing ACs or Tasks:
   - Cannot auto-generate safely
   - Use Option 1 (fail with guidance)
```

**Error Report Template:**
```markdown
**Status:** ❌ FAILED
**Failed At:** Step 2 - Validate Story Completeness
**Error:** Story missing required sections

**Context:**
The story-ready workflow validates that stories have all required sections
before advancing to IN PROGRESS. Story story-1.1-patient-registration.md
is missing critical sections.

**Missing Sections:**
- ❌ Acceptance Criteria (required: at least 1 AC)
- ❌ Tasks (required: at least 1 task)
- ✅ Dev Agent Record (present, can be empty)

**Root Cause:**
Story was either:
1. Manually created without complete template
2. Edited and sections accidentally removed
3. Generated by earlier workflow version with different template

**Recovery Options:**
1. Launch correct-course workflow to complete story sections
2. User edits story manually to add missing sections
3. Re-run create-story workflow to regenerate from scratch

**Orchestrator Action Required:**
Recommend Option 1 (correct-course workflow). If story needs major
changes, consider Option 3 (regenerate).
```

---

### Error 5: Epic File Not Found

**Scenario:**
```
Workflow: create-story
Step: Load epic context
Error: File not found: docs/epic-1.md
```

**Root Cause:**
Epic file doesn't exist or is in different location/naming format.

**Detection:**
```
Expected path: {output_folder}/epic-{epic-number}.md
Try to read file
If not found:
  Try alternative patterns:
  - epic-{epic-number}.md (no directory)
  - epics/epic-{epic-number}.md (subdirectory)
  - Epic-{epic-number}.md (capital E)

If still not found:
  ERROR: Epic file missing
```

**Recovery Strategy:**

**Option 1 - Search for Epic:**
```
1. Use Glob to search for epic files:
   - Pattern: "**/*epic*{number}*.md"
2. If found in different location:
   - Use found path
   - Note in report (inconsistent location)
   - Suggest standardizing path
3. Proceed with workflow
```

**Option 2 - Use PRD Only:**
```
1. If PRD exists and has sufficient detail:
   - Skip epic-specific context
   - Generate story from PRD only
   - Flag story with: "No epic context available"
2. Proceed with reduced context
```

**Option 3 - Fail and Request Epic:**
```
1. Report epic file not found
2. List expected locations tried
3. Request user to create epic or provide correct path
4. Do not proceed without epic context
```

**Error Report Template:**
```markdown
**Status:** ❌ FAILED
**Failed At:** Step 2 - Load Epic Context
**Error:** Epic file not found

**Context:**
The create-story workflow was attempting to generate story 1.1
(Epic 1, Story 1). It requires the Epic 1 file to extract story-level
requirements and context.

**Root Cause:**
Epic file not found at expected locations:
- ❌ docs/epic-1.md
- ❌ docs/epics/epic-1.md
- ❌ Epic-1.md

**Search Results:**
Searched entire docs/ directory for files matching "*epic*1*":
- No matches found

**Recovery Options:**
1. Create Epic 1 file:
   - Run epic planning workflow
   - Or user creates manually at docs/epic-1.md
2. Provide correct path:
   - If epic exists elsewhere, update config or provide path
3. Skip epic context:
   - Generate story from PRD only (reduced context)

**Orchestrator Action Required:**
If Epic 1 should exist, launch epic planning workflow. If epic already
exists elsewhere, provide correct path. Otherwise, consider generating
story from PRD only (Option 3).
```

---

### Error 6: No Stories in BACKLOG

**Scenario:**
```
Workflow: story-ready
Step: Advance BACKLOG story to TODO
Error: BACKLOG is empty, cannot replenish TODO
```

**Root Cause:**
All stories have been processed, or sprint planning hasn't been run to populate BACKLOG.

**Detection:**
```
After advancing TODO story to IN PROGRESS:
Check BACKLOG section in workflow-status.md
If BACKLOG is empty:
  WARNING: No stories to advance
```

**Recovery Strategy:**

**Option 1 - Complete Workflow Without Replenish:**
```
1. Story-ready workflow completed successfully
2. Note that TODO is now empty (no BACKLOG stories)
3. Report normal completion
4. Recommend: Check if epic is complete or add more stories
```

**Option 2 - Check for Epic Completion:**
```
1. Check current state:
   - BACKLOG: 0
   - TODO: 0 (after advancement)
   - IN PROGRESS: 1 (current story)
   - DONE: X stories
2. If this was the last story:
   - Report epic completion
   - Recommend retrospective workflow
3. If more stories expected:
   - Report unexpected empty BACKLOG
   - Suggest running sprint-planning again
```

**Error Report Template:**
```markdown
**Status:** ✅ SUCCESS (with warning)

**Workflow:** story-ready
**Executed:** 2025-11-04T16:00:00-03:00
**Duration:** 10s

**Actions Taken:**
- Advanced story-1.7 from TODO to IN PROGRESS
- Story Status updated: "Draft" → "Ready"
- Attempted to replenish TODO from BACKLOG
- ⚠️ BACKLOG is empty, TODO not replenished

**Files Modified:**
- docs/stories/story-1.7-final-feature.md (updated)
- docs/bmm-workflow-status.md (updated)

**Current State (after execution):**
- BACKLOG: 0 stories ⚠️
- TODO: empty ⚠️
- IN PROGRESS: story-1.7-final-feature
- DONE: 6 stories

**Next Action:**
⚠️ This appears to be the last story in Epic 1. After story-1.7
completes:
1. Launch retrospective workflow for Epic 1
2. OR: Add more stories if epic not complete

**Notes:**
BACKLOG exhausted. If epic is complete, this is expected. If more
stories should exist, run sprint-planning workflow to regenerate
BACKLOG from epic files.
```

---

## Error Severity Classification

### 🔴 CRITICAL - Must fail workflow
- Missing PRD (no workaround available)
- Corrupt workflow-status.md (cannot parse)
- Invalid state machine transition (would break BMAD)
- Required template file missing

**Action:** Stop immediately, return error report

### 🟡 WARNING - Can auto-recover or continue
- State mismatch (can sync)
- Empty BACKLOG (epic may be complete)
- Missing optional sections (can add empty)
- Alternative file location found

**Action:** Auto-fix if safe, report warning in success report

### 🟢 INFO - Expected behavior
- Story already in correct state (no-op)
- Epic complete (no more stories)
- Optional context not available (continue without)

**Action:** Complete normally, note in report

## Error Handling Decision Tree

```
                     [Error Detected]
                            |
                            ↓
                    Is it CRITICAL?
                   /               \
                YES                 NO
                 |                   |
                 ↓                   ↓
        [Stop Workflow]      Is it WARNING?
        [Return Error]       /            \
              |            YES             NO
              ↓             |              |
        [Orchestrator]      ↓              ↓
          Decision      Can auto-   [Continue]
                        recover?      [Note in
                       /        \      Success
                     YES         NO     Report]
                      |          |
                      ↓          ↓
                  [Auto-fix] [Return
                  [Continue]  Warning]
                      |          |
                      ↓          ↓
                  [Success]  [Orchestrator
                  [Report     Decision]
                   Warning]
```

## Testing Error Handling

### Test Scenario 1: Missing File
```bash
# Setup
rm docs/prd.md

# Execute
Launch SM agent with create-story workflow

# Expected
- ❌ FAILED status
- Error: "File not found: docs/prd.md"
- Recovery options listed
- Orchestrator action specified
```

### Test Scenario 2: Corrupt YAML
```bash
# Setup
echo "invalid: yaml: syntax" >> docs/bmm-workflow-status.md

# Execute
Launch SM agent with story-ready workflow

# Expected
- ❌ FAILED status
- Error with line number
- Parse error details
- Recovery options listed
```

### Test Scenario 3: State Mismatch
```bash
# Setup
# Manually edit story Status to "Ready"
# Leave workflow-status.md with story in TODO

# Execute
Launch SM agent with story-ready workflow

# Expected
- ⚠️ SUCCESS with warning
- Auto-sync performed
- Files modified listed
- Note about sync in report
```

## Best Practices for Error Handling

1. **Detect Early:** Validate inputs before executing workflow steps
2. **Be Specific:** Error messages should pinpoint exact issue
3. **Provide Context:** Explain what was being attempted when error occurred
4. **Offer Options:** Always provide 2-3 recovery strategies
5. **Guide Orchestrator:** Give specific, actionable next steps
6. **Log Details:** Include diagnostic info for debugging
7. **Fail Safe:** When in doubt, fail rather than corrupt data

---

**Comprehensive error handling enables robust, automated workflow orchestration even in unexpected scenarios.**
