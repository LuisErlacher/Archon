# BMAD Orchestrator - Parallel Batching Strategy Guide

**Document Type:** Technical Enhancement Specification
**Version:** 2.0.0-parallel
**Date:** 2025-11-04
**Author:** BMad Master Agent
**Purpose:** Transform sequential orchestration into parallel batch execution (3 agents simultaneously)
**Target Audience:** Skill Creator Agent / Implementation Team
**Based On:** ORCHESTRATOR-IMPROVEMENT-GUIDE.md (v1.5)

---

## 📋 EXECUTIVE SUMMARY

### Current State (v1.5 - Sequential)
- **Execution Model:** One agent at a time (sequential)
- **Epic Completion Time:** ~8-12 hours for 8 stories (1-1.5 hours per story)
- **Agent Utilization:** Single-threaded (1 agent active)
- **Bottleneck:** Waiting for each agent to complete before starting next

### Target State (v2.0 - Parallel Batching)
- **Execution Model:** 3 agents simultaneously (batching)
- **Epic Completion Time:** ~3-5 hours for 8 stories (3x faster)
- **Agent Utilization:** Multi-threaded (up to 3 agents active)
- **Optimization:** Batches of 3 execute in parallel, reducing idle time

### Key Change: Batch Execution Strategy

**Old Workflow (Sequential):**
```
SM creates story 1 → wait → SM creates story 2 → wait → SM creates story 3 → wait
Total time: 3 × T_create ≈ 30-45 minutes
```

**New Workflow (Parallel Batching):**
```
┌─ SM Agent 1 creates story 1 ─┐
├─ SM Agent 2 creates story 2 ─┤ → All execute in parallel
└─ SM Agent 3 creates story 3 ─┘
Total time: max(T_create_1, T_create_2, T_create_3) ≈ 10-15 minutes
```

**Performance Gain:** 3x speedup per phase (create, ready, develop, review)

---

## 🎯 PARALLEL BATCHING ARCHITECTURE

### Core Concept: Batch Size = 3

**Why 3 agents?**
- **Context efficiency:** 3 concurrent agents fit within typical context budgets
- **Manageable complexity:** Tracking 3 parallel executions is tractable
- **Optimal throughput:** Balances speed vs. orchestrator overhead
- **Error handling:** 3 failure scenarios easier to handle than 5+

### Batch Execution Phases

**Phase 1: Story Creation (SM Batch)**
- Launch 3 SM agents in parallel with `*create-story` workflow
- Each agent works on different story from BACKLOG
- Wait for ALL 3 to complete before proceeding
- Parse all 3 reports simultaneously

**Phase 2: Story Ready (SM Batch)**
- Launch 3 SM agents in parallel with `*story-ready` workflow
- Each agent advances different story TODO → IN PROGRESS
- Wait for ALL 3 to complete
- Validate state transitions for all 3

**Phase 3: Story Context (SM Batch)**
- Launch 3 SM agents in parallel with `*story-context` workflow
- Each agent generates context XML for different story
- Wait for ALL 3 to complete
- Extract and validate 3 context XML paths

**Phase 4: Implementation (DEV Batch)**
- Launch 3 DEV agents in parallel with `*develop` workflow
- Each agent implements different story
- Wait for ALL 3 to complete (or reach blocker)
- Parse test results from all 3

**Phase 5: Review (DEV Batch)**
- Launch 3 DEV agents in parallel with `*story-done` workflow
- Each agent marks story as DONE if tests 100% passing
- Wait for ALL 3 to complete
- Advance queue (3 stories: IN PROGRESS → DONE)

**Phase 6: Fix Failures (Selective DEV)**
- For each story that failed review:
  - Launch 1 DEV agent with `*develop` (retry)
  - Wait for completion
  - Re-run review for that story only

### Synchronization Model: Barrier Pattern

```
┌────────────────────────────────────────┐
│ Orchestrator Launches 3 Agents        │
│  - Agent 1: Task(story-1.1, workflow)  │
│  - Agent 2: Task(story-1.2, workflow)  │
│  - Agent 3: Task(story-1.3, workflow)  │
└──────────────┬─────────────────────────┘
               │
               ↓
        ┌──────────────┐
        │ BARRIER WAIT │ ← Wait for ALL 3 agents
        │ (Sync Point) │
        └──────┬───────┘
               │
      ┌────────┴────────┐
      │   All Complete? │
      └────────┬────────┘
               │
          ┌────┴────┐
         Yes       No
          │         │
          ↓         ↓
    ┌─────────┐ ┌────────────┐
    │Continue │ │Keep Waiting│
    │To Next  │ │(Poll/Block)│
    │Phase    │ └────────────┘
    └─────────┘
```

