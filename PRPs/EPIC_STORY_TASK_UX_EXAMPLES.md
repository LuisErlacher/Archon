# Epic-Story-Task: UX Examples & Workflows

## 📋 Sumário Executivo (1 página)

### O Que é?
Implementação de hierarquia ágil completa no Archon seguindo o **BMAD Method**: Épicos → Stories → Tasks → Subtasks

### Por Que Importa?
- **Organização**: Projetos grandes ficam organizados em unidades gerenciáveis
- **Clareza**: Cada nível tem propósito claro (épico = feature, story = user story, task = trabalho técnico)
- **AI-Driven**: AI agents geram hierarquia automaticamente a partir de PRD
- **Rastreabilidade**: Progresso visível em todos os níveis (story points, completion %)

### Estrutura Técnica
```
Project (container)
  └─ Epic (task_type='epic', parent_task_id=NULL)
      └─ Story (task_type='story', parent_task_id=epic_id)
          └─ Task (task_type='task', parent_task_id=story_id)
              └─ Subtask (task_type='subtask', parent_task_id=task_id)
```

### Timeline
- **Fase 1 (Backend)**: 1 semana - Schema, service layer, API
- **Fase 2 (Frontend Foundation)**: 1 semana - Types, services, hooks
- **Fase 3 (UI Components)**: 2 semanas - Cards, tree view, modals
- **Fase 4 (MCP)**: 1 semana - AI IDE integration
- **Fase 5 (BMAD AI)**: 1 semana - Auto-generation workflow
- **Fase 6 (Polish)**: 1 semana - Performance, docs, tutorial

**Total: 7 semanas para MVP completo**

### Quick Win
Usar campos já existentes (`parent_task_id`, validations) + novo field `task_type` = mínimo de migration risk

---

## 🎨 Wireframes & UI Flows

### 1. Projects Page - Nova Aba "Epics"

```
┌──────────────────────────────────────────────────────────────────┐
│  Project: E-Commerce Platform                        [+ New Epic] │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📋 User Authentication System                    🔴 High        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  75%           │
│  3 Stories • 12 Tasks • 45/60 Story Points                       │
│  ├─ 📖 Login with Email/Password (5 pts) ✅                      │
│  ├─ 📖 Social Login OAuth (8 pts) 🟡                            │
│  └─ 📖 Password Reset Flow (3 pts) ⚪                            │
│                                                                   │
│  📋 Shopping Cart                                 🟡 Medium      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  20%           │
│  5 Stories • 18 Tasks • 12/60 Story Points                       │
│  ├─ 📖 Add items to cart (3 pts) 🟡                             │
│  ├─ 📖 Update quantities (2 pts) ⚪                              │
│  └─ 📖 Persistent cart (5 pts) ⚪                                │
│                                                                   │
│  [+ Create Epic from PRD]                                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

Legend:
  ✅ Done   🟡 In Progress   ⚪ Todo   🔴 High   🟡 Medium   🟢 Low
```

### 2. Epic Detail View - Tree Visualization

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Epics                                    [Edit Epic]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📋 User Authentication System                                    │
│  Implement complete authentication system with OAuth support     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  📊 Statistics                                             │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  75%     │  │
│  │  Stories: 3 • Tasks: 12 • Subtasks: 24                    │  │
│  │  Story Points: 45/60 completed                             │  │
│  │  In Progress: 5 tasks • Todo: 3 tasks                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  🌲 Tree View                               [+ Add Story]         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  ▼ 📖 Login with Email/Password                    5 pts  │  │
│  │    Status: ✅ Done                                         │  │
│  │    Assignee: @dev-team                                     │  │
│  │    Acceptance Criteria: 5/5 ✓                              │  │
│  │                                                            │  │
│  │    ▼ ✓ Create login API endpoint                          │  │
│  │        Status: ✅ Done                                     │  │
│  │        ▶ ⚡ Add password hashing with bcrypt               │  │
│  │        ▶ ⚡ Implement JWT token generation                 │  │
│  │                                                            │  │
│  │    ▼ ✓ Build login form UI                                │  │
│  │        Status: ✅ Done                                     │  │
│  │        └─ No subtasks                                      │  │
│  │                                                            │  │
│  │  ▶ 📖 Social Login OAuth                           8 pts  │  │
│  │    Status: 🟡 Doing • 3/5 tasks done                       │  │
│  │                                                            │  │
│  │  ▶ 📖 Password Reset Flow                          3 pts  │  │
│  │    Status: ⚪ Todo • 0/3 tasks done                        │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

