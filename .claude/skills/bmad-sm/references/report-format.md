# Agent Report Format Standards

## Overview

This document defines the standardized format for agent reports that the BMAD Orchestrator expects and can parse. All reports must follow these formats exactly to ensure proper orchestrator integration.

## Why Structured Reports Matter

The orchestrator relies on structured reports to:
1. **Parse execution status** programmatically (SUCCESS/FAILED)
2. **Track file changes** for validation and rollback
3. **Monitor state transitions** (BACKLOG/TODO/IN PROGRESS/DONE)
4. **Determine next actions** automatically
5. **Handle errors** with appropriate recovery strategies

## Report Types

### 1. Success Report

Use this format when workflow execution completes successfully.

#### Template

```markdown
## Agent Report: {workflow-name}

**Status:** ✅ SUCCESS

**Workflow:** {workflow-name}
**Executed:** {ISO-8601-timestamp}
**Duration:** {execution-time}

**Actions Taken:**
- {Action 1 with specific details}
- {Action 2 with specific details}
- {Action N with specific details}

**Files Modified:**
- {absolute-file-path-1} ({action}: created/updated/deleted)
- {absolute-file-path-2} ({action}: created/updated/deleted)
- {absolute-file-path-N} ({action}: created/updated/deleted)

**Current State (after execution):**
- BACKLOG: {count} stories
- TODO: {story-id or "empty"}
- IN PROGRESS: {story-id or "empty"}
- DONE: {count} stories

**Next Action:**
{Specific recommendation for what should happen next}

**Notes:**
{Any important observations, warnings, or context}
```

#### Field Specifications

##### Status
- **Format:** `**Status:** ✅ SUCCESS`
- **Required:** YES
- **Values:** Must be exactly `✅ SUCCESS`
- **Purpose:** Orchestrator parses this to determine success/failure

##### Workflow
- **Format:** `**Workflow:** {workflow-name}`
- **Required:** YES
- **Values:** Exact workflow name (e.g., "create-story", "dev-story")
- **Purpose:** Identifies which workflow was executed

##### Executed
- **Format:** `**Executed:** {ISO-8601-timestamp}`
- **Required:** YES
- **Values:** ISO 8601 format (e.g., "2025-11-04T14:30:00-03:00")
- **Purpose:** Audit trail and timing analysis

##### Duration
- **Format:** `**Duration:** {time-value}`
- **Required:** YES
- **Values:** Format as "{X}s" for seconds or "{X}m" for minutes
- **Purpose:** Performance monitoring

##### Actions Taken
- **Format:** Bullet list with dash prefix
- **Required:** YES
- **Values:** Concrete actions (not abstract descriptions)
- **Purpose:** Audit trail of what was done
- **Example:**
  ```
  - Read PRD from docs/prd.md
  - Generated story draft with 5 acceptance criteria
  - Saved story to docs/stories/story-1.1-patient-registration.md
  - Updated workflow-status.md: moved story to TODO section
  ```

##### Files Modified
- **Format:** `- {path} ({action}: created/updated/deleted)`
- **Required:** YES (even if empty, state "None")
- **Values:**
  - Path: Absolute or relative to project root
  - Action: Exactly one of "created", "updated", "deleted"
- **Purpose:** Track changes for validation and potential rollback
- **Example:**
  ```
  - docs/stories/story-1.1-patient-registration.md (created)
  - docs/bmm-workflow-status.md (updated)
  ```

##### Current State
- **Format:** Four lines with exact labels
- **Required:** YES
- **Values:**
  - BACKLOG: Integer count
  - TODO: Story ID (e.g., "story-1.2") or literal "empty"
  - IN PROGRESS: Story ID or literal "empty"
  - DONE: Integer count
- **Purpose:** Validate state transitions, decide next workflow
- **Example:**
  ```
  - BACKLOG: 5 stories
  - TODO: story-1.2-doctor-profile
  - IN PROGRESS: empty
  - DONE: 0 stories
  ```

##### Next Action
- **Format:** Clear, actionable recommendation
- **Required:** YES
- **Values:** Specific next step for orchestrator or user
- **Purpose:** Guide workflow progression
- **Examples:**
  - "User approval required for story draft"
  - "Launch SM agent with story-ready workflow"
  - "Launch DEV agent to implement story-1.1"
  - "Epic complete, run retrospective workflow"