**Barrier Implementation:**
- Orchestrator sends 3 Task tool calls in **single message** (parallel invocation)
- Wait for 3 agent reports to return
- Process all 3 reports before advancing to next phase
- If any agent fails, handle recovery for that story specifically

---

## 🔧 IMPLEMENTATION: PARALLEL AGENT LAUNCHING

### Pattern 1: Launch 3 Agents Simultaneously

**Key Requirement:** Send 3 Task tool calls in **one message** to execute in parallel.

**Example: Create 3 Stories in Parallel**

```markdown
I'm going to launch 3 SM agents in parallel to create stories 1.1, 1.2, and 1.3.

Each agent will execute the `*create-story` workflow for their assigned story.
```

**Task Tool Calls (in single message):**

```xml
<!-- Agent 1: Create story 1.1 -->
<Task>
  <subagent_type>scrum-master-bmad</subagent_type>
  <description>Create story 1.1 (Agent 1 of 3)</description>
  <prompt>
You are Bob, the BMAD Scrum Master agent #1.

Execute the *create-story workflow for Story 1.1 from BACKLOG.

**CONTEXT:**
- Workflow status: docs/bmm-workflow-status.md
- Epic file: docs/epics/epic-1.md
- PRD: docs/prd.md
- Sprint status: docs/sprint-status.yaml

**BATCH CONTEXT:**
- You are Agent 1 in a batch of 3 agents
- Agent 2 is creating Story 1.2 simultaneously
- Agent 3 is creating Story 1.3 simultaneously

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: 1.1
- Files Modified
- Current State
- Next Action
  </prompt>
</Task>

<!-- Agent 2: Create story 1.2 -->
<Task>
  <subagent_type>scrum-master-bmad</subagent_type>
  <description>Create story 1.2 (Agent 2 of 3)</description>
  <prompt>
You are Bob, the BMAD Scrum Master agent #2.

Execute the *create-story workflow for Story 1.2 from BACKLOG.

**CONTEXT:**
- Workflow status: docs/bmm-workflow-status.md
- Epic file: docs/epics/epic-1.md
- PRD: docs/prd.md
- Sprint status: docs/sprint-status.yaml

**BATCH CONTEXT:**
- You are Agent 2 in a batch of 3 agents
- Agent 1 is creating Story 1.1 simultaneously
- Agent 3 is creating Story 1.3 simultaneously

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: 1.2
- Files Modified
- Current State
- Next Action
  </prompt>
</Task>

<!-- Agent 3: Create story 1.3 -->
<Task>
  <subagent_type>scrum-master-bmad</subagent_type>
  <description>Create story 1.3 (Agent 3 of 3)</description>
  <prompt>
You are Bob, the BMAD Scrum Master agent #3.

Execute the *create-story workflow for Story 1.3 from BACKLOG.

**CONTEXT:**
- Workflow status: docs/bmm-workflow-status.md
- Epic file: docs/epics/epic-1.md
- PRD: docs/prd.md
- Sprint status: docs/sprint-status.yaml

**BATCH CONTEXT:**
- You are Agent 3 in a batch of 3 agents
- Agent 1 is creating Story 1.1 simultaneously
- Agent 2 is creating Story 1.2 simultaneously

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: 1.3
- Files Modified
- Current State
- Next Action
  </prompt>
</Task>
```

**After Barrier:**

All 3 agents complete and return reports. Orchestrator processes all 3 reports before proceeding.

### Pattern 2: Process Batch Results

**After 3 agents complete, parse all reports:**

```python
def process_batch_reports(reports: list[str]) -> dict:
    """
    Process 3 agent reports from parallel batch execution
    Returns aggregated results and any failures
    """
    parsed_reports = []
    successes = []
    failures = []

    for i, report in enumerate(reports, 1):
        parsed = parse_agent_report(report)
        parsed['agent_number'] = i
        parsed_reports.append(parsed)

        if parsed['status'] == 'SUCCESS':
            successes.append(parsed)
        else:
            failures.append(parsed)

    return {
        'total': len(reports),
        'successes': len(successes),
        'failures': len(failures),
        'success_rate': len(successes) / len(reports) * 100,
        'reports': parsed_reports,
        'success_stories': [r['story_id'] for r in successes],
        'failed_stories': [r['story_id'] for r in failures]
    }

# Example usage:
batch_results = process_batch_reports([report1, report2, report3])

print(f"Batch complete: {batch_results['successes']}/3 successful")
if batch_results['failures'] > 0:
    print(f"Failed stories: {batch_results['failed_stories']}")
```

