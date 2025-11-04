# BMAD Agent Mapping Reference

## Overview

This reference maps each BMAD workflow to the appropriate specialized agent. When orchestrating workflows, use this mapping to determine which agent to launch via the Task tool with the correct `subagent_type`.

## Key Changes from Skills to Agents

**Previous approach** (deprecated):
- Used generic agents with `subagent_type="general-purpose"`
- Required agents to manually load skills (`bmad-sm` or `bmad-dev`)
- More token overhead and slower initialization

**Current approach**:
- Use specialized agents with `subagent_type="scrum-master-bmad"` or `subagent_type="agent-skill-dev"`
- Agents come pre-configured with BMAD knowledge and workflows
- Faster initialization and better context efficiency
- Agents execute workflows using asterisk commands (e.g., `*create-story`, `*develop`)

## Mapping Table

| Workflow            | Phase | Agent Type           | Workflow Command  | Purpose                              | Approval Gate |
|---------------------|-------|----------------------|-------------------|--------------------------------------|---------------|
| workflow-status     | Any   | Any                  | *workflow-status  | Check status, get recommendations    | No            |
| sprint-planning     | 4     | scrum-master-bmad    | *sprint-planning  | Generate sprint-status.yaml          | No            |
| create-story        | 4     | scrum-master-bmad    | *create-story     | Draft story from TODO section        | **Yes** (1)   |
| story-ready         | 4     | scrum-master-bmad    | *story-ready      | Advance story TODO → IN PROGRESS     | User trigger  |
| story-context       | 4     | scrum-master-bmad    | *story-context    | Generate expertise injection XML     | No            |
| dev-story           | 4     | agent-skill-dev      | *develop          | Implement story from IN PROGRESS     | **Yes** (2)   |
| story-done          | 4     | agent-skill-dev      | *story-done       | Advance story IN PROGRESS → DONE     | User trigger  |
| review-story        | 4     | agent-skill-dev      | *review           | Quality validation (optional)        | No            |
| correct-course      | 4     | scrum-master-bmad    | *correct-course   | Handle issues/changes                | Varies        |
| retrospective       | 4     | scrum-master-bmad    | *retrospective    | Epic/sprint retrospective            | No            |
| epic-tech-context   | 4     | scrum-master-bmad    | *epic-tech-context| Create tech-spec for specific epic   | No            |

**Approval Gates**:
- **(1)**: After `*create-story`, user must review and approve before `*story-ready`
- **(2)**: After `*develop`, user must verify DoD before `*story-done`

## Agent Launch Templates

### Scrum Master (SM) Agent

**Agent Details**:
- **Name**: Bob
- **Role**: Technical Scrum Master + Story Preparation Specialist
- **subagent_type**: `scrum-master-bmad`
- **Workflows**: Uses asterisk commands (`*create-story`, `*story-ready`, etc.)

**For story management workflows** (*create-story, *story-ready, *story-context):
```
Task tool:
  subagent_type: "scrum-master-bmad"
  description: "Execute [workflow-command] workflow"
  prompt: |
    You are Bob, the BMAD Scrum Master agent.

    Execute the [workflow-command] workflow (e.g., *create-story, *story-ready).

    Read the workflow status file at: {project-root}/docs/bmm-workflow-status.md

    [Additional context specific to this workflow invocation]

    Return a structured report with:
    - Status: ✅ SUCCESS or ❌ FAILED
    - Actions Taken
    - Files Modified
    - Current State (BACKLOG, TODO, IN PROGRESS, DONE counts)
    - Next Action
```

**Example - Create Story**:
```
Task tool:
  subagent_type: "scrum-master-bmad"
  description: "Create story draft"
  prompt: |
    You are Bob, the BMAD Scrum Master agent.

    Execute the *create-story workflow.

    The story to draft is in the TODO section of docs/bmm-workflow-status.md.

    Draft a complete story file with all sections:
    - Story metadata (ID, title, epic, status="Draft")
    - User story statement
    - Acceptance criteria (specific, testable)
    - Technical tasks
    - Definition of Done
    - Dev Agent Record

    Return structured report with status, files modified, and next action.
```

**Example - Story Ready**:
```
Task tool:
  subagent_type: "scrum-master-bmad"
  description: "Mark story ready for development"
  prompt: |
    You are Bob, the BMAD Scrum Master agent.

    Execute the *story-ready workflow.

    User has approved the story in TODO section.

    Advance the story:
    - Update story Status to "Ready"
    - Move TODO → IN PROGRESS
    - Move BACKLOG → TODO (if available)

    Return structured report with status, transitions, and next action.
```

**Example - Story Context**:
```
Task tool:
  subagent_type: "scrum-master-bmad"
  description: "Generate story context XML"
  prompt: |
    You are Bob, the BMAD Scrum Master agent.

    Execute the *story-context workflow.

    Generate Story Context XML for the story in IN PROGRESS section.

    Analyze project docs (PRD, Architecture, Tech Spec, existing code) and create:
    - Architectural patterns
    - Code examples
    - Interface definitions
    - Testing strategies
    - Implementation guidance

    Save Context XML and update story's Dev Agent Record.

    Return structured report with status, files modified, and next action.
```

### Developer (DEV) Agent

**Agent Details**:
- **Name**: Amelia
- **Role**: Senior Implementation Engineer
- **subagent_type**: `agent-skill-dev`
- **Workflows**: Uses asterisk commands (`*develop`, `*story-done`, `*review`)