##### Notes
- **Format:** Free text, markdown supported
- **Required:** OPTIONAL (but recommended)
- **Values:** Context, warnings, architectural decisions
- **Purpose:** Provide human-readable context
- **Examples:**
  - "Story complexity high (8 SP), may need split"
  - "Reused existing authentication pattern from architecture"
  - "External API dependency noted in story context"

### 2. Error Report

Use this format when workflow execution fails.

#### Template

```markdown
## Agent Report: {workflow-name}

**Status:** ❌ FAILED

**Workflow:** {workflow-name}
**Failed At:** Step {step-number} - {step-title}
**Error:** {concise-error-message}

**Context:**
{What was the workflow trying to accomplish when it failed?}

**Root Cause:**
{Technical explanation of why the failure occurred}

**Recovery Options:**
1. {Option 1: Describe the fix and retry approach}
2. {Option 2: Alternative approach if Option 1 not viable}
3. {Option 3: Manual intervention or escalation}

**Diagnostic Info:**
- Workflow status file: {✅ loaded / ❌ missing / ⚠️ corrupt}
- Config file: {✅ loaded / ❌ missing}
- Required files: {list each with status emoji}

**Orchestrator Action Required:**
{Specific, actionable recommendation for orchestrator}
```

#### Field Specifications

##### Status
- **Format:** `**Status:** ❌ FAILED`
- **Required:** YES
- **Values:** Must be exactly `❌ FAILED`
- **Purpose:** Signal failure to orchestrator

##### Failed At
- **Format:** `**Failed At:** Step {number} - {step-name}`
- **Required:** YES
- **Values:** Step identifier from workflow.yaml
- **Purpose:** Pinpoint failure location for debugging
- **Example:** "Step 3 - Generate Story Draft"

##### Error
- **Format:** `**Error:** {concise-message}`
- **Required:** YES
- **Values:** Short, technical error description
- **Purpose:** Quick identification of failure type
- **Examples:**
  - "File not found: docs/prd.md"
  - "Invalid YAML syntax in workflow-status.md:45"
  - "Variable resolution failed: {output_folder}"

##### Context
- **Format:** Paragraph explaining intent
- **Required:** YES
- **Values:** What the workflow was attempting
- **Purpose:** Provide context for debugging
- **Example:**
  ```
  The create-story workflow was attempting to generate a story draft
  for Epic 1, Story 1. It successfully loaded the PRD and Epic file,
  but failed while trying to read the architecture documentation to
  populate the technical constraints section.
  ```

##### Root Cause
- **Format:** Technical explanation
- **Required:** YES
- **Values:** Why the failure occurred (not just what failed)
- **Purpose:** Enable informed recovery decision
- **Example:**
  ```
  The architecture documentation directory (docs/architecture/) exists,
  but contains no .md files. The workflow expected at least one
  architecture document to extract technical patterns from.
  ```

##### Recovery Options
- **Format:** Numbered list (1-3 options recommended)
- **Required:** YES
- **Values:** Actionable recovery strategies
- **Purpose:** Guide orchestrator or user to resolution
- **Example:**
  ```
  1. Create architecture documentation:
     - Run architecture documentation workflow
     - Retry create-story workflow after docs exist

  2. Skip architecture injection:
     - Modify workflow to allow empty architecture
     - Generate story without technical constraints
     - Add constraints manually later

  3. Use default patterns:
     - Populate story context with default tech stack
     - Flag story for architecture review before implementation
  ```

##### Diagnostic Info
- **Format:** Bullet list with status emojis
- **Required:** YES
- **Values:**
  - ✅ Success/present
  - ❌ Failure/missing
  - ⚠️ Warning/corrupt
- **Purpose:** Quick system state overview
- **Example:**
  ```
  - Workflow status file: ✅ loaded
  - Config file: ✅ loaded
  - Required files:
    - docs/prd.md: ✅ present
    - docs/epic-1.md: ✅ present
    - docs/architecture/*.md: ❌ missing (0 files found)
  ```

##### Orchestrator Action Required
- **Format:** Specific instruction
- **Required:** YES
- **Values:** Actionable recommendation
- **Purpose:** Guide orchestrator's next decision
- **Examples:**
  - "Re-run workflow after architecture docs created"
  - "Request user to create docs/architecture/backend.md"
  - "Launch architecture documentation workflow first"
  - "Manual intervention required: check file permissions"

## Workflow-Specific Report Examples

### Example 1: create-story Success Report