### Pattern 3: Handle Partial Failures

**Scenario:** Agent 2 fails, but Agent 1 and Agent 3 succeed

```python
def handle_partial_batch_failure(batch_results: dict):
    """
    Handle case where some agents succeed and some fail
    """
    if batch_results['success_rate'] == 100:
        # All succeeded - continue to next phase
        return {'action': 'CONTINUE', 'next_phase': 'story-ready'}

    elif batch_results['success_rate'] == 0:
        # All failed - HALT orchestration
        return {
            'action': 'HALT',
            'reason': 'Batch completely failed - investigate root cause'
        }

    else:
        # Partial failure - retry failed stories only
        failed_stories = batch_results['failed_stories']

        print(f"⚠️  Partial batch failure: {len(failed_stories)} stories failed")
        print(f"Failed stories: {', '.join(failed_stories)}")
        print("\nOptions:")
        print("1. Retry failed stories (re-launch agents for failed stories only)")
        print("2. Continue with successful stories (skip failed for now)")
        print("3. Halt batch for investigation")

        user_choice = WAIT_FOR_USER_INPUT()

        if user_choice == '1':
            # Retry only failed stories
            return {
                'action': 'RETRY',
                'stories_to_retry': failed_stories,
                'successful_stories': batch_results['success_stories']
            }
        elif user_choice == '2':
            # Skip failed, continue with successes
            return {
                'action': 'SKIP_FAILED',
                'proceeding_with': batch_results['success_stories'],
                'skipped': failed_stories
            }
        elif user_choice == '3':
            # Halt for investigation
            return {
                'action': 'HALT',
                'reason': 'User requested halt for investigation'
            }

# Example execution:
recovery = handle_partial_batch_failure(batch_results)

if recovery['action'] == 'RETRY':
    # Launch agents only for failed stories
    retry_stories(recovery['stories_to_retry'])
elif recovery['action'] == 'CONTINUE':
    # Move to next batch phase
    launch_next_batch_phase()
elif recovery['action'] == 'HALT':
    # Stop orchestration
    halt_orchestration(recovery['reason'])
```

### Pattern 4: Selective Retry (DEV Failures)

**Scenario:** 3 DEV agents implement stories, Agent 2 has failing tests

```
Agent 1 (story-1.1): ✅ Tests 100% passing
Agent 2 (story-1.2): ❌ Tests 60% passing (AuthService mock issue)
Agent 3 (story-1.3): ✅ Tests 100% passing
```

**Recovery Strategy:**

```python
def handle_dev_batch_failures(batch_results: dict):
    """
    Handle DEV batch where some stories have failing tests
    """
    passing_stories = []
    failing_stories = []

    for report in batch_results['reports']:
        if report['status'] == 'SUCCESS' and report.get('test_results', {}).get('percentage') == 100:
            passing_stories.append(report['story_id'])
        else:
            failing_stories.append({
                'story_id': report['story_id'],
                'test_percentage': report.get('test_results', {}).get('percentage', 0),
                'error': report.get('error', 'Unknown error')
            })

    if failing_stories:
        print(f"\n🔍 Batch Review Results:")
        print(f"✅ Passing: {len(passing_stories)} stories")
        print(f"❌ Failing: {len(failing_stories)} stories\n")

        print("Failed stories:")
        for failure in failing_stories:
            print(f"  - {failure['story_id']}: {failure['test_percentage']}% tests passing")
            print(f"    Error: {failure['error']}\n")

        print("Options:")
        print("1. Fix issues and retry failed stories only")
        print("2. Mark passing stories as DONE, retry failed later")
        print("3. Halt all for debugging")

        user_choice = WAIT_FOR_USER_INPUT()

        if user_choice == '1':
            # Wait for user to fix, then retry ONLY failed stories
            print("Fix issues for failed stories, then type 'retry'")
            WAIT_FOR_USER_INPUT()

            # Launch DEV agents ONLY for failed stories (not a full batch of 3)
            launch_selective_retry([f['story_id'] for f in failing_stories])

        elif user_choice == '2':
            # Mark passing stories as DONE, queue failed for later
            mark_stories_done(passing_stories)
            queue_for_retry(failing_stories)

        elif user_choice == '3':
            # Halt entire batch
            halt_orchestration("User requested halt for debugging")

# Example: Selective retry
def launch_selective_retry(failed_story_ids: list[str]):
    """
    Launch DEV agents ONLY for stories that failed tests
    Not a full batch of 3 - only as many as failed
    """
    print(f"Retrying {len(failed_story_ids)} failed stories...")

    # Launch 1 agent per failed story (could be 1, 2, or 3 agents)
    # This is NOT a batch of 3 - it's dynamic based on failures

    for story_id in failed_story_ids:
        # Launch single DEV agent with retry context
        launch_dev_agent_with_retry(story_id)

    # Wait for all retry agents to complete
    wait_for_all_retries()
```

