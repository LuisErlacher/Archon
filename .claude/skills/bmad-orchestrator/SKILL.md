---
name: bmad-orchestrator
description: Orchestrate the BMAD Method v6a workflow to develop complete epics by launching specialized agents (SM and DEV) within the same session. Each agent operates with isolated context and loads role-specific skills. Use this skill when the user requests full epic development, automated story implementation, or coordinated workflow execution across multiple BMAD agents.
---

# BMAD Orchestrator

## Overview

Orchestrate the complete BMAD Method v6a workflow to develop entire epics end-to-end. Launch specialized agents (SM for story management, DEV for implementation) within the same session, with each agent operating in isolated context and loading role-specific skills. Maximize context efficiency by delegating to focused agents rather than maintaining all knowledge in a single conversation.

## Core Capabilities

### 1. Workflow State Assessment

Before any orchestration, assess the current workflow state:

1. **Load workflow status file**: `{project-root}/docs/bmm-workflow-status.md`
2. **Identify current phase**: Analysis, Planning, Solutioning, or Implementation
3. **Check story queue**:
   - **BACKLOG**: Stories waiting to be drafted
   - **TODO**: Story ready for SM to draft (or drafted, awaiting approval)
   - **IN PROGRESS**: Story approved for DEV implementation
   - **DONE**: Completed stories
4. **Determine next action** based on state machine position

#### Dual Status Tracking

DigiLife project uses **two status files** for workflow tracking. The orchestrator must understand both and their relationship:

**1. bmm-workflow-status.md** (Orchestrator Primary Source):
- **Format**: Markdown narrative
- **Purpose**: Human-readable epic progress and story states
- **Contains**:
  - Current phase (Analysis, Planning, Solutioning, Implementation)
  - Epic overview with story breakdown
  - Story states: BACKLOG → TODO → IN PROGRESS → DONE
  - Narrative context and progress notes
- **Used by**: Orchestrator reads this file to determine next action

**2. sprint-status.yaml** (Machine-Readable Metadata):
- **Format**: YAML structured data
- **Purpose**: Story metadata for automation and tracking
- **Contains**:
  - Story points (SP)
  - Priority (P0/P1/P2)
  - Assigned agent (Marcus/Amelia)
  - Dates (created, drafted, started, completed)
  - Epic and module associations
- **Used by**: SM workflows (sprint-planning, story-ready, story-done)

**Synchronization Rules**:

```
Orchestrator behavior:
├─ READS FROM: bmm-workflow-status.md (primary source for state machine)
├─ NEVER MODIFIES: Either file (agents handle updates)
└─ VALIDATES: Files stay in sync after agent executions

SM Agent behavior:
├─ UPDATES: Both bmm-workflow-status.md AND sprint-status.yaml
├─ WORKFLOWS that sync both:
│   ├─ sprint-planning: Generates sprint-status.yaml from epics
│   ├─ story-ready: Updates both files (TODO → IN PROGRESS)
│   └─ story-done: Updates both files (IN PROGRESS → DONE)
└─ ENSURES: Changes propagate to both files atomically

DEV Agent behavior:
├─ READS FROM: sprint-status.yaml (story metadata)
├─ UPDATES VIA: SM agent (story-done workflow)
└─ NEVER MODIFIES: Status files directly
```

**Conflict Resolution**:

If orchestrator detects inconsistency between files, it must HALT and offer resolution options.

**Detection Function**

```python
def detect_status_file_conflicts() -> dict:
    """Detect inconsistencies between bmm-workflow-status.md and sprint-status.yaml"""
    import yaml

    conflicts = []

    # Read both status files
    workflow_status_content = Read('docs/bmm-workflow-status.md')
    sprint_status_content = Read('docs/sprint-status.yaml')
    sprint_status = yaml.safe_load(sprint_status_content)

    # Extract story states from workflow-status.md
    workflow_states = {}  # story_id -> state (TODO, IN PROGRESS, DONE)

    # Parse workflow-status.md to extract states
    current_section = None
    for line in workflow_status_content.split('\n'):
        if '#### TODO' in line:
            current_section = 'todo'
        elif '#### IN PROGRESS' in line:
            current_section = 'in_progress'
        elif '#### DONE' in line:
            current_section = 'done'
        elif '#### BACKLOG' in line:
            current_section = 'backlog'
        elif current_section and line.strip().startswith('- Story'):
            # Extract story ID (e.g., "- Story 1.1:" -> "story-1.1")
            story_match = re.search(r'Story (\d+\.\d+)', line)
            if story_match:
                story_id = f"story-{story_match.group(1)}"
                workflow_states[story_id] = current_section

    # Compare with sprint-status.yaml
    for story in sprint_status.get('stories', []):
        story_id = story['id']
        yaml_status = story['status']  # drafted, todo, in_progress, done

        # Map YAML status to workflow status
        yaml_to_workflow = {
            'drafted': 'backlog',
            'todo': 'todo',
            'in_progress': 'in_progress',
            'done': 'done'
        }
        expected_workflow_state = yaml_to_workflow.get(yaml_status, 'unknown')

        # Check if states match
        actual_workflow_state = workflow_states.get(story_id, 'not_found')

        if actual_workflow_state != expected_workflow_state:
            conflicts.append({
                'story_id': story_id,
                'workflow_status': actual_workflow_state,
                'sprint_yaml_status': yaml_status,
                'expected_workflow_status': expected_workflow_state,
                'mismatch': True
            })

    return {
        'has_conflicts': len(conflicts) > 0,
        'conflicts': conflicts,
        'total_conflicts': len(conflicts)
    }
```

**Resolution Workflow**

```python
def resolve_status_conflicts(conflicts: dict):
    """Resolve status file conflicts with user guidance"""

    if not conflicts['has_conflicts']:
        print("✅ No conflicts detected")
        return {'resolved': True}

    print(f"⚠️  Detected {conflicts['total_conflicts']} status file conflict(s)")
    print("\nConflicts:")

    for i, conflict in enumerate(conflicts['conflicts'], 1):
        print(f"\n{i}. Story: {conflict['story_id']}")
        print(f"   bmm-workflow-status.md: {conflict['workflow_status'].upper()}")
        print(f"   sprint-status.yaml: {conflict['sprint_yaml_status']}")
        print(f"   Expected (from yaml): {conflict['expected_workflow_status'].upper()}")

    print("\n" + "="*60)
    print("CONFLICT RESOLUTION OPTIONS")
    print("="*60)

    print("\nOption 1: Auto-Sync (Recommended)")
    print("  - bmm-workflow-status.md is AUTHORITATIVE")
    print("  - Orchestrator will update sprint-status.yaml to match")
    print("  - Safe for most cases")

    print("\nOption 2: Re-run sprint-planning")
    print("  - Regenerates sprint-status.yaml from epic files")
    print("  - Use if sprint-status.yaml is completely corrupt")
    print("  - Will overwrite all metadata in sprint-status.yaml")

    print("\nOption 3: Manual Investigation")
    print("  - Halt orchestration for manual review")
    print("  - Use if conflicts indicate deeper issues")
    print("  - Allows manual editing of both files")

    print("\nOption 4: Force Continue (Dangerous)")
    print("  - Ignore conflicts and continue orchestration")
    print("  - Not recommended - may cause state corruption")

    # Wait for user choice
    print("\nEnter choice (1, 2, 3, or 4):")
    user_choice = input().strip()

    if user_choice == '1':
        return auto_sync_status_files(conflicts)
    elif user_choice == '2':
        return launch_sprint_planning_workflow()
    elif user_choice == '3':
        return {'resolved': False, 'action': 'HALT_FOR_MANUAL_REVIEW'}
    elif user_choice == '4':
        print("⚠️  WARNING: Continuing with conflicts may corrupt state")
        return {'resolved': True, 'forced': True}
    else:
        print("Invalid choice. Halting orchestration.")
        return {'resolved': False, 'action': 'INVALID_CHOICE'}
```

**Auto-Sync Implementation**