Interactions:
  • Click ▶/▼ to expand/collapse
  • Drag stories to reorder
  • Click story to open detail modal
  • Hover for quick actions (edit, delete, move)
```

### 3. Create Story Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  Create New Story                                         [X]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Parent Epic: 📋 User Authentication System                      │
│                                                                   │
│  Story Title *                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Login with Email/Password                                │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Description (supports markdown)                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ As a user, I want to log in with my email and           │    │
│  │ password so that I can access my account securely.       │    │
│  │                                                           │    │
│  │ **Technical Notes:**                                      │    │
│  │ - Use JWT for session management                         │    │
│  │ - Hash passwords with bcrypt (cost factor 12)            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Story Points              Assignee                Priority       │
│  ┌──────┐                 ┌──────────┐           ┌─────────┐     │
│  │  5   │                 │ @dev-team│           │ High ▼  │     │
│  └──────┘                 └──────────┘           └─────────┘     │
│                                                                   │
│  Acceptance Criteria                          [+ Add Criterion]   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 1. ☐ User can enter email and password in login form     │    │
│  │ 2. ☐ System validates credentials against database       │    │
│  │ 3. ☐ On success, user receives JWT token (24h validity)  │    │
│  │ 4. ☐ On failure, user sees clear error message           │    │
│  │ 5. ☐ Login attempts rate-limited to 5/min per IP         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Dependencies (optional)                      [+ Add Dependency]  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ No dependencies                                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│                                  [Cancel]  [Create Story]         │
└──────────────────────────────────────────────────────────────────┘
```

### 4. BMAD AI Generation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  Generate Epics from PRD                                   [X]    │
├──────────────────────────────────────────────────────────────────┤
│  Step 1/3: Paste PRD                                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ # Product Requirements Document                           │    │
│  │                                                           │    │
│  │ ## Vision                                                 │    │
│  │ Build a secure, user-friendly authentication system      │    │
│  │ for our e-commerce platform with support for email       │    │
│  │ login and social OAuth providers.                         │    │
│  │                                                           │    │
│  │ ## Functional Requirements                                │    │
│  │ 1. Email/password login                                   │    │
│  │ 2. Google OAuth integration                               │    │
│  │ 3. GitHub OAuth integration                               │    │
│  │ 4. Password reset flow                                    │    │
│  │ 5. Session management with JWT                            │    │
│  │                                                           │    │
│  │ ## Success Metrics                                        │    │
│  │ - Login success rate > 95%                                │    │
│  │ - Password reset completion rate > 80%                    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [← Back]                                       [Analyze PRD →]   │
├──────────────────────────────────────────────────────────────────┤
│  Step 2/3: Review Generated Epics                                │
│                                                                   │
│  🤖 AI identified 2 epics from your PRD:                          │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ✓ 📋 Epic 1: User Authentication Core                      │  │
│  │   Stories: 3 • Estimated: 16 story points                  │  │
│  │   ├─ Login with Email/Password (5 pts)                     │  │
│  │   ├─ Session Management & JWT (8 pts)                      │  │
│  │   └─ Password Reset Flow (3 pts)                           │  │
│  │                                                            │  │
│  │   [Edit] [Remove]                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ✓ 📋 Epic 2: OAuth Integration                             │  │
│  │   Stories: 2 • Estimated: 13 story points                  │  │
│  │   ├─ Google OAuth (8 pts)                                  │  │
│  │   └─ GitHub OAuth (5 pts)                                  │  │
│  │                                                            │  │
│  │   [Edit] [Remove]                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [+ Add Manual Epic]                                              │
│                                                                   │
│  [← Back]                                    [Create Epics →]    │
├──────────────────────────────────────────────────────────────────┤
│  Step 3/3: Epics Created Successfully!                           │
│                                                                   │
│  ✅ Created 2 epics with 5 stories (29 story points total)       │
│                                                                   │
│  Next steps:                                                      │
│  1. Review acceptance criteria for each story                    │
│  2. Break down stories into tasks                                │
│  3. Assign stories to team members                               │
│  4. Start working!                                                │
│                                                                   │
│                        [View Epics] [Create Another PRD]          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 User Flows

### Flow 1: Criar Hierarquia Manualmente