---

## 📊 BATCH ORCHESTRATION WORKFLOW

### Complete Epic Flow with Batching

```
Epic with 8 stories: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8

BATCH 1 (Stories 1.1, 1.2, 1.3):
├─ Phase 1: Create stories (3 SM agents in parallel)
│   ├─ Agent 1: create-story for 1.1 ✅
│   ├─ Agent 2: create-story for 1.2 ✅
│   └─ Agent 3: create-story for 1.3 ✅
│   └─ BARRIER: Wait for all 3, parse reports
│
├─ GATE: User approval for 3 stories (review 1.1, 1.2, 1.3)
│   └─ User: "All approved"
│
├─ Phase 2: Move to Ready (3 SM agents in parallel)
│   ├─ Agent 1: story-ready for 1.1 ✅
│   ├─ Agent 2: story-ready for 1.2 ✅
│   └─ Agent 3: story-ready for 1.3 ✅
│   └─ BARRIER: Wait for all 3, validate state transitions
│
├─ Phase 3: Generate context (3 SM agents in parallel)
│   ├─ Agent 1: story-context for 1.1 ✅
│   ├─ Agent 2: story-context for 1.2 ✅
│   └─ Agent 3: story-context for 1.3 ✅
│   └─ BARRIER: Wait for all 3, extract XML paths
│
├─ Phase 4: Implement (3 DEV agents in parallel)
│   ├─ Agent 1: develop for 1.1 ✅ (100% tests passing)
│   ├─ Agent 2: develop for 1.2 ❌ (60% tests passing - mock issue)
│   └─ Agent 3: develop for 1.3 ✅ (100% tests passing)
│   └─ BARRIER: Wait for all 3, check test results
│   └─ RECOVERY: Retry Agent 2 for story 1.2 after user fixes mock
│       └─ Agent 2 (retry): develop for 1.2 ✅ (100% tests passing)
│
├─ GATE: User DoD verification for 3 stories
│   └─ User: "All verified"
│
└─ Phase 5: Mark Done (3 DEV agents in parallel)
    ├─ Agent 1: story-done for 1.1 ✅
    ├─ Agent 2: story-done for 1.2 ✅
    └─ Agent 3: story-done for 1.3 ✅
    └─ BARRIER: Wait for all 3, advance queue

BATCH 2 (Stories 1.4, 1.5, 1.6):
└─ [Repeat Phases 1-5 for stories 1.4, 1.5, 1.6]

BATCH 3 (Stories 1.7, 1.8):
└─ [Repeat Phases 1-5 for stories 1.7, 1.8]
    └─ NOTE: Only 2 stories in batch (not enough for 3)
    └─ Launch 2 agents instead of 3

EPIC COMPLETE:
└─ All 8 stories DONE
└─ Recommend retrospective workflow
```

### Time Savings Analysis

**Sequential Execution (v1.5):**
```
Story 1.1: Create (10m) + Ready (5m) + Context (10m) + Develop (45m) + Done (5m) = 75 minutes
Story 1.2: 75 minutes
Story 1.3: 75 minutes
...
Total for 8 stories: 8 × 75m = 600 minutes (10 hours)
```

**Parallel Batching (v2.0):**
```
Batch 1 (3 stories):
  - Phase 1: max(Create 1.1, Create 1.2, Create 1.3) ≈ 10-12 minutes (not 30)
  - Phase 2: max(Ready 1.1, Ready 1.2, Ready 1.3) ≈ 5-7 minutes
  - Phase 3: max(Context 1.1, Context 1.2, Context 1.3) ≈ 10-12 minutes
  - Phase 4: max(Develop 1.1, Develop 1.2, Develop 1.3) ≈ 45-50 minutes
  - Phase 5: max(Done 1.1, Done 1.2, Done 1.3) ≈ 5-7 minutes
  Total per batch: ~75-90 minutes for 3 stories (instead of 225 minutes)

Total for 8 stories:
  - Batch 1 (3 stories): 90 minutes
  - Batch 2 (3 stories): 90 minutes
  - Batch 3 (2 stories): 60 minutes (partial batch)
  Total: 240 minutes (4 hours)

Speedup: 10 hours → 4 hours (60% faster)
```

