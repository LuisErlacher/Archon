# Batch Develop Story Template (3 DEV Agents in Parallel)

**Purpose:** Launch 3 DEV agents simultaneously to implement 3 stories from IN PROGRESS
**Agent Type:** agent-skill-dev
**Workflow:** *develop
**Batch Size:** 3 agents

---

## Usage

Use this template when launching a batch of 3 DEV agents to implement stories in parallel.

**Prerequisites:**
- 3 stories in IN PROGRESS state
- Story files exist for all 3
- Context XML files exist for all 3
- All stories approved by user (Status="Ready")

**Template Variables:**
- `{story_id_1}`: First story ID (e.g., "story-1.1")
- `{story_id_2}`: Second story ID (e.g., "story-1.2")
- `{story_id_3}`: Third story ID (e.g., "story-1.3")
- `{story_file_1}`: Path to first story (e.g., "docs/stories/story-1.1-user-auth.md")
- `{story_file_2}`: Path to second story
- `{story_file_3}`: Path to third story
- `{context_xml_1}`: Path to first context XML (e.g., "docs/stories/story-context-1.1.xml")
- `{context_xml_2}`: Path to second context XML
- `{context_xml_3}`: Path to third context XML

---

## Prompt Template

**Orchestrator Message:**
```
I'm launching 3 DEV agents in parallel to implement stories {story_id_1}, {story_id_2}, and {story_id_3}.

Each agent will execute the *develop workflow for their assigned story.
```

**Task Tool Calls (all 3 in single message):**

### Agent 1 - Story {story_id_1}

```
Subagent Type: agent-skill-dev
Description: Implement {story_id_1} (Agent 1 of 3)
Prompt:

You are Amelia, the BMAD Developer agent #1.

Execute the *develop workflow for {story_id_1}.

**CONTEXT:**
- Story file: {story_file_1}
- Context XML: {context_xml_1}
- Workflow status: docs/bmm-workflow-status.md

**BATCH CONTEXT:**
- You are Agent 1 in a batch of 3 agents
- Agent 2 is implementing {story_id_2} simultaneously
- Agent 3 is implementing {story_id_3} simultaneously

**INSTRUCTIONS:**
1. Read the Context XML FIRST to understand architectural constraints and expertise injections
2. Read the Story file to understand all acceptance criteria and tasks
3. Implement ALL acceptance criteria following the architecture in Context XML
4. Run ALL tests - they MUST be 100% passing
5. Return detailed report with status, files modified, and test results

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Do NOT proceed if tests are not 100% passing
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: {story_id_1}
- Actions Taken
- Files Modified
- Test Results (X/X passing, Y%)
- Current State
- Next Action
```

### Agent 2 - Story {story_id_2}

```
Subagent Type: agent-skill-dev
Description: Implement {story_id_2} (Agent 2 of 3)
Prompt:

You are Amelia, the BMAD Developer agent #2.

Execute the *develop workflow for {story_id_2}.

**CONTEXT:**
- Story file: {story_file_2}
- Context XML: {context_xml_2}
- Workflow status: docs/bmm-workflow-status.md

**BATCH CONTEXT:**
- You are Agent 2 in a batch of 3 agents
- Agent 1 is implementing {story_id_1} simultaneously
- Agent 3 is implementing {story_id_3} simultaneously

**INSTRUCTIONS:**
1. Read the Context XML FIRST to understand architectural constraints and expertise injections
2. Read the Story file to understand all acceptance criteria and tasks
3. Implement ALL acceptance criteria following the architecture in Context XML
4. Run ALL tests - they MUST be 100% passing
5. Return detailed report with status, files modified, and test results

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Do NOT proceed if tests are not 100% passing
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: {story_id_2}
- Actions Taken
- Files Modified
- Test Results (X/X passing, Y%)
- Current State
- Next Action
```

### Agent 3 - Story {story_id_3}

```
Subagent Type: agent-skill-dev
Description: Implement {story_id_3} (Agent 3 of 3)
Prompt:

You are Amelia, the BMAD Developer agent #3.

Execute the *develop workflow for {story_id_3}.

**CONTEXT:**
- Story file: {story_file_3}
- Context XML: {context_xml_3}
- Workflow status: docs/bmm-workflow-status.md

**BATCH CONTEXT:**
- You are Agent 3 in a batch of 3 agents
- Agent 1 is implementing {story_id_1} simultaneously
- Agent 2 is implementing {story_id_2} simultaneously

**INSTRUCTIONS:**
1. Read the Context XML FIRST to understand architectural constraints and expertise injections
2. Read the Story file to understand all acceptance criteria and tasks
3. Implement ALL acceptance criteria following the architecture in Context XML
4. Run ALL tests - they MUST be 100% passing
5. Return detailed report with status, files modified, and test results

**CRITICAL:**
- Execute independently (no coordination with other agents needed)
- Do NOT proceed if tests are not 100% passing
- Return structured report when complete
- Do NOT wait for other agents

Return structured report with:
- Status: ✅ SUCCESS or ❌ FAILED
- Story ID: {story_id_3}
- Actions Taken
- Files Modified
- Test Results (X/X passing, Y%)
- Current State
- Next Action
```

