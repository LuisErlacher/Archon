<!-- Powered by BMAD™ Core -->

# develop-story-enhanced

Enhanced development workflow with Archon MCP integration for comprehensive context-aware implementation.

## Purpose

Execute story implementation with enhanced research capabilities, pattern analysis, and automated progress tracking through Archon MCP integration. This enhanced workflow provides developers with similar implementation patterns, latest documentation, and automatic project tracking.

## Prerequisites

- Story status must be "Ready" (not "Draft")
- Story file exists with complete Tasks/Subtasks section
- Dev Agent Record section is available for updates
- Archon MCP integration is configured (if enabled)

## Enhanced Development Workflow

### Step 0: Pre-Development Research (ARCHON INTEGRATION)

#### 0.1 Research Implementation Patterns
- **If archon_integration.enabled in config:**
  - Use Archon MCP `rag_search_code_examples(query="{feature_description}", match_count=5)` to find similar implementations
  - Use Archon MCP `rag_search_knowledge_base(query="{technology_stack} {feature_type} patterns", match_count=3)` to understand architectural approaches
  - Document key patterns to follow in implementation
  - Add findings to Dev Agent Record > Debug Log section

#### 0.2 Load Current Documentation
- **If archon_integration.enabled in config:**
  - Use Archon MCP `rag_search_knowledge_base(query="{apis_mentioned_in_story}", match_count=5)` for latest API documentation
  - Use Archon MCP `find_documents(project_id, document_type="api_docs")` for project-specific API specs
  - Cache documentation references for development
  - Note any discrepancies between story assumptions and current docs

### Step 1: Enhanced Development Loop

#### 1.1 Start Task Implementation
- Read current task from story file Tasks/Subtasks section
- **If archon_integration.enabled and auto_update_progress: true:**
  - Use Archon MCP `manage_task(action="update", task_id="{task_id}", status="doing")` to update status
- Mark task as [in-progress] in story file
- Begin implementation using RAG research insights

#### 1.2 Implementation with Context
- Follow patterns identified in pre-development research
- Reference cached API documentation from Archon
- Document any deviations from established patterns in Debug Log
- Update Dev Agent Record > Change Log with significant decisions

#### 1.3 Testing and Validation
- Write tests based on patterns found via `rag_search_code_examples()`
- Execute all validations and linting
- Run full test suite to ensure no regressions
- If tests pass, mark task [x] locally AND update Archon (if enabled)

#### 1.4 Document Learnings (For Complex Tasks)
- **If task complexity is high or reveals new patterns:**
  - Use Archon MCP `manage_document(action="create", project_id, document_type="dev_notes", title="Development Insights {story_id}.{task_id}", content="{learnings_and_patterns}")`
  - Include code snippets and architectural decisions for future reference
  - Link insights in story's Dev Agent Record > Completion Notes

#### 1.5 Update File List and Progress
- Update story File List section with all new/modified/deleted files
- **If archon_integration.enabled:**
  - Use Archon MCP `manage_task(action="update", task_id="{task_id}", status="done")`
- Mark task as [x] in story file
- Continue to next task

### Step 2: Story Completion and Handoff

#### 2.1 Final Validation
- Verify all Tasks/Subtasks are marked [x]
- Execute full regression test suite
- Confirm all files are listed in File List section
- Run task `execute-checklist` for checklist `story-dod-checklist`

#### 2.2 Documentation Finalization
- Complete Dev Agent Record > Completion Notes with:
  - Key implementation decisions
  - Patterns followed/deviated from
  - Performance considerations
  - Known limitations or future improvements
- **If archon_integration.enabled:**
  - Use Archon MCP `manage_task(action="update", task_id="{story_id}", status="ready_for_review")`

#### 2.3 Story Status Update
- Set story status to "Ready for Review"
- Ensure all insights are captured in Archon for future stories
- HALT and await QA review

## Archon MCP Integration Commands

### Available MCP Tools for Development

- `rag_search_code_examples(query, match_count)` - Find similar code implementations
- `rag_search_knowledge_base(query, match_count)` - Search documentation and patterns
- `find_documents(project_id, document_type)` - Load project-specific documentation
- `manage_task(action, task_id, status)` - Update task status in project management
- `manage_document(action, project_id, document_type, title, content)` - Store development insights

### Configuration-Driven Behavior

Based on `core-config.yaml` settings:

```yaml
archon_integration:
  enabled: true/false
agent_archon_settings:
  dev:
    research_before_coding: true/false
    save_dev_insights: true/false
    update_task_progress: true/false
```

## Error Handling and Fallbacks

### When Archon MCP is Unavailable
- Continue with local-only development workflow
- Skip MCP-specific steps gracefully
- Document missed integrations in Debug Log
- Proceed with standard BMAD workflow

### When RAG Research Fails
- Continue with story information as primary source
- Note research failure in Debug Log
- Proceed with implementation based on story context
- Flag for manual research if critical

## Story File Updates Authorization

**CRITICAL: You are ONLY authorized to edit these specific sections:**
- Tasks/Subtasks checkboxes ([x] marking)
- Dev Agent Record section and all subsections:
  - Agent Model Used
  - Debug Log References
  - Completion Notes List
  - Change Log
- File List section
- Status field (final update only)

**DO NOT modify:**
- Story description
- Acceptance Criteria
- Dev Notes (story preparation content)
- Testing section
- Any other sections

## Success Criteria

Story is ready for QA review when:
- All Tasks/Subtasks marked [x] with tests
- Full regression passes
- File List is complete and accurate
- Dev Agent Record contains comprehensive implementation notes
- Archon tracking updated (if enabled)
- Status set to "Ready for Review"

## Blocking Conditions

HALT development for:
- 3+ consecutive failures implementing/fixing the same issue
- Missing critical configuration or dependencies
- Ambiguous requirements after thorough story analysis
- Failing regression tests that cannot be resolved
- Unapproved external dependencies needed

When blocked, document the issue in Debug Log and request user assistance.