---

## 🔀 HANDLING EDGE CASES

### Case 1: Backlog Has < 3 Stories

**Scenario:** Only 2 stories remaining in BACKLOG

**Solution:** Launch partial batch (2 agents instead of 3)

```python
def determine_batch_size(backlog_count: int) -> int:
    """Determine how many agents to launch based on remaining stories"""
    IDEAL_BATCH_SIZE = 3

    if backlog_count >= IDEAL_BATCH_SIZE:
        return IDEAL_BATCH_SIZE  # Full batch of 3
    else:
        return backlog_count  # Partial batch (1 or 2 agents)

# Example:
backlog_count = 2  # Only 2 stories left
batch_size = determine_batch_size(backlog_count)  # Returns 2

print(f"Launching partial batch: {batch_size} agents (not enough for full batch of 3)")

# Launch 2 agents instead of 3
launch_batch(batch_size)
```

### Case 2: Context File Conflicts (3 Agents Modifying Same File)

**Scenario:** 3 SM agents all update `docs/sprint-status.yaml` simultaneously

**Problem:** File write conflicts, corruption

**Solution 1:** Sequential file writes (agents write to temp files first)

```
Agent 1: Writes to docs/.temp/sprint-status-agent-1.yaml
Agent 2: Writes to docs/.temp/sprint-status-agent-2.yaml
Agent 3: Writes to docs/.temp/sprint-status-agent-3.yaml

Orchestrator: Merges all 3 temp files into single sprint-status.yaml after barrier
```

**Solution 2:** Agents write to separate files (recommended)

```
Agent 1: Updates docs/stories/story-1.1.md (independent)
Agent 2: Updates docs/stories/story-1.2.md (independent)
Agent 3: Updates docs/stories/story-1.3.md (independent)

No conflict - each agent works on different story file
```

**Best Practice:** Ensure each agent in batch operates on **disjoint file sets** to avoid conflicts.

### Case 3: Approval Gate with Batch of 3

**Scenario:** User must approve 3 drafted stories before proceeding

**Flow:**

```
1. 3 SM agents create stories 1.1, 1.2, 1.3 → all draft complete
2. Orchestrator reports to user:
   "3 stories drafted:
    - Story 1.1: User Authentication (5 AC, 12 tasks)
    - Story 1.2: Password Reset (3 AC, 8 tasks)
    - Story 1.3: Email Verification (4 AC, 10 tasks)

   Please review all 3 stories and type 'approved' to continue, or request changes."

3. User reviews all 3 story files

4. User responds: "approved" (or "story 1.2 needs changes")

5. Orchestrator proceeds:
   - If all approved: Launch 3 SM agents for story-ready (advance all 3)
   - If changes requested: Hold batch, user fixes, re-check approval
```

**Key Point:** Approval gates now cover **batches of 3** instead of individual stories.

### Case 4: DEV Agent Blocker in Batch

**Scenario:** Agent 2 encounters blocker (missing dependency), cannot proceed

```
Agent 1 (story-1.1): ✅ Develops successfully
Agent 2 (story-1.2): ❌ BLOCKED - requires Auth library not available
Agent 3 (story-1.3): ✅ Develops successfully
```

**Recovery:**

```python
def handle_blocked_agent_in_batch(batch_results: dict):
    """Handle case where 1 agent in batch is blocked"""
    blocked_stories = [
        r for r in batch_results['reports']
        if 'BLOCKED' in r.get('status', '') or r.get('blocker')
    ]

    if blocked_stories:
        print(f"⚠️  {len(blocked_stories)} story(ies) blocked in batch")

        for blocked in blocked_stories:
            print(f"\nStory: {blocked['story_id']}")
            print(f"Blocker: {blocked.get('blocker', 'Unknown')}")

        print("\nOptions:")
        print("1. Resolve blockers now and retry blocked stories")
        print("2. Skip blocked stories, continue with unblocked")
        print("3. Halt batch for investigation")

        user_choice = WAIT_FOR_USER_INPUT()

        if user_choice == '1':
            # User resolves blockers
            print("Resolve blockers, then type 'retry'")
            WAIT_FOR_USER_INPUT()
            # Retry only blocked stories
            retry_stories([b['story_id'] for b in blocked_stories])

        elif user_choice == '2':
            # Mark blocked stories as TODO (move back from IN PROGRESS)
            # Continue with unblocked stories
            mark_stories_todo(blocked_stories)
            proceed_with_unblocked()

        elif user_choice == '3':
            halt_orchestration("Blocker investigation required")
```