---

## After Barrier (All 3 Agents Complete)

**Process batch results:**

```python
# Parse all 3 reports
batch_results = process_batch_reports([agent1_report, agent2_report, agent3_report])

# Extract test results
test_results = extract_test_results(batch_results)

# Classify stories by test status
passing_stories = [r for r in batch_results['reports'] if r['test_results']['percentage'] == 100]
failing_stories = [r for r in batch_results['reports'] if r['test_results']['percentage'] < 100]

if len(passing_stories) == 3:
    # All 3 passed - proceed to DoD gate
    report_to_user(f"✅ 3 stories implemented successfully. All tests 100% passing.")
    proceed_to_dod_gate()

elif len(passing_stories) == 0:
    # All 3 failed - HALT
    halt_orchestration("All 3 implementations failed tests")

else:
    # Partial success - handle selective retry
    report_to_user(f"⚠️  {len(passing_stories)}/3 stories passing tests")
    report_to_user(f"Failed stories: {[s['story_id'] for s in failing_stories]}")

    # Offer recovery options
    handle_dev_partial_failure(passing_stories, failing_stories)
```

---

## Handling Test Failures

**Scenario:** Agent 2 has failing tests (60%), but Agents 1 and 3 pass (100%)

**Recovery Strategy:**

```python
def handle_dev_partial_failure(passing_stories, failing_stories):
    """Handle partial batch failure where some tests fail"""

    print(f"\n🔍 Batch Implementation Results:")
    print(f"✅ Passing: {len(passing_stories)} stories")
    print(f"❌ Failing: {len(failing_stories)} stories\n")

    print("Failed stories:")
    for failure in failing_stories:
        print(f"  - {failure['story_id']}: {failure['test_results']['percentage']}% tests passing")
        print(f"    Error: {failure.get('error', 'Unknown error')}\n")

    print("Options:")
    print("1. Fix issues and retry failed stories only")
    print("2. Continue with passing stories, mark as ready for DoD")
    print("3. Halt all for debugging")

    user_choice = WAIT_FOR_USER_INPUT()

    if user_choice == '1':
        # Wait for user to fix, then retry ONLY failed stories
        print("Fix issues for failed stories, then type 'retry'")
        WAIT_FOR_USER_INPUT()

        # Launch DEV agents ONLY for failed stories (selective retry)
        launch_selective_retry([f['story_id'] for f in failing_stories])

    elif user_choice == '2':
        # Proceed with passing stories to DoD, queue failed for later
        proceed_to_dod_with_subset(passing_stories)
        queue_for_retry(failing_stories)

    elif user_choice == '3':
        # Halt entire batch
        halt_orchestration("User requested halt for debugging")
```

---

## Example Execution

**Input:**
- story_id_1 = "story-1.1"
- story_file_1 = "docs/stories/story-1.1-user-auth.md"
- context_xml_1 = "docs/stories/story-context-1.1.xml"
(... same for stories 1.2 and 1.3)

**Expected Output (All Pass):**
```
Batch complete: 3/3 tests passing

Agent 1 (story-1.1): ✅ SUCCESS - 100% tests passing (15/15)
Agent 2 (story-1.2): ✅ SUCCESS - 100% tests passing (12/12)
Agent 3 (story-1.3): ✅ SUCCESS - 100% tests passing (18/18)

Files Modified:
- apps/api/src/modules/auth/ (Agent 1)
- apps/api/src/modules/password-reset/ (Agent 2)
- apps/api/src/modules/email-verification/ (Agent 3)

Next Action: DoD verification required for 3 stories
```

**Expected Output (Partial Failure):**
```
Batch complete: 2/3 tests passing

Agent 1 (story-1.1): ✅ SUCCESS - 100% tests passing (15/15)
Agent 2 (story-1.2): ❌ FAILED - 60% tests passing (9/15)
  Error: AuthService mock not configured correctly
Agent 3 (story-1.3): ✅ SUCCESS - 100% tests passing (18/18)

Options:
1. Fix mock for story-1.2 and retry
2. Continue with stories 1.1 and 1.3 (skip 1.2 for now)
3. Halt batch for investigation
```

---

## Notes

- Always send all 3 Task tool calls in **single message** for parallel execution
- Wait for ALL 3 agents to complete before processing results (barrier)
- Tests MUST be 100% passing for story to proceed to DoD
- Handle test failures with selective retry (only retry failed stories)
- Each agent works on independent codebase sections (minimize conflicts)