```
1. User acessa Projects → Seleciona projeto → Aba "Epics"
   └─ Vê lista de épicos existentes ou empty state

2. Clica em [+ New Epic]
   └─ Modal de criação abre

3. Preenche:
   - Title: "User Authentication System"
   - Description: "Implement complete auth..."
   - Priority: High
   - Assignee: @dev-team
   └─ Clica [Create Epic]

4. Épico aparece na lista
   └─ Clica no épico para abrir detail view

5. Dentro do épico, clica [+ Add Story]
   └─ Modal de criação de story abre

6. Preenche story:
   - Title: "Login with Email/Password"
   - Description: "As a user, I want to..."
   - Story Points: 5
   - Acceptance Criteria: [5 items]
   └─ Clica [Create Story]

7. Story aparece expandida no tree view
   └─ Clica na story para adicionar tasks

8. Dentro da story, clica [+ Add Task]
   └─ Modal simples abre (rápido!)

9. Cria task:
   - Title: "Create login API endpoint"
   - Assignee: @backend-dev
   └─ Clica [Create Task]

10. Task aparece sob a story
    └─ Pode expandir task para adicionar subtasks

Resultado: Hierarquia completa criada em ~5 minutos
```

### Flow 2: Gerar Hierarquia com BMAD AI

```
1. User acessa Projects → Seleciona projeto → Aba "Epics"
   └─ Vê botão [Create Epic from PRD]

2. Clica em [Create Epic from PRD]
   └─ Modal multi-step abre

3. Step 1: Cola PRD completo no textarea
   └─ Clica [Analyze PRD]
   └─ AI processa (3-5 segundos)

4. Step 2: Review de épicos gerados
   - AI mostra 2 épicos identificados
   - Cada épico já tem stories estimadas
   - User pode editar, remover, ou adicionar mais
   └─ Clica [Create Epics]

5. AI cria épicos no backend
   └─ Progress indicator mostra criação

6. Step 3: Success screen
   - Mostra resumo do que foi criado
   - Links para cada épico
   └─ Clica [View Epics]

7. User vê épicos na lista principal
   └─ Pode expandir cada um para ver stories
   └─ Stories já têm acceptance criteria preenchidos

Resultado: 2 épicos com 5 stories criados em ~30 segundos
```

### Flow 3: Mover Task para Outro Epic

```
1. User está em Epic Detail View
   └─ Vê tree com todas as stories e tasks

2. Encontra task que deveria estar em outro epic
   └─ Clica no botão [...] da task

3. Menu dropdown abre:
   - Edit
   - Delete
   - Move to...
   └─ Seleciona [Move to...]

4. Modal de seleção abre:
   - Mostra lista de épicos do projeto
   - Mostra stories dentro de cada épico
   └─ Seleciona target story ou epic

5. Clica [Move Task]
   └─ Backend valida hierarquia
   └─ Task move para novo parent

6. UI atualiza:
   - Task desaparece da view atual
   - Toast notification confirma
   └─ User pode navegar para o epic de destino

Resultado: Task movida com validação de hierarquia
```

---

## 🤖 MCP Commands - AI Workflows

### Scenario 1: AI cria épico completo a partir de descrição

**Prompt do usuário para AI IDE (Cursor/Windsurf):**
```
Create an epic for "User Authentication" with email login,
OAuth, and password reset. Include stories with acceptance criteria.
```

**AI executa:**
```python
# 1. Cria épico
archon:manage_epic(
  action="create",
  project_id="abc123",
  title="User Authentication System",
  description="Complete authentication system with email and OAuth",
  epic_metadata={
    "functional_requirements": [
      "Email/password login",
      "Google OAuth",
      "GitHub OAuth",
      "Password reset"
    ],
    "technical_requirements": [
      "JWT session management",
      "bcrypt password hashing",
      "Rate limiting"
    ],
    "success_metrics": [
      "Login success rate > 95%",
      "Password reset completion > 80%"
    ]
  }
)
# Returns: {"epic": {"id": "epic-001", ...}}

# 2. Cria story 1
archon:manage_story(
  action="create",
  parent_task_id="epic-001",
  title="Login with Email/Password",
  description="As a user, I want to log in with email and password...",
  story_points=5,
  acceptance_criteria=[
    "User can enter email and password in login form",
    "System validates credentials against database",
    "On success, user receives JWT token (24h validity)",
    "On failure, user sees clear error message",
    "Login attempts rate-limited to 5/min per IP"
  ]
)

# 3. Cria story 2
archon:manage_story(
  action="create",
  parent_task_id="epic-001",
  title="Social Login OAuth",
  description="As a user, I want to log in with Google or GitHub...",
  story_points=8,
  acceptance_criteria=[
    "Google OAuth flow implemented",
    "GitHub OAuth flow implemented",
    "User profile created/updated from OAuth data",
    "Error handling for OAuth failures"
  ]
)

# 4. Cria story 3
archon:manage_story(
  action="create",
  parent_task_id="epic-001",
  title="Password Reset Flow",
  description="As a user, I want to reset my password via email...",
  story_points=3,
  acceptance_criteria=[
    "User can request password reset link",
    "Email sent with secure token",
    "User can set new password",
    "Old sessions invalidated on password change"
  ]
)
```