---

## 📝 UPDATED SKILL.MD SECTIONS

### Section to Add: "## Parallel Batch Execution"

**Location:** After "### 3. Agent Report Parsing" section

**Content:**

```markdown
### 4. Parallel Batch Execution (3 Agents Simultaneously)

The orchestrator executes workflows in **batches of 3 agents simultaneously** to maximize throughput and minimize epic completion time.

#### Core Principles

**Batch Size: 3 Agents**
- Launch 3 agents in parallel for same workflow phase
- Each agent works on different story
- All 3 execute independently (no coordination needed)
- Orchestrator waits for ALL 3 to complete (barrier synchronization)

**Why Batching:**
- **3x faster:** Reduces epic development time from 10 hours → 4 hours
- **Efficient context:** 3 concurrent agents fit within context budget
- **Manageable complexity:** Tracking 3 parallel executions is tractable
- **Optimal throughput:** Balances speed vs. orchestrator overhead

#### Batch Execution Workflow

**Phase 1: Create Stories (3 SM agents)**
```
Launch 3 SM agents in parallel:
- Agent 1: Execute *create-story for story-1.1
- Agent 2: Execute *create-story for story-1.2
- Agent 3: Execute *create-story for story-1.3

Wait for ALL 3 agents to complete (barrier)
Parse all 3 reports
If all successful → proceed to approval gate
If partial failure → retry failed stories only
```

**Phase 2: Move to Ready (3 SM agents)**
```
After user approves 3 stories:

Launch 3 SM agents in parallel:
- Agent 1: Execute *story-ready for story-1.1
- Agent 2: Execute *story-ready for story-1.2
- Agent 3: Execute *story-ready for story-1.3

Wait for ALL 3 agents to complete
Validate state transitions: TODO → IN PROGRESS for all 3
If all successful → proceed to Phase 3
```

**Phase 3: Generate Context (3 SM agents)**
```
Launch 3 SM agents in parallel:
- Agent 1: Execute *story-context for story-1.1
- Agent 2: Execute *story-context for story-1.2
- Agent 3: Execute *story-context for story-1.3

Wait for ALL 3 agents to complete
Extract 3 context XML paths
Validate all 3 XML files exist
If all successful → proceed to Phase 4
```

**Phase 4: Implement (3 DEV agents)**
```
Launch 3 DEV agents in parallel:
- Agent 1: Execute *develop for story-1.1
- Agent 2: Execute *develop for story-1.2
- Agent 3: Execute *develop for story-1.3

Wait for ALL 3 agents to complete
Parse test results from all 3
If all 100% passing → proceed to DoD gate
If some failing → retry failed stories only
```

**Phase 5: Mark Done (3 DEV agents)**
```
After user verifies DoD for 3 stories:

Launch 3 DEV agents in parallel:
- Agent 1: Execute *story-done for story-1.1
- Agent 2: Execute *story-done for story-1.2
- Agent 3: Execute *story-done for story-1.3

Wait for ALL 3 agents to complete
Validate state transitions: IN PROGRESS → DONE for all 3
Report progress: "Batch 1 complete: 3/8 stories done (37.5%)"
Loop to next batch (stories 1.4, 1.5, 1.6)
```

#### Launching Parallel Batch

**Critical:** All 3 Task tool calls must be in **single message** to execute in parallel.

**Example: Launch 3 SM agents for create-story**

```
I'm launching 3 SM agents in parallel to create stories 1.1, 1.2, and 1.3.
```

*[Include 3 Task tool invocations in single message]*

**After Barrier (all 3 complete):**

```
All 3 agents completed. Processing batch results...

Agent 1 (story-1.1): ✅ SUCCESS - Story drafted
Agent 2 (story-1.2): ✅ SUCCESS - Story drafted
Agent 3 (story-1.3): ✅ SUCCESS - Story drafted

Batch success rate: 100% (3/3 stories)

Next action: User approval required for 3 stories
```

#### Handling Partial Failures

**Scenario:** Agent 2 fails, Agents 1 and 3 succeed

```python
Batch results:
- Agent 1 (story-1.1): ✅ SUCCESS
- Agent 2 (story-1.2): ❌ FAILED (missing epic context)
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
- Agent 1 (retry): ✅ SUCCESS - Story 1.2 drafted