```markdown
## Agent Report: create-story

**Status:** ✅ SUCCESS

**Workflow:** create-story
**Executed:** 2025-11-04T14:35:22-03:00
**Duration:** 45s

**Actions Taken:**
- Read PRD from docs/prd.md (Epic 1 requirements)
- Read Epic file from docs/epic-1.md (Patient Management)
- Read architecture docs (3 files: backend.md, frontend.md, database.md)
- Generated story draft with 5 acceptance criteria
- Created 8 implementation tasks
- Generated Story Context XML placeholder reference
- Saved story to docs/stories/story-1.1-patient-registration.md
- Updated workflow-status.md: added story to TODO section

**Files Modified:**
- docs/stories/story-1.1-patient-registration.md (created)
- docs/bmm-workflow-status.md (updated)

**Current State (after execution):**
- BACKLOG: 6 stories
- TODO: story-1.1-patient-registration
- IN PROGRESS: empty
- DONE: 0 stories

**Next Action:**
User approval required for story draft. If approved, launch SM agent
with story-ready workflow to advance story to IN PROGRESS.

**Notes:**
Story complexity estimated at 5 SP based on 8 tasks and integration
with existing authentication system. Story Context XML reference added
but not yet generated - SM agent will create this when story advances
to IN PROGRESS.
```

### Example 2: story-context Success Report

```markdown
## Agent Report: story-context

**Status:** ✅ SUCCESS

**Workflow:** story-context
**Executed:** 2025-11-04T15:12:08-03:00
**Duration:** 2m 15s

**Actions Taken:**
- Read story file: docs/stories/story-1.1-patient-registration.md
- Extracted 5 acceptance criteria requiring technical context
- Searched codebase for existing authentication patterns (found 3 files)
- Read architecture docs: backend.md, frontend.md, security.md
- Identified tech stack: NestJS, Prisma, PostgreSQL, React, TypeScript
- Found existing Patient entity pattern in apps/api/src/modules/clinical/entities/
- Generated Story Context XML with:
  - Tech stack constraints
  - Existing pattern references (3 code examples)
  - Security requirements (LGPD compliance)
  - Anti-patterns (5 items to avoid)
- Saved context to docs/stories/story-context-1.1.xml
- Updated story file: added Context Reference path

**Files Modified:**
- docs/stories/story-context-1.1.xml (created)
- docs/stories/story-1.1-patient-registration.md (updated)

**Current State (after execution):**
- BACKLOG: 6 stories
- TODO: story-1.2-doctor-profile
- IN PROGRESS: story-1.1-patient-registration
- DONE: 0 stories

**Next Action:**
Launch DEV agent with dev-story workflow to implement story-1.1.
Context XML ready at docs/stories/story-context-1.1.xml.

**Notes:**
Strong existing patterns found for patient data handling. Context XML
includes references to apps/api/src/modules/clinical/entities/patient.entity.ts
as canonical example. LGPD compliance requirements explicitly noted in
security constraints section.
```

### Example 3: create-story Error Report

```markdown
## Agent Report: create-story

**Status:** ❌ FAILED

**Workflow:** create-story
**Failed At:** Step 2 - Load Architecture Context
**Error:** No architecture documentation found in docs/architecture/

**Context:**
The create-story workflow was generating a draft for Epic 1, Story 2
(Doctor Profile Management). It successfully loaded the PRD and Epic
file, extracted requirements, and was attempting to read architecture
documentation to populate technical constraints for the story.

**Root Cause:**
The workflow expects architecture documentation in docs/architecture/
to extract technical patterns, tech stack, and constraints. The directory
exists but contains no .md files. This is likely because the project
is in initial setup and architecture documentation hasn't been created yet.

**Recovery Options:**
1. Create architecture documentation first:
   - Pause story creation
   - Run architecture documentation workflow to generate:
     - docs/architecture/backend.md
     - docs/architecture/frontend.md
     - docs/architecture/database.md
   - Retry create-story workflow

2. Use minimal architecture mode:
   - Modify workflow to skip architecture injection
   - Generate story with basic tech stack (from PRD)
   - Flag story for architecture review before implementation
   - Create architecture context manually later

3. Copy from similar project:
   - If architecture docs exist elsewhere, copy to docs/architecture/
   - Update paths if needed
   - Retry workflow

**Diagnostic Info:**
- Workflow status file: ✅ loaded successfully
- Config file: ✅ loaded successfully
- Required files:
  - docs/prd.md: ✅ present (valid)
  - docs/epic-1.md: ✅ present (valid)
  - docs/architecture/: ⚠️ exists but empty (0 .md files)

**Orchestrator Action Required:**
Recommended: Launch architecture documentation workflow first, then
retry create-story. Alternative: Modify workflow to allow empty
architecture and proceed with basic tech stack only.
```

