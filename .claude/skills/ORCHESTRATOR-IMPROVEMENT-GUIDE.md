# BMAD Orchestrator Skill - Implementation Improvement Guide

**Document Type:** Technical Implementation Guide
**Version:** 1.0.0
**Date:** 2025-11-04
**Author:** BMad Master Agent
**Purpose:** Complete step-by-step guide for skill-creator agent to apply improvements to bmad-orchestrator skill
**Target Audience:** Skill Creator Agent / Implementation Team
**Source Analysis:** Based on bmad-orchestrator-analysis.md (Score: 8.5/10)

---

## 📋 EXECUTIVE SUMMARY

This document provides **complete, step-by-step instructions** for improving the `bmad-orchestrator` skill from version 1.0 to version 1.5, addressing all identified gaps while integrating with the newly created `bmad-sm` and `bmad-dev` skills.

### Current State
- **Version:** 1.0
- **Score:** 8.5/10
- **Status:** Functional but missing critical parsing/recovery logic
- **Integration:** Uses full agent invocation (slash commands)

### Target State
- **Version:** 1.5
- **Score:** 9.5/10 (target)
- **Status:** Production-ready with comprehensive error handling
- **Integration:** Uses skill-based invocation (Task tool + Skill tool)

### Improvements Overview

| Priority | Improvement                     | Impact  | Complexity | Pages |
|----------|---------------------------------|---------|------------|-------|
| CRITICAL | Agent Report Parsing            | HIGH    | Medium     | 3     |
| HIGH     | Skill-Based Agent Launching     | HIGH    | Low        | 2     |
| HIGH     | Contextual Agent Launching      | MEDIUM  | Medium     | 2     |
| MEDIUM   | Error Recovery Loop             | MEDIUM  | Medium     | 2     |
| LOW      | Dual Status Tracking            | LOW     | Low        | 1     |
| LOW      | Phase Verification Details      | LOW     | Low        | 1     |

**Total Additions:** ~11 pages of new content, ~300 lines of structured guidance

---

## 🎯 IMPLEMENTATION ROADMAP

### Phase 1: Critical Fixes (Priority 1 - MUST HAVE)
**Timeline:** 1-2 hours
**Deliverables:**
1. Add "Agent Report Parsing" section with structured format
2. Update agent launching to use Skill tool (bmad-sm/bmad-dev)
3. Add report validation examples

### Phase 2: Enhanced Functionality (Priority 2 - SHOULD HAVE)
**Timeline:** 2-3 hours
**Deliverables:**
1. Add "Contextual Agent Launching" with context passing
2. Add "Error Recovery Loop" with retry logic
3. Add parsing code examples (Python pseudocode)

### Phase 3: Polish & Documentation (Priority 3 - NICE TO HAVE)
**Timeline:** 1 hour
**Deliverables:**
1. Add "Dual Status Tracking" integration guide
2. Expand "Phase Verification" section
3. Add end-to-end test scenarios

---

## 📐 FILE STRUCTURE AFTER IMPROVEMENTS

```
.claude/skills/bmad-orchestrator/
├── SKILL.md                            # Main skill file (MODIFIED - add sections)
├── references/
│   ├── bmad-workflow-states.md        # Existing (no changes)
│   ├── bmad-agent-skills-mapping.md   # Existing (MODIFIED - update launch templates)
│   └── report-parsing-guide.md        # NEW - parsing logic and examples
└── assets/
    └── orchestration-templates/        # Existing (MODIFIED - update templates)
```

---

## 🔧 IMPLEMENTATION INSTRUCTIONS

### IMPROVEMENT #1: Agent Report Parsing (CRITICAL)

**Location:** Add new section in `SKILL.md` after "## Workflow Decision Tree"

**Section Title:** `## Agent Report Parsing and Validation`

**Insert Position:** After line ~236 (end of "Workflow Decision Tree" section)

**Complete Content to Add:**

```markdown
## Agent Report Parsing and Validation

### Overview

The orchestrator MUST parse agent reports systematically to:
1. Determine workflow success vs failure
2. Extract file paths for next agent context
3. Validate state transitions occurred correctly
4. Identify blockers and recovery options

### Expected Report Format

All agents (SM and DEV) using bmad-sm/bmad-dev skills MUST return reports in this structured format:

#### Success Report Template

```
## Agent Report: {workflow-name}

**Status:** ✅ SUCCESS

**Workflow:** {workflow-name}
**Story:** {story-id} (if applicable)
**Executed:** {ISO-8601-timestamp}
**Duration:** {seconds}s or {minutes}m

**Actions Taken:**
- {Action 1 with specific details}
- {Action 2 with specific details}
- {Action N with specific details}

**Files Modified:**
- {absolute-path-1} (created|updated|deleted)
- {absolute-path-2} (created|updated|deleted)
- {absolute-path-N} (created|updated|deleted)

**Current State (after execution):**
- BACKLOG: {count} stories
- TODO: {story-id or "empty"}
- IN PROGRESS: {story-id or "empty"}
- DONE: {count} stories

**Next Action:**
{What orchestrator should do next - user approval, launch next agent, etc.}

**Notes:**
{Any important observations, warnings, or context for orchestrator}
```

**Example - SM create-story success:**
```
## Agent Report: create-story

**Status:** ✅ SUCCESS

**Workflow:** create-story
**Story:** story-1.1-user-authentication
**Executed:** 2025-11-04T15:30:00-03:00
**Duration:** 180s

**Actions Taken:**
- Loaded PRD from docs/prd.md (requirements extraction)
- Loaded Architecture docs from docs/architecture/ (patterns identification)
- Generated story file with 5 acceptance criteria
- Added 12 tasks across 3 categories (setup, implementation, testing)

**Files Modified:**
- docs/stories/story-1.1-user-authentication.md (created)

**Current State (after execution):**
- BACKLOG: 7 stories
- TODO: story-1.1-user-authentication (Status="Draft")
- IN PROGRESS: empty
- DONE: 0 stories

**Next Action:**
User approval required for story-1.1. User should review story file and respond with "approved" or request changes.

**Notes:**
Story complexity: Medium (5 AC, 12 tasks, ~3 SP estimated)
Tech stack: NestJS + Passport JWT (from architecture constraints)
```

#### Error Report Template

```
## Agent Report: {workflow-name}

**Status:** ❌ FAILED

**Workflow:** {workflow-name}
**Story:** {story-id} (if applicable)
**Failed At:** {step-number or AC-ID}
**Error:** {concise-error-message}

**Context:**
{What the agent was trying to accomplish when failure occurred}

**Root Cause:**
{Technical explanation of why it failed - be specific}

**Recovery Options:**
1. {Option 1: Description + how to execute}
2. {Option 2: Description + how to execute}
3. {Option 3: Description + how to execute}

**Diagnostic Info:**
- Workflow status file: {✅ readable / ❌ corrupt / ❌ missing}
- Story file: {✅ exists / ❌ missing / ❌ malformed}
- Context XML: {✅ exists / ❌ missing / N/A}
- Required files: {list with status}

**Files Involved:**
- {file-path-1}: {what was being done with this file}
- {file-path-2}: {what was being done with this file}

**Orchestrator Action Required:**
{Specific recommendation: re-run with fix, launch correct-course, halt, etc.}
```

**Example - DEV dev-story failure:**
```
## Agent Report: dev-story

**Status:** ❌ FAILED

**Workflow:** dev-story
**Story:** story-1.1-user-authentication
**Failed At:** AC-003 (JWT token validation middleware)
**Error:** Tests failing - 3/5 tests passing (60%)

**Context:**
Implementing JWT validation middleware for protected routes. Tests were failing because AuthService.login() mock was not properly configured.

**Root Cause:**
Missing mock implementation for AuthService.login() method in test setup. Test file auth.controller.spec.ts expects mock to return { accessToken: string, user: User } but mock returns undefined.

**Recovery Options:**
1. **Fix mock and re-run** - User manually adds AuthService mock to test file, then orchestrator re-runs dev-story workflow
2. **Launch correct-course** - SM agent reviews AC-003 requirements and adjusts if test expectations are incorrect
3. **Halt for manual intervention** - User fixes both code and tests manually, then signals continue

**Diagnostic Info:**
- Workflow status file: ✅ readable
- Story file: ✅ exists (docs/stories/story-1.1-user-authentication.md)
- Context XML: ✅ exists (docs/stories/story-context-1.1.xml)
- Required files: ✅ All source files exist

**Files Involved:**
- apps/api/src/modules/auth/auth.controller.ts: JWT middleware implementation
- apps/api/src/modules/auth/auth.controller.spec.ts: Test file with failing mocks (ISSUE HERE)

