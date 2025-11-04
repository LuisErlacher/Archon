# BMAD Workflow States Reference

## State Machine Overview

The BMAD Implementation Phase (Phase 4) uses a 4-state lifecycle to manage story progression:

```
BACKLOG → TODO → IN PROGRESS → DONE
```

## State Definitions

### BACKLOG

**Purpose**: Ordered queue of stories waiting to be drafted

**Characteristics**:
- Contains story IDs, titles, and file paths
- Order is sequential (Epic 1 stories, then Epic 2, etc.)
- Stories do NOT have files created yet
- Automatically populated at phase transition from Planning/Solutioning

**Example in bmm-workflow-status.md**:
```markdown
## Phase 4: Implementation

### BACKLOG
- story-1.2-implement-jwt-validation.md - JWT Token Validation
- story-1.3-password-reset-flow.md - Password Reset Flow
- story-2.1-patient-crud-api.md - Patient CRUD API
```

**Valid Operations**:
- ✅ Read list for planning
- ✅ Move first story to TODO (automatic via story-ready)
- ❌ Skip stories out of order
- ❌ Modify story details (stories don't exist yet)

### TODO

**Purpose**: Single story ready for SM to draft (or drafted, awaiting user approval)

**Characteristics**:
- Contains exactly ONE story at a time
- Story file may or may not exist yet
- If file exists, Status="Draft"
- User approval required before advancement

**Example in bmm-workflow-status.md**:
```markdown
### TODO
- story-1.1-user-authentication.md - User Authentication Setup (Status: Draft, awaiting approval)
```

**Valid Operations**:
- ✅ SM runs create-story to draft story file
- ✅ User reviews drafted story
- ✅ SM runs story-ready to advance (after user approval)
- ❌ DEV cannot work on TODO stories
- ❌ Cannot have multiple stories in TODO

**Story File Status**: `Draft`

### IN PROGRESS

**Purpose**: Single story approved for development

**Characteristics**:
- Contains exactly ONE story at a time
- Story file exists with Status="Ready" or "In Review"
- May have associated Context XML file
- DEV agent implements story here

**Example in bmm-workflow-status.md**:
```markdown
### IN PROGRESS
- story-1.1-user-authentication.md - User Authentication Setup (Status: Ready, assigned to DEV)
```

**Valid Operations**:
- ✅ SM runs story-context to generate expertise injection
- ✅ DEV runs dev-story to implement
- ✅ DEV runs story-done to advance (after user DoD verification)
- ❌ SM cannot draft new stories here
- ❌ Cannot have multiple stories in progress

**Story File Status**: `Ready` (not yet started) or `In Review` (implementation complete)

### DONE

**Purpose**: Immutable record of completed stories

**Characteristics**:
- Contains all completed stories with metadata
- Each entry includes completion date and story points
- Stories have Status="Done" in their files
- Cannot be modified (only appended to)

**Example in bmm-workflow-status.md**:
```markdown
### DONE
- story-1.1-user-authentication.md - User Authentication Setup (3 SP, completed 2025-11-04)
- story-1.2-jwt-validation.md - JWT Token Validation (2 SP, completed 2025-11-05)
```

**Valid Operations**:
- ✅ Append newly completed stories
- ✅ Read for progress tracking
- ✅ Reference for retrospectives
- ❌ Modify completed stories
- ❌ Remove stories from DONE

**Story File Status**: `Done`

## State Transitions

### Automatic Transitions

**Phase Transition → BACKLOG**:
- Trigger: Completing Planning (Phase 2) or Solutioning (Phase 3)
- Action: All epic stories enumerated in BACKLOG
- Result: First story moved to TODO

**BACKLOG → TODO**:
- Trigger: story-ready workflow completes
- Action: Next story in BACKLOG moves to TODO
- Result: New story ready for drafting

### Manual Transitions (via workflows)

**TODO → IN PROGRESS**:
- Workflow: `story-ready` (SM agent)
- Prerequisite: Story drafted (Status="Draft") AND user approved
- Action: Move story to IN PROGRESS, mark Status="Ready"
- Side Effect: Next BACKLOG story moves to TODO

**IN PROGRESS → DONE**:
- Workflow: `story-done` (DEV agent)
- Prerequisite: Implementation complete AND tests 100% passing AND user verified DoD
- Action: Move story to DONE with completion date and points
- Side Effect: TODO story moves to IN PROGRESS, BACKLOG story moves to TODO

## Validation Rules

### BACKLOG Validation
- ✅ Can have 0+ stories
- ✅ Stories must have unique IDs
- ✅ Stories must reference valid epic
- ❌ Cannot contain duplicate stories
- ❌ Cannot skip epic order

### TODO Validation
- ✅ Must have exactly 0 or 1 story
- ✅ If 1 story, must be from BACKLOG or current TODO
- ❌ Cannot have multiple stories
- ❌ Cannot skip to later epics

### IN PROGRESS Validation
- ✅ Must have exactly 0 or 1 story
- ✅ Story must exist as file with Status="Ready" or "In Review"
- ✅ Story must have been in TODO previously
- ❌ Cannot have multiple stories
- ❌ Cannot move stories directly from BACKLOG

### DONE Validation
- ✅ Can have 0+ stories
- ✅ Each story must have completion date
- ✅ Each story must have story points
- ✅ Story files must have Status="Done"
- ❌ Cannot modify completed stories
- ❌ Cannot have stories without dates/points

## Common Scenarios

### Starting Fresh Epic
```
Initial State:
BACKLOG: [8 stories from Epic 1]
TODO: [empty]
IN PROGRESS: [empty]
DONE: [empty]

After Phase Transition:
BACKLOG: [7 stories remaining]
TODO: [story-1.1]
IN PROGRESS: [empty]
DONE: [empty]
```

### Story Creation Flow
```
1. TODO has story-1.1 (not drafted yet)
2. SM runs create-story → story file created, Status="Draft"
3. User reviews, approves
4. SM runs story-ready:
   - TODO story-1.1 → IN PROGRESS, Status="Ready"
   - BACKLOG story-1.2 → TODO
```

### Story Completion Flow
```
1. IN PROGRESS has story-1.1 (Status="Ready")
2. SM runs story-context → context XML created
3. DEV runs dev-story → implements, tests pass
4. DEV marks Status="In Review"
5. User verifies DoD
6. DEV runs story-done:
   - IN PROGRESS story-1.1 → DONE with metadata
   - TODO story-1.2 → IN PROGRESS
   - BACKLOG story-1.3 → TODO
```

### Epic Completion
```
Final State:
BACKLOG: [empty]
TODO: [empty]
IN PROGRESS: [empty]
DONE: [all 8 stories with dates/points]

Next Action: Run retrospective workflow
```

## Error States and Recovery

### Multiple Stories in TODO
- **Symptom**: TODO section has 2+ stories
- **Cause**: Manual edit or workflow error
- **Recovery**: Remove all but first story, return others to BACKLOG

### Story in IN PROGRESS without file
- **Symptom**: Status file shows story, but file doesn't exist
- **Cause**: File deleted or workflow interrupted
- **Recovery**: Move story back to TODO, re-run create-story

### Story file Status mismatch
- **Symptom**: IN PROGRESS shows story, but file Status="Draft"
- **Cause**: story-ready workflow didn't complete
- **Recovery**: Re-run story-ready workflow

### DONE story missing metadata
- **Symptom**: Story in DONE without date or points
- **Cause**: story-done workflow incomplete
- **Recovery**: Add metadata manually or re-run story-done

## Reading Workflow Status File

**Python Example**:
```python
def read_workflow_status():
    with open('docs/bmm-workflow-status.md', 'r') as f:
        content = f.read()

    # Parse sections
    backlog = extract_section(content, '### BACKLOG')
    todo = extract_section(content, '### TODO')
    in_progress = extract_section(content, '### IN PROGRESS')
    done = extract_section(content, '### DONE')

    return {
        'backlog': backlog,
        'todo': todo,
        'in_progress': in_progress,
        'done': done
    }
```

**Key Parsing Rules**:
- Each section starts with `### SECTION_NAME`
- Stories are markdown list items: `- filename.md - Title (metadata)`
- Metadata format: `(Status: X)` or `(X SP, completed YYYY-MM-DD)`
- Empty sections have no list items

## State Machine Invariants

**Must ALWAYS be true**:
1. TODO contains 0 or 1 story (never 2+)
2. IN PROGRESS contains 0 or 1 story (never 2+)
3. Story in IN PROGRESS must have file with Status="Ready" or "In Review"
4. Story in DONE must have completion date and story points
5. Stories advance in order (cannot skip)
6. Total stories = BACKLOG + TODO + IN PROGRESS + DONE

**If any invariant violated**:
- HALT orchestration
- Report error to user
- Offer manual intervention options
