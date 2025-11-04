---
name: bmad-orchestrator-v2
description: Orchestrate the BMAD Method v6a workflow with parallel batch execution (3 agents simultaneously) to develop complete epics 60% faster. Launch specialized agents (SM and DEV) in batches of 3 for story creation, context generation, implementation, and review. Use this skill when the user requests full epic development with optimized parallel execution across multiple BMAD agents.
---

# BMAD Orchestrator v2 - Parallel Batch Execution

## Overview

Orchestrate the complete BMAD Method v6a workflow to develop entire epics end-to-end with **parallel batch execution**. Launch specialized agents (SM for story management, DEV for implementation) in **batches of 3 simultaneously**, achieving 60% faster epic completion compared to sequential execution.

**Key Innovation:** Execute workflows in batches of 3 agents in parallel, reducing epic development time from ~10 hours → ~4 hours for 8 stories.

**Version 2.0 Changes:**
- ✨ Parallel execution: 3 agents run simultaneously (not sequentially)
- 🚀 3x speedup per phase (create, ready, context, develop, review)
- ⚙️ Barrier synchronization: Wait for ALL 3 agents before proceeding
- 🔧 Selective retry: Only retry failed stories, not entire batch
- 📊 Batched approvals: Review 3 stories at once

## Core Capabilities

### 1. Parallel Batch Execution (NEW in v2.0)

Execute workflows in **batches of 3 agents simultaneously** to maximize throughput.

#### Batch Size: 3 Agents

**Why 3 agents?**
- **Context efficiency:** 3 concurrent agents fit within typical context budgets
- **Manageable complexity:** Tracking 3 parallel executions is tractable
- **Optimal throughput:** Balances speed vs. orchestrator overhead
- **Error handling:** 3 failure scenarios easier to handle than 5+

#### Batch Execution Phases

**Phase 1: Create Stories** (3 SM agents in parallel)
- Launch 3 SM agents with `*create-story` workflow
- Each agent works on different story from BACKLOG
- Wait for ALL 3 to complete (barrier)
- Parse all 3 reports simultaneously

**Phase 2: Story Ready** (3 SM agents in parallel)
- Launch 3 SM agents with `*story-ready` workflow
- Each agent advances different story TODO → IN PROGRESS
- Wait for ALL 3 to complete
- Validate state transitions for all 3

**Phase 3: Story Context** (3 SM agents in parallel)
- Launch 3 SM agents with `*story-context` workflow
- Each agent generates context XML for different story
- Wait for ALL 3 to complete
- Extract and validate 3 context XML paths

**Phase 4: Implementation** (3 DEV agents in parallel)
- Launch 3 DEV agents with `*develop` workflow
- Each agent implements different story
- Wait for ALL 3 to complete (or reach blocker)
- Parse test results from all 3

**Phase 5: Review** (3 DEV agents in parallel)
- Launch 3 DEV agents with `*story-done` workflow
- Each agent marks story as DONE if tests 100% passing
- Wait for ALL 3 to complete
- Advance queue (3 stories: IN PROGRESS → DONE)

**Phase 6: Fix Failures** (Selective DEV retry)
- For each story that failed review:
  - Launch 1 DEV agent with `*develop` (retry)
  - Wait for completion
  - Re-run review for that story only

#### Launching Parallel Batch

**CRITICAL:** All 3 Task tool calls must be in **single message** to execute in parallel.

**Template (Phase 1: Create Stories):**

```
I'm launching 3 SM agents in parallel to create stories 1.1, 1.2, and 1.3.

Each agent will execute the *create-story workflow for their assigned story.
```

Then send 3 Task tool invocations in same message:

1. **Agent 1**: `subagent_type="scrum-master-bmad"`, prompt includes "Story 1.1, Agent 1 of 3"
2. **Agent 2**: `subagent_type="scrum-master-bmad"`, prompt includes "Story 1.2, Agent 2 of 3"
3. **Agent 3**: `subagent_type="scrum-master-bmad"`, prompt includes "Story 1.3, Agent 3 of 3"

**Barrier:** Wait for all 3 agents to return reports before proceeding.

**Detailed templates available in:** `assets/orchestration-templates/batch-create-story-3.md` and `batch-develop-story-3.md`

#### Handling Partial Failures

**Scenario:** Agent 2 fails, but Agents 1 and 3 succeed

```python
Batch results:
- Agent 1 (story-1.1): ✅ SUCCESS
- Agent 2 (story-1.2): ❌ FAILED (epic context missing)
- Agent 3 (story-1.3): ✅ SUCCESS

Orchestrator action:
1. Report partial failure to user
2. Offer options:
   a) Retry failed story (story-1.2) only
   b) Continue with successful stories (skip 1.2)
   c) Halt batch for investigation
```

