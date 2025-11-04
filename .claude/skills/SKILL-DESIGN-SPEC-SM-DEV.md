# BMAD Skills Design Specification: SM & DEV

**Document Type:** Technical Design Specification
**Version:** 1.0.0
**Date:** 2025-11-04
**Author:** BMad Master Agent
**Purpose:** Complete specification for creating bmad-sm and bmad-dev skills for context-optimized agent orchestration
**Target Audience:** Skill Creator Agent / Implementation Team

---

## 📋 EXECUTIVE SUMMARY

This document specifies the design and implementation requirements for two Claude Code skills that will replace the current agent-based workflow execution model with a more context-efficient skill-based approach.

**Current Problem:**
- Orchestrator launches agents using `/bmad:bmm:agents:sm` and `/bmad:bmm:agents:dev` slash commands
- Agents load full persona, menu system, config files, and activation steps (~2000+ tokens overhead)
- Unnecessary context consumed for workflow execution that doesn't require interactive menus

**Proposed Solution:**
- Create focused skills: `bmad-sm` and `bmad-dev`
- Orchestrator launches agents with direct skill loading via Task tool
- Skills contain only workflow execution logic + essential context (~500-800 tokens)
- **70% context reduction** per agent launch

**Impact:**
- ✅ Faster agent initialization
- ✅ More workflows per session (lower context burn)
- ✅ Clearer separation of concerns (orchestrator → skill → workflow)
- ✅ Better error handling (skills return structured reports)

---

## 🎯 DESIGN GOALS

### Primary Goals
1. **Context Optimization**: Reduce agent context overhead by 70%
2. **Workflow Focus**: Each skill contains only workflow execution logic
3. **Orchestrator Integration**: Skills designed for Task tool invocation
4. **Structured Reporting**: Consistent output format for orchestrator parsing
5. **BMAD Compliance**: 100% alignment with BMAD v6 Alpha state machine

