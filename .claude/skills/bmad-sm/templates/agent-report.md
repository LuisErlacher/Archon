# Agent Report Template

## Success Report

Use this template for successful workflow execution:

```markdown
## Agent Report: {workflow-name}

**Status:** ✅ SUCCESS

**Workflow:** {workflow-name}
**Executed:** {ISO-8601-timestamp}
**Duration:** {time-in-seconds}s OR {time-in-minutes}m

**Actions Taken:**
- {Specific action 1 with details}
- {Specific action 2 with details}
- {Specific action 3 with details}
- {... additional actions}

**Files Modified:**
- {absolute-or-relative-path-1} ({created|updated|deleted})
- {absolute-or-relative-path-2} ({created|updated|deleted})
- {... additional files}

**Current State (after execution):**
- BACKLOG: {integer-count} stories
- TODO: {story-id} OR empty
- IN PROGRESS: {story-id} OR empty
- DONE: {integer-count} stories

**Next Action:**
{Clear, specific recommendation for what should happen next.
 Examples:
 - "User approval required for story draft"
 - "Launch SM agent with story-ready workflow"
 - "Launch DEV agent to implement story-X.Y"
 - "Epic complete, run retrospective workflow"}

**Notes:**
{Optional: Any important observations, warnings, architectural decisions,
 or context that would be helpful for understanding what was done.
 This section can be omitted if there's nothing notable to report.}
```

## Error Report

Use this template when workflow fails:

```markdown
## Agent Report: {workflow-name}

**Status:** ❌ FAILED

**Workflow:** {workflow-name}
**Failed At:** Step {step-number} - {step-name-from-workflow.yaml}
**Error:** {Concise, specific error message}

**Context:**
{Paragraph explaining what the workflow was attempting to do when it failed.
 Provide enough context for someone to understand the situation without
 needing to read the entire workflow definition.}

**Root Cause:**
{Technical explanation of WHY the failure occurred, not just WHAT failed.
 This should help determine if the issue is:
 - Configuration problem
 - Missing prerequisite
 - Data quality issue
 - Environmental issue
 - Workflow logic bug}

**Recovery Options:**
1. {Option 1: Most recommended approach}
   - What to fix
   - How to retry
   - Expected outcome

2. {Option 2: Alternative if Option 1 not viable}
   - Different approach
   - Tradeoffs
   - Expected outcome

3. {Option 3: Last resort or manual intervention}
   - When to use this
   - What it requires
   - Expected outcome

**Diagnostic Info:**
- Workflow status file: {✅ loaded | ❌ missing | ⚠️ corrupt}
- Config file: {✅ loaded | ❌ missing}
- Required files:
  - {file-path-1}: {✅ present | ❌ missing | ⚠️ invalid}
  - {file-path-2}: {✅ present | ❌ missing | ⚠️ invalid}
  - {... additional required files}
- Environment: {any relevant environment details}

**Orchestrator Action Required:**
{Specific, actionable instruction for what the orchestrator should do next.
 This should be unambiguous enough that automated decision-making is possible.
 Examples:
 - "Re-run workflow after creating docs/prd.md"
 - "Launch PRD generation workflow first"
 - "Request user to fix YAML syntax at line 23 of workflow-status.md"
 - "Manual intervention required: check file permissions"}
```

## Warning Report (Success with Warnings)

Use this template when workflow succeeds but with notable issues:

```markdown
## Agent Report: {workflow-name}

**Status:** ✅ SUCCESS (with warnings)

**Workflow:** {workflow-name}
**Executed:** {ISO-8601-timestamp}
**Duration:** {time}

**Actions Taken:**
- {Action 1}
- {Action 2}
- ⚠️ {Warning action or auto-recovery taken}
- {Action N}

**Files Modified:**
- {file-path-1} ({action})
- {file-path-2} ({action})

**Warnings:**
- ⚠️ {Warning 1: Description of what was unexpected or concerning}
- ⚠️ {Warning 2: Another issue that didn't prevent completion}

**Current State (after execution):**
- BACKLOG: {count} stories
- TODO: {story-id or "empty"}
- IN PROGRESS: {story-id or "empty"}
- DONE: {count} stories

**Next Action:**
{What should happen next, considering the warnings}

**Notes:**
{Explanation of warnings and why workflow was able to continue despite them.
 Include any recommendations for addressing the warnings later.}
```