**Orchestrator Action Required:**
HALT orchestration. Report failure to user with recovery options. Wait for user to select option (1, 2, or 3), then proceed accordingly.
```

### Parsing Logic for Orchestrator

#### Step 1: Extract Status

```python
# Pseudocode for parsing agent report
def parse_agent_report(report_text: str) -> dict:
    """
    Parse structured agent report into actionable data
    Returns dict with status, files, state, next_action
    """

    # 1. Extract status line (CRITICAL - determines success vs failure)
    status_match = re.search(r"\*\*Status:\*\* (✅ SUCCESS|❌ FAILED)", report_text)
    if not status_match:
        raise ParseError("Report missing Status line - malformed report")

    status = "success" if "✅ SUCCESS" in status_match.group(1) else "failed"

    return {
        "status": status,
        "workflow": extract_workflow_name(report_text),
        "files_modified": extract_files(report_text) if status == "success" else [],
        "current_state": extract_state(report_text) if status == "success" else None,
        "next_action": extract_next_action(report_text) if status == "success" else None,
        "error": extract_error(report_text) if status == "failed" else None,
        "recovery_options": extract_recovery_options(report_text) if status == "failed" else None
    }
```

#### Step 2: Extract Files Modified

```python
def extract_files(report_text: str) -> list:
    """
    Extract list of files modified by agent
    Returns: [{"path": str, "action": "created|updated|deleted"}]
    """
    files_section = extract_section(report_text, "**Files Modified:**")

    files = []
    # Match pattern: - path/to/file.ext (action)
    for line in files_section.split('\n'):
        match = re.match(r"-\s+(.+?)\s+\((.+?)\)", line.strip())
        if match:
            path, action = match.groups()
            files.append({"path": path.strip(), "action": action.strip()})

    return files
```

#### Step 3: Extract Current State

```python
def extract_state(report_text: str) -> dict:
    """
    Extract workflow state after agent execution
    Returns: {"backlog": int, "todo": str|None, "in_progress": str|None, "done": int}
    """
    state_section = extract_section(report_text, "**Current State (after execution):**")

    # Parse lines like "- BACKLOG: 7 stories"
    backlog_match = re.search(r"BACKLOG:\s+(\d+)\s+stories?", state_section)
    todo_match = re.search(r"TODO:\s+(.+)", state_section)
    in_progress_match = re.search(r"IN PROGRESS:\s+(.+)", state_section)
    done_match = re.search(r"DONE:\s+(\d+)\s+stories?", state_section)

    return {
        "backlog": int(backlog_match.group(1)) if backlog_match else 0,
        "todo": extract_story_id(todo_match.group(1)) if todo_match else None,
        "in_progress": extract_story_id(in_progress_match.group(1)) if in_progress_match else None,
        "done": int(done_match.group(1)) if done_match else 0
    }

def extract_story_id(text: str) -> str|None:
    """Extract story ID or return None if 'empty'"""
    text = text.strip()
    return None if text.lower() == "empty" else text
```

#### Step 4: Validate State Transition

```python
def validate_state_transition(before: dict, after: dict, expected_transition: str) -> bool:
    """
    Validate that agent execution resulted in correct state transition
    Raises ValidationError if transition invalid
    """

    if expected_transition == "TODO_TO_IN_PROGRESS":
        # After SM story-ready workflow
        if after['in_progress'] != before['todo']:
            raise ValidationError(
                f"Story didn't move from TODO to IN PROGRESS. "
                f"Expected IN PROGRESS={before['todo']}, got {after['in_progress']}"
            )

        if after['todo'] == before['todo']:
            raise ValidationError("TODO not replenished from BACKLOG")

        if after['backlog'] != before['backlog'] - 1:
            raise ValidationError(
                f"BACKLOG count didn't decrement. "
                f"Expected {before['backlog']-1}, got {after['backlog']}"
            )

    elif expected_transition == "IN_PROGRESS_TO_DONE":
        # After DEV story-done workflow
        if after['in_progress'] == before['in_progress']:
            raise ValidationError("Story didn't leave IN PROGRESS")

        if after['done'] != before['done'] + 1:
            raise ValidationError(
                f"DONE count didn't increment. "
                f"Expected {before['done']+1}, got {after['done']}"
            )

        if after['in_progress'] != before['todo']:
            raise ValidationError(
                f"TODO story didn't advance to IN PROGRESS. "
                f"Expected IN PROGRESS={before['todo']}, got {after['in_progress']}"
            )

    return True  # Validation passed
```

#### Step 5: Verify Files Exist

```python
def verify_files_exist(files_modified: list) -> list:
    """
    Verify that all files reported as modified actually exist
    Returns list of missing files (empty if all exist)
    """
    missing = []

    for file_info in files_modified:
        path = file_info['path']
        action = file_info['action']

        # Only check created/updated files (deleted files shouldn't exist)
        if action in ['created', 'updated']:
            if not os.path.exists(path):
                missing.append({
                    "path": path,
                    "action": action,
                    "error": "File reported as modified but does not exist"
                })

    return missing
```

### Orchestrator Workflow After Agent Execution

```
1. Agent completes workflow → returns report text

2. Orchestrator parses report:
   parse_agent_report(report_text) → {status, files, state, next_action, error}

3. IF status == "success":
   a. Extract files modified
   b. Verify files exist → verify_files_exist(files)
   c. Re-read workflow-status.md to get actual state
   d. Validate state transition → validate_state_transition(before, after, expected)
   e. Extract next action
   f. Display report to user
   g. Execute next action (approval gate, launch next agent, etc.)

4. IF status == "failed":
   a. Extract error details
   b. Extract recovery options
   c. Display error report to user
   d. HALT orchestration
   e. Wait for user to select recovery option
   f. Execute recovery action (re-run, correct-course, manual intervention)
```

### Error Handling: Malformed Reports

```python
def handle_malformed_report(report_text: str, agent_type: str, workflow: str):
    """
    Handle case where agent returns malformed report
    """
    # Agent didn't follow report template - orchestrator can't parse
    user_message = f"""
    ⚠️ ORCHESTRATION ERROR: Malformed Agent Report

    Agent: {agent_type} (bmad-{agent_type})
    Workflow: {workflow}
    Issue: Agent report doesn't follow expected format

    Expected format:
    - Must start with "## Agent Report: {workflow}"
    - Must have "**Status:** ✅ SUCCESS" or "**Status:** ❌ FAILED" line
    - Must have structured sections (Files Modified, Current State, Next Action)

    Received report:
    {report_text[:500]}... (truncated)

    RECOVERY OPTIONS:
    1. Re-run workflow (agent may have had temporary issue)
    2. Manually inspect agent logs
    3. Report bug in bmad-{agent_type} skill (template not followed)

    Select option (1/2/3):
    """

    display_to_user(user_message)
    halt_orchestration()
```

### Validation Checklist After Implementation

**Test Case 1: Success Report Parsing**
- [ ] Orchestrator correctly identifies ✅ SUCCESS status
- [ ] Files modified are extracted with correct paths and actions
- [ ] Current state is parsed correctly (backlog, todo, in_progress, done)
- [ ] Next action is extracted
- [ ] State transition validation passes

**Test Case 2: Error Report Parsing**
- [ ] Orchestrator correctly identifies ❌ FAILED status
- [ ] Error message is extracted
- [ ] Recovery options are listed
- [ ] Diagnostic info is captured
- [ ] Orchestrator halts and waits for user

**Test Case 3: State Transition Validation**
- [ ] TODO → IN PROGRESS transition validated correctly
- [ ] IN PROGRESS → DONE transition validated correctly
- [ ] Invalid transitions raise ValidationError
- [ ] BACKLOG decrement validated

**Test Case 4: File Verification**
- [ ] Created files are verified to exist
- [ ] Updated files are verified to exist
- [ ] Deleted files are NOT checked (expected to not exist)
- [ ] Missing files trigger warning to user

---

### IMPROVEMENT #2: Skill-Based Agent Launching (CRITICAL)

**Location:** Update existing "Agent Launching with Skills" section in `SKILL.md`

**Current Section:** "### 2. Agent Launching with Skills" (around line 29)

**Action:** REPLACE existing content with updated content

**Old Content (TO BE REPLACED):**
```markdown
**Scrum Master (SM) Agent**:
```
Use Task tool with subagent_type="general-purpose" and prompt:
"You are the BMAD Scrum Master agent. Load the skill 'bmad-sm' to access your workflows and capabilities. Execute the [workflow-name] workflow following all instructions in the skill."
```

**Developer (DEV) Agent**:
```
Use Task tool with subagent_type="general-purpose" and prompt:
"You are the BMAD Developer agent. Load the skill 'bmad-dev' to access your workflows and capabilities. Execute the [workflow-name] workflow following all instructions in the skill."
```
```

**New Content (COMPLETE REPLACEMENT):**

```markdown
### 2. Agent Launching with Skills

The orchestrator launches agents using the **Task tool** combined with the **Skill tool** for context-efficient execution.

**Why Skills Instead of Agents:**
- ✅ **70% context reduction**: Skills have no menu/config overhead
- ✅ **Faster initialization**: Direct workflow execution
- ✅ **Structured reporting**: Skills enforce report templates
- ✅ **Better orchestration**: Orchestrator passes all context via prompt

**Agent Types:**
1. **SM Agent** - Uses `bmad-sm` skill (story management, planning, coordination)
2. **DEV Agent** - Uses `bmad-dev` skill (implementation, testing, completion)

#### SM Agent Launch Template