```python
def auto_sync_status_files(conflicts: dict) -> dict:
    """Auto-sync sprint-status.yaml to match bmm-workflow-status.md"""
    import yaml

    print("\n🔄 Auto-syncing status files...")
    print("Reading current state from bmm-workflow-status.md (AUTHORITATIVE)")

    # Read workflow status (authoritative)
    workflow_content = Read('docs/bmm-workflow-status.md')

    # Read sprint status
    sprint_content = Read('docs/sprint-status.yaml')
    sprint_data = yaml.safe_load(sprint_content)

    # Extract correct states from workflow status
    workflow_states = extract_workflow_states(workflow_content)

    # Update sprint-status.yaml to match
    updates_made = []

    for story in sprint_data['stories']:
        story_id = story['id']
        current_yaml_status = story['status']

        # Get authoritative status from workflow
        workflow_state = workflow_states.get(story_id)

        if workflow_state:
            # Map workflow state to YAML status
            workflow_to_yaml = {
                'backlog': 'drafted',
                'todo': 'todo',
                'in_progress': 'in_progress',
                'done': 'done'
            }
            correct_yaml_status = workflow_to_yaml.get(workflow_state)

            if correct_yaml_status and correct_yaml_status != current_yaml_status:
                # Update YAML
                story['status'] = correct_yaml_status
                updates_made.append({
                    'story_id': story_id,
                    'old_status': current_yaml_status,
                    'new_status': correct_yaml_status
                })

    # Write updated YAML back to file
    if updates_made:
        updated_yaml = yaml.dump(sprint_data, default_flow_style=False, sort_keys=False)
        Write('docs/sprint-status.yaml', updated_yaml)

        print(f"\n✅ Updated {len(updates_made)} stories in sprint-status.yaml:")
        for update in updates_made:
            print(f"  - {update['story_id']}: {update['old_status']} → {update['new_status']}")

        return {
            'resolved': True,
            'method': 'auto_sync',
            'updates': updates_made
        }
    else:
        print("\n✅ No updates needed (already in sync)")
        return {
            'resolved': True,
            'method': 'auto_sync',
            'updates': []
        }

def extract_workflow_states(content: str) -> dict:
    """Extract story states from bmm-workflow-status.md"""
    states = {}
    current_section = None

    for line in content.split('\n'):
        if '#### TODO' in line:
            current_section = 'todo'
        elif '#### IN PROGRESS' in line:
            current_section = 'in_progress'
        elif '#### DONE' in line:
            current_section = 'done'
        elif '#### BACKLOG' in line:
            current_section = 'backlog'
        elif current_section and line.strip().startswith('- Story'):
            story_match = re.search(r'Story (\d+\.\d+)', line)
            if story_match:
                story_id = f"story-{story_match.group(1)}"
                states[story_id] = current_section

    return states
```

**Conflict Resolution Examples**

**Example 1: Simple State Mismatch**

```
Scenario: Story 1.1 marked as "IN PROGRESS" in workflow but "todo" in YAML

Detection:
└─ Orchestrator reads both files at orchestration start
└─ detect_status_file_conflicts() finds mismatch
└─ Conflict: {
     'story_id': 'story-1.1',
     'workflow_status': 'in_progress',
     'sprint_yaml_status': 'todo',
     'mismatch': True
   }

Resolution (Auto-Sync):
1. Orchestrator reports conflict to user
2. User selects Option 1 (Auto-Sync)
3. Orchestrator updates sprint-status.yaml:
   - story-1.1: status="todo" → status="in_progress"
4. Orchestrator writes updated YAML
5. Orchestration continues

Result: ✅ Conflict resolved, files synchronized
```

**Example 2: Multiple Conflicts**

```
Scenario: 3 stories with mismatched states after manual editing

Detection:
└─ Conflicts detected:
    1. story-1.1: workflow="in_progress", yaml="todo"
    2. story-1.2: workflow="done", yaml="in_progress"
    3. story-2.1: workflow="todo", yaml="backlog"

Resolution (Auto-Sync):
1. Orchestrator reports 3 conflicts
2. User selects Option 1 (Auto-Sync)
3. Orchestrator updates all 3 stories in sprint-status.yaml
4. Changes written to file
5. Orchestration continues

Result: ✅ All 3 conflicts resolved
```

**Example 3: Corrupt YAML File**

```
Scenario: sprint-status.yaml is completely corrupt or malformed

Detection:
└─ Orchestrator attempts to load YAML
└─ yaml.safe_load() raises YAMLError
└─ Unable to parse sprint-status.yaml

Resolution (Re-run sprint-planning):
1. Orchestrator reports: "sprint-status.yaml is corrupt"
2. User selects Option 2 (Re-run sprint-planning)
3. Orchestrator launches SM agent with sprint-planning workflow
4. SM regenerates sprint-status.yaml from epic files
5. New YAML written to disk
6. Orchestration continues

Result: ✅ YAML regenerated from source
```

**Example 4: Deep Inconsistency Requiring Manual Review**

```
Scenario: Conflicts indicate state machine violation (e.g., story skipped TODO)

Detection:
└─ Conflict: story-1.1 jumped from BACKLOG to IN PROGRESS (skipped TODO)
└─ State machine violation detected

Resolution (Manual Investigation):
1. Orchestrator reports: "State machine violation detected"
2. Orchestrator recommends Option 3 (Manual Investigation)
3. User selects Option 3
4. Orchestrator HALTS and exits
5. User manually investigates:
   - Checks story files
   - Reviews workflow history
   - Fixes root cause
6. User re-runs orchestration after fix

Result: ⚠️ Orchestration halted for safety
```

**Integration with Orchestration Loop**

```python
def start_orchestration_with_validation():
    """Start orchestration with upfront conflict detection"""

    print("🔍 Pre-orchestration conflict detection...")

    # Detect conflicts before starting
    conflicts = detect_status_file_conflicts()

    if conflicts['has_conflicts']:
        print(f"\n⚠️  Found {conflicts['total_conflicts']} conflict(s)")
        print("Status files are out of sync")

        # Attempt resolution
        resolution = resolve_status_conflicts(conflicts)

        if not resolution['resolved']:
            print("\n❌ Conflicts not resolved - HALTING orchestration")
            print("Please fix status files manually and try again")
            return {'status': 'HALTED', 'reason': 'UNRESOLVED_CONFLICTS'}

        print("\n✅ Conflicts resolved - proceeding with orchestration")

    else:
        print("✅ No conflicts detected")

    # Continue with normal orchestration
    print("\n🚀 Starting orchestration loop...")
    return start_orchestration_loop()
```

**Best Practices**:
- Run conflict detection BEFORE starting orchestration (upfront check)
- bmm-workflow-status.md is ALWAYS authoritative for story state
- Auto-sync is safe for most conflicts (recommended default)
- Use sprint-planning regeneration for corrupt YAML only
- Manual investigation for state machine violations
- Never force-continue with unresolved conflicts

**Validation Checklist**:

Before launching any agent, validate file consistency:

```
✅ bmm-workflow-status.md exists
✅ sprint-status.yaml exists
✅ Current story state matches in both files
✅ Story metadata (SP, priority) present in sprint-status.yaml
✅ No duplicate story IDs

If any validation fails:
→ HALT orchestration
→ Report specific validation failure
→ Offer fix options (re-run sprint-planning, manual sync, etc.)
```

**Example: Checking File Consistency**

```
After SM agent runs story-ready workflow:

1. Orchestrator re-reads bmm-workflow-status.md:
   - Finds story-1.1 now in "IN PROGRESS" state ✅

2. Orchestrator reads sprint-status.yaml:
   - Finds story-1.1 with status="in_progress" ✅
   - Finds story-1.1 with started_date="2025-11-04" ✅

3. Orchestrator validates:
   - States match ✅
   - Metadata present ✅
   - No inconsistencies ✅

4. Orchestrator continues:
   - Launch next workflow (story-context)
```

**Key Takeaway**: Orchestrator treats `bmm-workflow-status.md` as the **single source of truth** for state machine position, but validates consistency with `sprint-status.yaml` after each agent execution to ensure both files remain synchronized.

#### Phase Verification

Before starting epic orchestration, the orchestrator MUST verify that the project is in the correct phase (Phase 4: Implementation) and all prerequisites are complete. Orchestration cannot proceed if these validations fail.

**Verification Sequence**:

```
1. Verify Phase 4 Active
   ↓
2. Verify Prerequisites Complete
   ↓
3. Verify BACKLOG Not Empty
   ↓
4. Start Orchestration
```

**1. Phase 4 Verification**:

```
Read bmm-workflow-status.md:
├─ Look for: "CURRENT_PHASE: Phase 4 - Implementation"
├─ OR look for: "## Phase 4: Implementation" section header
└─ If Phase 1, 2, or 3:
    └─ HALT orchestration
    └─ Report to user:
        "Orchestrator requires Phase 4 (Implementation).
         Current phase: [X]

         Phase 4 cannot start until:
         - Phase 1: Product Requirements Document (PRD) complete
         - Phase 2: Architecture and Tech Specs documented
         - Phase 3: Solutioning gate passed

         Please complete [current phase] and run solutioning gate check before starting orchestration."
```

**2. Prerequisites Verification**:

Verify all Phase 4 prerequisites are complete:

```
✅ PRD exists and validated:
   - File: docs/prd.md or docs/epics/epic-X-prd.md
   - Validation: PRD compliance > 80% (check for "PRD Compliance: X%")
   - If missing: HALT and report "PRD not found or not validated"

✅ Architecture documented:
   - File: docs/architecture/* (backend-architecture.md, frontend-architecture.md, etc.)
   - Check: At least 1 architecture doc exists
   - If missing: HALT and report "Architecture documentation not found"

✅ Tech specs exist for active epic:
   - File: docs/epics/epic-X.md with "Technical Specifications" section
   - OR separate: docs/tech-specs/epic-X-tech-spec.md
   - If missing: HALT and report "Tech specs not found for active epic"

✅ Sprint planning executed:
   - File: docs/sprint-status.yaml exists and is valid YAML
   - Check: Contains at least 1 story with metadata (SP, priority, etc.)
   - If missing: HALT and report "Sprint not initialized. Run sprint-planning workflow first."

✅ Workflow status file valid:
   - File: docs/bmm-workflow-status.md exists
   - Check: Contains "BACKLOG", "TODO", "IN PROGRESS", "DONE" sections
   - If invalid: HALT and report "Workflow status file corrupt or malformed"
```

**3. BACKLOG Verification**:

```
Read bmm-workflow-status.md BACKLOG section:
├─ Count stories in BACKLOG
├─ If BACKLOG empty:
│   └─ Report to user:
│       "BACKLOG is empty. No stories to orchestrate.
│
│        Options:
│        1. Epic complete - Run retrospective workflow
│        2. Start new epic - Run analysis and planning workflows
│        3. Exit orchestration"
│   └─ HALT orchestration
└─ If BACKLOG not empty:
    └─ Report: "Found [X] stories in BACKLOG. Ready to start orchestration."
    └─ Continue to orchestration
```

**4. Early Exit Conditions**:

Orchestrator HALTS early (before starting loop) if:

```
❌ Wrong phase (not Phase 4)
   → Report: "Run solutioning gate check first"
   → Exit code: PHASE_MISMATCH

❌ Prerequisites incomplete
   → Report: "Complete [missing prerequisite] first"
   → Exit code: PREREQUISITES_INCOMPLETE

❌ BACKLOG empty
   → Report: "No stories to orchestrate"
   → Exit code: NO_STORIES

❌ Status files corrupt
   → Report: "Fix workflow status files"
   → Exit code: INVALID_STATE
```

**Example: Full Pre-Orchestration Verification**

```
User: "Develop Epic 12"

Orchestrator executes verification:

Step 1: Phase Verification
└─ Read docs/bmm-workflow-status.md
└─ Find: "CURRENT_PHASE: Phase 4 - Implementation" ✅
└─ Result: Phase 4 active

Step 2: Prerequisites Verification
├─ Check docs/epics/epic-12.md ✅ (exists, has tech specs)
├─ Check docs/architecture/backend-architecture.md ✅ (exists)
├─ Check docs/sprint-status.yaml ✅ (valid, has 8 stories)
└─ Result: All prerequisites complete

Step 3: BACKLOG Verification
└─ Read BACKLOG section in docs/bmm-workflow-status.md
└─ Find: 8 stories in BACKLOG ✅
└─ Result: Stories ready for orchestration

Step 4: Report to User
"Pre-orchestration verification complete ✅

Phase: 4 (Implementation)
Prerequisites: All complete
Stories in BACKLOG: 8

Starting orchestration for Epic 12..."

Step 5: Start Orchestration Loop
└─ Proceed to Implementation Phase Orchestration
```

**Example: Verification Failure**

```
User: "Develop Epic 5"

Orchestrator executes verification:

Step 1: Phase Verification
└─ Read docs/bmm-workflow-status.md
└─ Find: "CURRENT_PHASE: Phase 3 - Solutioning" ❌
└─ Result: NOT Phase 4

Orchestrator HALTS:
"Cannot start orchestration ❌

Current phase: Phase 3 - Solutioning
Required phase: Phase 4 - Implementation

Phase 4 cannot start until solutioning gate is passed.

Next steps:
1. Complete solutioning for Epic 5
2. Run solutioning gate check workflow
3. Verify all tech specs documented
4. Run this orchestration again

Exit code: PHASE_MISMATCH"
```

**Verification Checklist Summary**:

Before starting orchestration, verify:
- ✅ Phase 4 active (read workflow status)
- ✅ PRD exists and validated (> 80% compliance)
- ✅ Architecture documented (at least 1 doc exists)
- ✅ Tech specs exist for epic (in epic file or separate)
- ✅ Sprint planning complete (sprint-status.yaml valid)
- ✅ Workflow status file valid (contains all sections)
- ✅ BACKLOG not empty (at least 1 story)

If ANY verification fails → HALT orchestration and report specific failure.

### 2. Agent Launching with Specialized Agents

Launch agents using the Task tool with specialized agent types that have role-specific knowledge and workflows built-in:

**Scrum Master (SM) Agent**:
```
Use Task tool with subagent_type="scrum-master-bmad" and prompt:
"You are Bob, the BMAD Scrum Master agent.

Execute the [workflow-name] workflow (e.g., *create-story, *story-ready, *story-context, etc.).

[Include any context needed for this specific workflow execution]

Return a structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Actions Taken
- Files Modified
- Current State (BACKLOG, TODO, IN PROGRESS, DONE counts)
- Next Action"
```

**Developer (DEV) Agent**:
```
Use Task tool with subagent_type="agent-skill-dev" and prompt:
"You are Amelia, the BMAD Developer agent.

Execute the [workflow-name] workflow (e.g., *develop, *story-done, *review).

[Include any context needed for this specific workflow execution]

Return a structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Actions Taken
- Files Modified
- Test Results (if applicable)
- Current State
- Next Action"
```

**Key principles**:
- Each agent runs in isolated context with specialized capabilities
- Agents are invoked with their specific subagent_type (scrum-master-bmad or agent-skill-dev)
- Agents have built-in knowledge of BMAD workflows and methodology
- Agent receives specific workflow command to execute (e.g., *create-story, *develop)
- Orchestrator receives only final structured report from agent
- No need to manually load skills - agents come pre-configured

### 3. Agent Report Parsing

After launching an agent, the orchestrator MUST parse the agent's report to determine next actions. Agents return structured reports that the orchestrator analyzes to validate execution and detect errors.

#### Expected Report Format

Agents MUST return structured reports in this format:

**Successful Execution**:
```
Agent Report: [workflow-name]

Status: ✅ SUCCESS

Actions Taken:
- [Action 1]
- [Action 2]

Files Modified:
- docs/stories/story-1.1.md (created)
- docs/sprint-status.yaml (updated)

Current State:
- BACKLOG: 7 stories
- TODO: story-1.2
- IN PROGRESS: story-1.1
- DONE: 0 stories

Next Action:
User approval required for story-1.1
```

**Failed Execution**:
```
Agent Report: [workflow-name]

Status: ❌ FAILED

Error:
Tests failing: authentication service not mocked

Blockers:
- Missing mock for AuthService.login()
- 3/5 tests passing (60%)

Recovery Options:
1. Fix mock and re-run dev-story
2. Launch correct-course to adjust story
3. Skip for now and continue
```

#### Orchestrator Parsing Logic

After receiving agent report, execute this parsing sequence:

1. **Check Status line**:
   - Look for `Status: ✅ SUCCESS` or `Status: ❌ FAILED`
   - If SUCCESS: Continue to validation
   - If FAILED: Jump to error handling

2. **Extract files modified**:
   - Parse "Files Modified:" section
   - Verify each file exists using Read tool
   - If file missing: Report inconsistency to user

3. **Validate state transitions**:
   - Re-read workflow status file (`docs/bmm-workflow-status.md`)
   - Confirm expected state transition occurred
   - Example: After story-ready, verify story moved TODO → IN PROGRESS

4. **Identify blockers**:
   - If "Blockers:" section present in report
   - Extract blocker list
   - Report to user with "Recovery Options:"

5. **Determine next action**:
   - Parse "Next Action:" from report
   - If "User approval required": HALT and wait
   - If "Continue to [workflow]": Prepare next agent launch
   - If "Epic complete": Report completion

**Parsing Example**:

```
Agent report includes:
"Files Modified:
- docs/stories/story-context-1.1.xml (created)"

Orchestrator action:
1. Extract path: `docs/stories/story-context-1.1.xml`
2. Verify file exists: Read tool
3. Store path for next agent launch (pass to DEV agent)
```

**Error Detection**:

If report lacks required sections, treat as malformed:
- Missing "Status:" → Assume FAILED, report to user
- Missing "Files Modified:" → Warn user, but continue if Status is SUCCESS
- Missing "Next Action:" → Infer from workflow (e.g., after create-story → user approval)

#### Parsing Implementation Examples

To systematically extract structured data from agent reports, use these regex patterns and parsing functions:

**Pattern 1: Extract Status**

```python
import re

def parse_status(report: str) -> str:
    """Extract status from agent report (SUCCESS or FAILED)"""
    status_match = re.search(r'\*\*Status:\*\*\s+(✅ SUCCESS|❌ FAILED)', report)
    if status_match:
        return 'SUCCESS' if '✅' in status_match.group(1) else 'FAILED'
    return 'UNKNOWN'  # Treat as malformed

# Example usage:
# report = "**Status:** ✅ SUCCESS"
# status = parse_status(report)  # Returns: 'SUCCESS'
```

**Pattern 2: Extract Files Modified**

```python
def parse_files_modified(report: str) -> list[dict]:
    """Extract file paths and actions from 'Files Modified' section"""
    files_section = re.search(
        r'\*\*Files Modified:\*\*\s*\n((?:- .+\n)+)',
        report,
        re.MULTILINE
    )

    if not files_section:
        return []

    files = []
    # Match lines like: "- docs/stories/story-1.1.md (created)"
    file_pattern = r'^- (.+?)\s+\((.+?)\)$'

    for line in files_section.group(1).split('\n'):
        match = re.match(file_pattern, line.strip())
        if match:
            files.append({
                'path': match.group(1),
                'action': match.group(2)  # created, updated, deleted
            })

    return files

# Example usage:
# report = """**Files Modified:**
# - docs/stories/story-1.1.md (created)
# - docs/sprint-status.yaml (updated)"""
# files = parse_files_modified(report)
# Returns: [
#   {'path': 'docs/stories/story-1.1.md', 'action': 'created'},
#   {'path': 'docs/sprint-status.yaml', 'action': 'updated'}
# ]
```

**Pattern 3: Extract Current State**

