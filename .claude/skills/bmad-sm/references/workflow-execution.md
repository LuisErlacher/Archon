# Workflow Execution Guide

## Overview

This guide explains how to execute BMAD workflows using the `workflow.xml` task system. All workflows follow a standardized execution pattern that ensures consistency, traceability, and proper context management.

## The workflow.xml Task System

### Purpose

The `workflow.xml` task is the central execution engine for all BMAD workflows. It:
- Loads workflow definitions from `workflow.yaml` files
- Resolves variables and context
- Executes workflow steps in order
- Manages templates and outputs
- Provides error handling and reporting

### Location

```
{project-root}/bmad/core/tasks/workflow.xml
```

## Execution Pattern

### Step 1: Locate Workflow Definition

All Phase 4 (Implementation) workflows are located in:
```
{project-root}/bmad/bmm/workflows/4-implementation/{workflow-name}/
```

Each workflow directory contains:
- `workflow.yaml` - Workflow definition and metadata
- `instructions.md` - Detailed execution instructions
- Template files (if applicable) - Output templates

### Step 2: Load workflow.xml Task

To execute a workflow, use the Task tool to load and execute `workflow.xml`:

```
Read file: {project-root}/bmad/core/tasks/workflow.xml

This task will instruct you on:
1. How to load the workflow.yaml
2. How to resolve variables
3. How to execute each step
4. How to use templates
```

### Step 3: Load workflow.yaml

The `workflow.yaml` file contains:

```yaml
name: workflow-name
description: Brief description
phase: "4-implementation"
installed_path: /absolute/path/to/workflow
version: 1.0.0

inputs:
  required:
    - name: variable_name
      description: Description
      type: string/path/array
      default: optional_default

  optional:
    - name: optional_variable
      description: Description

steps:
  - id: step-1
    description: What this step does
    actions:
      - Read file X
      - Process Y
      - Generate Z
    outputs:
      - path/to/output/file

outputs:
  - name: output-name
    path: path/to/output
    description: What this output contains
```

### Step 4: Resolve Variables

Variables in workflow.yaml are resolved from multiple sources, in priority order:

1. **Orchestrator-provided parameters** (highest priority)
2. **Config file** ({config-path} from activation prompt)
3. **Workflow defaults** (defined in workflow.yaml)
4. **Environment** (project root, current user)

Common variables:
- `{project_root}` - Absolute path to project root
- `{output_folder}` - Where to save outputs (from config.yaml)
- `{user_name}` - User name (from config.yaml)
- `{communication_language}` - Language preference (from config.yaml)

### Step 5: Load instructions.md

The `instructions.md` file in the workflow directory contains:
- Detailed step-by-step guidance
- Context requirements
- Decision points
- Output specifications

Load and follow these instructions EXACTLY.

### Step 6: Execute Steps in Order

Execute each step defined in `workflow.yaml` steps array:

```yaml
steps:
  - id: load-context
    description: Load story and context files
    actions:
      - Read {output_folder}/stories/story-{story_id}.md
      - Read {output_folder}/stories/story-context-{story_id}.xml
```

For each step:
1. Read the step description
2. Execute each action listed
3. Validate outputs are created
4. Proceed to next step only after current step completes

### Step 7: Use Templates (if applicable)

Some workflows include template files for generating outputs:

```yaml
outputs:
  - name: story-file
    path: "{output_folder}/stories/story-{epic}.{number}-{slug}.md"
    template: "story-template.md"
```

To use a template:
1. Load template file from workflow directory
2. Replace all `{variable}` placeholders with resolved values
3. Fill in dynamic content as per instructions
4. Save to specified output path

## Workflow-Specific Examples

### Example 1: create-story Workflow

```
1. Load workflow:
   - Path: bmad/bmm/workflows/4-implementation/create-story/workflow.yaml
   - Task: bmad/core/tasks/workflow.xml

2. Resolve variables:
   - {output_folder} from config.yaml → "docs"
   - {epic} from parameters → "1"
   - {story_number} from parameters → "1"

3. Load instructions:
   - Read: bmad/bmm/workflows/4-implementation/create-story/instructions.md

4. Execute steps:
   Step 1: Load context
   - Read docs/prd.md
   - Read docs/epic-1.md
   - Read docs/architecture/*.md

   Step 2: Draft story
   - Load template: story-template.md
   - Fill sections using context
   - Generate ACs from requirements
   - Create tasks from technical approach

   Step 3: Save output
   - Path: docs/stories/story-1.1-{slug}.md
   - Status: "Draft"

5. Return report
```

### Example 2: story-context Workflow