**For implementation workflows** (*develop):
```
Task tool:
  subagent_type: "agent-skill-dev"
  description: "Implement story [story-id]"
  prompt: |
    You are Amelia, the BMAD Developer agent.

    Execute the *develop workflow for the story in IN PROGRESS.

    Read:
    - Workflow status file: {project-root}/docs/bmm-workflow-status.md
    - Story file (from IN PROGRESS section)
    - Story Context XML (from Dev Agent Record)

    Requirements:
    - Implement ALL acceptance criteria
    - Complete ALL technical tasks
    - Write tests for ALL ACs
    - Run ALL tests - MUST be 100% passing
    - Update story Status to "In Review"

    Return structured report with:
    - Status: ✅ SUCCESS or ❌ FAILED
    - Actions Taken
    - Files Modified
    - Test Results (X/X passing, Y%)
    - Current State
    - Next Action: "User DoD verification required"
```

**Example - Dev Story**:
```
Task tool:
  subagent_type: "agent-skill-dev"
  description: "Implement story 1.1"
  prompt: |
    You are Amelia, the BMAD Developer agent.

    Execute the *develop workflow for story-1.1.

    CONTEXT:
    - Story file: docs/stories/story-1.1-user-authentication.md
    - Context XML: docs/stories/story-context-1.1.xml
    - Workflow status: docs/bmm-workflow-status.md

    INSTRUCTIONS:
    1. Read Context XML FIRST (architectural constraints)
    2. Read Story file (acceptance criteria and tasks)
    3. Implement ALL acceptance criteria
    4. Run ALL tests - MUST be 100% passing
    5. Return detailed report with test results

    CRITICAL:
    - NEVER skip tests
    - NEVER lie about test results
    - Report actual execution results
```

**For story completion** (*story-done):
```
Task tool:
  subagent_type: "agent-skill-dev"
  description: "Mark story done"
  prompt: |
    You are Amelia, the BMAD Developer agent.

    Execute the *story-done workflow.

    User has verified Definition of Done for story in IN PROGRESS.

    Verify:
    - Story Status="In Review"
    - ALL tests passing (100%)
    - ALL acceptance criteria met

    Update:
    - Story Status to "Done"
    - IN PROGRESS → DONE
    - TODO → IN PROGRESS (if available)
    - BACKLOG → TODO (if available)

    Return structured report with:
    - Status: ✅ SUCCESS
    - Story completed (ID, date, points)
    - Queue transitions
    - Progress (X/Y stories, Z%)
    - Next Action
```

## Orchestration Patterns

### Pattern 1: Sequential Story Development

1. **Create Story** → SM agent (`*create-story`) → User approval gate
2. **Advance Story** → SM agent (`*story-ready`) → No gate
3. **Generate Context** → SM agent (`*story-context`) → No gate
4. **Implement Story** → DEV agent (`*develop`) → User DoD verification gate
5. **Complete Story** → DEV agent (`*story-done`) → No gate
6. **Loop** to step 1 for next story

### Pattern 2: Error Recovery with Retry

1. **DEV agent fails** (e.g., tests failing) → Track retry count
2. **Report to user** with error details and options
3. **User fixes issue** → Signal retry
4. **Relaunch DEV agent** with retry context (attempt X/Y)
5. **If max retries exceeded** → HALT for manual intervention

### Pattern 3: Sprint Planning

1. **SM agent** (`*sprint-planning`) → Generates sprint-status.yaml
2. **Validate** sprint-status.yaml exists and is valid
3. **Start orchestration** for Implementation phase

## Best Practices

### Do's ✅

- Always use specialized `subagent_type` (scrum-master-bmad or agent-skill-dev)
- Include workflow command with asterisk prefix (e.g., `*create-story`)
- Pass relevant context in the prompt (file paths, previous errors, etc.)
- Expect structured reports from agents (Status, Actions, Files, etc.)
- Validate agent reports before proceeding to next workflow

### Don'ts ❌

- Don't use generic `subagent_type="general-purpose"`
- Don't ask agents to "load skills" - they're pre-configured
- Don't skip approval gates (story approval and DoD verification)
- Don't launch multiple agents in parallel - always sequential
- Don't maintain story details in orchestrator context - agents handle it

## Migration Notes

If you have existing orchestrator code using the old skill-based approach:

**Old (deprecated)**:
```
Task tool:
  subagent_type: "general-purpose"
  prompt: |
    Load the skill 'bmad-sm' to access workflows.
    Execute create-story workflow...
```

**New (current)**:
```
Task tool:
  subagent_type: "scrum-master-bmad"
  prompt: |
    Execute the *create-story workflow...
```

**Benefits of new approach**:
- ~30% faster agent initialization
- Better context efficiency
- Direct access to BMAD workflows
- Clearer separation of concerns

## Quick Reference

**Launch SM agent**: `Task(subagent_type="scrum-master-bmad", prompt="Execute *[workflow]...")`
**Launch DEV agent**: `Task(subagent_type="agent-skill-dev", prompt="Execute *[workflow]...")`

**SM workflows**: *create-story, *story-ready, *story-context, *correct-course, *retrospective, *epic-tech-context
**DEV workflows**: *develop, *story-done, *review

**Approval gates**: After *create-story (user review) and after *develop (DoD verification)