```python
def parse_current_state(report: str) -> dict:
    """Extract story queue state from 'Current State' section"""
    state_section = re.search(
        r'\*\*Current State.*?:\*\*\s*\n((?:- .+\n)+)',
        report,
        re.MULTILINE | re.DOTALL
    )

    if not state_section:
        return {}

    state = {
        'backlog_count': 0,
        'todo_story': None,
        'in_progress_story': None,
        'done_count': 0
    }

    # Extract counts and story IDs
    backlog_match = re.search(r'BACKLOG:\s+(\d+)\s+stories?', state_section.group(1))
    if backlog_match:
        state['backlog_count'] = int(backlog_match.group(1))

    todo_match = re.search(r'TODO:\s+(story-[\d.]+|empty)', state_section.group(1))
    if todo_match and todo_match.group(1) != 'empty':
        state['todo_story'] = todo_match.group(1)

    in_progress_match = re.search(r'IN PROGRESS:\s+(story-[\d.]+|empty)', state_section.group(1))
    if in_progress_match and in_progress_match.group(1) != 'empty':
        state['in_progress_story'] = in_progress_match.group(1)

    done_match = re.search(r'DONE:\s+(\d+)\s+stories?', state_section.group(1))
    if done_match:
        state['done_count'] = int(done_match.group(1))

    return state

# Example usage:
# report = """**Current State:**
# - BACKLOG: 7 stories
# - TODO: story-1.2
# - IN PROGRESS: story-1.1
# - DONE: 0 stories"""
# state = parse_current_state(report)
# Returns: {
#   'backlog_count': 7,
#   'todo_story': 'story-1.2',
#   'in_progress_story': 'story-1.1',
#   'done_count': 0
# }
```

**Pattern 4: Extract Test Results (DEV Reports)**

```python
def parse_test_results(report: str) -> dict:
    """Extract test results from DEV agent report"""
    tests_section = re.search(
        r'\*\*Test Results:\*\*\s*\n((?:- .+\n)+)',
        report,
        re.MULTILINE
    )

    if not tests_section:
        return {'overall_status': 'UNKNOWN', 'percentage': 0}

    results = {
        'unit': None,
        'integration': None,
        'e2e': None,
        'overall_status': 'UNKNOWN',
        'percentage': 0
    }

    # Match patterns like: "- Unit Tests: 5/5 passing (100%)"
    test_pattern = r'- (.+?) Tests?:\s+(\d+)/(\d+)\s+passing\s+\((\d+)%\)'

    for line in tests_section.group(1).split('\n'):
        match = re.search(test_pattern, line)
        if match:
            test_type = match.group(1).lower()
            passed = int(match.group(2))
            total = int(match.group(3))
            percentage = int(match.group(4))

            results[test_type] = {
                'passed': passed,
                'total': total,
                'percentage': percentage
            }

    # Check for overall status
    overall_match = re.search(r'Overall.*?:\s+(✅ ALL TESTS PASSING|❌)', report)
    if overall_match and '✅' in overall_match.group(1):
        results['overall_status'] = 'PASSING'
        results['percentage'] = 100
    else:
        results['overall_status'] = 'FAILING'

    return results

# Example usage:
# report = """**Test Results:**
# - Unit Tests: 5/5 passing (100%)
# - Integration Tests: 3/3 passing (100%)
# - **Overall:** ✅ ALL TESTS PASSING (100%)"""
# results = parse_test_results(report)
# Returns: {
#   'unit': {'passed': 5, 'total': 5, 'percentage': 100},
#   'integration': {'passed': 3, 'total': 3, 'percentage': 100},
#   'overall_status': 'PASSING',
#   'percentage': 100
# }
```

**Complete Parsing Function**

```python
def parse_agent_report(report: str) -> dict:
    """Complete report parser - combines all extraction patterns"""
    parsed = {
        'status': parse_status(report),
        'files': parse_files_modified(report),
        'state': parse_current_state(report),
        'workflow': None,
        'error': None,
        'next_action': None
    }

    # Extract workflow name
    workflow_match = re.search(r'\*\*Workflow:\*\*\s+(.+)', report)
    if workflow_match:
        parsed['workflow'] = workflow_match.group(1).strip()

    # Extract error if status is FAILED
    if parsed['status'] == 'FAILED':
        error_match = re.search(r'\*\*Error:\*\*\s+(.+?)(?:\n\n|\*\*)', report, re.DOTALL)
        if error_match:
            parsed['error'] = error_match.group(1).strip()

        # Extract test results if present
        parsed['test_results'] = parse_test_results(report)

    # Extract next action
    next_action_match = re.search(r'\*\*Next Action:\*\*\s+(.+?)(?:\n\n|\*\*|$)', report, re.DOTALL)
    if next_action_match:
        parsed['next_action'] = next_action_match.group(1).strip()

    return parsed

# Example usage:
# agent_report = """## Agent Report: create-story
#
# **Status:** ✅ SUCCESS
# **Workflow:** create-story
#
# **Files Modified:**
# - docs/stories/story-1.1.md (created)
#
# **Current State:**
# - BACKLOG: 7 stories
# - TODO: story-1.2
# - IN PROGRESS: story-1.1
# - DONE: 0 stories
#
# **Next Action:**
# User approval required for story-1.1
# """
#
# parsed = parse_agent_report(agent_report)
#
# # Now orchestrator can use structured data:
# if parsed['status'] == 'SUCCESS':
#     for file in parsed['files']:
#         verify_file_exists(file['path'])  # Validate files
#
#     print(f"Story queue: {parsed['state']['in_progress_story']} in progress")
#     print(f"Next action: {parsed['next_action']}")
```

**Using Parsed Data in Orchestration**

```python
# After launching SM agent with create-story workflow:
report = agent.get_report()
parsed = parse_agent_report(report)

# Validate execution
if parsed['status'] == 'SUCCESS':
    # Verify files exist
    for file_info in parsed['files']:
        if not file_exists(file_info['path']):
            HALT(f"Agent reported creating {file_info['path']} but file not found")

    # Validate state transition
    current_state = read_workflow_status()
    if current_state['in_progress'] != parsed['state']['in_progress_story']:
        HALT("State mismatch between report and workflow-status.md")

    # Store file paths for next agent
    story_file = next(f['path'] for f in parsed['files'] if 'story-' in f['path'])

    # Report to user
    print(f"✅ {parsed['workflow']} completed")
    print(f"📄 Story file: {story_file}")
    print(f"⏭️  Next: {parsed['next_action']}")

    # Wait for user approval before continuing
    WAIT_FOR_USER()

elif parsed['status'] == 'FAILED':
    # Handle error
    print(f"❌ {parsed['workflow']} failed")
    print(f"Error: {parsed['error']}")

    if 'test_results' in parsed and parsed['test_results']['overall_status'] == 'FAILING':
        print(f"Tests: {parsed['test_results']['percentage']}% passing")

    # Offer recovery options
    HALT_WITH_OPTIONS([
        "Fix issue and retry",
        "Launch correct-course workflow",
        "Skip story and continue"
    ])
```

**Key Takeaways**:
- Parsing functions extract structured data from free-text reports
- Regex patterns target specific sections (Status, Files, State, Tests)
- Always validate extracted data before using (file existence, state consistency)
- Treat malformed reports as errors (missing required sections)
- Use parsed data to make orchestration decisions (continue, halt, retry)

### 4. Contextual Agent Launching

When launching agents sequentially, the orchestrator MUST pass relevant context from previous agent outputs. This ensures each agent has the information needed without maintaining state in orchestrator memory.

#### Passing Context Between Agents

**Core Principle**: Extract file paths and relevant data from previous agent reports, then pass explicitly to next agent via Task tool prompt.

**Context Passing Workflow**:

1. **SM agent completes story-context workflow**
2. **Orchestrator parses report**:
   - Extracts: `Context XML created at: docs/stories/story-context-1.1.xml`
3. **Orchestrator validates file exists**:
   - Uses Read tool to verify file exists
   - If missing: HALT and report error
4. **Orchestrator launches DEV agent with explicit paths**:

```
Task tool with subagent_type="agent-skill-dev" and prompt:
"You are Amelia, the BMAD Developer agent.

Execute the *develop workflow for story-1.1.

CONTEXT:
- Story file: docs/stories/story-1.1-user-authentication.md
- Context XML: docs/stories/story-context-1.1.xml (created by SM)
- Workflow status: docs/bmm-workflow-status.md

INSTRUCTIONS:
1. Read the Context XML FIRST to understand architectural constraints and expertise injections
2. Read the Story file to understand all acceptance criteria and tasks
3. Implement ALL acceptance criteria following the architecture in Context XML
4. Run ALL tests - they MUST be 100% passing
5. Return a detailed report with status, files modified, and test results

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Actions Taken
- Files Modified
- Test Results (X/X passing, Y%)
- Current State
- Next Action"
```

#### Context Types and When to Pass

**Story Context** (SM → DEV):
- **When**: After story-context workflow, before dev-story
- **What to pass**:
  - Story file path
  - Context XML path
  - Workflow status file path
- **Why**: DEV needs architecture constraints and expertise injections

**Error Context** (DEV → SM):
- **When**: After dev-story fails, launching correct-course
- **What to pass**:
  - Story file path
  - Error report from DEV
  - Failed test results
  - Files that were modified
- **Why**: SM needs to understand what failed to adjust story or provide guidance