**User selects: "Retry story-1.2"**

```
Launching 1 SM agent to retry story-1.2...
(Not a full batch of 3 - selective retry)

Agent completes:
- Agent (retry): ✅ SUCCESS - Story 1.2 created

All 3 stories now complete. Proceeding to approval gate.
```

#### Approval Gates with Batching

**Gate 1: Story Approval** (after create-story batch)
- Orchestrator reports: "3 stories drafted. Review all 3 and approve."
- User reviews all 3 story files
- User responds: "approved" (or requests changes)
- Orchestrator proceeds to next phase for all 3

**Gate 2: DoD Verification** (after develop batch)
- Orchestrator reports: "3 stories implemented. All tests 100% passing. Verify DoD."
- User verifies all 3 implementations
- User responds: "done" (or reports issues)
- Orchestrator marks all 3 as DONE

**Key Change:** Gates now cover **batches of 3** instead of individual stories.

#### Performance Gains

**Sequential Execution (v1.5):**
```
Story 1.1: 75 minutes
Story 1.2: 75 minutes
Story 1.3: 75 minutes
Total: 225 minutes for 3 stories
```

**Parallel Batching (v2.0):**
```
Batch 1 (3 stories in parallel): 75-90 minutes
Total: 90 minutes for 3 stories

Speedup: 225 → 90 minutes (60% faster)
```

**Epic with 8 stories:**
- v1.5 (sequential): ~10 hours
- v2.0 (batching): ~4 hours
- **Overall speedup: 60%**

### 2. Workflow State Assessment

(Inherited from v1.5 - unchanged)

Before any orchestration, assess the current workflow state:

1. **Load workflow status file**: `{project-root}/docs/bmm-workflow-status.md`
2. **Identify current phase**: Analysis, Planning, Solutioning, or Implementation
3. **Check story queue**:
   - **BACKLOG**: Stories waiting to be drafted
   - **TODO**: Story ready for SM to draft (or drafted, awaiting approval)
   - **IN PROGRESS**: Story approved for DEV implementation
   - **DONE**: Completed stories
4. **Determine next action** based on state machine position

For detailed dual status tracking and conflict resolution, see `references/bmad-workflow-states.md`.

### 3. Agent Launching with Specialized Agents

(Inherited from v1.5 - adapted for batching)

Launch agents using the Task tool with specialized agent types:

**Scrum Master (SM) Agent** (for batches of 3):
```
Use Task tool with subagent_type="scrum-master-bmad" and prompt:
"You are Bob, the BMAD Scrum Master agent #[1/2/3].

Execute the [workflow-name] workflow (e.g., *create-story).

**BATCH CONTEXT:**
- You are Agent [N] in a batch of 3 agents
- Agent [M] is working on story [X] simultaneously
- Agent [K] is working on story [Y] simultaneously

**CRITICAL:**
- Execute independently (no coordination needed)
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: [X.Y]
- Files Modified
- Next Action"
```

**Developer (DEV) Agent** (for batches of 3):
```
Use Task tool with subagent_type="agent-skill-dev" and prompt:
"You are Amelia, the BMAD Developer agent #[1/2/3].

Execute the [workflow-name] workflow (e.g., *develop).

**BATCH CONTEXT:**
- You are Agent [N] in a batch of 3 agents
- Agent [M] is implementing story [X] simultaneously
- Agent [K] is implementing story [Y] simultaneously

**CRITICAL:**
- Execute independently (no coordination needed)
- Do NOT proceed if tests not 100% passing
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: [X.Y]
- Test Results (X/X passing, Y%)
- Next Action"
```

### 4. Edge Cases in Batching

**Case 1: Backlog has < 3 stories**

Launch **partial batch** (2 agents instead of 3):

```python
def determine_batch_size(backlog_count: int) -> int:
    """Determine how many agents to launch"""
    IDEAL_BATCH_SIZE = 3

    if backlog_count >= IDEAL_BATCH_SIZE:
        return IDEAL_BATCH_SIZE  # Full batch
    else:
        return backlog_count  # Partial batch (1 or 2)
```

**Case 2: All 3 agents in batch fail**

HALT orchestration - systemic failure detected:

```
Batch results:
- Agent 1: ❌ FAILED
- Agent 2: ❌ FAILED
- Agent 3: ❌ FAILED

Success rate: 0%

Orchestrator action: HALT
Reason: All 3 agents failed - investigate root cause
Recommendation: Check epic file, PRD, or system issues
```

**Case 3: DEV tests failing in batch**

