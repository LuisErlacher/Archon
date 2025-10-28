# 🤖 Archon - Current Context for AI Agents

> **Last Updated:** 2025-10-28 16:30:00 UTC
> **Auto-updated by:** Workflow Management System

---

## 🎯 TL;DR - What You Need to Know

- **Current Sprint:** Sprint 1 (Day 1 of 10)
- **Current Work:** Epic #1 - Frontend Authentication System (Planning Phase)
- **Next Task:** Setup Supabase Auth Client
- **Status:** Ready to start development
- **Blockers:** None

---

## 📂 Quick File References

### Must-Read Documents
1. **Sprint Planning:** [`docs/sprints/sprint-current.md`](../docs/sprints/sprint-current.md)
2. **Workflow Status:** [`docs/workflow/workflow-status.md`](../docs/workflow/workflow-status.md)
3. **Epic Document:** [`docs/prd/epic-1-frontend-authentication.md`](../docs/prd/epic-1-frontend-authentication.md)
4. **Task Breakdown:** [`docs/prd/epic-1-tasks.md`](../docs/prd/epic-1-tasks.md)

### Architecture & Standards
- **Coding Standards:** `docs/architecture/coding-standards.md`
- **Tech Stack:** `docs/architecture/tech-stack.md`
- **Source Tree:** `docs/architecture/source-tree.md`

---

## 🗂️ Current Project Structure

```
Archon/
├── Epic #1: Frontend Authentication System
│   ├── Story 1: Frontend Authentication Foundation (todo)
│   │   ├── Task 1.1: Setup Supabase Auth Client ⬜
│   │   ├── Task 1.2: Create Auth Context and Provider ⬜
│   │   ├── Task 1.3: Implement Custom Auth Hooks ⬜
│   │   ├── Task 1.4: Integrate Auth Tokens with API Client ⬜
│   │   └── Task 1.5: Create Auth Service Layer ⬜
│   │
│   ├── Story 2: Login/Signup UI Components (todo)
│   │   ├── Task 2.1: Create Login Page Component ⬜
│   │   ├── Task 2.2: Create Signup Page Component ⬜
│   │   ├── Task 2.3: Implement Password Reset Flow ⬜
│   │   ├── Task 2.4: Create Protected Route Wrapper ⬜
│   │   ├── Task 2.5: Add Auth Routes to React Router ⬜
│   │   └── Task 2.6: Implement Logout Functionality ⬜
│   │
│   └── Story 3: Backend Authentication & RLS Integration (todo - Sprint 2)
│       └── [6 tasks defined]
```

---

## 🎯 Current Sprint Goals

### Sprint 1 (Week 1-2)
**Goal:** Establish authentication foundation and core UI components

**Target Deliverables:**
- ✅ Epic planning complete
- ⬜ Story 1: Frontend Authentication Foundation (100%)
- ⬜ Story 2: Login/Signup UI Components (100%)

---

## 📊 Progress Tracking

### Epic #1 Progress
- **Total Stories:** 3
- **Completed:** 0
- **In Progress:** 0
- **Todo:** 3
- **Overall:** 0%

### Sprint 1 Progress
- **Total Tasks:** 11 (Story 1 + Story 2)
- **Completed:** 0
- **In Progress:** 0
- **Blocked:** 0
- **Overall:** 0%

---

## 🔍 What to Work On Next

### Immediate Priority (Today/Tomorrow)

#### Task 1.1: Setup Supabase Auth Client
**Priority:** High (106)
**Estimated Time:** 2 hours
**Status:** todo
**Task ID:** `b3dcb5d4-8beb-48ab-82db-3b662742ed7d`

**What to do:**
1. Install `@supabase/supabase-js` package
2. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Create `archon-ui-main/src/lib/supabase.ts`
4. Initialize Supabase client for authentication

**Acceptance Criteria:**
- [ ] Package installed
- [ ] Environment variables configured
- [ ] Supabase client exports auth methods
- [ ] Type definitions for auth responses

**Files to Create/Modify:**
- Create: `archon-ui-main/src/lib/supabase.ts`
- Modify: `archon-ui-main/.env.example`
- Modify: `archon-ui-main/package.json`

---

## 🚧 Known Blockers & Risks

### Active Blockers
_None at this time_

### Risks to Watch
1. **Supabase Auth complexity** (Medium/Medium) - Review docs carefully
2. **JWT validation challenges** (Low/High) - Research FastAPI patterns
3. **RLS policy testing** (Medium/High) - Create comprehensive test cases

---

## 🔗 Important Links

### Archon MCP
- **Project ID:** `91fa5f8d-630b-4fff-b325-343494f87b36`
- **Access:** Use Archon MCP tools to query tasks and update status

### Documentation
- **Epic #1:** [docs/prd/epic-1-frontend-authentication.md](../docs/prd/epic-1-frontend-authentication.md)
- **Current Sprint:** [docs/sprints/sprint-current.md](../docs/sprints/sprint-current.md)
- **Workflow Status:** [docs/workflow/workflow-status.md](../docs/workflow/workflow-status.md)

### External Resources
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Archon GitHub:** https://github.com/yourusername/Archon

---

## 💡 Development Tips

### When Starting a New Task
1. Read the task description in `docs/prd/epic-1-tasks.md`
2. Check acceptance criteria
3. Review files to create/modify
4. Update task status to "doing" using Archon MCP:
   ```python
   manage_task("update", task_id="<task-id>", status="doing")
   ```

### When Completing a Task
1. Verify all acceptance criteria are met
2. Update task status to "done" using Archon MCP:
   ```python
   manage_task("update", task_id="<task-id>", status="done")
   ```
3. Update sprint progress in `docs/sprints/sprint-current.md`
4. Update workflow status in `docs/workflow/workflow-status.md`

### When Blocked
1. Document the blocker clearly
2. Add blocker to workflow-status.md
3. Notify PM or team lead
4. Switch to next available task if possible

---

## 📝 Notes for Developers

### Architecture Patterns to Follow
- **Frontend:** Vertical slice architecture in `/features`
- **State Management:** TanStack Query (no Redux/Zustand)
- **API Calls:** Service layer pattern
- **Design System:** Tron-inspired glassmorphism with Tailwind

### Code Quality Standards
- **TypeScript:** Strict mode, no implicit any
- **Frontend Linting:** Biome for `/src/features`, ESLint for legacy
- **Backend Linting:** Ruff + MyPy
- **Testing:** Vitest (frontend), Pytest (backend)

---

## 🤝 Collaboration Protocol

### For AI Agents
- Always read current-context.md first
- Check workflow-status.md for latest updates
- Update sprint-current.md when completing tasks
- Use Archon MCP for task status updates

### For Human Developers
- Review sprint-current.md at start of day
- Update workflow-status.md when switching tasks
- Keep current-context.md updated for agents
- Communicate blockers immediately

---

**This file is auto-generated and updated by the Workflow Management System**
**Manual edits may be overwritten - Update source documents instead**
