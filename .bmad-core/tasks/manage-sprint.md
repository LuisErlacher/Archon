<!-- Powered by BMAD™ Core -->

# Manage Sprint Task

## Purpose

Manage sprint planning, tracking, and retrospectives. This task enables PM and SM agents to create, update, and close sprints while maintaining sprint documentation and workflow status.

## When to Use This Task

**Use this task when:**
- Starting a new sprint
- Updating daily sprint progress
- Completing a sprint with retrospective
- Checking sprint status

## Commands

### `/sprint-start`
Create a new sprint with planning document

### `/sprint-update`
Update current sprint progress (daily standup updates)

### `/sprint-complete`
Close current sprint and create retrospective

### `/sprint-status`
View current sprint status and metrics

---

## Instructions

### 1. Starting a New Sprint

**Prerequisites:**
- [ ] Epic(s) defined and documented
- [ ] Stories created and estimated
- [ ] Tasks broken down and registered in Archon MCP
- [ ] Team capacity calculated

**Steps:**

1. **Load Configuration**
   ```yaml
   # Read from core-config.yaml
   sprintLocation: docs/sprints
   currentSprintFile: docs/sprints/sprint-current.md
   ```

2. **Archive Previous Sprint (if exists)**
   - Move `sprint-current.md` to `sprint-archive/sprint-{n}-completed.md`
   - Update filename with sprint number and completion date

3. **Create New Sprint Document**
   - Use template: `.bmad-core/templates/sprint-planning-tmpl.yaml`
   - Fill in sprint metadata:
     - Sprint number
     - Sprint name/theme
     - Start and end dates
     - Team capacity
     - Sprint goal

4. **Add Epics and Stories**
   - List primary epic(s) for this sprint
   - Break down stories with:
     - Story ID from Archon MCP
     - Story points
     - Assignee
     - Tasks with IDs

5. **Create Workflow Status**
   - Update `docs/workflow/workflow-status.md` with new sprint info
   - Update `.ai/current-context.md` for agents

6. **Commit Sprint Plan**
   - Save `docs/sprints/sprint-current.md`
   - Notify team of sprint kickoff

**Output:**
- New sprint planning document created
- Workflow status updated
- Agent context updated
- Sprint ready to start

---

### 2. Updating Sprint Progress

**When to Update:**
- Daily (recommended)
- After completing a task
- When blockers arise
- When changing status of stories/tasks

**Steps:**

1. **Read Current Sprint**
   - Load `docs/sprints/sprint-current.md`

2. **Update Daily Progress Section**
   - Add new day entry
   - List completed items (with ✅)
   - Document any blockers
   - Note next planned items

3. **Update Sprint Metrics**
   - Update burndown chart data
   - Calculate velocity (completed vs. planned)
   - Update task completion percentage

4. **Update Workflow Status**
   - Update `docs/workflow/workflow-status.md`:
     - Current sprint progress percentage
     - Active work items
     - Phase status
     - Recent completions

5. **Update Agent Context**
   - Update `.ai/current-context.md`:
     - Progress tracking section
     - Next task to work on
     - Updated blockers

6. **Sync with Archon MCP**
   - Query tasks from Archon MCP to get real-time status
   - Ensure sprint document reflects MCP state

**Output:**
- Sprint document updated with daily progress
- Workflow status reflects current state
- Agent context shows next actions
- Team has visibility into sprint health

---

### 3. Completing a Sprint

**Prerequisites:**
- [ ] All planned stories reviewed
- [ ] Sprint metrics calculated
- [ ] Team feedback collected for retrospective

**Steps:**

1. **Calculate Final Metrics**
   - Total story points completed
   - Velocity achieved
   - Task completion rate
   - Burndown final state

2. **Conduct Retrospective**
   - Add to sprint document:
     - What went well ✅
     - What could be improved 🔄
     - Action items for next sprint 🎯

3. **Archive Sprint**
   - Move `sprint-current.md` to `sprint-archive/sprint-{n}-completed-{date}.md`
   - Add completion metadata