### Example 4: sprint-planning Success Report

```markdown
## Agent Report: sprint-planning

**Status:** ✅ SUCCESS

**Workflow:** sprint-planning
**Executed:** 2025-11-04T10:05:00-03:00
**Duration:** 30s

**Actions Taken:**
- Read all epic files from docs/ (found 2 epics)
- Epic 1 (Patient Management): Extracted 7 stories
- Epic 2 (Appointment System): Extracted 5 stories
- Populated sprint-status.yaml with 12 total stories
- Set all stories to status: "drafted"
- Calculated total story points: 52 SP
- Generated BACKLOG queue (all 12 stories)
- Initialized TODO and IN PROGRESS as empty
- Saved to docs/sprint-status.yaml

**Files Modified:**
- docs/sprint-status.yaml (created)

**Current State (after execution):**
- BACKLOG: 12 stories (52 SP total)
- TODO: empty (ready for first story)
- IN PROGRESS: empty
- DONE: 0 stories

**Next Action:**
Sprint planning complete. To start implementation:
1. User selects first story from BACKLOG
2. Launch SM agent with create-story workflow for selected story
3. Story will populate TODO section

**Notes:**
Sprint capacity: 52 SP across 2 epics. Recommended sprint length: 3-4 weeks
based on story complexity. Epic 1 has higher priority stories (more
critical features) recommended to complete first.
```

## Parsing Guidelines for Orchestrator

### Success Report Parsing

```python
def parse_success_report(report: str) -> dict:
    """Parse success report into structured data"""
    return {
        "status": "success",
        "workflow": extract_value(report, "**Workflow:**"),
        "timestamp": extract_value(report, "**Executed:**"),
        "duration": extract_value(report, "**Duration:**"),
        "actions": extract_bullet_list(report, "**Actions Taken:**"),
        "files_modified": parse_files_modified(report),
        "state": parse_current_state(report),
        "next_action": extract_section(report, "**Next Action:**"),
        "notes": extract_section(report, "**Notes:**") or None
    }

def parse_files_modified(report: str) -> list[dict]:
    """Extract files modified with actions"""
    section = extract_section(report, "**Files Modified:**")
    files = []
    for line in section.split("\n"):
        if line.startswith("- "):
            # Format: "- path (action)"
            match = re.match(r"- (.+) \((created|updated|deleted)\)", line)
            if match:
                files.append({
                    "path": match.group(1),
                    "action": match.group(2)
                })
    return files

def parse_current_state(report: str) -> dict:
    """Extract current state"""
    section = extract_section(report, "**Current State")
    return {
        "backlog": extract_number(section, "BACKLOG:"),
        "todo": extract_story_id(section, "TODO:"),
        "in_progress": extract_story_id(section, "IN PROGRESS:"),
        "done": extract_number(section, "DONE:")
    }
```

### Error Report Parsing

```python
def parse_error_report(report: str) -> dict:
    """Parse error report into structured data"""
    return {
        "status": "failed",
        "workflow": extract_value(report, "**Workflow:**"),
        "failed_at": extract_value(report, "**Failed At:**"),
        "error": extract_value(report, "**Error:**"),
        "context": extract_section(report, "**Context:**"),
        "root_cause": extract_section(report, "**Root Cause:**"),
        "recovery_options": parse_recovery_options(report),
        "diagnostic_info": parse_diagnostic_info(report),
        "orchestrator_action": extract_section(report, "**Orchestrator Action Required:**")
    }
```

## Report Quality Checklist

Before submitting a report, verify:

### Success Reports
- [ ] Status line present and correct (✅ SUCCESS)
- [ ] All required fields filled
- [ ] Actions list is specific (not vague)
- [ ] File paths are accurate (verified to exist)
- [ ] Current state numbers are correct
- [ ] Next action is actionable

### Error Reports
- [ ] Status line present and correct (❌ FAILED)
- [ ] Failed At step is specific
- [ ] Error message is clear
- [ ] Context explains what was attempted
- [ ] Root cause explains why it failed
- [ ] At least 2 recovery options provided
- [ ] Diagnostic info uses correct emojis
- [ ] Orchestrator action is specific

---

**Structured reports enable automated orchestration. Follow these formats exactly for reliable workflow execution.**