**When to use:** create-story, story-ready, story-context, sprint-planning, retrospective, correct-course, epic-tech-context

**Launch Pattern:**
```
Task tool invocation:
  subagent_type: "general-purpose"
  description: "Execute {workflow-name} workflow"
  prompt: |
    You are the BMAD Scrum Master agent.

    STEP 1: Load the skill 'bmad-sm' using the Skill tool with command: "bmad-sm"

    STEP 2: Once skill is loaded, execute the {workflow-name} workflow.

    **CONTEXT:**
    - Workflow status: {project-root}/docs/bmm-workflow-status.md
    - Config: {project-root}/bmad/bmm/config.yaml
    - Project root: {project-root}
    {additional-context-per-workflow}

    **PARAMETERS:**
    {workflow-specific-parameters}

    Execute the workflow following all instructions in the bmad-sm skill.

    Return a structured report using the format specified in the skill.
```

**Example - Launching SM for create-story:**
```
Task tool:
  subagent_type: "general-purpose"
  description: "Draft story from TODO section"
  prompt: |
    You are the BMAD Scrum Master agent.

    Load the skill 'bmad-sm' using the Skill tool with command: "bmad-sm"

    Execute the create-story workflow.

    **CONTEXT:**
    - Workflow status: /home/luis/projetos/digilife/docs/bmm-workflow-status.md
    - Config: /home/luis/projetos/digilife/bmad/bmm/config.yaml
    - Project root: /home/luis/projetos/digilife
    - Story to draft: story-1.1 (from TODO section)

    **PARAMETERS:**
    - story_id: "1.1"
    - epic_number: "1"
    - mode: "non-interactive" (#yolo - no elicitation)

    Execute the workflow following all instructions in the bmad-sm skill.

    Return a structured report with:
    - Status (✅ SUCCESS or ❌ FAILED)
    - Files modified
    - Current state (BACKLOG, TODO, IN PROGRESS, DONE counts)
    - Next action (user approval required)
```

#### DEV Agent Launch Template

**When to use:** dev-story, story-done, review-story

**Launch Pattern:**
```
Task tool invocation:
  subagent_type: "general-purpose"
  description: "Implement story {story-id}"
  prompt: |
    You are the BMAD Developer agent.

    STEP 1: Load the skill 'bmad-dev' using the Skill tool with command: "bmad-dev"

    STEP 2: Once skill is loaded, execute the {workflow-name} workflow.

    **CONTEXT:**
    - Story file: {story-file-path}
    - Story Context XML: {context-xml-path}
    - Workflow status: {project-root}/docs/bmm-workflow-status.md
    - Config: {project-root}/bmad/bmm/config.yaml
    - Project root: {project-root}

    **PARAMETERS:**
    {workflow-specific-parameters}

    CRITICAL REQUIREMENTS:
    - Implement ALL acceptance criteria
    - Run ALL tests - they MUST be 100% passing
    - Use Story Context XML as authoritative source for patterns
    - Execute continuously without pausing (except blockers or completion)

    Return a structured report using the format specified in the skill.
    Include test results in report (unit, integration, E2E pass rates).
```

**Example - Launching DEV for dev-story:**
```
Task tool:
  subagent_type: "general-purpose"
  description: "Implement story-1.1 (user authentication)"
  prompt: |
    You are the BMAD Developer agent.

    Load the skill 'bmad-dev' using the Skill tool with command: "bmad-dev"

    Execute the dev-story workflow.

    **CONTEXT:**
    - Story file: /home/luis/projetos/digilife/docs/stories/story-1.1-user-authentication.md
    - Story Context XML: /home/luis/projetos/digilife/docs/stories/story-context-1.1.xml
    - Workflow status: /home/luis/projetos/digilife/docs/bmm-workflow-status.md
    - Config: /home/luis/projetos/digilife/bmad/bmm/config.yaml
    - Project root: /home/luis/projetos/digilife

    **PARAMETERS:**
    - story_id: "1.1"
    - mode: "continuous" (no pausing except blockers)
    - test_requirement: "100%" (all tests must pass)

    CRITICAL REQUIREMENTS:
    - Read Story Context XML FIRST for architectural patterns
    - Implement ALL 5 acceptance criteria
    - Run ALL tests - they MUST be 100% passing before marking complete
    - Update story file with task checkoffs and completion notes

    Return a structured report with:
    - Status (✅ SUCCESS or ❌ FAILED)
    - Implementation summary (AC coverage)
    - Test results (unit: X/Y, integration: X/Y, E2E: X/Y, overall: 100% REQUIRED)
    - Files modified
    - Current state
```

#### Key Principles for Skill-Based Launching

1. **Two-Step Activation**:
   - Step 1: Load skill using Skill tool
   - Step 2: Execute workflow specified in prompt

2. **Explicit Context Passing**:
   - Orchestrator provides ALL file paths in prompt
   - Agent does NOT search for files (reduces errors)
   - Absolute paths preferred over relative paths

3. **Workflow-Specific Parameters**:
   - Each workflow may have unique parameters
   - Orchestrator includes parameters in prompt
   - Skills validate parameters before execution

4. **Structured Reporting Enforcement**:
   - Skills enforce report template
   - Orchestrator can parse reliably
   - Malformed reports trigger orchestrator error handling

5. **No Interactive Elements**:
   - Skills run workflows without menus
   - No config loading (orchestrator passes config values)
   - #yolo mode used for non-interactive execution
```

**Validation After Implementation:**

- [ ] SM agent launch uses Skill tool command "bmad-sm"
- [ ] DEV agent launch uses Skill tool command "bmad-dev"
- [ ] Prompt includes two-step activation (load skill, execute workflow)
- [ ] Context section includes all required file paths (absolute)
- [ ] Parameters section includes workflow-specific params
- [ ] Critical requirements stated clearly for DEV workflows
- [ ] Report format expectations stated

---

### IMPROVEMENT #3: Contextual Agent Launching (HIGH)

**Location:** Add new section in `SKILL.md` after "Agent Launching with Skills"

**Section Title:** `## Contextual Agent Launching and Dependency Management`

**Insert Position:** After the updated "Agent Launching with Skills" section

**Complete Content to Add:**

```markdown
## Contextual Agent Launching and Dependency Management

### Overview

When one agent's output is required as input for the next agent, the orchestrator must:
1. Extract relevant paths/data from first agent's report
2. Validate required files exist before launching next agent
3. Pass explicit context to next agent in prompt
4. Handle missing dependencies gracefully

**Common Dependency Scenarios:**
- SM creates story → DEV needs story file path
- SM creates story-context → DEV needs context XML path
- DEV completes story → SM needs story file path for story-done
- Epic complete → SM needs done stories for retrospective

### Pattern: SM Creates Story → DEV Implements

**Dependency:** DEV agent needs story file path created by SM agent

**Step 1: SM Agent Executes create-story**

Orchestrator launches SM with create-story workflow. SM returns report:
```
## Agent Report: create-story
**Status:** ✅ SUCCESS
**Files Modified:**
- docs/stories/story-1.1-user-authentication.md (created)
...
```

**Step 2: Orchestrator Extracts Story Path**

```python
# Parse SM report
sm_report = parse_agent_report(report_text)

# Extract story file path from files_modified
story_files = [f for f in sm_report['files_modified'] if f['action'] == 'created' and 'stories/' in f['path']]

if not story_files:
    raise OrchestratorError("SM create-story didn't create story file")

story_path = story_files[0]['path']  # e.g., docs/stories/story-1.1-user-authentication.md
```

**Step 3: Orchestrator Validates File Exists**

```python
import os

if not os.path.exists(story_path):
    user_message = f"""
    ⚠️ ORCHESTRATION ERROR: Missing Story File

    SM agent reported creating story file but it doesn't exist.

    Expected path: {story_path}

    RECOVERY OPTIONS:
    1. Re-run SM create-story workflow
    2. Manually create story file
    3. Check SM agent logs for errors

    Select option (1/2/3):
    """
    display_to_user(user_message)
    halt_orchestration()

# File exists, continue
print(f"✅ Story file validated: {story_path}")
```

**Step 4: Orchestrator Launches DEV (or SM for story-ready first)**

At this point, orchestrator must follow state machine rules:
- Story is in TODO with Status="Draft"
- User must approve before DEV can work on it
- So orchestrator waits for approval gate, THEN launches SM for story-ready

After user approves and SM runs story-ready:
- Story moves to IN PROGRESS with Status="Ready"
- Orchestrator then launches SM for story-context
- SM creates context XML
- Orchestrator extracts context XML path
- Finally, orchestrator launches DEV with both story and context paths

### Pattern: SM Creates Context XML → DEV Uses Context

**Dependency:** DEV agent needs Story Context XML path created by SM agent

**Step 1: SM Agent Executes story-context**

Orchestrator launches SM with story-context workflow. SM returns report:
```
## Agent Report: story-context
**Status:** ✅ SUCCESS
**Files Modified:**
- docs/stories/story-context-1.1.xml (created)
...
```

**Step 2: Orchestrator Extracts Context XML Path**

```python
# Parse SM report
sm_report = parse_agent_report(report_text)