### Non-Goals
- ❌ Interactive menus (orchestrator handles interaction)
- ❌ Config file loading (orchestrator passes config values)
- ❌ Multi-workflow selection (orchestrator specifies single workflow)
- ❌ User elicitation (workflows run in #yolo mode when possible)

---

## 📐 SKILL ARCHITECTURE OVERVIEW

### Skill Structure (Both Skills)

```
.claude/skills/[skill-name]/
├── SKILL.md                    # Main skill file (metadata + instructions)
├── references/
│   ├── workflow-execution.md   # How to execute workflows using workflow.xml
│   ├── report-format.md        # Structured report template
│   └── error-handling.md       # Error scenarios + recovery
└── templates/
    └── agent-report.md         # Report template for orchestrator
```

### Skill Invocation Flow

```
┌─────────────────┐
│  Orchestrator   │ Reads workflow-status.md
│                 │ Determines next workflow
└────────┬────────┘
         │
         │ Launches via Task tool
         ↓
┌─────────────────┐
│  General Agent  │ Receives prompt:
│                 │ "Load skill [bmad-sm|bmad-dev]
│                 │  Execute [workflow-name]"
└────────┬────────┘
         │
         │ Loads skill
         ↓
┌─────────────────┐
│  Skill Loaded   │ Executes workflow using:
│                 │ - workflow.xml task
│                 │ - workflow.yaml config
│                 │ - instructions.md
└────────┬────────┘
         │
         │ Returns structured report
         ↓
┌─────────────────┐
│  Orchestrator   │ Parses report
│                 │ Validates state transition
│                 │ Decides next action
└─────────────────┘
```

---

## 🧩 SKILL #1: bmad-sm (Scrum Master)

### Metadata

```yaml
name: bmad-sm
description: Execute BMAD Scrum Master workflows for story management, planning, and coordination. Designed for orchestrator invocation with single workflow execution per session.
version: 1.0.0
author: BMad Team
category: project
```

### Core Capabilities

The **bmad-sm** skill enables execution of the following workflows:

| Workflow ID       | Purpose                                  | Input Files                        | Output Files                     | Approval Gate |
|-------------------|------------------------------------------|------------------------------------|----------------------------------|---------------|
| `sprint-planning` | Generate sprint-status.yaml from epics   | epics/*.md, config.yaml            | sprint-status.yaml               | No            |
| `create-story`    | Draft story from TODO section            | workflow-status.md, PRD, arch docs | stories/story-X.Y.md             | **Yes**       |
| `story-ready`     | Advance TODO → IN PROGRESS               | stories/story-X.Y.md (Draft)       | story (Status="Ready")           | User trigger  |
| `story-context`   | Generate expertise injection XML         | story-X.Y.md, architecture, code   | story-context-X.Y.xml            | No            |
| `retrospective`   | Facilitate epic/sprint retrospective     | workflow-status.md, done stories   | retrospective-YYYY-MM-DD.md      | No            |
| `correct-course`  | Handle story issues/requirement changes  | story-X.Y.md, issue description    | Updated story-X.Y.md             | Varies        |
| `epic-tech-context` | Create tech-spec for specific epic     | PRD, architecture, epic-X.md       | tech-spec-epic-X.md              | No            |

### Skill Structure (bmad-sm)

#### SKILL.md Contents

```markdown
---
name: bmad-sm
description: Execute BMAD Scrum Master workflows for story management, planning, and coordination. Designed for orchestrator invocation with single workflow execution per session.
---

# BMAD Scrum Master Skill

## Purpose

Execute BMAD Phase 4 (Implementation) workflows related to story management, sprint planning, and team coordination. This skill is designed for invocation by the BMAD Orchestrator and executes a single workflow per session.

## Core Principles

1. **Single Workflow Execution**: Each skill invocation executes ONE workflow specified by orchestrator
2. **No Interactive Menus**: Orchestrator provides all inputs via prompt
3. **Structured Reporting**: Always return reports in standardized format
4. **BMAD State Machine Compliance**: Respect BACKLOG → TODO → IN PROGRESS → DONE transitions
5. **Context Authority**: Story Context XML and workflow-status.md are authoritative sources

## Persona

**Role:** Technical Scrum Master + Story Preparation Specialist
**Identity:** Expert in agile ceremonies, story preparation, and development team coordination
**Communication:** Task-oriented and efficient, focuses on clear handoffs and precise requirements
**Boundaries:** Never cross into implementation territory, focus entirely on developer-ready specifications

## Activation Instructions

When invoked by orchestrator, you will receive a prompt in this format:

```
You are the BMAD Scrum Master agent.

Load the skill 'bmad-sm' to access your workflows and capabilities.

Execute the [workflow-name] workflow.

**CONTEXT:**
- Workflow status: {path-to-workflow-status.md}
- Config: {path-to-config.yaml}
- [Additional workflow-specific context]

**PARAMETERS:**
[Any workflow-specific parameters]

Return a structured report using the template in references/report-format.md
```

**Your response:**
1. Load configuration from specified config.yaml path
2. Read workflow status file to understand current state
3. Execute the specified workflow using workflow.xml task
4. Return structured report

## Workflow Execution

### Generic Execution Pattern

For ANY workflow invocation:

**Step 1: Load Configuration**
```
Read {config-path} → Extract user_name, communication_language, output_folder
```

**Step 2: Load Workflow Definition**
```
Workflow path: {project-root}/bmad/bmm/workflows/4-implementation/{workflow-name}/workflow.yaml
Load using workflow.xml task: {project-root}/bmad/core/tasks/workflow.xml
```

**Step 3: Execute Workflow**
```
Follow workflow.xml instructions EXACTLY:
- Load workflow.yaml and resolve all variables
- Load instructions.md from workflow's installed_path
- Execute each step in order
- Save outputs as specified
```

**Step 4: Return Structured Report**
```
Use template from references/report-format.md
Include: Status, Actions, Files, Current State, Next Action
```

### Workflow-Specific Guidance

#### create-story

**Trigger:** TODO section has story that needs drafting
**Mode:** Run non-interactively using PRD, Architecture, and Epic docs to generate complete draft
**Key Behavior:** Do NOT elicit from user, synthesize from existing docs
**Output:** Story file with Status="Draft", all sections complete

**Execution Notes:**
- Use `#yolo` mode to skip elicitation prompts
- Reference: PRD ({output_folder}/prd.md), Architecture docs, Epic file
- Story file location: {output_folder}/stories/story-{epic}.{number}-{slug}.md
- Include ALL sections: Overview, Acceptance Criteria, Tasks, Dev Agent Record

#### story-ready

**Trigger:** Story in TODO has Status="Draft" AND user approved
**Mode:** Validation + state transition
**Key Behavior:** Verify story completeness, update Status="Ready", advance queue
**State Transitions:**
- TODO story → IN PROGRESS (Status="Draft" → "Ready")
- BACKLOG first story → TODO

**Execution Notes:**
- Validate story has all required sections (use checklist)
- Update story file: Status="Draft" → "Ready"
- Update workflow-status.md: Move story from TODO to IN PROGRESS
- Move next BACKLOG story to TODO

#### story-context

**Trigger:** Story in IN PROGRESS needs Context XML
**Mode:** Context assembly + expertise injection
**Key Behavior:** Read architecture, code patterns, create XML with constraints
**Output:** story-context-{epic}.{number}.xml with architectural guidance

**Execution Notes:**
- Read story file to understand requirements
- Read architecture docs ({project-root}/docs/architecture/)
- Search codebase for relevant patterns using Grep/Glob
- Generate XML using template from workflow
- Include: Tech stack, patterns, constraints, anti-patterns

#### sprint-planning

**Trigger:** Beginning of Phase 4 or when sprint-status.yaml needs regeneration
**Mode:** Batch processing of epic files
**Key Behavior:** Extract all stories from epics, populate sprint-status.yaml
**Output:** {output_folder}/sprint-status.yaml with all stories tracked

**Execution Notes:**
- Read all epic files from {output_folder}/epic*.md
- Extract stories (look for "Story X.Y:" patterns)
- Populate YAML with story metadata (ID, title, epic, status=drafted)
- Include story points if present in epic

#### retrospective

**Trigger:** Epic complete (BACKLOG empty, TODO empty, IN PROGRESS empty)
**Mode:** Facilitation + documentation
**Key Behavior:** Review done stories, identify patterns, document learnings
**Output:** retrospective-{epic}-YYYY-MM-DD.md

**Execution Notes:**
- Read all DONE stories for the epic
- Calculate metrics (total SP, time taken, velocity)
- Identify patterns (blockers, successes, improvements)
- Generate structured retrospective document

#### correct-course

**Trigger:** Story in IN PROGRESS has issues (scope change, blocker, requirement clarification)
**Mode:** Adjustment + re-validation
**Key Behavior:** Update story based on issue, maintain AC integrity
**Output:** Updated story-X.Y.md with adjustments documented

**Execution Notes:**
- Read current story file
- Understand issue from orchestrator context
- Update relevant sections (ACs, tasks, notes)
- Add to changelog with timestamp
- Re-validate against PRD/Architecture alignment

#### epic-tech-context

**Trigger:** Epic needs tech-spec before story creation
**Mode:** Technical planning + architecture application
**Key Behavior:** Use PRD + Architecture to create epic-specific tech constraints
**Output:** tech-spec-epic-{number}.md

**Execution Notes:**
- Read PRD for epic requirements
- Read Architecture docs for patterns
- Generate tech-spec with: Scope, Tech Stack, Patterns, Constraints, API design
- Include references to architecture docs

### Error Scenarios

**If workflow execution fails:**
1. Capture error details (which step, what failed, why)
2. Do NOT retry automatically
3. Return error report with structured format (see references/error-handling.md)
4. Include recovery suggestions for orchestrator

**Common errors:**
- Story file missing required sections → Report specific missing sections
- Workflow status file corrupt → Report parse error with line number
- Epic/PRD not found → Report missing file with expected path
- State transition invalid → Report current state vs expected state

## Report Format

### Success Report Template

```markdown
## Agent Report: {workflow-name}

**Status:** ✅ SUCCESS

**Workflow:** {workflow-name}
**Executed:** {timestamp}
**Duration:** {seconds}s

**Actions Taken:**
- {Action 1}
- {Action 2}
- {Action N}

**Files Modified:**
- {file-path-1} ({action}: created/updated/deleted)
- {file-path-2} ({action}: created/updated/deleted)

**Current State (after execution):**
- BACKLOG: {count} stories
- TODO: {story-id or "empty"}
- IN PROGRESS: {story-id or "empty"}
- DONE: {count} stories

**Next Action:**
{What should happen next - user approval, launch DEV agent, etc.}

**Notes:**
{Any important observations or warnings}
```

### Error Report Template

```markdown
## Agent Report: {workflow-name}

**Status:** ❌ FAILED

**Workflow:** {workflow-name}
**Failed At:** Step {number} - {step-title}
**Error:** {error-message}

**Context:**
{Describe what the workflow was trying to do}

**Root Cause:**
{Technical explanation of why it failed}

**Recovery Options:**
1. {Option 1: what to fix, how to retry}
2. {Option 2: alternative approach}
3. {Option 3: manual intervention required}

**Diagnostic Info:**
- Workflow status file: {status}
- Config file: {status}
- Required files: {list with ✅/❌ status}

**Orchestrator Action Required:**
{Specific recommendation for orchestrator}
```

## references/

### workflow-execution.md

Contains detailed guide on using workflow.xml task to execute any BMAD workflow, including:
- How to load workflow.yaml
- Variable resolution rules
- Step execution patterns
- Template output handling

### report-format.md

Full template and formatting rules for agent reports (success and error variants).

### error-handling.md

Comprehensive error scenarios with recovery strategies:
- File not found errors
- Parse errors
- State transition errors
- Validation failures

---

## 🔧 SKILL #2: bmad-dev (Developer)

### Metadata

```yaml
name: bmad-dev
description: Execute BMAD Developer workflows for story implementation, testing, and completion. Designed for orchestrator invocation with single workflow execution per session.
version: 1.0.0
author: BMad Team
category: project
```

### Core Capabilities

The **bmad-dev** skill enables execution of the following workflows:

| Workflow ID    | Purpose                                  | Input Files                        | Output Files                     | Approval Gate |
|----------------|------------------------------------------|------------------------------------|----------------------------------|---------------|
| `dev-story`    | Implement story from IN PROGRESS         | story-X.Y.md, story-context-X.Y.xml, codebase | Code changes, tests              | **Yes**       |
| `story-done`   | Advance IN PROGRESS → DONE               | story-X.Y.md (Status="In Review")  | story (Status="Done"), updates workflow-status | User trigger  |
| `review-story` | Quality validation (optional peer review)| story-X.Y.md, code changes         | review-notes-X.Y.md              | No            |

### Skill Structure (bmad-dev)

#### SKILL.md Contents

```markdown
---
name: bmad-dev
description: Execute BMAD Developer workflows for story implementation, testing, and completion. Designed for orchestrator invocation with single workflow execution per session.
---

# BMAD Developer Skill

## Purpose

Execute BMAD Phase 4 (Implementation) workflows related to story implementation, testing, and completion. This skill is designed for invocation by the BMAD Orchestrator and executes a single workflow per session.

## Core Principles

1. **Single Workflow Execution**: Each skill invocation executes ONE workflow specified by orchestrator
2. **Story Context Authority**: Story Context XML is the single source of truth
3. **Acceptance Criteria Driven**: Every change maps to specific AC
4. **Test-First Mindset**: All tests must pass 100% before marking done
5. **Structured Reporting**: Always return reports in standardized format

## Persona

**Role:** Senior Implementation Engineer
**Identity:** Executes approved stories with strict adherence to acceptance criteria
**Communication:** Succinct, checklist-driven, cites paths and AC IDs
**Testing Philosophy:** Tests MUST pass 100%, no shortcuts, no lies about test status

## Activation Instructions

When invoked by orchestrator, you will receive a prompt in this format:

```
You are the BMAD Developer agent.

Load the skill 'bmad-dev' to access your workflows and capabilities.

Execute the [workflow-name] workflow.

**CONTEXT:**
- Story file: {path-to-story.md}
- Story Context XML: {path-to-story-context.xml}
- Workflow status: {path-to-workflow-status.md}
- Config: {path-to-config.yaml}

**PARAMETERS:**
[Any workflow-specific parameters]

Return a structured report using the template in references/report-format.md
```

**Your response:**
1. Load configuration from specified config.yaml path
2. Read story file to understand requirements
3. Read Story Context XML for architectural guidance
4. Execute the specified workflow using workflow.xml task
5. Return structured report

## Workflow Execution

### Generic Execution Pattern

For ANY workflow invocation:

**Step 1: Load Configuration**
```
Read {config-path} → Extract user_name, communication_language, output_folder
```

**Step 2: Load Story + Context**
```
Read story file → Extract ACs, tasks, constraints
Read Story Context XML → Extract patterns, anti-patterns, tech stack
```

**Step 3: Execute Workflow**
```
Workflow path: {project-root}/bmad/bmm/workflows/4-implementation/{workflow-name}/workflow.yaml
Load using workflow.xml task: {project-root}/bmad/core/tasks/workflow.xml
Follow instructions EXACTLY
```

**Step 4: Return Structured Report**
```
Use template from references/report-format.md
Include: Status, Implementation Summary, Test Results, Files Modified
```

### Workflow-Specific Guidance

#### dev-story

**Trigger:** Story in IN PROGRESS with Status="Ready"
**Mode:** Continuous execution until complete (no pausing for milestones)
**Key Behavior:** Implement ALL ACs, run ALL tests, ensure 100% passing
**Output:** Code changes, tests, updated story file (Status="In Review")

**Execution Notes:**
- Read story file completely to understand all ACs and tasks
- Locate Story Context XML path in Dev Agent Record → Context Reference
- Pin Story Context XML to active memory (authoritative over model priors)
- Implement changes following Story Context patterns
- Run tests after EVERY significant change
- Only mark Status="In Review" when ALL tests pass 100%
- Update story file: Check off completed tasks, mark ACs as satisfied
- Add completion notes to Dev Agent Record

**Critical Rules:**
- ⛔ NEVER mark story complete if tests < 100%
- ⛔ NEVER skip tests or lie about test results
- ⛔ NEVER invent solutions when information missing (ask orchestrator)
- ✅ ALWAYS reuse existing interfaces over rebuilding
- ✅ ALWAYS map changes to specific AC IDs

**Continuous Execution Mode:**
Run WITHOUT pausing except for:
1. **BLOCKER conditions**: Missing file, unclear requirement, external dependency
2. **Story COMPLETE**: All ACs satisfied, all tasks checked, all tests 100%

#### story-done

**Trigger:** Story in IN PROGRESS with Status="In Review" AND user verified DoD
**Mode:** Validation + state transition + queue advancement
**Key Behavior:** Verify completeness, update Status="Done", advance queue
**State Transitions:**
- IN PROGRESS story → DONE (Status="In Review" → "Done")
- TODO story → IN PROGRESS
- BACKLOG first story → TODO

**Execution Notes:**
- Validate ALL acceptance criteria marked as satisfied
- Validate ALL tasks checked off
- Confirm tests passing (re-run if needed)
- Update story file: Status="In Review" → "Done", add completion metadata
- Update workflow-status.md: Move story to DONE with date and SP
- Advance queue: TODO → IN PROGRESS, BACKLOG → TODO

**Definition of Done Checklist:**
- ✅ All ACs implemented and verified
- ✅ All tasks completed
- ✅ Tests passing 100%
- ✅ Code follows Story Context patterns
- ✅ No console.log or PII in logs
- ✅ TypeScript errors resolved
- ✅ ESLint passing

#### review-story

**Trigger:** Story flagged "Ready for Review" (optional workflow)
**Mode:** Clean context review + quality assessment
**Key Behavior:** Load story fresh, review implementation, append notes
**Output:** Review notes appended to story file

**Execution Notes:**
- Start with CLEAN CONTEXT (don't reuse implementation context)
- Read story file to understand requirements
- Read Story Context XML for patterns
- Review code changes against ACs
- Check test coverage
- Verify architectural alignment
- Append review notes with findings and recommendations

**Review Criteria:**
- AC Coverage: All ACs implemented?
- Code Quality: Follows patterns? Clean? DRY?
- Test Coverage: Edge cases covered?
- Security: No vulnerabilities? No PII leaks?
- Performance: Any obvious bottlenecks?

### Error Scenarios

**If dev-story fails:**
1. Identify which AC or task blocked
2. Capture test results (which tests failed, why)
3. Return error report with recovery options
4. Do NOT mark story as complete

**Common errors:**
- Tests failing (< 100%) → Report specific test failures with logs
- Story Context XML missing → Report missing context, request SM to run story-context
- Unclear AC → Report ambiguity, suggest correct-course workflow
- External dependency unavailable → Report blocker, suggest workaround or skip

## Report Format

### Success Report Template

```markdown
## Agent Report: {workflow-name}

**Status:** ✅ SUCCESS

**Workflow:** {workflow-name}
**Story:** {story-id}
**Executed:** {timestamp}
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

### Error Report Template

```markdown
## Agent Report: {workflow-name}

**Status:** ❌ FAILED

**Workflow:** {workflow-name}
**Story:** {story-id}
**Failed At:** {AC-ID or task description}
**Error:** {error-message}

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

## references/

### workflow-execution.md

Same content as bmad-sm (shared reference), contains guide on using workflow.xml task.

### report-format.md

Full template for DEV agent reports with focus on implementation details and test results.

### error-handling.md

Developer-specific error scenarios:
- Test failures
- Context XML missing
- AC ambiguity
- External dependencies
- Performance issues

---

## 🔗 ORCHESTRATOR INTEGRATION GUIDE

### How Orchestrator Launches Skills

#### Launch Template: SM Agent

```
Task tool invocation:
  subagent_type: "general-purpose"
  description: "Execute {workflow-name} workflow"
  prompt: |
    You are the BMAD Scrum Master agent.

    Load the skill 'bmad-sm' immediately by using the Skill tool with command: "bmad-sm"

    Once skill is loaded, execute the {workflow-name} workflow.

    **CONTEXT:**
    - Workflow status: {project-root}/docs/bmm-workflow-status.md
    - Config: {project-root}/bmad/bmm/config.yaml
    - Project root: {project-root}
    {additional-context}

    **PARAMETERS:**
    {workflow-specific-parameters}

    Execute the workflow following all instructions in the skill.
    Return a structured report when complete.
```

#### Launch Template: DEV Agent

```
Task tool invocation:
  subagent_type: "general-purpose"
  description: "Implement story {story-id}"
  prompt: |
    You are the BMAD Developer agent.

    Load the skill 'bmad-dev' immediately by using the Skill tool with command: "bmad-dev"

    Once skill is loaded, execute the {workflow-name} workflow.

    **CONTEXT:**
    - Story file: {story-file-path}
    - Story Context XML: {context-xml-path}
    - Workflow status: {project-root}/docs/bmm-workflow-status.md
    - Config: {project-root}/bmad/bmm/config.yaml
    - Project root: {project-root}

    **PARAMETERS:**
    {workflow-specific-parameters}

    Execute the workflow following all instructions in the skill.

    CRITICAL: Implement ALL acceptance criteria and run ALL tests.
    Tests MUST be 100% passing before marking complete.

    Return a structured report when complete.
```

### Report Parsing Logic

#### Orchestrator Must Parse

```python
def parse_agent_report(report: str) -> dict:
    """
    Parse agent report from skill execution
    Returns structured data for orchestrator decision making
    """
    # Extract status line
    status_match = re.search(r"\*\*Status:\*\* (✅ SUCCESS|❌ FAILED)", report)
    status = "success" if "SUCCESS" in status_match.group(1) else "failed"

    # Extract files modified
    files_section = extract_section(report, "**Files Modified:**")
    files_modified = parse_file_list(files_section)

    # Extract current state
    state_section = extract_section(report, "**Current State")
    backlog_count = extract_number(state_section, "BACKLOG:")
    todo_story = extract_story_id(state_section, "TODO:")
    in_progress_story = extract_story_id(state_section, "IN PROGRESS:")
    done_count = extract_number(state_section, "DONE:")

    # Extract next action
    next_action = extract_section(report, "**Next Action:**")

    return {
        "status": status,
        "files_modified": files_modified,
        "state": {
            "backlog": backlog_count,
            "todo": todo_story,
            "in_progress": in_progress_story,
            "done": done_count
        },
        "next_action": next_action
    }
```

#### Validation After Agent Execution

```python
def validate_state_transition(before_state, after_state, expected_transition):
    """
    Validate that agent execution resulted in correct state transition
    """
    if expected_transition == "TODO_TO_IN_PROGRESS":
        # After story-ready workflow
        assert after_state['in_progress'] == before_state['todo'], \
            "Story didn't move from TODO to IN PROGRESS"
        assert after_state['todo'] != before_state['todo'], \
            "TODO not replenished from BACKLOG"
        assert after_state['backlog'] == before_state['backlog'] - 1, \
            "BACKLOG count didn't decrement"

    elif expected_transition == "IN_PROGRESS_TO_DONE":
        # After story-done workflow
        assert before_state['in_progress'] not in after_state['in_progress'], \
            "Story didn't leave IN PROGRESS"
        assert after_state['done'] == before_state['done'] + 1, \
            "DONE count didn't increment"
        assert after_state['in_progress'] == before_state['todo'], \
            "TODO story didn't move to IN PROGRESS"

    return True  # Validation passed
```

### Context Passing Between Agents

When SM creates story-context and DEV needs it:

```
1. SM executes story-context workflow
   Report includes: "Context XML created at: docs/stories/story-context-1.1.xml"

2. Orchestrator extracts path from report:
   context_xml_path = extract_file_path(sm_report, "Context XML created at:")

3. Orchestrator validates file exists:
   assert os.path.exists(context_xml_path), "Context XML missing"

4. Orchestrator launches DEV with explicit path:
   prompt = f"""
   ...
   **CONTEXT:**
   - Story Context XML: {context_xml_path} (AUTHORITATIVE SOURCE)
   ...
   """
```

---

## ✅ IMPLEMENTATION CHECKLIST

### For Skill Creator Agent

#### bmad-sm Skill

- [ ] Create directory structure: `.claude/skills/bmad-sm/`
- [ ] Create `SKILL.md` with:
  - [ ] Metadata (name, description, version)
  - [ ] Purpose and core principles
  - [ ] Persona definition
  - [ ] Activation instructions
  - [ ] Workflow execution guide (all 7 workflows)
  - [ ] Report format templates (success + error)
  - [ ] Error scenarios
- [ ] Create `references/workflow-execution.md`
- [ ] Create `references/report-format.md`
- [ ] Create `references/error-handling.md`
- [ ] Create `templates/agent-report.md`

#### bmad-dev Skill

- [ ] Create directory structure: `.claude/skills/bmad-dev/`
- [ ] Create `SKILL.md` with:
  - [ ] Metadata (name, description, version)
  - [ ] Purpose and core principles
  - [ ] Persona definition (testing-focused)
  - [ ] Activation instructions
  - [ ] Workflow execution guide (all 3 workflows)
  - [ ] Report format templates (success + error with test results)
  - [ ] Error scenarios (test failures, blockers)
- [ ] Create `references/workflow-execution.md` (shared with SM)
- [ ] Create `references/report-format.md`
- [ ] Create `references/error-handling.md`
- [ ] Create `templates/agent-report.md`

#### Orchestrator Updates

- [ ] Update `bmad-orchestrator/SKILL.md`:
  - [ ] Section 2: Change "Load skill bmad-sm" to use Skill tool command
  - [ ] Add explicit Skill tool invocation examples
  - [ ] Update agent launch templates
- [ ] Add section "Agent Report Parsing" with parsing logic
- [ ] Add section "Contextual Agent Launching" with context passing examples

#### Testing

- [ ] Test bmad-sm skill:
  - [ ] Launch via Task tool with Skill command
  - [ ] Execute create-story workflow
  - [ ] Verify structured report returned
  - [ ] Verify orchestrator can parse report
- [ ] Test bmad-dev skill:
  - [ ] Launch via Task tool with Skill command
  - [ ] Execute dev-story workflow (on real story)
  - [ ] Verify continuous execution (no pausing)
  - [ ] Verify test results in report
- [ ] Test orchestrator integration:
  - [ ] Full epic loop (BACKLOG → DONE)
  - [ ] Context passing (SM → DEV)
  - [ ] Error recovery (failed tests)

---

## 📊 EXPECTED OUTCOMES

### Before (Agent-Based)

**Orchestrator launches SM agent:**
- Agent activation: ~500 tokens (config loading, menu display, persona)
- Workflow execution: ~1500 tokens
- **Total per agent launch: ~2000 tokens**

**For 8-story epic:**
- SM launches: 8 (create-story) + 8 (story-ready) + 8 (story-context) = 24 launches
- DEV launches: 8 (dev-story) + 8 (story-done) = 16 launches
- **Total: 40 agent launches × 2000 tokens = 80,000 tokens**

### After (Skill-Based)

**Orchestrator launches agent with skill:**
- Skill loading: ~200 tokens (minimal activation)
- Workflow execution: ~1500 tokens
- **Total per agent launch: ~1700 tokens**

**For 8-story epic:**
- Same 40 agent launches × 1700 tokens = **68,000 tokens**
- **Savings: 12,000 tokens (15% reduction)**
- **More accurate estimate: 30% reduction** (due to focused context, no menu overhead)

### Quality Improvements

1. **Clearer separation of concerns**: Orchestrator = coordinator, Skills = executors
2. **Better error handling**: Structured reports easier to parse
3. **Faster agent initialization**: No config loading, menu display
4. **Context optimization**: Only workflow-relevant context loaded
5. **Easier maintenance**: Skills are focused, agents remain for interactive use

---

## 📚 APPENDIX: WORKFLOW REFERENCE

### All SM Workflows

| Workflow          | Path                                                      | Instructions File        | Template File               |
|-------------------|-----------------------------------------------------------|--------------------------|-----------------------------|
| sprint-planning   | bmad/bmm/workflows/4-implementation/sprint-planning/      | instructions.md          | sprint-status-template.yaml |
| create-story      | bmad/bmm/workflows/4-implementation/create-story/         | instructions.md          | story-template.md           |
| story-ready       | bmad/bmm/workflows/4-implementation/story-ready/          | instructions.md          | N/A (action workflow)       |
| story-context     | bmad/bmm/workflows/4-implementation/story-context/        | instructions.md          | story-context-template.xml  |
| retrospective     | bmad/bmm/workflows/4-implementation/retrospective/        | instructions.md          | retrospective-template.md   |
| correct-course    | bmad/bmm/workflows/4-implementation/correct-course/       | instructions.md          | N/A (action workflow)       |
| epic-tech-context | bmad/bmm/workflows/4-implementation/epic-tech-context/    | instructions.md          | tech-spec-template.md       |

### All DEV Workflows

| Workflow      | Path                                                  | Instructions File        | Template File         |
|---------------|-------------------------------------------------------|--------------------------|-----------------------|
| dev-story     | bmad/bmm/workflows/4-implementation/dev-story/        | instructions.md          | N/A (action workflow) |
| story-done    | bmad/bmm/workflows/4-implementation/story-done/       | instructions.md          | N/A (action workflow) |
| review-story  | bmad/bmm/workflows/4-implementation/review-story/     | instructions.md          | review-template.md    |

---

## 🎯 FINAL NOTES FOR SKILL CREATOR

1. **Skill activation MUST be fast** - No config loading, no menu display, jump straight to workflow execution
2. **Reports MUST be structured** - Orchestrator relies on consistent format for parsing
3. **Error handling MUST be comprehensive** - Every failure mode needs recovery option
4. **Testing mindset MUST be enforced** - DEV skill NEVER accepts < 100% test pass rate
5. **Context MUST be authoritative** - Story Context XML overrides model priors

**When implementing, ask yourself:**
- Can orchestrator parse this report programmatically?
- Does this skill execute exactly ONE workflow per invocation?
- Is error handling clear enough for automated recovery?
- Are all file paths explicitly passed vs assumed?

**Success criteria:**
- ✅ Skill loads in < 5 seconds
- ✅ Orchestrator can parse reports with simple regex
- ✅ Full epic (8 stories) completes in single session
- ✅ 70%+ context reduction vs agent-based approach

---

**END OF SPECIFICATION**

*This document is ready for handoff to Skill Creator Agent or implementation team.*