**Retry Context** (After user fixes → DEV):
- **When**: User manually fixes issue, re-launching dev-story
- **What to pass**:
  - Story file path
  - Previous error report
  - User's fix description
  - Files user modified
- **Why**: DEV needs to know what was attempted and what user fixed

#### File Path Extraction Pattern

**Standard extraction logic**:

```
1. Agent report includes:
   "Files Modified:
   - docs/stories/story-1.1.md (created)
   - docs/stories/story-context-1.1.xml (created)
   - docs/sprint-status.yaml (updated)"

2. Orchestrator extracts:
   story_file = "docs/stories/story-1.1.md"
   context_xml = "docs/stories/story-context-1.1.xml"
   status_file = "docs/sprint-status.yaml"

3. Orchestrator validates:
   for file_path in [story_file, context_xml, status_file]:
       Read(file_path)  # Verify exists
       if error:
           HALT and report "Agent reported creating {file_path} but file not found"

4. Orchestrator stores paths:
   Store in memory for next agent launch (not in workflow status file)

5. Orchestrator passes to next agent:
   Include paths in Task tool prompt under "CONTEXT:" section
```

#### Dependency Validation

Before launching an agent, validate all dependencies exist. This prevents agents from failing due to missing files or invalid state.

**Core Validation Functions**

```python
def validate_file_exists(file_path: str, file_type: str) -> dict:
    """Validate file exists and is readable"""
    try:
        # Use Read tool to verify file exists
        content = Read(file_path)
        return {
            'exists': True,
            'path': file_path,
            'type': file_type,
            'size': len(content)
        }
    except FileNotFoundError:
        return {
            'exists': False,
            'path': file_path,
            'type': file_type,
            'error': f'{file_type} not found'
        }

def validate_xml_file(file_path: str) -> dict:
    """Validate XML file exists and is well-formed"""
    validation = validate_file_exists(file_path, 'Story Context XML')

    if not validation['exists']:
        return validation

    # Additional XML validation
    content = Read(file_path)
    try:
        # Check for basic XML structure
        if not content.strip().startswith('<?xml') and not content.strip().startswith('<story-context'):
            return {
                'exists': True,
                'path': file_path,
                'type': 'Story Context XML',
                'valid_xml': False,
                'error': 'File is not valid XML (missing XML declaration or root element)'
            }

        # Check for required sections
        required_sections = ['<patterns>', '<tech-stack>', '<constraints>']
        missing_sections = [s for s in required_sections if s not in content]

        if missing_sections:
            return {
                'exists': True,
                'path': file_path,
                'type': 'Story Context XML',
                'valid_xml': True,
                'complete': False,
                'error': f'Missing required sections: {", ".join(missing_sections)}'
            }

        return {
            'exists': True,
            'path': file_path,
            'type': 'Story Context XML',
            'valid_xml': True,
            'complete': True
        }
    except Exception as e:
        return {
            'exists': True,
            'path': file_path,
            'type': 'Story Context XML',
            'valid_xml': False,
            'error': f'XML parsing error: {str(e)}'
        }

def validate_story_state(story_file: str, expected_status: str) -> dict:
    """Validate story file exists and has expected status"""
    validation = validate_file_exists(story_file, 'Story File')

    if not validation['exists']:
        return validation

    # Read story frontmatter
    content = Read(story_file)
    lines = content.split('\n')

    # Extract status from frontmatter (YAML between --- markers)
    in_frontmatter = False
    status = None

    for line in lines:
        if line.strip() == '---':
            in_frontmatter = not in_frontmatter
            continue

        if in_frontmatter and line.startswith('Status:'):
            status = line.split(':', 1)[1].strip().strip('"')
            break

    if status != expected_status:
        return {
            'exists': True,
            'path': story_file,
            'type': 'Story File',
            'valid_status': False,
            'current_status': status,
            'expected_status': expected_status,
            'error': f'Story status is "{status}", expected "{expected_status}"'
        }

    return {
        'exists': True,
        'path': story_file,
        'type': 'Story File',
        'valid_status': True,
        'current_status': status
    }
```

**Pre-Launch Validation: dev-story Workflow**

```python
def validate_dev_story_dependencies(story_id: str) -> dict:
    """Validate all dependencies before launching dev-story workflow"""
    story_file = f'docs/stories/{story_id}-*.md'  # Extract from workflow status
    context_xml = f'docs/stories/story-context-{story_id}.xml'
    workflow_status = 'docs/bmm-workflow-status.md'

    validations = []

    # 1. Validate story file exists
    print(f"Validating story file: {story_file}")
    story_validation = validate_file_exists(story_file, 'Story File')
    validations.append(story_validation)

    if not story_validation['exists']:
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f'Story file not found: {story_file}',
            'recovery_action': 'Run create-story workflow first'
        }

    # 2. Validate story status is "Ready" (approved by user)
    print(f"Validating story status...")
    status_validation = validate_story_state(story_file, 'Ready')
    validations.append(status_validation)

    if not status_validation.get('valid_status'):
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f"Story not ready: {status_validation.get('error')}",
            'recovery_action': 'Run story-ready workflow first or get user approval'
        }

    # 3. Validate Context XML exists
    print(f"Validating Context XML: {context_xml}")
    xml_validation = validate_xml_file(context_xml)
    validations.append(xml_validation)

    if not xml_validation['exists']:
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f'Context XML not found: {context_xml}',
            'recovery_action': 'Run story-context workflow first'
        }

    if not xml_validation.get('valid_xml') or not xml_validation.get('complete'):
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f"Context XML invalid: {xml_validation.get('error')}",
            'recovery_action': 'Re-run story-context workflow to regenerate XML'
        }

    # 4. Validate workflow status file exists
    print(f"Validating workflow status: {workflow_status}")
    status_file_validation = validate_file_exists(workflow_status, 'Workflow Status')
    validations.append(status_file_validation)

    if not status_file_validation['exists']:
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': 'Workflow status file not found',
            'recovery_action': 'Workflow status file is corrupted or missing - halt orchestration'
        }

    # 5. Verify story is in "IN PROGRESS" state in workflow status
    print(f"Verifying story is IN PROGRESS...")
    workflow_content = Read(workflow_status)
    if f'{story_id}' not in workflow_content or 'IN PROGRESS' not in workflow_content:
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f'Story {story_id} not found in IN PROGRESS section',
            'recovery_action': 'Run story-ready workflow to advance story to IN PROGRESS'
        }

    # All validations passed
    return {
        'valid': True,
        'validations': validations,
        'message': f'All dependencies validated for {story_id}',
        'story_file': story_file,
        'context_xml': context_xml
    }

# Usage before launching DEV agent:
validation_result = validate_dev_story_dependencies('story-1.1')

if not validation_result['valid']:
    print(f"❌ Cannot launch dev-story workflow")
    print(f"Blocking error: {validation_result['blocking_error']}")
    print(f"Recovery action: {validation_result['recovery_action']}")
    HALT_ORCHESTRATION()
else:
    print(f"✅ All dependencies validated")
    print(f"Story file: {validation_result['story_file']}")
    print(f"Context XML: {validation_result['context_xml']}")
    # Proceed to launch DEV agent
    launch_dev_agent('dev-story', validation_result['story_file'], validation_result['context_xml'])
```

**Pre-Launch Validation: story-done Workflow**

```python
def validate_story_done_dependencies(story_id: str, dev_report: dict) -> dict:
    """Validate all DoD criteria before launching story-done workflow"""
    validations = []

    # 1. Validate tests are 100% passing
    print("Validating test results...")
    test_results = dev_report.get('test_results', {})

    if test_results.get('overall_status') != 'PASSING':
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f"Tests not passing: {test_results.get('percentage', 0)}%",
            'recovery_action': 'Fix failing tests and re-run dev-story'
        }

    if test_results.get('percentage') != 100:
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f"Tests not 100% passing: {test_results['percentage']}%",
            'recovery_action': 'All tests must pass 100% before marking done'
        }

    validations.append({
        'type': 'Test Results',
        'status': 'PASSING',
        'percentage': 100
    })

    # 2. Validate story implementation complete (all ACs satisfied)
    print("Validating acceptance criteria...")
    story_file = dev_report.get('story_file')
    content = Read(story_file)

    # Count ACs and check if all marked as satisfied
    ac_pattern = r'AC-\d{3}:'
    import re
    acs = re.findall(ac_pattern, content)
    satisfied_pattern = r'AC-\d{3}:.*✅'
    satisfied_acs = re.findall(satisfied_pattern, content)

    if len(acs) != len(satisfied_acs):
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': f'Not all ACs satisfied: {len(satisfied_acs)}/{len(acs)}',
            'recovery_action': 'Complete remaining acceptance criteria'
        }

    validations.append({
        'type': 'Acceptance Criteria',
        'total': len(acs),
        'satisfied': len(satisfied_acs),
        'complete': True
    })

    # 3. Validate no blockers in DEV report
    print("Checking for blockers...")
    if 'blockers' in dev_report or 'BLOCKED' in dev_report.get('status', ''):
        return {
            'valid': False,
            'validations': validations,
            'blocking_error': 'Story has blockers',
            'recovery_action': 'Resolve blockers before marking done'
        }

    # 4. Wait for user DoD confirmation
    print("Waiting for user DoD verification...")
    # This is a gate - orchestrator must HALT here and wait

    return {
        'valid': True,
        'validations': validations,
        'message': f'All DoD criteria met for {story_id}',
        'awaiting_user_confirmation': True
    }

# Usage before launching story-done:
validation_result = validate_story_done_dependencies('story-1.1', parsed_dev_report)

if not validation_result['valid']:
    print(f"❌ Cannot mark story as done")
    print(f"Blocking error: {validation_result['blocking_error']}")
    print(f"Recovery action: {validation_result['recovery_action']}")
    HALT_ORCHESTRATION()
elif validation_result.get('awaiting_user_confirmation'):
    print(f"✅ All DoD criteria met:")
    for v in validation_result['validations']:
        print(f"  - {v['type']}: ✅")
    print("\nWaiting for user verification...")
    print("Type 'done' to confirm and advance story to DONE")
    WAIT_FOR_USER()
```

