# Workflow Execution Guide

This guide explains how to execute BMAD workflows using the workflow.xml task system.

## Overview

All BMAD workflows are executed through a standardized workflow.xml task that:
1. Loads workflow definitions from workflow.yaml
2. Resolves variables and context
3. Executes steps in sequence
4. Handles template outputs

## Workflow Structure

Each workflow consists of:

```
{workflow-name}/
├── workflow.yaml        # Workflow definition and metadata
├── instructions.md      # Detailed execution instructions
└── [template-files]     # Optional output templates
```

## Executing a Workflow

### Step 1: Locate Workflow Files

Workflows are organized by BMAD phase:

```
{project-root}/bmad/bmm/workflows/4-implementation/{workflow-name}/
```

For developer workflows:
- `dev-story/` - Story implementation
- `story-done/` - Mark story complete
- `review-story/` - Peer review

### Step 2: Load workflow.yaml

Read the workflow.yaml file to understand:
- **metadata**: name, description, version
- **inputs**: Required inputs (files, parameters)
- **outputs**: Expected outputs (files to create/modify)
- **variables**: Context variables to resolve
- **steps**: Execution sequence

Example workflow.yaml structure:

```yaml
name: dev-story
version: 1.0.0
description: Implement story from IN PROGRESS queue

inputs:
  - story_file: path to story markdown file
  - context_xml: path to story context XML
  - config: path to config.yaml

outputs:
  - code_changes: modified source files
  - test_results: test execution results
  - updated_story: story file with updated status

variables:
  project_root: ${config.project_root}
  output_folder: ${config.output_folder}
  story_id: extracted from story_file name

steps:
  - name: Load Story Context
    action: read_file
    file: ${context_xml}

  - name: Implement ACs
    action: execute
    instructions: instructions.md

  - name: Run Tests
    action: test
    suite: all

  - name: Update Story Status
    action: update_file
    file: ${story_file}
    changes:
      - status: "In Review"
```

### Step 3: Variable Resolution

Variables are resolved in this priority order:

1. **Direct Parameters**: Values passed by orchestrator
2. **Config Values**: From config.yaml (${config.key})
3. **Extracted Values**: From file parsing (e.g., story ID from filename)
4. **Defaults**: Fallback values defined in workflow.yaml

Variable syntax:
- `${variable_name}` - Simple variable reference
- `${config.key}` - Config file value
- `${file.pattern}` - Extract from file content

### Step 4: Execute Instructions

Load `instructions.md` from the workflow directory. This file contains:
- Step-by-step execution guide
- Specific actions to take
- Success criteria
- Error handling instructions

**Critical**: Follow instructions.md EXACTLY as written. Do not skip steps or improvise unless explicitly instructed to adapt.

### Step 5: Handle Templates

If workflow includes template files:

1. Locate template in workflow directory
2. Load template content
3. Replace placeholders with resolved variables
4. Write output to specified location

Template placeholder format: `{{variable_name}}`

Example:
```markdown
# Story {{story_id}}: {{story_title}}

Status: {{status}}
Epic: {{epic_number}}
```

### Step 6: Validate Outputs

Before completing workflow:

1. Verify all output files exist
2. Check file content matches expected format
3. Validate state transitions (if applicable)
4. Confirm no errors occurred

## Continuous Execution Mode

For `dev-story` workflow specifically:

**Execute continuously** without stopping for:
- Checkpoint confirmations
- Milestone approvals
- Status updates

**Only pause execution for:**

1. **BLOCKER Conditions**:
   - Missing required file
   - Unclear acceptance criteria
   - External dependency unavailable
   - Authentication/permission error

2. **COMPLETION**:
   - All acceptance criteria satisfied
   - All tasks checked off
   - All tests passing 100%
   - Story status updated to "In Review"

When blocked, return error report (see error-handling.md) instead of attempting workarounds.

## Variable Resolution Examples

### Example 1: Config Variables