**AI responde ao usuário:**
```
✅ Created epic "User Authentication System" with 3 stories:

1. 📖 Login with Email/Password (5 pts)
   - 5 acceptance criteria defined

2. 📖 Social Login OAuth (8 pts)
   - 4 acceptance criteria defined

3. 📖 Password Reset Flow (3 pts)
   - 4 acceptance criteria defined

Total: 16 story points
View in Archon: http://localhost:3737/projects/abc123/epics
```

### Scenario 2: AI busca progresso de épico

**Prompt do usuário:**
```
What's the current progress on the User Authentication epic?
```

**AI executa:**
```python
# 1. Busca épico e suas estatísticas
archon:find_epics(epic_id="epic-001")

# Returns:
{
  "epic": {
    "id": "epic-001",
    "title": "User Authentication System",
    "status": "doing",
    "priority": "high"
  },
  "statistics": {
    "story_count": 3,
    "task_count": 12,
    "completed_tasks": 9,
    "in_progress_tasks": 2,
    "total_story_points": 16,
    "completed_story_points": 5,
    "completion_percentage": 31.25
  },
  "stories": [
    {
      "story": {
        "id": "story-001",
        "title": "Login with Email/Password",
        "status": "done",
        "story_points": 5
      },
      "tasks_count": 3
    },
    {
      "story": {
        "id": "story-002",
        "title": "Social Login OAuth",
        "status": "doing",
        "story_points": 8
      },
      "tasks_count": 5
    },
    {
      "story": {
        "id": "story-003",
        "title": "Password Reset Flow",
        "status": "todo",
        "story_points": 3
      },
      "tasks_count": 4
    }
  ]
}
```

**AI responde:**
```
📊 Epic: User Authentication System

Progress: 31% complete (5/16 story points)

Stories Status:
✅ Login with Email/Password (5 pts) - DONE
🟡 Social Login OAuth (8 pts) - IN PROGRESS
   └─ 3/5 tasks completed
⚪ Password Reset Flow (3 pts) - TODO
   └─ 0/4 tasks started

Tasks: 9/12 completed, 2 in progress

Next up: Finish OAuth integration, then start password reset flow.
```

### Scenario 3: AI quebra story em tasks

**Prompt do usuário:**
```
Break down the "Social Login OAuth" story into technical tasks
```

**AI executa:**
```python
# 1. Busca story details
archon:find_tasks(task_id="story-002")

# 2. Analisa acceptance criteria e cria tasks
archon:manage_task(
  action="create",
  parent_task_id="story-002",
  title="Implement Google OAuth flow",
  description="Set up Google OAuth client, handle callback, exchange code for token",
  assignee="@backend-dev",
  priority="high"
)

archon:manage_task(
  action="create",
  parent_task_id="story-002",
  title="Implement GitHub OAuth flow",
  description="Set up GitHub OAuth app, handle callback, fetch user profile",
  assignee="@backend-dev",
  priority="high"
)

archon:manage_task(
  action="create",
  parent_task_id="story-002",
  title="Create or update user profile from OAuth data",
  description="Map OAuth provider data to user model, handle conflicts",
  assignee="@backend-dev",
  priority="medium"
)

archon:manage_task(
  action="create",
  parent_task_id="story-002",
  title="Build OAuth login buttons in UI",
  description="Add Google and GitHub login buttons to login form",
  assignee="@frontend-dev",
  priority="medium"
)

archon:manage_task(
  action="create",
  parent_task_id="story-002",
  title="Add error handling for OAuth failures",
  description="Handle network errors, user cancellation, provider downtime",
  assignee="@backend-dev",
  priority="low"
)
```

**AI responde:**
```
✅ Created 5 tasks for story "Social Login OAuth":

Backend Tasks:
1. Implement Google OAuth flow (@backend-dev, high)
2. Implement GitHub OAuth flow (@backend-dev, high)
3. Create or update user profile from OAuth data (@backend-dev, medium)
4. Add error handling for OAuth failures (@backend-dev, low)

Frontend Tasks:
5. Build OAuth login buttons in UI (@frontend-dev, medium)

Recommendation: Start with tasks 1-2 in parallel, then 3, 5, and finally 4.
```