**Complete Pre-Launch Validation Flow**

```python
def launch_agent_with_validation(workflow: str, story_id: str, context: dict = None):
    """Launch agent only after validating all dependencies"""

    print(f"\n🔍 Pre-launch validation for {workflow} workflow...")

    # Select validation function based on workflow
    if workflow == 'dev-story':
        validation = validate_dev_story_dependencies(story_id)
    elif workflow == 'story-done':
        validation = validate_story_done_dependencies(story_id, context['dev_report'])
    elif workflow == 'story-context':
        # Minimal validation - just check story file exists
        story_file = f'docs/stories/{story_id}-*.md'
        validation = validate_file_exists(story_file, 'Story File')
    else:
        # No specific validation for this workflow
        validation = {'valid': True}

    # Check validation result
    if not validation.get('valid'):
        print(f"\n❌ Pre-launch validation FAILED")
        print(f"Workflow: {workflow}")
        print(f"Story: {story_id}")
        print(f"\nBlocking Error:")
        print(f"  {validation['blocking_error']}")
        print(f"\nRecovery Action:")
        print(f"  {validation['recovery_action']}")
        print("\nOrchestration HALTED")
        return {'status': 'VALIDATION_FAILED', 'validation': validation}

    # Validation passed - proceed with agent launch
    print(f"\n✅ Pre-launch validation PASSED")
    print(f"All dependencies validated for {workflow} workflow")

    if validation.get('awaiting_user_confirmation'):
        print("\nWaiting for user confirmation...")
        return {'status': 'AWAITING_USER', 'validation': validation}

    # Extract validated file paths from validation result
    story_file = validation.get('story_file')
    context_xml = validation.get('context_xml')

    # Launch agent with validated paths
    print(f"\n🚀 Launching {workflow} workflow...")
    agent_report = launch_agent(workflow, story_id, {
        'story_file': story_file,
        'context_xml': context_xml
    })

    return {'status': 'SUCCESS', 'report': agent_report}
```

**Validation Checklist Summary**

Before launching **dev-story**:
- ✅ Story file exists (`docs/stories/story-X.Y-*.md`)
- ✅ Story status is "Ready" (approved by user)
- ✅ Context XML exists (`docs/stories/story-context-X.Y.xml`)
- ✅ Context XML is valid and complete
- ✅ Workflow status file exists
- ✅ Story is in "IN PROGRESS" state

Before launching **story-done**:
- ✅ All tests passing (100%)
- ✅ All ACs satisfied (all marked with ✅)
- ✅ No blockers in DEV report
- ✅ DEV report status is "SUCCESS"
- ✅ User confirmed DoD (GATE - must wait)

If ANY validation fails:
- ❌ HALT orchestration immediately
- 📋 Report specific validation failure to user
- 🔧 Offer recovery action (run missing workflow, fix issue, etc.)
- ⏸️ Do NOT proceed until validation passes

#### Example: Full Context Passing Chain

**Scenario**: Orchestrating story 1.1 from TODO to DONE

```
Step 1: SM creates story (create-story workflow)
└─ Orchestrator receives: story file path
└─ Orchestrator validates: file exists
└─ Orchestrator reports to user: "Story drafted, review and approve"
└─ Orchestrator WAITS for user approval

Step 2: User approves ("approved")
└─ Orchestrator launches SM (story-ready workflow)
└─ Orchestrator receives: story advanced to IN PROGRESS
└─ Orchestrator continues (no user wait)

Step 3: SM creates context (story-context workflow)
└─ Orchestrator receives: context XML path
└─ Orchestrator validates: XML file exists
└─ Orchestrator stores: story_file, context_xml

Step 4: DEV implements story (dev-story workflow)
└─ Orchestrator launches DEV with CONTEXT:
    - Story file: {story_file}
    - Context XML: {context_xml}
└─ DEV reads both files, implements story
└─ Orchestrator receives: test results, files modified
└─ Orchestrator reports to user: "Implementation complete, verify DoD"
└─ Orchestrator WAITS for user verification

Step 5: User verifies DoD ("done")
└─ Orchestrator launches DEV (story-done workflow)
└─ Orchestrator receives: story marked DONE, queue advanced
└─ Orchestrator loops to next story
```

**Key Takeaway**: Orchestrator acts as a stateless relay, extracting paths from reports and passing explicitly to next agent. No story details are stored in orchestrator memory beyond file paths.

### 5. Implementation Phase Orchestration

The Implementation Phase (Phase 4) follows a strict state machine workflow:

```
BACKLOG → TODO → IN PROGRESS → DONE
```

**State Transitions**:

| Current State      | Agent | Workflow          | Next State         | Approval Required |
|--------------------|-------|-------------------|-------------------|-------------------|
| BACKLOG → TODO     | Auto  | N/A               | TODO              | No                |
| TODO (draft)       | SM    | create-story      | TODO (drafted)    | No                |
| TODO → IN PROGRESS | SM    | story-ready       | IN PROGRESS       | **Yes** (user)    |
| IN PROGRESS        | SM    | story-context     | IN PROGRESS       | No                |
| IN PROGRESS        | DEV   | dev-story         | IN PROGRESS       | No                |
| IN PROGRESS → DONE | DEV   | story-done        | DONE              | **Yes** (user)    |

**Orchestration Loop**:

```
LOOP until BACKLOG is empty:
    1. CHECK workflow status (read bmm-workflow-status.md)
    2. IDENTIFY current state and next story

    3. IF state == TODO and story not drafted:
        → Launch SM agent with create-story workflow
        → Wait for completion
        → Report to user: "Story drafted, ready for your review"
        → STOP and wait for user approval

    4. IF user approves drafted story:
        → Launch SM agent with story-ready workflow
        → Advances: TODO → IN PROGRESS, BACKLOG → TODO
        → Continue to step 5

    5. IF state == IN PROGRESS and no context XML:
        → Launch SM agent with story-context workflow
        → Generates expertise injection XML
        → Continue to step 6

    6. IF state == IN PROGRESS:
        → Launch DEV agent with dev-story workflow
        → Implements story following all ACs and tasks
        → Runs all tests (must be 100% passing)
        → Reports completion to user
        → STOP and wait for user DoD verification

    7. IF user confirms DoD complete:
        → Launch DEV agent with story-done workflow
        → Advances: IN PROGRESS → DONE, TODO → IN PROGRESS, BACKLOG → TODO
        → Loop to step 1

    8. IF BACKLOG empty:
        → Report epic completion
        → Recommend retrospective workflow
        → EXIT orchestration
```

### 4. Human-in-the-Loop Approval Gates

Two critical approval gates require human verification:

**Gate 1: Story Approval (after create-story)**
- SM drafts story with Status="Draft"
- Orchestrator reports: "Story [ID] has been drafted. Please review and approve."
- User reviews story file
- User responds: "approved" or requests changes
- Only then SM runs story-ready workflow

**Gate 2: Definition of Done (after dev-story)**
- DEV implements story, runs all tests (100% passing)
- Orchestrator reports: "Story [ID] implementation complete. All tests passing. Please verify DoD."
- User verifies implementation
- User responds: "done" or reports issues
- Only then DEV runs story-done workflow

**Never skip these gates** - they maintain quality and alignment.

### 5. Context Efficiency

**Orchestrator responsibilities** (minimal context):
- Read workflow status file
- Determine next action
- Launch appropriate agent via Task tool with correct subagent_type
- Display agent reports to user
- Handle approval gates

**Agent responsibilities** (focused context):
- Execute workflows using built-in BMAD knowledge
- Access project documentation as needed
- Return final structured report
- Operate independently with isolated context

**What NOT to do**:
- ❌ Load all BMAD documentation in orchestrator
- ❌ Execute workflows directly in orchestrator
- ❌ Maintain story details in orchestrator context
- ❌ Keep multiple agents active simultaneously
- ❌ Use generic agents - always use specialized subagent_types

### 6. Error Handling and Recovery

**If agent reports failure**:
1. Read agent's error report
2. Determine if issue is blocking
3. Report to user with clear explanation
4. Offer recovery options:
   - Re-run workflow with corrections
   - Launch correct-course workflow (SM agent)
   - Skip story and continue (if appropriate)
   - Halt orchestration for manual intervention

**Common failure scenarios**:
- Story missing required fields → Re-run create-story
- Tests failing → Re-run dev-story with fixes
- Context XML missing → Run story-context
- Workflow status file corrupt → Halt and report

#### Error Recovery Loop