```
1. Load workflow:
   - Path: bmad/bmm/workflows/4-implementation/story-context/workflow.yaml
   - Task: bmad/core/tasks/workflow.xml

2. Resolve variables:
   - {story_file} from parameters
   - {output_folder} from config

3. Execute steps:
   Step 1: Analyze story
   - Read story file
   - Extract requirements and ACs

   Step 2: Search codebase
   - Use Grep to find relevant patterns
   - Identify existing interfaces
   - Note architectural constraints

   Step 3: Read architecture docs
   - Load docs/architecture/*.md
   - Extract tech stack
   - Identify patterns and anti-patterns

   Step 4: Generate context XML
   - Load template: story-context-template.xml
   - Populate with findings
   - Include constraints and guidance

   Step 5: Save context
   - Path: docs/stories/story-context-{epic}.{number}.xml

4. Return report
```

## Error Handling During Execution

### File Not Found

If a required file is missing:
```
❌ ERROR: Required file not found
   Path: {expected-path}
   Step: {step-id}

Recovery:
1. Verify path is correct (check variable resolution)
2. Check if prerequisite workflow needs to run first
3. Report to orchestrator with missing file path
```

### Variable Resolution Failed

If a variable cannot be resolved:
```
❌ ERROR: Unable to resolve variable
   Variable: {variable_name}
   Required by: {step-id}

Recovery:
1. Check if variable in config.yaml
2. Check if orchestrator provided parameter
3. Check workflow.yaml for default
4. Report to orchestrator with missing variable name
```

### Step Execution Failed

If a step cannot complete:
```
❌ ERROR: Step execution failed
   Step: {step-id}
   Action: {action-description}
   Reason: {error-message}

Recovery:
1. Document which step failed
2. Capture error details
3. Do NOT continue to next step
4. Return error report to orchestrator
```

## Best Practices

### 1. Always Read Instructions First

Before executing any workflow step, read the instructions.md file completely. This ensures you understand:
- The full context
- Dependencies between steps
- Decision points
- Output expectations

### 2. Validate Variables Early

Before starting step execution, validate all required variables are resolved:
```
✅ Validation checklist:
- [ ] {project_root} resolved
- [ ] {output_folder} resolved
- [ ] {user_name} resolved
- [ ] Workflow-specific variables resolved
```

### 3. Execute Steps Sequentially

Never skip steps or execute out of order. Each step may depend on outputs from previous steps.

### 4. Verify Outputs After Each Step

After completing a step that produces output:
1. Verify file was created
2. Verify file is not empty
3. Verify file contains expected structure
4. Only then proceed to next step

### 5. Use Templates Correctly

When using templates:
- Replace ALL placeholders (search for `{` in template)
- Preserve markdown formatting
- Maintain section structure
- Add dynamic content in appropriate sections

### 6. Report Thoroughly

After workflow execution (success or failure):
- List all actions taken
- List all files modified
- Include current state
- Provide next action recommendation

## Common Pitfalls

### ❌ Don't: Assume variable values

```
# Wrong
story_path = "docs/stories/story-1.1.md"  # Hardcoded!
```

```
# Right
story_path = f"{output_folder}/stories/story-{epic}.{number}.md"  # Resolved!
```

### ❌ Don't: Skip error checking

```
# Wrong
Read file {path}
# Continue regardless of success/failure
```

```
# Right
Try to read file {path}
If file not found:
  Report error with path
  Stop execution
  Return error report
```

### ❌ Don't: Modify template structure

```
# Wrong
Load template
Remove sections you think are unnecessary
Fill remaining sections
```

```
# Right
Load template
Fill ALL sections as-is
If section not applicable, mark as "N/A" with reason
```

### ❌ Don't: Continue after partial failure

```
# Wrong
Step 1: Success
Step 2: Failed (but continue anyway)
Step 3: Execute using incomplete data from Step 2
```

```
# Right
Step 1: Success
Step 2: Failed
STOP execution
Report error at Step 2
Wait for orchestrator guidance
```

## Advanced: Workflow Composition

Some workflows may invoke other workflows as sub-steps:

```yaml
steps:
  - id: prepare-context
    description: Ensure story context exists
    workflow: story-context
    condition: context_xml_not_found
```

When executing composed workflows:
1. Check condition first
2. If condition true, pause current workflow
3. Report to orchestrator: "Sub-workflow required: story-context"
4. Wait for orchestrator to launch sub-workflow
5. Resume current workflow after sub-workflow completes

## Summary Checklist

Before executing any workflow:
- [ ] Load workflow.xml task
- [ ] Load workflow.yaml for the specific workflow
- [ ] Resolve all variables
- [ ] Read instructions.md completely
- [ ] Validate all required inputs exist
- [ ] Have error reporting template ready

During execution:
- [ ] Execute steps in exact order
- [ ] Validate outputs after each step
- [ ] Do not skip error checking
- [ ] Do not continue after failures

After execution:
- [ ] Verify all outputs created
- [ ] Validate output structure
- [ ] Generate structured report
- [ ] Include next action recommendation

---

**This workflow execution pattern ensures consistency, traceability, and reliability across all BMAD workflows.**
