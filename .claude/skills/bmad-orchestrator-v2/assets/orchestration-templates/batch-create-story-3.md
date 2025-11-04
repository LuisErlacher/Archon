# Batch Create Story Template (3 SM Agents in Parallel)

**Purpose:** Launch 3 SM agents simultaneously to create 3 stories from BACKLOG
**Agent Type:** scrum-master-bmad
**Workflow:** *create-story
**Batch Size:** 3 agents

---

## Usage

Use this template when launching a batch of 3 SM agents to create stories in parallel.

**Prerequisites:**
- At least 3 stories in BACKLOG
- Workflow status file exists
- Epic file exists with story outlines

**Template Variables:**
- `{story_id_1}`: First story ID (e.g., "story-1.1")
- `{story_id_2}`: Second story ID (e.g., "story-1.2")
- `{story_id_3}`: Third story ID (e.g., "story-1.3")
- `{epic_file}`: Path to epic file (e.g., "docs/epics/epic-1.md")

---

## Prompt Template

**Orchestrator Message:**
```
I'm launching 3 SM agents in parallel to create stories {story_id_1}, {story_id_2}, and {story_id_3}.

Each agent will execute the *create-story workflow for their assigned story.
```

**Task Tool Calls (all 3 in single message):**

### Agent 1 - Story {story_id_1}

```
Subagent Type: scrum-master-bmad
Description: Create {story_id_1} (Agent 1 of 3)
Prompt:

You are Bob, the BMAD Scrum Master agent #1.

Execute the *create-story workflow for {story_id_1} from BACKLOG.

**CONTEXT:**
- Workflow status: docs/bmm-workflow-status.md
- Epic file: {epic_file}
- PRD: docs/prd.md
- Sprint status: docs/sprint-status.yaml

**BATCH CONTEXT:**
- You are Agent 1 in a batch of 3 agents
- Agent 2 is creating {story_id_2} simultaneously
- Agent 3 is creating {story_id_3} simultaneously

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: {story_id_1}
- Files Modified
- Current State
- Next Action
```

### Agent 2 - Story {story_id_2}

```
Subagent Type: scrum-master-bmad
Description: Create {story_id_2} (Agent 2 of 3)
Prompt:

You are Bob, the BMAD Scrum Master agent #2.

Execute the *create-story workflow for {story_id_2} from BACKLOG.

**CONTEXT:**
- Workflow status: docs/bmm-workflow-status.md
- Epic file: {epic_file}
- PRD: docs/prd.md
- Sprint status: docs/sprint-status.yaml

**BATCH CONTEXT:**
- You are Agent 2 in a batch of 3 agents
- Agent 1 is creating {story_id_1} simultaneously
- Agent 3 is creating {story_id_3} simultaneously

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: {story_id_2}
- Files Modified
- Current State
- Next Action
```

### Agent 3 - Story {story_id_3}

```
Subagent Type: scrum-master-bmad
Description: Create {story_id_3} (Agent 3 of 3)
Prompt:

You are Bob, the BMAD Scrum Master agent #3.

Execute the *create-story workflow for {story_id_3} from BACKLOG.

**CONTEXT:**
- Workflow status: docs/bmm-workflow-status.md
- Epic file: {epic_file}
- PRD: docs/prd.md
- Sprint status: docs/sprint-status.yaml

**BATCH CONTEXT:**
- You are Agent 3 in a batch of 3 agents
- Agent 1 is creating {story_id_1} simultaneously
- Agent 2 is creating {story_id_2} simultaneously

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: {story_id_3}
- Files Modified
- Current State
- Next Action
```

---

## After Barrier (All 3 Agents Complete)

**Process batch results:**

```python
# Parse all 3 reports
batch_results = process_batch_reports([agent1_report, agent2_report, agent3_report])

# Check success rate
if batch_results['success_rate'] == 100:
    # All 3 succeeded - proceed to approval gate
    report_to_user(f"✅ 3 stories created successfully: {batch_results['success_stories']}")
    proceed_to_approval_gate()

elif batch_results['success_rate'] == 0:
    # All 3 failed - HALT
    halt_orchestration("All 3 agents failed - investigate root cause")

else:
    # Partial failure - handle recovery
    handle_partial_failure(batch_results)
```

---

## Example Execution

**Input:**
- story_id_1 = "story-1.1"
- story_id_2 = "story-1.2"
- story_id_3 = "story-1.3"
- epic_file = "docs/epics/epic-1.md"

**Expected Output:**
```
Batch complete: 3/3 successful

Agent 1 (story-1.1): ✅ SUCCESS - Story drafted
Agent 2 (story-1.2): ✅ SUCCESS - Story drafted
Agent 3 (story-1.3): ✅ SUCCESS - Story drafted

Files Created:
- docs/stories/story-1.1-user-authentication.md
- docs/stories/story-1.2-password-reset.md
- docs/stories/story-1.3-email-verification.md

Next Action: User approval required for 3 stories
```

---

## Notes

- Always send all 3 Task tool calls in **single message** for parallel execution
- Wait for ALL 3 agents to complete before processing results (barrier)
- Handle partial failures gracefully (retry failed stories only)
- Each agent works on independent story file (no conflicts)