When an agent reports failure, the orchestrator enters a recovery loop with retry limits to prevent infinite loops.

**Recovery Loop Logic**:

```
1. Agent reports failure (e.g., "Tests failing: 3/5 passing (60%)")
2. Orchestrator increments retry_count for current story
3. Orchestrator checks retry_count <= MAX_RETRIES (default: 3)
4. If retry_count > MAX_RETRIES:
   → HALT orchestration
   → Report to user: "Story [ID] failed after 3 retry attempts. Manual intervention required."
   → Offer options: (a) Skip story, (b) Halt epic, (c) Manual fix and reset retry count
5. If retry_count <= MAX_RETRIES:
   → Report to user with recovery options
   → WAIT for user action
6. User chooses recovery action (e.g., "Fix mock and retry")
7. User performs manual fix
8. User signals ready: "retry" or "re-run"
9. Orchestrator re-launches agent with RETRY CONTEXT
10. Loop back to step 1
```

**Retry Context Passing**:

When re-launching an agent after error, include retry context in prompt:

```
Task tool with subagent_type="agent-skill-dev" and prompt:
"You are Amelia, the BMAD Developer agent.

Execute the *develop workflow for story-1.1 (RETRY ATTEMPT 2/3).

PREVIOUS ERROR (ATTEMPT 1):
Tests failing: authentication service not mocked
- 3/5 tests passing (60%)
- Missing mock for AuthService.login()

USER ACTION:
Fixed AuthService.login() mock in apps/api/src/modules/auth/tests/auth.service.mock.ts

YOUR TASK:
Re-run *develop workflow. Focus on:
1. Verify AuthService mock is now correct
2. Run ALL tests again - must be 100% passing
3. If tests still fail, identify specific failures and report
4. Do NOT proceed if tests are not 100% passing

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Test results (X/X passing, Y%)
- Specific test failures if any
- Files modified during this retry
- Next Action"
```

**Retry Limit Enforcement**:

Track retry attempts per story in orchestrator memory (not persisted):

```python
# Initialize retry tracker at orchestration start
retry_tracker = {}
MAX_RETRIES = 3

def track_agent_failure(story_id: str) -> dict:
    """Increment retry count for story and check limits"""
    if story_id not in retry_tracker:
        retry_tracker[story_id] = 0

    retry_tracker[story_id] += 1

    return {
        'story_id': story_id,
        'retry_count': retry_tracker[story_id],
        'max_retries': MAX_RETRIES,
        'limit_exceeded': retry_tracker[story_id] > MAX_RETRIES,
        'retries_remaining': MAX_RETRIES - retry_tracker[story_id]
    }

def track_agent_success(story_id: str):
    """Reset retry count after successful execution"""
    if story_id in retry_tracker:
        retry_tracker[story_id] = 0

def get_retry_status(story_id: str) -> dict:
    """Get current retry status for a story"""
    count = retry_tracker.get(story_id, 0)
    return {
        'story_id': story_id,
        'retry_count': count,
        'max_retries': MAX_RETRIES,
        'limit_exceeded': count > MAX_RETRIES,
        'retries_remaining': max(0, MAX_RETRIES - count)
    }

# Example usage in orchestration loop:

# Agent execution fails
agent_report = launch_agent('dev-story', 'story-1.1')
if agent_report['status'] == 'FAILED':
    # Track failure
    retry_status = track_agent_failure('story-1.1')

    if retry_status['limit_exceeded']:
        # Max retries exceeded - HALT
        print(f"❌ Story {retry_status['story_id']} failed after {retry_status['retry_count']} attempts")
        print(f"MAX_RETRIES ({MAX_RETRIES}) exceeded")
        print("\nOptions:")
        print("1. Skip story (will remain IN PROGRESS)")
        print("2. Halt epic orchestration for debugging")
        print("3. Reset retry count and try again (use with caution)")
        HALT_ORCHESTRATION()
    else:
        # Still have retries remaining
        print(f"⚠️  Story {retry_status['story_id']} failed")
        print(f"Retry attempt {retry_status['retry_count']}/{retry_status['max_retries']}")
        print(f"({retry_status['retries_remaining']} retries remaining)")
        print("\nError:", agent_report['error'])
        print("\nRecovery options:")
        print("1. Fix issue and type 'retry'")
        print("2. Launch correct-course workflow")
        print("3. Skip story")
        WAIT_FOR_USER_RECOVERY()

# Agent execution succeeds
elif agent_report['status'] == 'SUCCESS':
    # Reset retry count
    track_agent_success('story-1.1')
    print(f"✅ Story story-1.1 completed successfully")

    # Check if this was a retry
    retry_status = get_retry_status('story-1.1')
    if retry_status['retry_count'] > 0:
        print(f"(Succeeded after {retry_status['retry_count']} retry attempts)")

    # Continue orchestration
    CONTINUE_TO_NEXT_WORKFLOW()
```

**Retry Tracker Persistence (Optional)**

For long-running orchestrations, consider persisting retry counts:

```python
import json

def save_retry_tracker():
    """Save retry tracker to disk"""
    with open('docs/.orchestrator-state.json', 'w') as f:
        json.dump({
            'retry_tracker': retry_tracker,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)

def load_retry_tracker():
    """Load retry tracker from disk"""
    global retry_tracker
    try:
        with open('docs/.orchestrator-state.json', 'r') as f:
            data = json.load(f)
            retry_tracker = data.get('retry_tracker', {})
            print(f"Loaded retry tracker: {len(retry_tracker)} stories tracked")
    except FileNotFoundError:
        retry_tracker = {}
        print("No existing retry tracker found, starting fresh")

# At orchestration start:
load_retry_tracker()

# After each agent execution:
save_retry_tracker()

# After epic completion:
os.remove('docs/.orchestrator-state.json')  # Clean up
```

**Retry Counter in Agent Prompt**

When relaunching after failure, include retry context in prompt:

```python
def launch_agent_with_retry_context(workflow: str, story_id: str, previous_error: str):
    """Launch agent with retry counter and previous error"""
    retry_status = get_retry_status(story_id)

    prompt = f"""You are Amelia, the BMAD Developer agent.

Execute the {workflow} workflow for {story_id} (RETRY ATTEMPT {retry_status['retry_count']}/{retry_status['max_retries']}).

**RETRY CONTEXT:**
This is retry attempt {retry_status['retry_count']} of {retry_status['max_retries']}.
{retry_status['retries_remaining']} retries remaining after this attempt.

**PREVIOUS ERROR (Attempt {retry_status['retry_count'] - 1}):**
{previous_error}

**USER ACTION:**
[User's fix description - inject here]

**YOUR TASK:**
Address the previous error and complete the workflow.
If you encounter the same error, provide detailed diagnostics.

CRITICAL: This is attempt {retry_status['retry_count']}/{retry_status['max_retries']}.
If this fails, only {retry_status['retries_remaining'] - 1} retries will remain.

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- If FAILED: Detailed error with diagnostics
- Test results (must be 100% passing)
- Next Action
"""

    # Launch using Task tool with agent-skill-dev subagent type
    return launch_task_agent('agent-skill-dev', prompt)
```

**Complete Retry Flow Example**

```python
def orchestrate_story_with_retry(story_id: str):
    """Orchestrate single story with retry logic"""
    MAX_RETRIES = 3
    story_complete = False

    while not story_complete:
        # Launch DEV agent
        report = launch_agent('dev-story', story_id)
        parsed = parse_agent_report(report)

        if parsed['status'] == 'SUCCESS':
            # Success - reset retry count
            track_agent_success(story_id)
            print(f"✅ {story_id} completed")
            story_complete = True

        elif parsed['status'] == 'FAILED':
            # Failure - track and check limit
            retry_status = track_agent_failure(story_id)

            if retry_status['limit_exceeded']:
                print(f"❌ {story_id} failed after {MAX_RETRIES} attempts")
                print("Manual intervention required")
                return 'MAX_RETRIES_EXCEEDED'

            # Offer recovery
            print(f"⚠️  Attempt {retry_status['retry_count']}/{MAX_RETRIES} failed")
            print(f"Error: {parsed['error']}")
            print(f"\nRetries remaining: {retry_status['retries_remaining']}")
            print("\nOptions:")
            print("1. Fix issue and retry")
            print("2. Launch correct-course")
            print("3. Skip story")

            user_choice = WAIT_FOR_USER_INPUT()

            if user_choice == 'retry':
                print(f"Retrying {story_id} (Attempt {retry_status['retry_count'] + 1}/{MAX_RETRIES})...")
                continue  # Loop to retry
            elif user_choice == 'correct-course':
                launch_agent('correct-course', story_id)
                # Don't increment retry count for correct-course
                continue
            elif user_choice == 'skip':
                print(f"Skipping {story_id} (will remain IN PROGRESS)")
                return 'SKIPPED'

    return 'SUCCESS'
```

**Key Implementation Details**:
- Retry tracker is a dict mapping story_id → retry_count
- Increment on FAILURE, reset to 0 on SUCCESS
- MAX_RETRIES = 3 (configurable)
- Include retry context in agent prompts (attempt X/Y)
- Persist to disk for long orchestrations (optional)
- Clear retry count when story advances to DONE

**Example: Recovery Loop Execution**

**Scenario**: DEV agent fails due to missing mock