## Template Usage Guidelines

### When to Use Each Template

**Success Report:**
- Workflow completed all steps
- All outputs created successfully
- No significant issues encountered
- State transitions are valid

**Error Report:**
- Workflow failed at any step
- Required file missing
- Data validation failed
- Cannot continue to completion

**Warning Report:**
- Workflow completed successfully
- BUT unexpected condition encountered
- Auto-recovery was performed
- Minor issue that didn't block completion

### Field Filling Guidelines

#### Timestamps
```
ISO 8601 format with timezone:
✅ Good: 2025-11-04T14:35:22-03:00
❌ Bad:  Nov 4, 2025 2:35 PM
❌ Bad:  2025-11-04 14:35:22
```

#### Duration
```
Use appropriate unit:
✅ Good: 45s (for under 2 minutes)
✅ Good: 3m (for 2+ minutes)
✅ Good: 15m (for longer workflows)
❌ Bad:  180s (use 3m instead)
```

#### Actions Taken
```
Be specific, not vague:
✅ Good: "Read PRD from docs/prd.md (3,245 lines)"
✅ Good: "Generated 5 acceptance criteria from requirements"
❌ Bad:  "Loaded context"
❌ Bad:  "Created story"
```

#### File Paths
```
Use consistent, unambiguous paths:
✅ Good: docs/stories/story-1.1-patient-registration.md
✅ Good: /home/user/project/docs/prd.md
⚠️ OK:   story-1.1-patient-registration.md (if context is clear)
❌ Bad:  ../stories/story.md (confusing relative path)
```

#### Story IDs
```
Use exact story identifier:
✅ Good: story-1.1-patient-registration
✅ Good: story-2.3-appointment-calendar
❌ Bad:  story 1.1
❌ Bad:  the patient registration story
```

#### Next Action
```
Be specific and actionable:
✅ Good: "Launch SM agent with story-context workflow for story-1.1"
✅ Good: "User approval required: review story draft and confirm ACs"
❌ Bad:  "Continue with next step"
❌ Bad:  "Do something"
```

### Common Mistakes to Avoid

**❌ Don't use placeholder values:**
```
Bad: **Duration:** {some time}
Good: **Duration:** 45s
```

**❌ Don't omit required fields:**
```
Bad: (Missing "Current State" section)
Good: Always include all required sections, even if "empty"
```

**❌ Don't be vague about files:**
```
Bad: Updated story file
Good: docs/stories/story-1.1-patient-registration.md (updated)
```

**❌ Don't use inconsistent emoji:**
```
Bad: ✓ SUCCESS
Good: ✅ SUCCESS (always use same emoji)
```

**❌ Don't continue list items across bullet points:**
```
Bad:
- Read PRD
  and epic file
Good:
- Read PRD from docs/prd.md
- Read Epic 1 file from docs/epic-1.md
```

### Quality Checklist

Before submitting a report, verify:

**For Success Reports:**
- [ ] Status line uses ✅ emoji
- [ ] Timestamp is ISO 8601 with timezone
- [ ] Actions list is specific (not vague)
- [ ] All file paths are accurate
- [ ] Current state numbers match reality
- [ ] Next action is clear and actionable

**For Error Reports:**
- [ ] Status line uses ❌ emoji
- [ ] Failed At specifies exact step
- [ ] Error message is concise but clear
- [ ] Root cause explains WHY not just WHAT
- [ ] At least 2 recovery options provided
- [ ] Diagnostic info uses correct emoji (✅/❌/⚠️)
- [ ] Orchestrator action is unambiguous

---

**Using these templates consistently ensures the orchestrator can reliably parse reports and make automated decisions.**