All 3 stories now complete. Proceeding to approval gate.
```

#### Approval Gates with Batching

**Gate 1: Story Approval (after create-story batch)**
- Orchestrator reports: "3 stories drafted. Review all 3 and approve."
- User reviews all 3 story files
- User responds: "approved" (or requests changes)
- Orchestrator proceeds to next phase for all 3

**Gate 2: DoD Verification (after develop batch)**
- Orchestrator reports: "3 stories implemented. All tests 100% passing. Verify DoD."
- User verifies all 3 implementations
- User responds: "done" (or reports issues)
- Orchestrator marks all 3 as DONE

**Key Change:** Gates now cover **batches of 3** instead of individual stories.

#### Edge Cases

**Case 1: Backlog has < 3 stories**

If only 2 stories remain in BACKLOG, launch **partial batch** (2 agents instead of 3):

```
Backlog count: 2 stories
Batch size: 2 agents (partial batch)

Launch 2 SM agents:
- Agent 1: create-story for story-1.7
- Agent 2: create-story for story-1.8

Wait for both to complete, then proceed
```

**Case 2: All agents in batch fail**

If all 3 agents fail, HALT orchestration:

```
Batch results:
- Agent 1: ❌ FAILED
- Agent 2: ❌ FAILED
- Agent 3: ❌ FAILED

Success rate: 0%

Orchestrator action: HALT orchestration
Reason: Systemic failure detected (all 3 agents failed)
Recommendation: Investigate root cause before retrying
```

**Case 3: File conflicts (3 agents modifying same file)**

**Problem:** 3 SM agents updating `sprint-status.yaml` simultaneously → conflicts

**Solution:** Each agent works on **independent files**:
- Agent 1: Updates `story-1.1.md` only
- Agent 2: Updates `story-1.2.md` only
- Agent 3: Updates `story-1.3.md` only
- No conflicts - disjoint file sets

For shared files (sprint-status.yaml), SM workflows handle locking/merging internally.

#### Performance Gains

**Sequential (v1.5):**
```
8 stories × 75 minutes/story = 600 minutes (10 hours)
```

**Parallel Batching (v2.0):**
```
Batch 1 (3 stories): 90 minutes
Batch 2 (3 stories): 90 minutes
Batch 3 (2 stories): 60 minutes
Total: 240 minutes (4 hours)

Speedup: 60% faster
```

#### Validation Checklist

Before launching batch:
- ✅ Determine batch size (3 or partial if backlog < 3)
- ✅ Identify next 3 stories from BACKLOG
- ✅ Verify no file conflicts (each agent works on different story)
- ✅ Prepare 3 Task tool calls in single message

After batch completes:
- ✅ Parse all 3 agent reports
- ✅ Check success rate (100%, partial, or 0%)
- ✅ Handle failures (retry, skip, or halt)
- ✅ Validate state transitions for all successful stories
- ✅ Report progress to user
- ✅ Proceed to next phase or next batch
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Update Skill Documentation

- [ ] Add "## Parallel Batch Execution" section to SKILL.md
- [ ] Update "Core Capabilities" to mention batching
- [ ] Modify "Implementation Phase Orchestration" for batch flow
- [ ] Add batch examples (create 3 stories, develop 3 stories)
- [ ] Document partial failure handling
- [ ] Document approval gates with batching

### Phase 2: Update Orchestration Templates

- [ ] Create `assets/orchestration-templates/batch-create-story-3.md` (template for launching 3 SM agents)
- [ ] Create `assets/orchestration-templates/batch-develop-3.md` (template for launching 3 DEV agents)
- [ ] Update existing templates to note they're for sequential execution (fallback)

### Phase 3: Update Agent Prompts

- [ ] Add "BATCH CONTEXT" section to agent prompts
- [ ] Include agent number (Agent 1 of 3, Agent 2 of 3, Agent 3 of 3)
- [ ] Clarify agents execute independently (no coordination)
- [ ] Ensure agents return structured reports for batch processing

### Phase 4: Testing

- [ ] Test batch of 3 SM agents (create-story)
- [ ] Test batch of 3 DEV agents (develop)
- [ ] Test partial batch (2 agents when backlog < 3)
- [ ] Test partial failure (1 agent fails, 2 succeed)
- [ ] Test complete failure (all 3 fail)
- [ ] Test approval gate with batch of 3
- [ ] Test file conflict scenarios

---

## 🎯 EXPECTED OUTCOMES

### Before (Sequential v1.5)
- **Epic time:** 10 hours for 8 stories
- **Agent utilization:** 1 agent active at a time
- **Idle time:** High (waiting for each agent sequentially)
- **User wait:** Long gaps between agent completions

### After (Parallel Batching v2.0)
- **Epic time:** 4 hours for 8 stories (60% faster)
- **Agent utilization:** Up to 3 agents active simultaneously
- **Idle time:** Minimized (3 agents working in parallel)
- **User wait:** Batched approvals (review 3 stories at once)

### Quality Metrics
- **Throughput:** 3x increase (3 stories per batch cycle)
- **Context efficiency:** ~15% reduction (batch overhead vs. sequential overhead)
- **Error handling:** Granular (retry individual failed stories, not entire batch)
- **User experience:** Faster progress visibility, batched review sessions

---

## 📚 APPENDIX

### Example: Complete Batch Execution Trace

```
Epic 1 (8 stories) - Parallel Batching Execution