**Scenario:** Agent 2 has failing tests (60%), but Agents 1 and 3 pass (100%)

**Recovery:**
```
Agent 1 (story-1.1): ✅ Tests 100% passing
Agent 2 (story-1.2): ❌ Tests 60% passing (AuthService mock issue)
Agent 3 (story-1.3): ✅ Tests 100% passing

Options:
1. Fix mock for story-1.2 and retry (selective retry)
2. Continue with 1.1 and 1.3 to DoD, retry 1.2 later
3. Halt batch for investigation

User selects: "Fix and retry"

[User fixes mock]

Launching 1 DEV agent to retry story-1.2...
Agent (retry): ✅ Tests 100% passing

All 3 stories now ready for DoD verification.
```

### 5. Complete Epic Flow with Batching

**Epic with 8 stories: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**

```
BATCH 1 (Stories 1.1, 1.2, 1.3):
├─ Phase 1: Create stories (3 SM agents in parallel) - 12 min
│   └─ BARRIER: Wait for all 3
├─ GATE: User approval for 3 stories - 5 min
├─ Phase 2: Move to Ready (3 SM agents in parallel) - 7 min
│   └─ BARRIER: Wait for all 3
├─ Phase 3: Generate context (3 SM agents in parallel) - 12 min
│   └─ BARRIER: Wait for all 3
├─ Phase 4: Implement (3 DEV agents in parallel) - 50 min
│   └─ BARRIER: Wait for all 3
│   └─ RECOVERY: Retry failed story if any
├─ GATE: User DoD verification for 3 stories - 5 min
└─ Phase 5: Mark Done (3 DEV agents in parallel) - 7 min
    └─ BARRIER: Wait for all 3

BATCH 1 TOTAL: ~90 minutes for 3 stories

BATCH 2 (Stories 1.4, 1.5, 1.6): ~90 minutes

BATCH 3 (Stories 1.7, 1.8): ~60 minutes (partial batch - only 2 stories)

EPIC TOTAL: ~240 minutes (4 hours)

vs. Sequential v1.5: ~600 minutes (10 hours)

Speedup: 60% faster
```

## Resources

### references/

**parallel-batching-guide.md**: Comprehensive guide to parallel batching strategy, including implementation patterns, error handling, and performance analysis.

**bmad-workflow-states.md**: Detailed reference for the 4-state story machine (BACKLOG, TODO, IN PROGRESS, DONE) with validation rules and state transition logic.

**bmad-agent-skills-mapping.md**: Maps each workflow to the appropriate agent and skill, ensuring correct delegation.

### assets/orchestration-templates/

**batch-create-story-3.md**: Template for launching 3 SM agents to create stories in parallel. Includes prompt templates with batch context.

**batch-develop-story-3.md**: Template for launching 3 DEV agents to implement stories in parallel. Includes context passing and test result handling.

**Single-agent templates** (from v1.5): Available for fallback or edge cases where batching isn't applicable.

## Best Practices

1. **Always send 3 Task calls in single message** - Ensures parallel execution
2. **Wait for ALL 3 agents (barrier)** - Process results only after all complete
3. **Handle partial failures gracefully** - Retry only failed stories, not entire batch
4. **Validate state transitions** - Check workflow status after each batch phase
5. **Respect approval gates** - Gates now cover batches of 3 stories
6. **Use partial batches for < 3 stories** - Launch 2 or 1 agents if needed
7. **Load parallel-batching-guide.md** - For detailed implementation patterns
8. **Trust the barrier pattern** - Never proceed until all 3 agents complete
9. **Report batch progress** - Users need visibility (e.g., "Batch 1: 3/3 complete")
10. **Selective retry for efficiency** - Don't re-run successful agents

## Migration from v1.5

**Key Differences:**
- v1.5: Sequential execution (1 agent at a time)
- v2.0: Parallel batching (3 agents simultaneously)

**Upgrade Path:**
1. Use v2.0 for new epic orchestrations (60% faster)
2. v1.5 still available for single-story workflows or debugging
3. Batching automatically handles edge cases (< 3 stories → partial batch)

**When to use v1.5:**
- Debugging specific story failures
- Single story implementation
- Testing new workflow before batching

**When to use v2.0:**
- Full epic development (8+ stories)
- Time-critical sprints
- Normal production workflow

## Notes

- This orchestrator is for **Phase 4 (Implementation)** workflows only
- For Phase 1-3, run workflows directly via agent commands
- Orchestrator coordinates, does NOT make architectural decisions
- All technical decisions happen within agent contexts
- v2.0 maintains full backward compatibility with v1.5 patterns
- Batching is transparent to SM/DEV agents (they execute independently)