4. **Update Workflow History**
   - Add sprint summary to `docs/workflow/workflow-history.md`
   - Document key outcomes and learnings

5. **Prepare for Next Sprint**
   - Review carry-over stories
   - Note incomplete work reasons
   - Update team velocity data

**Output:**
- Sprint archived with retrospective
- Metrics documented
- Workflow history updated
- Ready for next sprint planning

---

### 4. Checking Sprint Status

**Quick Status Check:**

```bash
# Read these files in order:
1. .ai/current-context.md           # Quick overview
2. docs/sprints/sprint-current.md   # Detailed sprint info
3. docs/workflow/workflow-status.md # Full workflow context
```

**Status Information Provided:**
- Current sprint number and day
- Sprint progress percentage
- Active story/task
- Blockers (if any)
- Next actions
- Team status

---

## Integration with Archon MCP

### Syncing Sprint Data

When updating sprint or workflow status, always sync with Archon MCP:

```python
# Get current tasks
tasks = mcp__archon__find_tasks(
    project_id="<project-id>",
    filter_by="status",
    filter_value="doing"
)

# Update task status
mcp__archon__manage_task(
    action="update",
    task_id="<task-id>",
    status="done"
)

# Get project overview
project = mcp__archon__find_projects(
    project_id="<project-id>"
)
```

**Keep in Sync:**
- Task statuses (todo/doing/review/done)
- Story completion
- Blocker information
- Assignees

---

## File Structure Reference

```
docs/
├── sprints/
│   ├── sprint-current.md              # Active sprint (always updated)
│   ├── sprint-01-planning.md          # Sprint 1 (after completion)
│   ├── sprint-02-planning.md          # Sprint 2 (after completion)
│   └── sprint-archive/
│       └── sprint-{n}-completed-{date}.md
│
├── workflow/
│   ├── workflow-status.md             # Current workflow state
│   ├── workflow-history.md            # Historical changes
│   └── workflow-templates/
│
└── prd/
    ├── epic-{n}-*.md                  # Epic documents
    └── epic-{n}-tasks.md              # Task breakdowns

.ai/
├── current-context.md                 # Agent quick reference
└── quick-ref.md                       # Developer quick reference
```

---

## Best Practices

### Daily Updates
1. Update sprint-current.md daily with progress
2. Keep workflow-status.md in sync
3. Update .ai/current-context.md for agents
4. Sync with Archon MCP status

### Communication
1. Make updates visible to entire team
2. Document blockers immediately
3. Celebrate completions
4. Be honest about challenges

### Metrics
1. Track velocity sprint-over-sprint
2. Monitor burndown regularly
3. Note patterns in retrospectives
4. Use data to improve estimates

### Agent Integration
1. Keep .ai/current-context.md accurate
2. Update after every major change
3. Include file references for agents
4. Note what to work on next

---

## Success Criteria

Sprint management is successful when:

1. ✅ Sprint documents are always up-to-date
2. ✅ Team has visibility into progress
3. ✅ Agents can quickly find current work
4. ✅ Blockers are documented and resolved
5. ✅ Retrospectives lead to improvements
6. ✅ Workflow status reflects reality
7. ✅ Archon MCP stays in sync

---

## Troubleshooting

### Sprint Document Out of Sync
**Problem:** Sprint document doesn't match Archon MCP
**Solution:** Query Archon MCP and update sprint document

### Agent Can't Find Current Work
**Problem:** .ai/current-context.md is stale
**Solution:** Run sprint-update to refresh all context files

### Metrics Don't Match Reality
**Problem:** Manual tracking drift
**Solution:** Use Archon MCP as source of truth; sync regularly

---

## Related Commands

- `*create-epic` - Create new epic for sprint
- `*create-story` - Break down epic into stories
- `/workflow-status` - Check overall workflow status
- Archon MCP tools - Manage tasks programmatically

---

**Note:** This task integrates BMad workflow management with Archon MCP for seamless sprint tracking across agents and human developers.