BATCH 1 (Stories 1.1, 1.2, 1.3)
════════════════════════════════

[10:00] Phase 1: Create Stories
├─ Launch 3 SM agents in parallel
│  ├─ Agent 1: *create-story for 1.1
│  ├─ Agent 2: *create-story for 1.2
│  └─ Agent 3: *create-story for 1.3
├─ [10:12] All 3 complete (12 minutes)
├─ Parse reports: 3/3 SUCCESS
└─ Report to user: "3 stories drafted, review and approve"

[10:15] APPROVAL GATE
├─ User reviews stories 1.1, 1.2, 1.3
└─ [10:20] User: "approved"

[10:20] Phase 2: Move to Ready
├─ Launch 3 SM agents in parallel
│  ├─ Agent 1: *story-ready for 1.1
│  ├─ Agent 2: *story-ready for 1.2
│  └─ Agent 3: *story-ready for 1.3
├─ [10:25] All 3 complete (5 minutes)
├─ Validate: 3 stories moved TODO → IN PROGRESS ✅
└─ Continue to Phase 3

[10:25] Phase 3: Generate Context
├─ Launch 3 SM agents in parallel
│  ├─ Agent 1: *story-context for 1.1
│  ├─ Agent 2: *story-context for 1.2
│  └─ Agent 3: *story-context for 1.3
├─ [10:37] All 3 complete (12 minutes)
├─ Extract 3 context XML paths, validate all exist ✅
└─ Continue to Phase 4

[10:37] Phase 4: Implement
├─ Launch 3 DEV agents in parallel
│  ├─ Agent 1: *develop for 1.1
│  ├─ Agent 2: *develop for 1.2
│  └─ Agent 3: *develop for 1.3
├─ [11:25] All 3 complete (48 minutes)
├─ Parse test results:
│  ├─ Agent 1: 100% tests passing ✅
│  ├─ Agent 2: 60% tests passing ❌ (mock issue)
│  └─ Agent 3: 100% tests passing ✅
├─ Partial failure detected (1/3 failed)
├─ Report to user: "2/3 stories complete, 1 failed"
└─ User fixes mock for story 1.2, signals retry

[11:30] Phase 4 Retry (Selective)
├─ Launch 1 DEV agent (only for failed story 1.2)
│  └─ Agent: *develop for 1.2 (retry)
├─ [12:15] Complete (45 minutes)
├─ Parse: 100% tests passing ✅
└─ All 3 stories now complete

[12:15] DOD VERIFICATION GATE
├─ Report to user: "3 stories implemented, all tests 100% passing"
└─ [12:20] User: "DoD verified"

[12:20] Phase 5: Mark Done
├─ Launch 3 DEV agents in parallel
│  ├─ Agent 1: *story-done for 1.1
│  ├─ Agent 2: *story-done for 1.2
│  └─ Agent 3: *story-done for 1.3
├─ [12:25] All 3 complete (5 minutes)
├─ Validate: 3 stories moved IN PROGRESS → DONE ✅
└─ Report progress: "Batch 1 complete: 3/8 stories (37.5%)"

BATCH 1 SUMMARY:
- Total time: 2h 25m (10:00 - 12:25)
- Stories completed: 3
- Failures: 1 (recovered via retry)
- Next: Launch Batch 2 for stories 1.4, 1.5, 1.6
```

---

**END OF PARALLEL BATCHING GUIDE**

**Next Steps:**
1. Update `.claude/skills/bmad-orchestrator/SKILL.md` with parallel batching sections
2. Create batch orchestration templates in `assets/orchestration-templates/`
3. Test batch execution with 3-story epic
4. Validate partial failure handling
5. Measure performance improvement (expect 60% speedup)