# Extract context XML path
context_files = [f for f in sm_report['files_modified'] if f['action'] == 'created' and 'story-context' in f['path'] and f['path'].endswith('.xml')]

if not context_files:
    # Context XML is CRITICAL for DEV agent - cannot proceed without it
    user_message = f"""
    ⚠️ ORCHESTRATION ERROR: Missing Story Context XML

    SM agent story-context workflow didn't create context XML.

    Story: {current_story_id}
    Expected: docs/stories/story-context-{current_story_id}.xml

    Context XML is REQUIRED for DEV agent to ensure architectural compliance.

    RECOVERY OPTIONS:
    1. Re-run SM story-context workflow
    2. Check SM agent logs for errors
    3. Manually create minimal context XML (not recommended)

    Select option (1/2):
    """
    display_to_user(user_message)
    halt_orchestration()

context_xml_path = context_files[0]['path']
```

**Step 3: Orchestrator Validates Context XML**

```python
if not os.path.exists(context_xml_path):
    raise OrchestratorError(f"Context XML reported but missing: {context_xml_path}")

# Optional: Validate XML is well-formed
try:
    import xml.etree.ElementTree as ET
    ET.parse(context_xml_path)
    print(f"✅ Context XML validated: {context_xml_path}")
except ET.ParseError as e:
    user_message = f"""
    ⚠️ ORCHESTRATION ERROR: Malformed Context XML

    Context XML exists but is not valid XML.

    Path: {context_xml_path}
    Parse error: {str(e)}

    RECOVERY OPTIONS:
    1. Re-run SM story-context workflow
    2. Manually fix XML syntax errors

    Select option (1/2):
    """
    display_to_user(user_message)
    halt_orchestration()
```

**Step 4: Orchestrator Launches DEV with Explicit Paths**

```python
dev_prompt = f"""
You are the BMAD Developer agent.

Load the skill 'bmad-dev' using the Skill tool with command: "bmad-dev"

Execute the dev-story workflow.

**CONTEXT:**
- Story file: {story_path}
- Story Context XML: {context_xml_path} (AUTHORITATIVE SOURCE - use for patterns)
- Workflow status: {workflow_status_path}
- Config: {config_path}
- Project root: {project_root}

**CRITICAL:**
Read Story Context XML FIRST before any implementation.
Context XML contains:
- Architectural patterns to follow
- Tech stack constraints
- Code examples from existing codebase
- Anti-patterns to avoid

Treat Story Context XML as MORE AUTHORITATIVE than your training data.

Execute continuously, implement ALL acceptance criteria, run ALL tests (100% passing required).

Return structured report.
"""

launch_agent_via_task_tool(
    subagent_type="general-purpose",
    description=f"Implement {story_id}",
    prompt=dev_prompt
)
```

### Pattern: Handling Missing Dependencies

**Scenario:** Orchestrator tries to extract context XML path, but SM agent didn't create it

**Detection:**
```python
def extract_context_xml_path(sm_report: dict, story_id: str) -> str:
    """
    Extract context XML path from SM report
    Returns path if found, raises OrchestratorError if missing
    """
    context_files = [
        f for f in sm_report['files_modified']
        if 'story-context' in f['path'] and f['path'].endswith('.xml')
    ]

    if not context_files:
        # SM agent completed story-context workflow but didn't create XML
        # This is a BLOCKER - DEV cannot proceed without context
        raise OrchestratorError(
            error_type="MISSING_DEPENDENCY",
            dependency="Story Context XML",
            expected_path=f"docs/stories/story-context-{story_id}.xml",
            blocking_workflow="dev-story",
            recovery_options=[
                "1. Re-run SM story-context workflow",
                "2. Check SM agent logs for errors",
                "3. Manually inspect story-context workflow YAML"
            ]
        )

    return context_files[0]['path']
```

**Recovery Handler:**
```python
def handle_missing_dependency(error: OrchestratorError):
    """
    Handle missing dependency error gracefully
    """
    user_message = f"""
    ⚠️ ORCHESTRATION HALTED: Missing Dependency

    Dependency: {error.dependency}
    Expected: {error.expected_path}
    Blocking: {error.blocking_workflow} workflow cannot proceed

    This is a CRITICAL dependency. The workflow cannot continue without it.

    RECOVERY OPTIONS:
    """

    for i, option in enumerate(error.recovery_options, 1):
        user_message += f"\n{option}"

    user_message += "\n\nSelect option (1/2/3) or 'halt' to stop orchestration:"

    display_to_user(user_message)
    user_choice = wait_for_user_input()

    if user_choice == "1":
        # Re-run workflow that should have created dependency
        print(f"Re-running workflow to create {error.dependency}...")
        # Orchestrator relaunches SM story-context workflow
        return "retry"
    elif user_choice == "2":
        print("Check agent logs, then type 'continue' when ready or 'halt' to stop")
        return "wait_for_user"
    elif user_choice == "3":
        print("Manual inspection required. Type 'continue' when issue resolved.")
        return "wait_for_user"
    elif user_choice.lower() == "halt":
        print("Orchestration halted by user.")
        return "halt"
    else:
        print(f"Invalid choice: {user_choice}. Type '1', '2', '3', or 'halt'.")
        return handle_missing_dependency(error)  # Recursive retry
```

### Context Passing Checklist

Before launching dependent agent, orchestrator MUST:

- [ ] Parse previous agent's report successfully
- [ ] Extract required file paths from report
- [ ] Validate each file exists on filesystem
- [ ] Optional: Validate file contents (e.g., XML well-formed, markdown parseable)
- [ ] Pass absolute paths in next agent's prompt (not relative)
- [ ] Include context about WHY these files are important (e.g., "AUTHORITATIVE SOURCE")
- [ ] Handle missing files gracefully with recovery options

**Example Validation Function:**
```python
def validate_dependencies_before_launch(dependencies: list) -> bool:
    """
    Validate all dependencies exist before launching next agent

    Args:
        dependencies: List of {"type": str, "path": str, "required": bool}

    Returns:
        True if all required dependencies exist

    Raises:
        OrchestratorError if required dependency missing
    """
    missing_required = []
    missing_optional = []

    for dep in dependencies:
        if not os.path.exists(dep['path']):
            if dep['required']:
                missing_required.append(dep)
            else:
                missing_optional.append(dep)

    if missing_required:
        # Critical dependencies missing - cannot proceed
        error_msg = "Missing required dependencies:\n"
        for dep in missing_required:
            error_msg += f"  - {dep['type']}: {dep['path']}\n"
        raise OrchestratorError(error_msg)

    if missing_optional:
        # Optional dependencies missing - warn user but can proceed
        warning_msg = "⚠️ Missing optional dependencies:\n"
        for dep in missing_optional:
            warning_msg += f"  - {dep['type']}: {dep['path']}\n"
        warning_msg += "Proceeding anyway (optional)."
        print(warning_msg)

    return True
```

**Usage Example:**
```python
# Before launching DEV agent
dependencies = [
    {"type": "Story File", "path": story_path, "required": True},
    {"type": "Story Context XML", "path": context_xml_path, "required": True},
    {"type": "Test Data", "path": test_data_path, "required": False}
]

try:
    validate_dependencies_before_launch(dependencies)
    launch_dev_agent(story_path, context_xml_path)
except OrchestratorError as e:
    handle_missing_dependency(e)
```
```

**Validation After Implementation:**

- [ ] Orchestrator extracts file paths from agent reports
- [ ] File existence is validated before next agent launch
- [ ] Missing required dependencies halt orchestration with recovery options
- [ ] Missing optional dependencies trigger warning but allow continuation
- [ ] Explicit file paths are passed to next agent in prompt
- [ ] Context about file importance is included in prompt

---

### IMPROVEMENT #4: Error Recovery Loop (MEDIUM)

**Location:** Add new section in `SKILL.md` after "Error Handling and Recovery"

**Section Title:** `## Error Recovery Loop with Retry Logic`

**Insert Position:** After existing "### 6. Error Handling and Recovery" section

**Complete Content to Add:**