---

## ✅ Implementation Checklist (Quick Reference)

### Phase 1: Backend (Week 1)
- [ ] Create `task_type` enum (epic, story, task, subtask)
- [ ] Alter `archon_tasks` table with new fields
- [ ] Add hierarchical constraints
- [ ] Create `task_hierarchy` view
- [ ] Create `epic_statistics` view
- [ ] Implement `TaskHierarchyService`
- [ ] Create `/api/hierarchy` endpoints
- [ ] Write backend tests (80%+ coverage)

### Phase 2: Frontend Foundation (Week 2)
- [ ] Define TypeScript types in `hierarchy.ts`
- [ ] Implement `hierarchyService.ts`
- [ ] Create query hooks in `useHierarchyQueries.ts`
- [ ] Set up query keys factory
- [ ] Write hook tests

### Phase 3: UI Components (Weeks 3-4)
- [ ] Build `EpicCard` and `EpicList`
- [ ] Build `StoryCard` and `StoryList`
- [ ] Build `EpicTreeView` with expand/collapse
- [ ] Build `EpicStatistics` dashboard
- [ ] Build `CreateEpicModal`
- [ ] Build `CreateStoryModal`
- [ ] Add drag-and-drop support
- [ ] Write component tests

### Phase 4: MCP Tools (Week 5)
- [ ] Implement `archon:find_epics` tool
- [ ] Implement `archon:manage_epic` tool
- [ ] Implement `archon:manage_story` tool
- [ ] Test tools in MCP Inspector
- [ ] Update CLAUDE.md with MCP examples

### Phase 5: BMAD AI (Week 6)
- [ ] Create `ProductManager` AI agent
- [ ] Create `ScrumMaster` AI agent
- [ ] Build PRD analysis endpoint
- [ ] Build epic generation endpoint
- [ ] Build story generation endpoint
- [ ] Create BMAD UI flow
- [ ] Test end-to-end workflow

### Phase 6: Polish (Week 7)
- [ ] Optimize database queries (< 200ms p95)
- [ ] Implement ETag caching on hierarchy endpoints
- [ ] Add skeleton loaders
- [ ] Create interactive tutorial
- [ ] Write comprehensive documentation
- [ ] Prepare release notes

---

## 🎯 Success Criteria

### User Can:
- [x] Create epic manually in < 30 seconds
- [x] Generate epic from PRD with AI in < 1 minute
- [x] View complete hierarchy in tree format
- [x] See real-time progress stats (completion %, story points)
- [x] Move tasks between stories/epics
- [x] Expand/collapse tree nodes smoothly
- [x] Filter by assignee, status, priority
- [x] Export hierarchy to markdown/JSON

### System Must:
- [x] Load hierarchy of 100+ items in < 200ms
- [x] Validate parent-child relationships on create/update
- [x] Prevent circular dependencies
- [x] Auto-update statistics when tasks change
- [x] Support drag-and-drop reordering
- [x] Cache with ETags (70%+ bandwidth reduction)

### AI Must:
- [x] Generate valid epics from PRD (90%+ success rate)
- [x] Create stories with meaningful acceptance criteria
- [x] Estimate story points reasonably (±20% accuracy)
- [x] Respect project context and existing patterns

---

## 📚 Additional Resources

### Internal Docs to Update
- `CLAUDE.md` - Add hierarchy commands and MCP tools
- `ARCHITECTURE.md` - Document new hierarchical structure
- `API_NAMING_CONVENTIONS.md` - Add hierarchy endpoint patterns

### External References
- [BMAD Method GitHub](https://github.com/bmad-code-org/BMAD-METHOD)
- [Atlassian Agile Epics](https://www.atlassian.com/agile/project-management/epics)
- [TanStack Query Docs](https://tanstack.com/query/latest/docs)

### Example Prompts for AI
```
"Create an epic for payment processing with Stripe integration"
"Break down the checkout epic into stories"
"What's blocking the authentication epic?"
"Move task X to story Y"
"Show me all high-priority stories"
"Generate acceptance criteria for this story"
```

---

**Document Status:** Ready for Implementation ✅
**Last Updated:** 2025-11-15
**Author:** Claude (AI Assistant)
**Reviewers:** [Add names after review]