```
Attempt 1:
└─ DEV agent fails: "Tests failing: AuthService not mocked (60%)"
└─ Orchestrator: retry_count = 1
└─ Orchestrator reports: "Story 1.1 failed (Attempt 1/3). Tests failing. Options:
   1. Fix mock and retry
   2. Launch correct-course to adjust tests
   3. Skip story for now"
└─ User: "Fix mock and retry"
└─ User edits: apps/api/src/modules/auth/tests/auth.service.mock.ts
└─ User: "retry"

Attempt 2:
└─ Orchestrator relaunches DEV with retry context (Attempt 2/3)
└─ DEV agent fails again: "Tests failing: Mock returns wrong type (80%)"
└─ Orchestrator: retry_count = 2
└─ Orchestrator reports: "Story 1.1 failed (Attempt 2/3). Mock returns wrong type. Options:
   1. Fix type and retry (1 retry remaining)
   2. Launch correct-course to adjust story
   3. Skip story"
└─ User: "Fix type and retry"
└─ User edits mock return type
└─ User: "retry"

Attempt 3:
└─ Orchestrator relaunches DEV with retry context (Attempt 3/3 - FINAL)
└─ DEV agent succeeds: "Tests: 5/5 passing (100%)"
└─ Orchestrator: retry_count = 0 (reset)
└─ Orchestrator reports: "Story 1.1 implementation complete after 3 attempts. Verify DoD."
└─ Continue to DoD verification gate
```

**Scenario**: Max retries exceeded

```
Attempt 3 (FINAL):
└─ DEV agent fails: "Tests still failing (70%)"
└─ Orchestrator: retry_count = 3
└─ Orchestrator: retry_count > MAX_RETRIES
└─ Orchestrator HALTS: "Story 1.1 failed after 3 retry attempts. Manual intervention required.

   Options:
   1. Skip story 1.1 and continue to next story (story will remain IN PROGRESS)
   2. Halt epic orchestration for thorough debugging
   3. Reset retry count and try again (use with caution)

   Recommendation: Option 2 (Halt) - 3 failures indicate deeper issue requiring investigation."
└─ User: "Halt epic"
└─ Orchestrator exits orchestration loop
```

**Retry Count Reset**:

Retry count resets in these scenarios:
- Agent reports SUCCESS (tests 100% passing)
- User chooses "Skip story" (story remains IN PROGRESS, retry count cleared for next story)
- User explicitly requests "Reset retry count" (use with caution)
- Story advances to DONE (via story-done workflow)

**Best Practices**:
- Default MAX_RETRIES = 3 (prevents infinite loops)
- Always include retry context in re-launch prompt
- Track retry count per story, not globally
- Reset count on success or skip
- Offer "Halt" option when max retries reached
- Include attempt number in agent prompt (e.g., "RETRY ATTEMPT 2/3")

### 7. Progress Tracking

**After each agent execution**:
1. Re-read workflow status file
2. Count stories in each state:
   - BACKLOG: [count] stories remaining
   - TODO: [count] story
   - IN PROGRESS: [count] story
   - DONE: [count] stories completed
3. Calculate progress: (DONE / TOTAL) * 100%
4. Report to user: "Progress: X of Y stories complete (Z%)"

**Visual progress indicator**:
```
Epic Progress: ██████████░░░░░░░░░░ 50% (5/10 stories)
BACKLOG: 3 | TODO: 1 | IN PROGRESS: 1 | DONE: 5
```

## Workflow Decision Tree

```
User Request: "Develop the epic"
    ↓
┌──────────────────────────────┐
│ 1. Load workflow status file │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│ 2. Verify Phase 4            │
│    (Implementation)           │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│ 3. Check BACKLOG not empty   │
└──────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ 4. Start Orchestration Loop            │
│    ┌────────────────────────────────┐  │
│    │ A. Read current state          │  │
│    └────────────────────────────────┘  │
│    ┌────────────────────────────────┐  │
│    │ B. Launch appropriate agent    │  │
│    │    - SM for story management   │  │
│    │    - DEV for implementation    │  │
│    └────────────────────────────────┘  │
│    ┌────────────────────────────────┐  │
│    │ C. Wait for agent completion   │  │
│    └────────────────────────────────┘  │
│    ┌────────────────────────────────┐  │
│    │ D. Handle approval gates       │  │
│    │    - Story approval            │  │
│    │    - DoD verification          │  │
│    └────────────────────────────────┘  │
│    ┌────────────────────────────────┐  │
│    │ E. Report progress to user     │  │
│    └────────────────────────────────┘  │
│    ┌────────────────────────────────┐  │
│    │ F. Check if BACKLOG empty      │  │
│    │    No  → Loop to A             │  │
│    │    Yes → Epic complete         │  │
│    └────────────────────────────────┘  │
└────────────────────────────────────────┘
    ↓
┌──────────────────────────────┐
│ 5. Report epic completion    │
│    Recommend retrospective   │
└──────────────────────────────┘
```

## Examples

### Example 1: Starting Epic Development

**User**: "Develop Epic 1 from start to finish"

**Orchestrator**:
1. Loads `docs/bmm-workflow-status.md`
2. Verifies Phase 4, finds Epic 1 stories in BACKLOG
3. Sees first story in TODO, not yet drafted
4. Reports: "Epic 1 has 8 stories. Starting with story 1.1..."
5. Launches SM agent via Task tool (subagent_type="scrum-master-bmad"): "Execute *create-story workflow"
6. SM agent completes, reports story drafted
7. Reports to user: "Story 1.1 'User Authentication' has been drafted. Please review and approve."
8. **WAITS for user approval**

**User**: "Approved"

**Orchestrator**:
9. Launches SM agent via Task tool (subagent_type="scrum-master-bmad"): "Execute *story-ready workflow"
10. SM agent advances story to IN PROGRESS
11. Launches SM agent via Task tool (subagent_type="scrum-master-bmad"): "Execute *story-context workflow"
12. SM agent generates context XML
13. Launches DEV agent via Task tool (subagent_type="agent-skill-dev"): "Execute *develop workflow"
14. DEV agent implements, runs tests (100% passing)
15. Reports to user: "Story 1.1 implementation complete. All tests passing. Please verify DoD."
16. **WAITS for user verification**

**User**: "DoD verified, looks good"

**Orchestrator**:
17. Launches DEV agent via Task tool (subagent_type="agent-skill-dev"): "Execute *story-done workflow"
18. DEV agent marks story done, advances queue
19. Reports progress: "Story 1.1 complete. Progress: 1/8 stories (12.5%)"
20. Loops to next story...

### Example 2: Resuming Interrupted Epic

**User**: "Continue epic development"

**Orchestrator**:
1. Loads `docs/bmm-workflow-status.md`
2. Finds story 1.3 in IN PROGRESS (partially implemented)
3. Reports: "Resuming Epic 1. Story 1.3 is in progress. Relaunching DEV agent..."
4. Launches DEV agent via Task tool (subagent_type="agent-skill-dev"): "Execute *develop workflow for story 1.3"
5. DEV agent continues implementation from checkpoint
6. Completes remaining ACs and tasks
7. Reports to user for DoD verification
8. Continues orchestration loop...

### Example 3: Error Recovery

**User**: "Develop the epic"

**Orchestrator**:
1. Launches DEV agent via Task tool (subagent_type="agent-skill-dev") for story 2.1
2. DEV agent reports: "Tests failing: authentication service not mocked"
3. Reports to user: "Story 2.1 blocked: tests failing due to missing mock. Options:
   a) Fix mock and re-run *develop
   b) Launch *correct-course to adjust story
   c) Skip for now and continue"

**User**: "Fix the mock and re-run"

**Orchestrator**:
4. Launches DEV agent via Task tool (subagent_type="agent-skill-dev"): "Execute *develop workflow with retry context"
5. DEV agent fixes mock, re-runs tests (100% passing)
6. Reports success, continues orchestration...

## Resources

### references/

**bmad-workflow-states.md**: Detailed reference for the 4-state story machine (BACKLOG, TODO, IN PROGRESS, DONE) with validation rules and state transition logic.

**bmad-agent-skills-mapping.md**: Maps each workflow to the appropriate agent and skill to load, ensuring correct delegation.

### assets/

**orchestration-templates/**: Template prompts for launching agents with different workflows, ensuring consistent agent activation.

## Best Practices

1. **Always read workflow status first** - Never assume state, always verify
2. **Respect approval gates** - Never skip story approval or DoD verification
3. **Launch agents serially** - One agent at a time, wait for completion
4. **Keep orchestrator context minimal** - Delegate all heavy work to agents
5. **Report progress frequently** - Users need visibility into orchestration
6. **Handle errors gracefully** - Offer clear recovery options
7. **Trust the state machine** - Follow state transitions exactly as designed
8. **Load skills in agent context** - Skills belong to agents, not orchestrator
9. **Never hallucinate agent output** - Report exactly what agents return
10. **Verify Phase 4** - Only orchestrate Implementation phase workflows

## Notes

- This orchestrator is specifically for **Phase 4 (Implementation)** workflows
- For Phase 1-3, users should run workflows directly via agent commands
- Orchestrator does NOT make architectural or design decisions
- Orchestrator does NOT modify story content or requirements
- All technical decisions happen within agent contexts
- Orchestrator is a **coordinator**, not a **participant**