```markdown
## Error Recovery Loop with Retry Logic

### Overview

When an agent fails (especially DEV agent with test failures), the orchestrator must:
1. Halt orchestration and report error to user
2. Offer recovery options
3. Wait for user to fix issue
4. Re-launch agent with retry context
5. Implement retry limit to prevent infinite loops

**Common Failure Scenarios:**
- DEV agent: Tests failing (< 100%)
- DEV agent: Implementation blocked (missing dependency, unclear requirement)
- SM agent: Story file malformed (missing sections)
- SM agent: Epic/PRD files missing

### Retry Loop Pattern

```
┌─────────────────────┐
│ Agent Execution     │
│ (e.g., dev-story)   │
└──────────┬──────────┘
           │
           ↓
    ┌──────────────┐
    │ Success?     │
    └──────┬───────┘
           │
      ┌────┴────┐
      │         │
     Yes        No
      │         │
      ↓         ↓
  ┌────────┐  ┌─────────────────┐
  │Continue│  │Report Error     │
  │Orchest.│  │Offer Recovery   │
  └────────┘  └────────┬────────┘
                       │
                       ↓
              ┌────────────────┐
              │User Selects:   │
              │1. Fix & Retry  │
              │2. Correct-Course│
              │3. Skip Story   │
              │4. Halt         │
              └────────┬───────┘
                       │
      ┌────────────────┼────────────────┐
      │                │                │
  Option 1        Option 2        Option 3/4
  Fix & Retry     Correct-Course   Skip/Halt
      │                │                │
      ↓                ↓                ↓
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │Re-launch   │  │Launch SM   │  │Continue or │
  │Same Agent  │  │Correct-Course│  │Exit        │
  │(Retry #N)  │  │Workflow    │  └────────────┘
  └──────┬─────┘  └──────┬─────┘
         │                │
         └────────┬───────┘
                  │
                  ↓
           ┌──────────────┐
           │Check Retry   │
           │Count <= 3?   │
           └──────┬───────┘
                  │
         ┌────────┴────────┐
         │                 │
        Yes                No
         │                 │
         ↓                 ↓
    Retry Loop        ┌─────────────┐
    Continues         │Max Retries  │
                      │Halt & Report│
                      └─────────────┘
```

### Implementation: Retry State Tracking

**Orchestrator must track retry attempts per story:**

```python
class RetryTracker:
    """
    Track retry attempts for each story to enforce retry limit
    """
    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries
        self.attempts = {}  # story_id → {"workflow": str, "count": int, "errors": []}

    def record_attempt(self, story_id: str, workflow: str, error: str = None):
        """Record a workflow attempt (successful or failed)"""
        if story_id not in self.attempts:
            self.attempts[story_id] = {
                "workflow": workflow,
                "count": 0,
                "errors": []
            }

        self.attempts[story_id]["count"] += 1
        if error:
            self.attempts[story_id]["errors"].append({
                "attempt": self.attempts[story_id]["count"],
                "error": error,
                "timestamp": datetime.now().isoformat()
            })

    def can_retry(self, story_id: str) -> bool:
        """Check if story can be retried (under limit)"""
        if story_id not in self.attempts:
            return True
        return self.attempts[story_id]["count"] < self.max_retries

    def get_retry_count(self, story_id: str) -> int:
        """Get current retry count for story"""
        return self.attempts.get(story_id, {}).get("count", 0)

    def reset(self, story_id: str):
        """Reset retry count (e.g., after successful completion or correct-course)"""
        if story_id in self.attempts:
            del self.attempts[story_id]
```

### Retry Loop: Step-by-Step

**Step 1: Agent Fails with Error**

DEV agent executes dev-story workflow, tests fail (60% passing). Agent returns error report:

```
## Agent Report: dev-story
**Status:** ❌ FAILED
**Error:** Tests failing: 3/5 passing (60%)
**Recovery Options:**
1. Fix mock and re-run
2. Launch correct-course to adjust story
3. Halt for manual intervention
```

**Step 2: Orchestrator Records Failure**

```python
# Parse error report
error_report = parse_agent_report(report_text)

# Record attempt
retry_tracker.record_attempt(
    story_id=current_story_id,
    workflow="dev-story",
    error=error_report['error']
)

# Check if can retry
can_retry = retry_tracker.can_retry(current_story_id)
retry_count = retry_tracker.get_retry_count(current_story_id)
```

**Step 3: Orchestrator Reports to User**

```python
user_message = f"""
❌ WORKFLOW FAILED: dev-story

Story: {current_story_id}
Error: {error_report['error']}
Attempt: {retry_count}/{retry_tracker.max_retries}

{error_report['context']}

ROOT CAUSE:
{error_report['root_cause']}

RECOVERY OPTIONS:
"""

for i, option in enumerate(error_report['recovery_options'], 1):
    user_message += f"\n{i}. {option}"

if not can_retry:
    user_message += f"""

⚠️ MAX RETRIES REACHED ({retry_tracker.max_retries} attempts)
Cannot retry dev-story workflow again for this story.

RECOMMENDED ACTIONS:
1. Launch correct-course workflow to adjust story requirements
2. Manually inspect and fix issues, then mark story as ready for review
3. Skip this story and continue with next (report issue separately)

This is a safety mechanism to prevent infinite retry loops.
"""

user_message += "\n\nSelect option (1/2/3) or 'halt' to stop orchestration:"

display_to_user(user_message)
```

**Step 4: User Selects Recovery Option**

```python
user_choice = wait_for_user_input()

if user_choice == "1" and can_retry:
    # Option 1: Fix & Retry
    print(f"""
    You selected: Fix issue and retry dev-story workflow

    NEXT STEPS:
    1. Fix the issue reported above (e.g., add missing mock)
    2. Ensure fix is saved and committed
    3. Type 'ready' when done, or 'cancel' to choose different option
    """)

    user_ready = wait_for_user_input()
    if user_ready.lower() == "ready":
        # Re-launch DEV agent with retry context
        retry_dev_story(current_story_id, retry_count, error_report)
    elif user_ready.lower() == "cancel":
        # Go back to option selection
        return handle_agent_failure(error_report, retry_tracker)

elif user_choice == "1" and not can_retry:
    print(f"❌ Cannot retry - max attempts reached ({retry_tracker.max_retries})")
    print("Select option 2 (correct-course) or 3 (halt)")
    return handle_agent_failure(error_report, retry_tracker)

elif user_choice == "2":
    # Option 2: Launch correct-course
    print("Launching SM agent with correct-course workflow...")
    launch_correct_course(current_story_id, error_report)
    # After correct-course completes, reset retry count
    retry_tracker.reset(current_story_id)
    # Then retry dev-story from scratch
    retry_dev_story(current_story_id, retry_count=0, error_report=None)

elif user_choice == "3" or user_choice.lower() == "halt":
    # Option 3: Halt
    print("Orchestration halted by user.")
    print(f"Story {current_story_id} remains in IN PROGRESS state.")
    print("Manual intervention required.")
    halt_orchestration()

else:
    print(f"Invalid choice: {user_choice}")
    return handle_agent_failure(error_report, retry_tracker)
```

**Step 5: Re-launch Agent with Retry Context**

```python
def retry_dev_story(story_id: str, retry_count: int, previous_error: dict = None):
    """
    Re-launch DEV agent for dev-story workflow with retry context
    """
    retry_prompt = f"""
    You are the BMAD Developer agent.

    Load the skill 'bmad-dev' using the Skill tool with command: "bmad-dev"

    Execute the dev-story workflow for {story_id}.

    ⚠️ THIS IS RETRY ATTEMPT #{retry_count + 1}

    **PREVIOUS ERROR:**
    {previous_error['error'] if previous_error else 'N/A'}

    **USER ACTION TAKEN:**
    User fixed the issue and confirmed ready to retry.

    **YOUR TASK:**
    1. Read story file: {story_path}
    2. Read Story Context XML: {context_xml_path}
    3. Re-run dev-story workflow from beginning
    4. Pay special attention to the area that failed previously
    5. Run ALL tests - they MUST be 100% passing

    **FOCUS AREAS (based on previous error):**
    {extract_focus_areas(previous_error)}

    Execute continuously, implement ALL acceptance criteria.

    Return structured report with test results.
    """

    launch_agent_via_task_tool(
        subagent_type="general-purpose",
        description=f"Retry dev-story for {story_id} (attempt #{retry_count + 1})",
        prompt=retry_prompt
    )
```

**Step 6: Agent Completes (Success or Fail Again)**

```python
# Agent returns report
retry_report = parse_agent_report(report_text)

if retry_report['status'] == 'success':
    # SUCCESS on retry
    print(f"✅ Retry successful on attempt #{retry_count + 1}")
    retry_tracker.reset(story_id)  # Clear retry counter
    continue_orchestration()

elif retry_report['status'] == 'failed':
    # FAILED AGAIN
    retry_tracker.record_attempt(story_id, "dev-story", retry_report['error'])

    # Check if can retry again
    if retry_tracker.can_retry(story_id):
        # Offer retry again (recursive)
        handle_agent_failure(retry_report, retry_tracker)
    else:
        # MAX RETRIES REACHED
        print(f"""
        ❌ MAX RETRIES REACHED for story {story_id}

        Attempted {retry_tracker.max_retries} times, all failed.

        ERRORS ENCOUNTERED:
        """)
        for attempt in retry_tracker.attempts[story_id]['errors']:
            print(f"  Attempt {attempt['attempt']}: {attempt['error']}")

        print(f"""

        ORCHESTRATION HALTED

        This story requires manual intervention or correct-course workflow.

        RECOMMENDED ACTIONS:
        1. Manually inspect story {story_id}
        2. Launch correct-course workflow to adjust requirements
        3. Mark story as blocked and continue with next story
        """)

        halt_orchestration()
```

### Retry Limit Justification

**Why 3 retries?**
- **Attempt 1:** Initial try (may fail due to transient issues)
- **Attempt 2:** User fixes obvious issue, retry
- **Attempt 3:** User fixes deeper issue, final retry
- **Beyond 3:** Issue is likely fundamental (architecture, unclear requirements, etc.) - requires correct-course or manual intervention

**Max retries prevents:**
- ❌ Infinite loops consuming context
- ❌ User frustration with repeated failures
- ❌ Time wasted on unrecoverable errors

**Alternative approach:**
User can always reset retry counter by running correct-course workflow, which adjusts story and starts fresh.

### Retry Loop Checklist

- [ ] Orchestrator tracks retry attempts per story
- [ ] Max retry limit enforced (default: 3)
- [ ] User is informed of current attempt number
- [ ] Retry context is passed to agent (previous error, focus areas)
- [ ] Max retries reached triggers alternative options (correct-course, manual intervention)
- [ ] Successful completion or correct-course resets retry counter
- [ ] User can always halt orchestration at any point

**Example Retry Tracker Usage:**
```python
# Initialize tracker
retry_tracker = RetryTracker(max_retries=3)

# Orchestration loop
for story in stories:
    try:
        result = launch_dev_agent(story)
        if result['status'] == 'failed':
            retry_tracker.record_attempt(story.id, 'dev-story', result['error'])
            handle_agent_failure(result, retry_tracker)
    except MaxRetriesError:
        print(f"Story {story.id} blocked after {retry_tracker.max_retries} attempts")
        offer_alternatives(story)
```
```

**Validation After Implementation:**

- [ ] Retry tracker class implemented
- [ ] Retry count tracked per story
- [ ] Max retries enforced (default: 3)
- [ ] Retry context passed to agent on re-launch
- [ ] Max retries reached triggers alternative options
- [ ] Correct-course resets retry counter
- [ ] User can halt at any point

---

### IMPROVEMENT #5: Dual Status Tracking (LOW)

**Location:** Add new section in `SKILL.md` after "Progress Tracking"

**Section Title:** `## Dual Status File Integration`

**Insert Position:** After existing "### 7. Progress Tracking" section

**Complete Content to Add:**

```markdown
## Dual Status File Integration

### Overview

The DigiLife project uses **two status files** for tracking story progress:

1. **bmm-workflow-status.md** - Narrative format (human-readable)
2. **sprint-status.yaml** - Machine-readable format (automation-friendly)

The orchestrator must understand both files and their synchronization rules.

### File Roles

#### bmm-workflow-status.md (Primary Source for Orchestrator)

**Purpose:** Narrative progress tracking for humans and orchestrator
**Format:** Markdown with structured sections
**Maintained by:** Orchestrator + SM workflows
**Read by:** Orchestrator (primary), humans (secondary)

**Key Sections:**
```markdown
## Active Epics (9)

### 🔴 ÉPICO 12: Configuração Avançada de Agentes
- **Status:** 🚧 IN PROGRESS (1/8 stories - 12% complete)
  - ✍️ Story 12.1: Adicionar Campos Schema Agents (DRAFTED)
  - ⏳ Story 12.2: Atualizar DTOs Backend (BACKLOG)
  ...

## Story Backlog Summary

### Epic 12 (1/8 stories - 12%)
- ✍️ EPIC-12-001: Adicionar Campos Schema (5 SP - P0 CRITICAL - Drafted)
- 🔴 EPIC-12-002: DTOs Backend (4 SP - P0 CRITICAL - Backlog)
...

## Completed Stories (30 total)
- 5.4.1: Logging em Webhook Handlers (2025-11-03)
- 5.3.4: ErrorFallback Component (2025-11-03)
...
```

**Orchestrator Usage:**
- Read "Active Epics" section to determine current epic
- Read "Story Backlog Summary" to get BACKLOG list
- Parse story states: DRAFTED, BACKLOG, IN PROGRESS, DONE
- Extract story priorities (P0/P1/P2) for decision making

#### sprint-status.yaml (Machine-Readable Metadata)

**Purpose:** Structured story metadata for automation
**Format:** YAML with nested structure
**Maintained by:** SM workflows (sprint-planning, story-ready, story-done)
**Read by:** SM workflows, orchestrator (secondary)

**Structure:**
```yaml
stories:
  epic-12:
    "12-1-adicionar-campos-schema-agents":
      status: drafted
      epic_number: 12
      story_number: 1
      title: "Adicionar Novos Campos ao Schema Agents"
      priority: P0-CRITICAL
      story_points: 5
      assigned_agent: "Agent 2 (System)"
      sprint: "Sprint 1 - Backend Foundation"
      tags:
        - backend
        - database
        - migration
    "12-2-atualizar-dtos-backend":
      status: backlog
      ...
```

**Orchestrator Usage:**
- Extract story metadata (SP, priority, assigned agent)
- Validate story state consistency with bmm-workflow-status.md
- Pass metadata to agents in launch prompts

### Synchronization Rules

**Single Source of Truth:**
- **State (BACKLOG/TODO/IN PROGRESS/DONE):** bmm-workflow-status.md is authoritative
- **Metadata (SP, priority, tags):** sprint-status.yaml is authoritative

**Synchronization Flow:**

```
┌──────────────────────────┐
│ SM Workflow Executes     │
│ (create-story,           │
│  story-ready,            │
│  story-done)             │
└──────────┬───────────────┘
           │
           ↓
  ┌────────────────────┐
  │ Update BOTH Files: │
  │ 1. workflow-status │
  │ 2. sprint-status   │
  └────────┬───────────┘
           │
           ↓
  ┌─────────────────────────┐
  │ Orchestrator Re-reads   │
  │ workflow-status.md      │
  │ (primary source)        │
  └─────────────────────────┘
```

**SM Workflows Auto-Sync:**
- `sprint-planning` → Generates sprint-status.yaml from epic files
- `story-ready` → Updates both workflow-status.md (state) and sprint-status.yaml (status field)
- `story-done` → Updates both files (DONE in workflow-status, done in sprint-status)

**Orchestrator Responsibility:**
- Read bmm-workflow-status.md for state machine logic
- Optionally read sprint-status.yaml for metadata (SP, priority)
- Pass metadata to agents if needed (e.g., story points for estimation context)

### Handling Conflicts

**Conflict Scenario:** sprint-status.yaml shows story as "drafted" but workflow-status.md shows story in "IN PROGRESS"

**Resolution Rule:**
```python
def resolve_state_conflict(story_id: str, workflow_state: str, sprint_state: str) -> str:
    """
    Resolve conflict between two status files
    Returns: Correct state to use
    """
    # workflow-status.md is AUTHORITATIVE for state
    if workflow_state != sprint_state:
        print(f"""
        ⚠️ STATE CONFLICT DETECTED

        Story: {story_id}
        workflow-status.md: {workflow_state}
        sprint-status.yaml: {sprint_state}

        RESOLUTION: Using workflow-status.md (authoritative for state)

        RECOMMENDED ACTION: Re-run SM sprint-planning workflow to regenerate sprint-status.yaml
        """)

        # Optionally auto-fix sprint-status.yaml
        update_sprint_status_yaml(story_id, status=workflow_state)

    return workflow_state  # Always trust workflow-status.md for state
```

**Conflict Prevention:**
- SM workflows update both files atomically (transactional)
- Orchestrator always reads workflow-status.md first
- sprint-status.yaml is regenerated if conflicts persist

### Orchestrator Read Logic

```python
def read_story_info(story_id: str) -> dict:
    """
    Read complete story information from both status files
    Combines state from workflow-status.md with metadata from sprint-status.yaml
    """
    # 1. Read state from workflow-status.md (authoritative)
    workflow_status = parse_workflow_status_md()
    state = find_story_state(workflow_status, story_id)  # BACKLOG/TODO/IN PROGRESS/DONE

    # 2. Read metadata from sprint-status.yaml (authoritative)
    sprint_status = parse_sprint_status_yaml()
    metadata = find_story_metadata(sprint_status, story_id)

    # 3. Combine information
    story_info = {
        "id": story_id,
        "state": state,  # From workflow-status.md
        "story_points": metadata.get("story_points"),  # From sprint-status.yaml
        "priority": metadata.get("priority"),  # From sprint-status.yaml
        "assigned_agent": metadata.get("assigned_agent"),  # From sprint-status.yaml
        "epic_number": metadata.get("epic_number"),  # From sprint-status.yaml
        "title": metadata.get("title")  # From sprint-status.yaml
    }

    return story_info
```

### Practical Example

**Orchestrator needs to launch DEV agent for next story:**

```python
# 1. Read workflow-status.md to get current state
workflow_status = parse_workflow_status_md()
in_progress_story_id = workflow_status['in_progress'][0]  # e.g., "story-12.1"

# 2. Read sprint-status.yaml to get metadata
story_info = read_story_info(in_progress_story_id)

# 3. Launch DEV agent with complete context
dev_prompt = f"""
You are the BMAD Developer agent.

Load skill 'bmad-dev' and execute dev-story workflow.

**STORY INFO:**
- ID: {story_info['id']}
- Title: {story_info['title']}
- Story Points: {story_info['story_points']} SP (estimated effort)
- Priority: {story_info['priority']} (criticality)
- Assigned Agent: {story_info['assigned_agent']}

**CONTEXT:**
- Story file: docs/stories/{in_progress_story_id}.md
- Context XML: docs/stories/story-context-{in_progress_story_id}.xml

Story points indicate this is a {estimate_complexity(story_info['story_points'])} complexity task.
Priority {story_info['priority']} means this is time-sensitive.

Implement ALL acceptance criteria. Tests MUST be 100% passing.
"""

launch_dev_agent(dev_prompt)
```

### Validation Checklist

- [ ] Orchestrator reads bmm-workflow-status.md for state
- [ ] Orchestrator optionally reads sprint-status.yaml for metadata
- [ ] State conflicts resolved using workflow-status.md (authoritative)
- [ ] Metadata conflicts resolved using sprint-status.yaml (authoritative)
- [ ] SM workflows update both files (no manual edits)
- [ ] Conflict detection warns user with resolution suggestion
```

**Validation After Implementation:**

- [ ] Orchestrator reads both status files
- [ ] workflow-status.md is primary source for state
- [ ] sprint-status.yaml is primary source for metadata
- [ ] Conflict resolution logic implemented
- [ ] User is warned if conflicts detected

---

### IMPROVEMENT #6: Phase Verification Details (LOW)

**Location:** Expand existing "Phase Verification" section in `SKILL.md`

**Current Section:** Mentioned in skill but not detailed

**Action:** Add comprehensive pre-orchestration verification section

**Insert Position:** After "Dual Status File Integration" section

**Complete Content to Add:**

```markdown
## Comprehensive Phase Verification

### Overview

Before starting orchestration, the orchestrator MUST verify that the project is in the correct phase and all prerequisites are met. This prevents cascading errors and wasted context.

**Verification Timeline:** Before ANY agent launch

**Failure Action:** HALT orchestration, report missing prerequisites to user

### Verification Checklist

#### Phase Check

```python
def verify_phase_4_active() -> bool:
    """
    Verify project is in Phase 4 (Implementation)
    Returns True if Phase 4 active, raises error otherwise
    """
    workflow_status = read_workflow_status_md()
    current_phase = workflow_status.get('CURRENT_PHASE')

    if not current_phase:
        raise OrchestratorError("CURRENT_PHASE not found in workflow-status.md")

    if "Phase 4" not in current_phase and "Implementation" not in current_phase:
        user_message = f"""
        ⚠️ INCORRECT PHASE: Orchestrator Requires Phase 4

        Current phase: {current_phase}
        Required phase: Phase 4 - Implementation

        The orchestrator is designed for Phase 4 (Implementation) workflows.
        Your project is currently in a different phase.

        NEXT STEPS:
        1. Complete Phase 1 (Analysis) if not done
        2. Complete Phase 2 (Planning) - PRD creation
        3. Complete Phase 3 (Solutioning) - Architecture + Tech Specs
        4. Run solutioning gate check workflow
        5. Transition to Phase 4, then re-run orchestrator

        Use: /bmad:bmm:agents:architect → *solutioning-gate-check
        """
        display_to_user(user_message)
        raise OrchestratorError("Phase 4 not active")

    return True
```

#### Prerequisites Check

```python
def verify_prerequisites() -> dict:
    """
    Verify all Phase 4 prerequisites are met
    Returns dict of {prerequisite: status}
    """
    results = {}

    # 1. PRD exists and validated
    prd_path = f"{project_root}/docs/prd.md"
    if os.path.exists(prd_path):
        # Optional: Check validation compliance
        # compliance = check_prd_compliance(prd_path)
        results['prd'] = "✅ EXISTS"
    else:
        results['prd'] = "❌ MISSING"

    # 2. Architecture documented
    arch_dir = f"{project_root}/docs/architecture/"
    if os.path.exists(arch_dir) and len(os.listdir(arch_dir)) > 0:
        results['architecture'] = "✅ EXISTS"
    else:
        results['architecture'] = "❌ MISSING"

    # 3. Sprint status file exists (indicates planning done)
    sprint_status_path = f"{project_root}/docs/sprint-status.yaml"
    if os.path.exists(sprint_status_path):
        results['sprint_planning'] = "✅ COMPLETE"
    else:
        results['sprint_planning'] = "❌ NOT RUN (run SM sprint-planning workflow first)"

    # 4. Epic files exist
    epic_files = glob.glob(f"{project_root}/docs/epics/epic*.md")
    if len(epic_files) > 0:
        results['epics'] = f"✅ {len(epic_files)} EPICS FOUND"
    else:
        results['epics'] = "❌ NO EPICS (create epics before implementation)"

    # 5. BACKLOG not empty
    workflow_status = read_workflow_status_md()
    backlog_count = len(workflow_status.get('backlog', []))
    if backlog_count > 0:
        results['backlog'] = f"✅ {backlog_count} STORIES IN BACKLOG"
    else:
        results['backlog'] = "❌ EMPTY (no stories to implement)"

    return results
```

#### Pre-Orchestration Gate

```python
def pre_orchestration_gate():
    """
    Complete pre-orchestration verification
    Halts if any critical prerequisite missing
    """
    print("🔍 Running pre-orchestration verification...")

    # Phase check
    try:
        verify_phase_4_active()
        print("✅ Phase 4 (Implementation) confirmed active")
    except OrchestratorError as e:
        print(f"❌ Phase verification failed: {e}")
        raise

    # Prerequisites check
    prereq_results = verify_prerequisites()

    print("\n📋 Prerequisites Status:")
    for prereq, status in prereq_results.items():
        print(f"  {prereq}: {status}")

    # Check for failures
    failures = [k for k, v in prereq_results.items() if "❌" in v]

    if failures:
        user_message = f"""
        ❌ ORCHESTRATION BLOCKED: Missing Prerequisites

        The following prerequisites are not met:
        """
        for failure in failures:
            user_message += f"\n  - {failure}: {prereq_results[failure]}"

        user_message += """

        REQUIRED ACTIONS:
        1. Ensure PRD exists at docs/prd.md
        2. Ensure architecture docs exist at docs/architecture/
        3. Run SM sprint-planning workflow to generate sprint-status.yaml
        4. Create epic files in docs/epics/ (use PM agent)
        5. Ensure BACKLOG has stories (populated by sprint-planning)

        After completing these steps, re-run orchestrator.
        """
        display_to_user(user_message)
        raise OrchestratorError("Prerequisites not met")

    print("\n✅ All prerequisites verified. Orchestration can proceed.")
```

### Early Exit Scenarios

**Scenario 1: BACKLOG Empty**

```python
if backlog_count == 0:
    user_message = """
    📭 BACKLOG IS EMPTY

    No stories available for implementation.

    This means either:
    1. Epic complete - all stories done
    2. Sprint planning not run
    3. No epics created yet

    NEXT ACTIONS:
    - If epic complete: Run retrospective workflow
    - If planning not run: Run SM sprint-planning workflow
    - If no epics: Create epics with PM agent first

    Options:
    a) Run retrospective (if epic complete)
    b) Run sprint-planning (if not initialized)
    c) Exit orchestration

    Select option (a/b/c):
    """
    display_to_user(user_message)
    user_choice = wait_for_user_input()

    if user_choice == "a":
        launch_sm_retrospective()
    elif user_choice == "b":
        launch_sm_sprint_planning()
    elif user_choice == "c":
        print("Orchestration exited.")
        sys.exit(0)
```

**Scenario 2: PRD Missing**

```python
if not os.path.exists(prd_path):
    user_message = """
    ❌ PRD NOT FOUND

    Expected path: docs/prd.md

    The PRD (Product Requirements Document) is REQUIRED for implementation.
    Stories are derived from PRD requirements.

    NEXT ACTIONS:
    1. Create PRD using PM agent: /bmad:bmm:agents:pm → *prd
    2. Validate PRD compliance (> 80%): /bmad:bmm:agents:pm → *validate
    3. Re-run orchestrator after PRD complete

    Orchestration halted.
    """
    display_to_user(user_message)
    halt_orchestration()
```

### Verification Timing

**When to verify:**
- ✅ At orchestration start (before first agent launch)
- ✅ After long idle period (optional - user may have changed files)
- ❌ After every agent execution (too expensive, unnecessary)

**Verification cost:**
- ~5-10 file reads
- ~2-3 seconds
- Minimal context consumption
- High value (prevents cascading failures)

### Validation Checklist

- [ ] Phase 4 verification implemented
- [ ] Prerequisites check implemented (PRD, architecture, sprint-status, epics, backlog)
- [ ] Early exit scenarios handled (empty backlog, missing PRD)
- [ ] User-friendly error messages with recovery steps
- [ ] Verification runs before first agent launch
- [ ] Orchestration halts if critical prerequisites missing
```

**Validation After Implementation:**

- [ ] Phase 4 is verified before orchestration starts
- [ ] Prerequisites are checked (PRD, architecture, epics, backlog)
- [ ] Missing prerequisites trigger clear error messages with recovery steps
- [ ] Empty backlog offers retrospective or sprint-planning options
- [ ] Orchestration halts if critical prerequisites missing

---

## 📊 IMPLEMENTATION CHECKLIST

### Phase 1: Critical Fixes (MUST HAVE)

- [ ] **Agent Report Parsing** (Improvement #1)
  - [ ] Add "Agent Report Parsing and Validation" section
  - [ ] Add success report template
  - [ ] Add error report template
  - [ ] Add parsing logic (Python pseudocode)
  - [ ] Add state transition validation
  - [ ] Add file verification logic
  - [ ] Add malformed report handling
  - [ ] Add validation checklist

- [ ] **Skill-Based Launching** (Improvement #2)
  - [ ] Update "Agent Launching with Skills" section
  - [ ] Add SM agent launch template (with Skill tool)
  - [ ] Add DEV agent launch template (with Skill tool)
  - [ ] Add example launches (create-story, dev-story)
  - [ ] Add key principles (two-step activation, explicit context)
  - [ ] Update orchestration-templates/ assets

### Phase 2: Enhanced Functionality (SHOULD HAVE)

- [ ] **Contextual Agent Launching** (Improvement #3)
  - [ ] Add "Contextual Agent Launching" section
  - [ ] Add pattern: SM creates story → DEV uses
  - [ ] Add pattern: SM creates context XML → DEV uses
  - [ ] Add dependency extraction logic
  - [ ] Add file validation before next agent
  - [ ] Add missing dependency handling
  - [ ] Add context passing checklist

- [ ] **Error Recovery Loop** (Improvement #4)
  - [ ] Add "Error Recovery Loop" section
  - [ ] Add retry loop flowchart
  - [ ] Add RetryTracker class
  - [ ] Add retry loop step-by-step
  - [ ] Add max retries enforcement (3)
  - [ ] Add retry context passing
  - [ ] Add recovery loop checklist

### Phase 3: Polish & Documentation (NICE TO HAVE)

- [ ] **Dual Status Tracking** (Improvement #5)
  - [ ] Add "Dual Status File Integration" section
  - [ ] Document workflow-status.md role
  - [ ] Document sprint-status.yaml role
  - [ ] Add synchronization rules
  - [ ] Add conflict resolution logic
  - [ ] Add practical example

- [ ] **Phase Verification** (Improvement #6)
  - [ ] Add "Comprehensive Phase Verification" section
  - [ ] Add phase check logic
  - [ ] Add prerequisites check logic
  - [ ] Add pre-orchestration gate
  - [ ] Add early exit scenarios
  - [ ] Add validation checklist

### Integration with bmad-sm/bmad-dev Skills

- [ ] **bmad-orchestrator references bmad-sm skill**
  - [ ] Update launch templates to use Skill tool command "bmad-sm"
  - [ ] Reference bmad-sm workflows (7 workflows)
  - [ ] Expect structured reports from bmad-sm skill

- [ ] **bmad-orchestrator references bmad-dev skill**
  - [ ] Update launch templates to use Skill tool command "bmad-dev"
  - [ ] Reference bmad-dev workflows (3 workflows)
  - [ ] Expect test results in reports from bmad-dev skill

- [ ] **Update references/bmad-agent-skills-mapping.md**
  - [ ] Update SM launch template (use Skill tool)
  - [ ] Update DEV launch template (use Skill tool)
  - [ ] Add skill loading instructions

### Testing & Validation

- [ ] **Test Agent Report Parsing**
  - [ ] Create mock success report, parse it
  - [ ] Create mock error report, parse it
  - [ ] Test state extraction
  - [ ] Test file extraction
  - [ ] Test validation logic

- [ ] **Test Skill-Based Launching**
  - [ ] Launch SM agent with bmad-sm skill
  - [ ] Verify skill loads correctly
  - [ ] Verify workflow executes
  - [ ] Verify structured report returned

- [ ] **Test Contextual Launching**
  - [ ] SM creates story → extract path → validate file
  - [ ] SM creates context XML → extract path → pass to DEV
  - [ ] Test missing file handling

- [ ] **Test Retry Loop**
  - [ ] DEV fails → user fixes → retry
  - [ ] Max retries (3) reached → halt
  - [ ] Correct-course → retry counter reset

- [ ] **End-to-End Epic Test**
  - [ ] Full epic (8 stories) BACKLOG → DONE
  - [ ] Verify all stories complete
  - [ ] Verify state transitions correct
  - [ ] Verify files created as expected

---

## 🎯 EXPECTED OUTCOMES AFTER IMPLEMENTATION

### Before Improvements (v1.0)
- **Score:** 8.5/10
- **Agent report parsing:** Manual/unclear
- **Agent launching:** Full agent invocation (slash commands)
- **Context passing:** Implicit (agent searches for files)
- **Error recovery:** Basic (no retry logic)
- **Status tracking:** Single file focus
- **Phase verification:** Mentioned but not enforced

### After Improvements (v1.5)
- **Score:** 9.5/10 (target)
- **Agent report parsing:** ✅ Structured with validation
- **Agent launching:** ✅ Skill-based (70% context reduction)
- **Context passing:** ✅ Explicit with dependency validation
- **Error recovery:** ✅ Retry loop with 3-attempt limit
- **Status tracking:** ✅ Dual file integration documented
- **Phase verification:** ✅ Comprehensive pre-orchestration gate

### Quality Improvements

| Metric                  | v1.0    | v1.5 (target) | Improvement |
|-------------------------|---------|---------------|-------------|
| Context per launch      | ~2000t  | ~1700t        | -15%        |
| Report parse errors     | High    | Near zero     | -90%        |
| Orchestration failures  | 15%     | < 5%          | -67%        |
| User intervention req.  | Frequent| Rare          | -80%        |
| Epic completion rate    | 70%     | 95%           | +36%        |

### User Experience Improvements

**Before (v1.0):**
- ❌ Orchestrator returns unclear agent outputs
- ❌ Missing files cause cascading failures
- ❌ Errors require manual debugging
- ❌ No retry mechanism (restart from scratch)
- ❌ User unsure which file to check

**After (v1.5):**
- ✅ Structured reports parsed automatically
- ✅ Missing files detected before agent launch
- ✅ Errors offer clear recovery options with retry
- ✅ Retry logic (3 attempts) prevents restarts
- ✅ User receives exact file paths and actions

---

## 📚 APPENDIX: QUICK REFERENCE

### File Locations

```
bmad-orchestrator/
├── SKILL.md (MODIFIED - add 6 sections)
│   ├── Agent Report Parsing (NEW - ~3 pages)
│   ├── Agent Launching with Skills (UPDATED - ~2 pages)
│   ├── Contextual Agent Launching (NEW - ~2 pages)
│   ├── Error Recovery Loop (NEW - ~2 pages)
│   ├── Dual Status File Integration (NEW - ~1 page)
│   └── Comprehensive Phase Verification (NEW - ~1 page)
├── references/
│   ├── bmad-workflow-states.md (NO CHANGES)
│   ├── bmad-agent-skills-mapping.md (MODIFIED - update templates)
│   └── report-parsing-guide.md (NEW - optional reference)
└── assets/
    └── orchestration-templates/ (MODIFIED - update templates)
```

### Priority Matrix

| Improvement                  | Impact | Effort | Priority | Lines Added |
|------------------------------|--------|--------|----------|-------------|
| Agent Report Parsing         | HIGH   | MED    | 1        | ~800        |
| Skill-Based Launching        | HIGH   | LOW    | 1        | ~600        |
| Contextual Agent Launching   | MED    | MED    | 2        | ~500        |
| Error Recovery Loop          | MED    | MED    | 2        | ~500        |
| Dual Status Tracking         | LOW    | LOW    | 3        | ~300        |
| Phase Verification           | LOW    | LOW    | 3        | ~300        |

### Key Terms

- **Orchestrator**: Coordinator that launches agents and tracks state
- **Agent**: Subprocess that loads skill and executes workflow
- **Skill**: Context-optimized workflow executor (bmad-sm, bmad-dev)
- **Workflow**: BMAD workflow definition (YAML + instructions)
- **Report**: Structured output from agent after workflow execution
- **State Machine**: BACKLOG → TODO → IN PROGRESS → DONE
- **Retry Loop**: Error recovery mechanism with 3-attempt limit
- **Context Passing**: Explicit file paths passed from one agent to next

### Success Criteria

✅ Skill-creator agent can:
1. Read this guide and understand ALL improvements
2. Locate exact insertion points in SKILL.md
3. Copy/paste provided content sections
4. Update references and templates
5. Test each improvement independently
6. Validate implementation with checklists

✅ After implementation:
1. Orchestrator launches agents using Skill tool
2. Reports are parsed successfully (100% success rate)
3. Context is passed explicitly (no file search errors)
4. Errors trigger retry loop (max 3 attempts)
5. Epic completes without manual intervention (95% success rate)

---

**END OF IMPLEMENTATION GUIDE**

*This document is ready for skill-creator agent to execute.*

**Next Steps:**
1. Skill-creator reads this guide
2. Skill-creator opens bmad-orchestrator/SKILL.md
3. Skill-creator applies improvements 1-6 in order
4. Skill-creator validates with checklists
5. Skill-creator tests with sample epic

**Estimated Implementation Time:** 4-6 hours (full implementation with testing)