Config file (`config.yaml`):
```yaml
user_name: Luis Erlacher
output_folder: docs
project_root: /home/luis/projetos/digilife
```

Workflow reference: `${config.output_folder}/stories/`
Resolves to: `docs/stories/`

### Example 2: Extracted Variables

Story file: `story-12.2-atualizar-dtos-validacao-backend.md`

Extraction pattern: `story-{epic}.{number}-{slug}.md`
Extracted variables:
- `epic` = "12"
- `number` = "2"
- `slug` = "atualizar-dtos-validacao-backend"
- `story_id` = "12.2"

### Example 3: Nested Variables

Workflow variable: `${config.output_folder}/stories/story-${story_id}.md`
With config.output_folder = "docs" and story_id = "12.2"
Resolves to: `docs/stories/story-12.2.md`

## Error Handling During Execution

If workflow execution encounters errors:

1. **Capture Context**:
   - Which step failed
   - What was being attempted
   - Error message/stack trace

2. **Do NOT**:
   - Skip the step
   - Continue to next step
   - Mark workflow as complete
   - Invent workarounds

3. **Return Error Report** (see error-handling.md):
   - Status: FAILED
   - Failed step details
   - Root cause analysis
   - Recovery options

4. **Let Orchestrator Decide**:
   - Retry after fix
   - Launch correct-course workflow
   - Manual intervention required

## Workflow State Tracking

Track workflow execution state:

```markdown
**Workflow Progress:**
- [x] Step 1: Load Story Context
- [x] Step 2: Implement AC-001
- [ ] Step 3: Implement AC-002 (IN PROGRESS)
- [ ] Step 4: Run Tests
- [ ] Step 5: Update Story Status
```

Include progress in reports when pausing for blockers.

## Best Practices

1. **Always read instructions.md completely** before starting execution
2. **Resolve ALL variables** before using in file paths or content
3. **Validate inputs exist** before processing
4. **Test frequently** during implementation workflows
5. **Update story file** as tasks complete (don't batch updates)
6. **Use specific AC IDs** when describing changes
7. **Cite file paths** when reporting modifications
8. **Return structured reports** using standard template

## Common Pitfalls

❌ **Don't**:
- Assume file paths without resolving variables
- Skip validation steps
- Mark story complete with failing tests
- Continue execution after blockers
- Invent solutions for unclear requirements

✅ **Do**:
- Validate all inputs before execution
- Follow instructions.md exactly
- Report blockers immediately
- Update story incrementally
- Map every change to specific AC

## Integration with Story Context XML

For `dev-story` workflow:

1. **Load Story Context XML** (from story file "Context Reference" field)
2. **Pin to active memory** as authoritative source
3. **Follow patterns** specified in XML
4. **Avoid anti-patterns** listed in XML
5. **Use specified tech stack** and libraries
6. **Reference XML** when making architectural decisions

Story Context XML overrides model priors and general best practices.

## Testing Requirements

For any workflow that involves code changes:

1. **Run tests after EVERY significant change**
2. **All tests must pass 100%** before marking complete
3. **Re-run failed tests** after fixes
4. **Report test results** in structured format:
   ```
   Unit Tests: 24/24 passing (100%)
   Integration Tests: 8/8 passing (100%)
   E2E Tests: 3/3 passing (100%)
   Overall: ✅ ALL TESTS PASSING (100%)
   ```

5. **Never accept**:
   - 99% passing (1 test failing)
   - "Most tests passing"
   - "Tests pass locally" (must pass in execution context)
   - Disabled tests to make suite pass

## Workflow Completion Criteria

Workflow is complete when:

1. ✅ All steps in instructions.md executed
2. ✅ All outputs generated and validated
3. ✅ No errors or blockers encountered
4. ✅ State transitions completed (if applicable)
5. ✅ Story file updated with results
6. ✅ Structured report prepared

Return report to orchestrator for parsing and next action determination.
