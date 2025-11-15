# Plano de Implementação: Épicos > Stories > Tasks (BMAD Method)

## Sumário Executivo

Este documento apresenta o plano de implementação de uma estrutura hierárquica de gestão ágil no Archon, seguindo os princípios do **BMAD Method** (Breakthrough Method for Agile AI-Driven Development). A estrutura seguirá a hierarquia:

**Projeto → Épico → Story → Task → Subtask**

## 1. Contexto e Análise

### 1.1 Estrutura Atual do Archon

**Status Atual:**
- ✅ Banco de dados possui campo `parent_task_id` (self-referencing foreign key)
- ✅ Schema de validação frontend inclui `parent_task_id` (Zod)
- ✅ Query no backend já seleciona `parent_task_id`
- ❌ Nenhuma lógica de negócio implementada para hierarquia
- ❌ Frontend não possui tipos ou UI para hierarquia
- ❌ MCP tools não suportam hierarquia

**Tabelas Envolvidas:**
- `archon_projects` - Projetos (container principal)
- `archon_tasks` - Atualmente usado apenas para tasks simples
- `archon_project_sources` - Links para knowledge base
- `archon_document_versions` - Versionamento de documentos

### 1.2 Framework BMAD Method

**Princípios do BMAD:**

1. **Spec-Oriented Development**: PRD detalhado como base
2. **Epic Sharding**: Quebra do PRD em épicos autocontidos
3. **Story Creation**: Scrum Master cria stories hiperdetalhadas com contexto completo
4. **Task Granularity**: Tasks de no máximo 1 dia de desenvolvimento
5. **Context Preservation**: Cada unidade mantém contexto completo das fases anteriores
6. **AI Agent Collaboration**: Diferentes agentes (PM, Scrum Master, Developer) trabalham em fases específicas

**Hierarquia BMAD:**
```
PRD (Product Requirements Document)
  └─ Epic (Self-contained development units)
      └─ Story (Hyper-detailed with architectural context)
          └─ Task/Subtask (Granular, 1-day max)
```

### 1.3 Estrutura Proposta para Archon

**Mapeamento BMAD → Archon:**
```
Project (= PRD context)
  └─ Epic (type: "epic")
      └─ Story (type: "story", parent_task_id → Epic)
          └─ Task (type: "task", parent_task_id → Story)
              └─ Subtask (type: "subtask", parent_task_id → Task)
```

**Justificativa:**
- Aproveita campo `parent_task_id` existente
- Usa type discriminator para diferenciar níveis
- Mantém flexibilidade para diferentes metodologias
- Permite queries eficientes com índices existentes

---

## 2. Especificação Técnica

### 2.1 Modelo de Dados

#### 2.1.1 Alterações no Schema

**Nova Enum:**
```sql
CREATE TYPE task_type AS ENUM ('epic', 'story', 'task', 'subtask');
```

**Alteração na Tabela `archon_tasks`:**
```sql
ALTER TABLE archon_tasks
  ADD COLUMN task_type task_type DEFAULT 'task' NOT NULL;

-- Index para queries por tipo
CREATE INDEX idx_archon_tasks_type ON archon_tasks(task_type);

-- Index composto para queries hierárquicas
CREATE INDEX idx_archon_tasks_parent_type ON archon_tasks(parent_task_id, task_type);
```

**Novos Campos Opcionais (para Épicos e Stories):**
```sql
ALTER TABLE archon_tasks
  ADD COLUMN epic_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN story_points INTEGER,
  ADD COLUMN acceptance_criteria JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN dependencies JSONB DEFAULT '[]'::jsonb;
```

**Constraints de Validação:**
```sql
-- Epic não pode ter parent
ALTER TABLE archon_tasks
  ADD CONSTRAINT chk_epic_no_parent
  CHECK (task_type != 'epic' OR parent_task_id IS NULL);

-- Story deve ter Epic como parent
ALTER TABLE archon_tasks
  ADD CONSTRAINT chk_story_parent_is_epic
  CHECK (
    task_type != 'story' OR
    parent_task_id IN (SELECT id FROM archon_tasks WHERE task_type = 'epic')
  );

-- Task deve ter Story ou Epic como parent
ALTER TABLE archon_tasks
  ADD CONSTRAINT chk_task_parent_valid
  CHECK (
    task_type != 'task' OR
    parent_task_id IN (
      SELECT id FROM archon_tasks
      WHERE task_type IN ('story', 'epic')
    )
  );

-- Subtask deve ter Task como parent
ALTER TABLE archon_tasks
  ADD CONSTRAINT chk_subtask_parent_is_task
  CHECK (
    task_type != 'subtask' OR
    parent_task_id IN (SELECT id FROM archon_tasks WHERE task_type = 'task')
  );
```

#### 2.1.2 Views para Queries Eficientes

**View para Hierarquia Completa:**
```sql
CREATE OR REPLACE VIEW task_hierarchy AS
WITH RECURSIVE task_tree AS (
  -- Base case: Épicos (nível 0)
  SELECT
    id,
    project_id,
    parent_task_id,
    task_type,
    title,
    status,
    0 AS depth,
    ARRAY[id] AS path,
    id AS epic_id,
    NULL::uuid AS story_id,
    NULL::uuid AS task_id
  FROM archon_tasks
  WHERE task_type = 'epic' AND archived = false

  UNION ALL

  -- Recursive case: filhos
  SELECT
    t.id,
    t.project_id,
    t.parent_task_id,
    t.task_type,
    t.title,
    t.status,
    tt.depth + 1,
    tt.path || t.id,
    tt.epic_id,
    CASE WHEN t.task_type = 'story' THEN t.id ELSE tt.story_id END,
    CASE WHEN t.task_type = 'task' THEN t.id ELSE tt.task_id END
  FROM archon_tasks t
  INNER JOIN task_tree tt ON t.parent_task_id = tt.id
  WHERE t.archived = false
)
SELECT * FROM task_tree
ORDER BY path;
```

**View para Estatísticas de Épico:**
```sql
CREATE OR REPLACE VIEW epic_statistics AS
SELECT
  e.id AS epic_id,
  e.title AS epic_title,
  e.project_id,
  COUNT(DISTINCT s.id) AS story_count,
  COUNT(DISTINCT t.id) AS task_count,
  COUNT(DISTINCT st.id) AS subtask_count,
  COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completed_tasks,
  COUNT(DISTINCT CASE WHEN t.status IN ('doing', 'review') THEN t.id END) AS in_progress_tasks,
  SUM(s.story_points) AS total_story_points,
  SUM(CASE WHEN s.status = 'done' THEN s.story_points ELSE 0 END) AS completed_story_points
FROM archon_tasks e
LEFT JOIN archon_tasks s ON s.parent_task_id = e.id AND s.task_type = 'story'
LEFT JOIN archon_tasks t ON t.parent_task_id = s.id AND t.task_type = 'task'
LEFT JOIN archon_tasks st ON st.parent_task_id = t.id AND st.task_type = 'subtask'
WHERE e.task_type = 'epic' AND e.archived = false
GROUP BY e.id, e.title, e.project_id;
```

### 2.2 Backend Implementation

#### 2.2.1 Novos Modelos Pydantic

**Location:** `python/src/server/models/task_hierarchy.py` (novo arquivo)

```python
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, UUID4, field_validator
from datetime import datetime

class TaskType(str, Enum):
    """Tipo de item na hierarquia de tarefas"""
    EPIC = "epic"
    STORY = "story"
    TASK = "task"
    SUBTASK = "subtask"

class EpicMetadata(BaseModel):
    """Metadados específicos para Épicos"""
    functional_requirements: List[str] = Field(default_factory=list)
    technical_requirements: List[str] = Field(default_factory=list)
    user_personas: List[str] = Field(default_factory=list)
    success_metrics: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)

class AcceptanceCriteria(BaseModel):
    """Critérios de aceitação para Stories"""
    criteria: str
    completed: bool = False
    tested_by: Optional[str] = None
    tested_at: Optional[datetime] = None

class TaskDependency(BaseModel):
    """Dependência entre tasks"""
    depends_on_task_id: UUID4
    dependency_type: str = "blocks"  # blocks, relates_to, duplicates
    description: Optional[str] = None

class HierarchicalTask(BaseModel):
    """Task com suporte a hierarquia"""
    id: UUID4
    project_id: UUID4
    parent_task_id: Optional[UUID4] = None
    task_type: TaskType = TaskType.TASK
    title: str
    description: str = ""
    status: str  # todo, doing, review, done
    assignee: str = "User"
    task_order: int = 0
    priority: str = "medium"
    feature: Optional[str] = None

    # Campos hierárquicos
    epic_metadata: Optional[EpicMetadata] = None
    story_points: Optional[int] = None
    acceptance_criteria: List[AcceptanceCriteria] = Field(default_factory=list)
    dependencies: List[TaskDependency] = Field(default_factory=list)

    # Campos padrão
    sources: List[dict] = Field(default_factory=list)
    code_examples: List[dict] = Field(default_factory=list)
    archived: bool = False
    archived_at: Optional[datetime] = None
    archived_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Campos calculados (preenchidos por queries)
    depth: Optional[int] = None
    path: Optional[List[UUID4]] = None
    children_count: Optional[int] = None
    epic_id: Optional[UUID4] = None
    story_id: Optional[UUID4] = None

    @field_validator('parent_task_id')
    @classmethod
    def validate_parent(cls, v, info):
        """Valida hierarquia de parent"""
        task_type = info.data.get('task_type')
        if task_type == TaskType.EPIC and v is not None:
            raise ValueError("Épicos não podem ter parent_task_id")
        if task_type != TaskType.EPIC and v is None:
            raise ValueError(f"{task_type} deve ter um parent_task_id")
        return v

class CreateEpicRequest(BaseModel):
    """Request para criar Épico"""
    project_id: UUID4
    title: str
    description: str = ""
    epic_metadata: Optional[EpicMetadata] = None
    assignee: str = "User"
    priority: str = "medium"

class CreateStoryRequest(BaseModel):
    """Request para criar Story"""
    parent_task_id: UUID4  # Epic ID
    title: str
    description: str = ""
    story_points: Optional[int] = None
    acceptance_criteria: List[str] = Field(default_factory=list)
    dependencies: List[TaskDependency] = Field(default_factory=list)
    assignee: str = "User"
    priority: str = "medium"

class CreateTaskRequest(BaseModel):
    """Request para criar Task"""
    parent_task_id: UUID4  # Story ID ou Epic ID
    title: str
    description: str = ""
    assignee: str = "User"
    priority: str = "medium"
    feature: Optional[str] = None

class TaskHierarchyStats(BaseModel):
    """Estatísticas de hierarquia"""
    epic_id: UUID4
    epic_title: str
    story_count: int = 0
    task_count: int = 0
    subtask_count: int = 0
    completed_tasks: int = 0
    in_progress_tasks: int = 0
    total_story_points: int = 0
    completed_story_points: int = 0
    completion_percentage: float = 0.0
```

#### 2.2.2 Novo Service Layer

**Location:** `python/src/server/services/projects/task_hierarchy_service.py` (novo arquivo)

```python
from typing import List, Optional
from uuid import UUID
from supabase import Client
from ..models.task_hierarchy import (
    HierarchicalTask,
    TaskType,
    CreateEpicRequest,
    CreateStoryRequest,
    CreateTaskRequest,
    TaskHierarchyStats
)
from ..config.database import get_supabase_client
from ..exceptions import NotFoundError, ValidationError

class TaskHierarchyService:
    """Service para gerenciar hierarquia de tasks"""

    def __init__(self):
        self.db: Client = get_supabase_client()

    # ==================== CRUD Épicos ====================

    async def create_epic(self, request: CreateEpicRequest) -> HierarchicalTask:
        """Cria um novo Épico"""
        data = {
            "project_id": str(request.project_id),
            "task_type": TaskType.EPIC.value,
            "title": request.title,
            "description": request.description,
            "assignee": request.assignee,
            "priority": request.priority,
            "epic_metadata": request.epic_metadata.model_dump() if request.epic_metadata else {},
            "status": "todo",
            "task_order": 0
        }

        result = self.db.table("archon_tasks").insert(data).execute()

        if not result.data:
            raise ValidationError("Falha ao criar épico")

        return HierarchicalTask(**result.data[0])

    async def get_epics_by_project(self, project_id: UUID) -> List[HierarchicalTask]:
        """Lista todos os épicos de um projeto"""
        result = self.db.table("archon_tasks")\
            .select("*")\
            .eq("project_id", str(project_id))\
            .eq("task_type", TaskType.EPIC.value)\
            .eq("archived", False)\
            .order("task_order")\
            .execute()

        return [HierarchicalTask(**item) for item in result.data]

    # ==================== CRUD Stories ====================

    async def create_story(self, request: CreateStoryRequest) -> HierarchicalTask:
        """Cria uma nova Story"""
        # Valida que parent é um Epic
        parent = await self._get_task_by_id(request.parent_task_id)
        if parent.task_type != TaskType.EPIC:
            raise ValidationError(f"Story deve ter um Epic como parent, não {parent.task_type}")

        # Converte acceptance_criteria de lista de strings para lista de objetos
        acceptance_criteria = [
            {"criteria": c, "completed": False}
            for c in request.acceptance_criteria
        ]

        data = {
            "project_id": str(parent.project_id),
            "parent_task_id": str(request.parent_task_id),
            "task_type": TaskType.STORY.value,
            "title": request.title,
            "description": request.description,
            "story_points": request.story_points,
            "acceptance_criteria": acceptance_criteria,
            "dependencies": [d.model_dump() for d in request.dependencies],
            "assignee": request.assignee,
            "priority": request.priority,
            "status": "todo"
        }

        result = self.db.table("archon_tasks").insert(data).execute()

        if not result.data:
            raise ValidationError("Falha ao criar story")

        return HierarchicalTask(**result.data[0])

    async def get_stories_by_epic(self, epic_id: UUID) -> List[HierarchicalTask]:
        """Lista todas as stories de um épico"""
        result = self.db.table("archon_tasks")\
            .select("*")\
            .eq("parent_task_id", str(epic_id))\
            .eq("task_type", TaskType.STORY.value)\
            .eq("archived", False)\
            .order("task_order")\
            .execute()

        return [HierarchicalTask(**item) for item in result.data]

    # ==================== CRUD Tasks ====================

    async def create_task(self, request: CreateTaskRequest) -> HierarchicalTask:
        """Cria uma nova Task"""
        # Valida que parent é Story ou Epic
        parent = await self._get_task_by_id(request.parent_task_id)
        if parent.task_type not in [TaskType.STORY, TaskType.EPIC]:
            raise ValidationError(
                f"Task deve ter Story ou Epic como parent, não {parent.task_type}"
            )

        data = {
            "project_id": str(parent.project_id),
            "parent_task_id": str(request.parent_task_id),
            "task_type": TaskType.TASK.value,
            "title": request.title,
            "description": request.description,
            "assignee": request.assignee,
            "priority": request.priority,
            "feature": request.feature,
            "status": "todo"
        }

        result = self.db.table("archon_tasks").insert(data).execute()

        if not result.data:
            raise ValidationError("Falha ao criar task")

        return HierarchicalTask(**result.data[0])

    async def get_tasks_by_parent(
        self,
        parent_id: UUID,
        task_type: Optional[TaskType] = None
    ) -> List[HierarchicalTask]:
        """Lista tasks por parent (Story ou Epic)"""
        query = self.db.table("archon_tasks")\
            .select("*")\
            .eq("parent_task_id", str(parent_id))\
            .eq("archived", False)

        if task_type:
            query = query.eq("task_type", task_type.value)

        result = query.order("task_order").execute()

        return [HierarchicalTask(**item) for item in result.data]

    # ==================== Hierarquia Completa ====================

    async def get_epic_tree(self, epic_id: UUID) -> dict:
        """Retorna árvore completa de um épico"""
        epic = await self._get_task_by_id(epic_id)
        if epic.task_type != TaskType.EPIC:
            raise ValidationError(f"ID fornecido não é um épico: {epic_id}")

        # Busca stories
        stories = await self.get_stories_by_epic(epic_id)

        # Para cada story, busca tasks e subtasks
        stories_with_tasks = []
        for story in stories:
            tasks = await self.get_tasks_by_parent(story.id, TaskType.TASK)

            tasks_with_subtasks = []
            for task in tasks:
                subtasks = await self.get_tasks_by_parent(task.id, TaskType.SUBTASK)
                tasks_with_subtasks.append({
                    "task": task,
                    "subtasks": subtasks
                })

            stories_with_tasks.append({
                "story": story,
                "tasks": tasks_with_subtasks
            })

        return {
            "epic": epic,
            "stories": stories_with_tasks
        }

    async def get_project_hierarchy(self, project_id: UUID) -> List[dict]:
        """Retorna hierarquia completa de um projeto"""
        epics = await self.get_epics_by_project(project_id)

        result = []
        for epic in epics:
            epic_tree = await self.get_epic_tree(epic.id)
            result.append(epic_tree)

        return result

    # ==================== Estatísticas ====================

    async def get_epic_statistics(self, epic_id: UUID) -> TaskHierarchyStats:
        """Retorna estatísticas de um épico"""
        result = self.db.rpc("get_epic_statistics", {"p_epic_id": str(epic_id)}).execute()

        if not result.data or len(result.data) == 0:
            raise NotFoundError(f"Épico não encontrado: {epic_id}")

        stats_data = result.data[0]

        # Calcula porcentagem de conclusão
        total_tasks = stats_data.get("task_count", 0)
        completed_tasks = stats_data.get("completed_tasks", 0)
        completion_percentage = (
            (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
        )

        return TaskHierarchyStats(
            **stats_data,
            completion_percentage=completion_percentage
        )

    # ==================== Utilitários ====================

    async def _get_task_by_id(self, task_id: UUID) -> HierarchicalTask:
        """Busca task por ID"""
        result = self.db.table("archon_tasks")\
            .select("*")\
            .eq("id", str(task_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise NotFoundError(f"Task não encontrada: {task_id}")

        return HierarchicalTask(**result.data[0])

    async def move_task(
        self,
        task_id: UUID,
        new_parent_id: UUID
    ) -> HierarchicalTask:
        """Move task para novo parent (validando hierarquia)"""
        task = await self._get_task_by_id(task_id)
        new_parent = await self._get_task_by_id(new_parent_id)

        # Valida movimento baseado em tipo
        valid_moves = {
            TaskType.STORY: [TaskType.EPIC],
            TaskType.TASK: [TaskType.STORY, TaskType.EPIC],
            TaskType.SUBTASK: [TaskType.TASK]
        }

        if new_parent.task_type not in valid_moves.get(task.task_type, []):
            raise ValidationError(
                f"Não é possível mover {task.task_type} para {new_parent.task_type}"
            )

        # Atualiza parent
        result = self.db.table("archon_tasks")\
            .update({"parent_task_id": str(new_parent_id)})\
            .eq("id", str(task_id))\
            .execute()

        return HierarchicalTask(**result.data[0])
```

#### 2.2.3 Novos Endpoints da API

**Location:** `python/src/server/api_routes/task_hierarchy_api.py` (novo arquivo)

```python
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from uuid import UUID

from ..services.projects.task_hierarchy_service import TaskHierarchyService
from ..models.task_hierarchy import (
    HierarchicalTask,
    CreateEpicRequest,
    CreateStoryRequest,
    CreateTaskRequest,
    TaskHierarchyStats,
    TaskType
)

router = APIRouter(prefix="/api/hierarchy", tags=["Task Hierarchy"])

# ==================== Épicos ====================

@router.post("/epics", response_model=HierarchicalTask, status_code=201)
async def create_epic(request: CreateEpicRequest):
    """Cria um novo Épico"""
    service = TaskHierarchyService()
    return await service.create_epic(request)

@router.get("/projects/{project_id}/epics", response_model=List[HierarchicalTask])
async def list_project_epics(project_id: UUID):
    """Lista todos os épicos de um projeto"""
    service = TaskHierarchyService()
    return await service.get_epics_by_project(project_id)

@router.get("/epics/{epic_id}/statistics", response_model=TaskHierarchyStats)
async def get_epic_statistics(epic_id: UUID):
    """Retorna estatísticas de um épico"""
    service = TaskHierarchyService()
    return await service.get_epic_statistics(epic_id)

@router.get("/epics/{epic_id}/tree")
async def get_epic_tree(epic_id: UUID):
    """Retorna árvore completa de um épico (Epic > Stories > Tasks > Subtasks)"""
    service = TaskHierarchyService()
    return await service.get_epic_tree(epic_id)

# ==================== Stories ====================

@router.post("/stories", response_model=HierarchicalTask, status_code=201)
async def create_story(request: CreateStoryRequest):
    """Cria uma nova Story dentro de um Épico"""
    service = TaskHierarchyService()
    return await service.create_story(request)

@router.get("/epics/{epic_id}/stories", response_model=List[HierarchicalTask])
async def list_epic_stories(epic_id: UUID):
    """Lista todas as stories de um épico"""
    service = TaskHierarchyService()
    return await service.get_stories_by_epic(epic_id)

# ==================== Tasks ====================

@router.post("/tasks", response_model=HierarchicalTask, status_code=201)
async def create_task(request: CreateTaskRequest):
    """Cria uma nova Task dentro de uma Story ou Épico"""
    service = TaskHierarchyService()
    return await service.create_task(request)

@router.get("/{parent_id}/tasks", response_model=List[HierarchicalTask])
async def list_tasks_by_parent(
    parent_id: UUID,
    task_type: TaskType = None
):
    """Lista tasks por parent (Story ou Epic)"""
    service = TaskHierarchyService()
    return await service.get_tasks_by_parent(parent_id, task_type)

# ==================== Hierarquia Completa ====================

@router.get("/projects/{project_id}/hierarchy")
async def get_project_hierarchy(project_id: UUID):
    """Retorna hierarquia completa de um projeto (todos os épicos com suas árvores)"""
    service = TaskHierarchyService()
    return await service.get_project_hierarchy(project_id)

# ==================== Utilitários ====================

@router.put("/tasks/{task_id}/move", response_model=HierarchicalTask)
async def move_task(task_id: UUID, new_parent_id: UUID):
    """Move task para novo parent (validando hierarquia)"""
    service = TaskHierarchyService()
    return await service.move_task(task_id, new_parent_id)
```

**Registrar no `main.py`:**
```python
from .api_routes import task_hierarchy_api

app.include_router(task_hierarchy_api.router)
```

### 2.3 Frontend Implementation

#### 2.3.1 Novos Tipos TypeScript

**Location:** `archon-ui-main/src/features/projects/tasks/types/hierarchy.ts` (novo arquivo)

```typescript
// Tipos base
export type TaskType = "epic" | "story" | "task" | "subtask";

export type DatabaseTaskStatus = "todo" | "doing" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "critical";

// Metadados de Épico
export interface EpicMetadata {
  functional_requirements: string[];
  technical_requirements: string[];
  user_personas: string[];
  success_metrics: string[];
  risks: string[];
}

// Critérios de Aceitação (Stories)
export interface AcceptanceCriteria {
  criteria: string;
  completed: boolean;
  tested_by?: string;
  tested_at?: string;
}

// Dependências entre tasks
export interface TaskDependency {
  depends_on_task_id: string;
  dependency_type: "blocks" | "relates_to" | "duplicates";
  description?: string;
}

// Task hierárquica (substitui Task atual)
export interface HierarchicalTask {
  id: string;
  project_id: string;
  parent_task_id?: string;
  task_type: TaskType;
  title: string;
  description: string;
  status: DatabaseTaskStatus;
  assignee: string;
  task_order: number;
  priority: TaskPriority;
  feature?: string;

  // Campos hierárquicos
  epic_metadata?: EpicMetadata;
  story_points?: number;
  acceptance_criteria?: AcceptanceCriteria[];
  dependencies?: TaskDependency[];

  // Campos padrão
  sources?: TaskSource[];
  code_examples?: TaskCodeExample[];
  archived?: boolean;
  archived_at?: string;
  archived_by?: string;
  created_at: string;
  updated_at: string;

  // Campos calculados
  depth?: number;
  path?: string[];
  children_count?: number;
  epic_id?: string;
  story_id?: string;
}

// Requests
export interface CreateEpicRequest {
  project_id: string;
  title: string;
  description?: string;
  epic_metadata?: EpicMetadata;
  assignee?: string;
  priority?: TaskPriority;
}

export interface CreateStoryRequest {
  parent_task_id: string; // Epic ID
  title: string;
  description?: string;
  story_points?: number;
  acceptance_criteria?: string[];
  dependencies?: TaskDependency[];
  assignee?: string;
  priority?: TaskPriority;
}

export interface CreateTaskRequest {
  parent_task_id: string; // Story ID ou Epic ID
  title: string;
  description?: string;
  assignee?: string;
  priority?: TaskPriority;
  feature?: string;
}

// Estatísticas de Épico
export interface EpicStatistics {
  epic_id: string;
  epic_title: string;
  story_count: number;
  task_count: number;
  subtask_count: number;
  completed_tasks: number;
  in_progress_tasks: number;
  total_story_points: number;
  completed_story_points: number;
  completion_percentage: number;
}

// Árvore de Epic
export interface EpicTree {
  epic: HierarchicalTask;
  stories: StoryWithTasks[];
}

export interface StoryWithTasks {
  story: HierarchicalTask;
  tasks: TaskWithSubtasks[];
}

export interface TaskWithSubtasks {
  task: HierarchicalTask;
  subtasks: HierarchicalTask[];
}

// Tipos auxiliares
export interface TaskSource {
  id: string;
  title: string;
  url?: string;
}

export interface TaskCodeExample {
  id: string;
  summary: string;
  language: string;
}
```

#### 2.3.2 Serviço Frontend

**Location:** `archon-ui-main/src/features/projects/tasks/services/hierarchyService.ts` (novo arquivo)

```typescript
import { apiClient } from "@/features/shared/api/apiClient";
import type {
  HierarchicalTask,
  CreateEpicRequest,
  CreateStoryRequest,
  CreateTaskRequest,
  EpicStatistics,
  EpicTree,
} from "../types/hierarchy";

export const hierarchyService = {
  // ==================== Épicos ====================

  async createEpic(data: CreateEpicRequest): Promise<HierarchicalTask> {
    const response = await apiClient.post<HierarchicalTask>("/hierarchy/epics", data);
    return response.data;
  },

  async listProjectEpics(projectId: string): Promise<HierarchicalTask[]> {
    const response = await apiClient.get<HierarchicalTask[]>(
      `/hierarchy/projects/${projectId}/epics`
    );
    return response.data;
  },

  async getEpicStatistics(epicId: string): Promise<EpicStatistics> {
    const response = await apiClient.get<EpicStatistics>(
      `/hierarchy/epics/${epicId}/statistics`
    );
    return response.data;
  },

  async getEpicTree(epicId: string): Promise<EpicTree> {
    const response = await apiClient.get<EpicTree>(
      `/hierarchy/epics/${epicId}/tree`
    );
    return response.data;
  },

  // ==================== Stories ====================

  async createStory(data: CreateStoryRequest): Promise<HierarchicalTask> {
    const response = await apiClient.post<HierarchicalTask>("/hierarchy/stories", data);
    return response.data;
  },

  async listEpicStories(epicId: string): Promise<HierarchicalTask[]> {
    const response = await apiClient.get<HierarchicalTask[]>(
      `/hierarchy/epics/${epicId}/stories`
    );
    return response.data;
  },

  // ==================== Tasks ====================

  async createTask(data: CreateTaskRequest): Promise<HierarchicalTask> {
    const response = await apiClient.post<HierarchicalTask>("/hierarchy/tasks", data);
    return response.data;
  },

  async listTasksByParent(
    parentId: string,
    taskType?: string
  ): Promise<HierarchicalTask[]> {
    const params = taskType ? { task_type: taskType } : {};
    const response = await apiClient.get<HierarchicalTask[]>(
      `/hierarchy/${parentId}/tasks`,
      { params }
    );
    return response.data;
  },

  // ==================== Hierarquia Completa ====================

  async getProjectHierarchy(projectId: string): Promise<EpicTree[]> {
    const response = await apiClient.get<EpicTree[]>(
      `/hierarchy/projects/${projectId}/hierarchy`
    );
    return response.data;
  },

  // ==================== Utilitários ====================

  async moveTask(taskId: string, newParentId: string): Promise<HierarchicalTask> {
    const response = await apiClient.put<HierarchicalTask>(
      `/hierarchy/tasks/${taskId}/move`,
      { new_parent_id: newParentId }
    );
    return response.data;
  },
};
```

#### 2.3.3 Query Hooks

**Location:** `archon-ui-main/src/features/projects/tasks/hooks/useHierarchyQueries.ts` (novo arquivo)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hierarchyService } from "../services/hierarchyService";
import { STALE_TIMES } from "@/features/shared/config/queryPatterns";
import type {
  CreateEpicRequest,
  CreateStoryRequest,
  CreateTaskRequest,
  HierarchicalTask,
} from "../types/hierarchy";

// Query Keys Factory
export const hierarchyKeys = {
  all: ["hierarchy"] as const,
  epics: (projectId: string) => [...hierarchyKeys.all, "epics", projectId] as const,
  epicTree: (epicId: string) => [...hierarchyKeys.all, "epic-tree", epicId] as const,
  epicStats: (epicId: string) => [...hierarchyKeys.all, "epic-stats", epicId] as const,
  stories: (epicId: string) => [...hierarchyKeys.all, "stories", epicId] as const,
  tasks: (parentId: string) => [...hierarchyKeys.all, "tasks", parentId] as const,
  projectHierarchy: (projectId: string) =>
    [...hierarchyKeys.all, "project", projectId] as const,
};

// ==================== Queries ====================

export function useProjectEpics(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? hierarchyKeys.epics(projectId) : ["disabled"],
    queryFn: () => projectId
      ? hierarchyService.listProjectEpics(projectId)
      : Promise.reject("No project ID"),
    enabled: !!projectId,
    staleTime: STALE_TIMES.normal,
  });
}

export function useEpicTree(epicId: string | undefined) {
  return useQuery({
    queryKey: epicId ? hierarchyKeys.epicTree(epicId) : ["disabled"],
    queryFn: () => epicId
      ? hierarchyService.getEpicTree(epicId)
      : Promise.reject("No epic ID"),
    enabled: !!epicId,
    staleTime: STALE_TIMES.frequent,
  });
}

export function useEpicStatistics(epicId: string | undefined) {
  return useQuery({
    queryKey: epicId ? hierarchyKeys.epicStats(epicId) : ["disabled"],
    queryFn: () => epicId
      ? hierarchyService.getEpicStatistics(epicId)
      : Promise.reject("No epic ID"),
    enabled: !!epicId,
    staleTime: STALE_TIMES.frequent,
  });
}

export function useProjectHierarchy(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? hierarchyKeys.projectHierarchy(projectId) : ["disabled"],
    queryFn: () => projectId
      ? hierarchyService.getProjectHierarchy(projectId)
      : Promise.reject("No project ID"),
    enabled: !!projectId,
    staleTime: STALE_TIMES.normal,
  });
}

// ==================== Mutations ====================

export function useCreateEpic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEpicRequest) => hierarchyService.createEpic(data),
    onSuccess: (data) => {
      // Invalida lista de épicos do projeto
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.epics(data.project_id)
      });
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.projectHierarchy(data.project_id)
      });
    },
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStoryRequest) => hierarchyService.createStory(data),
    onSuccess: (data) => {
      // Invalida lista de stories do épico
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.stories(data.parent_task_id!)
      });
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.epicTree(data.parent_task_id!)
      });
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.epicStats(data.parent_task_id!)
      });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskRequest) => hierarchyService.createTask(data),
    onSuccess: (data) => {
      // Invalida lista de tasks do parent
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.tasks(data.parent_task_id!)
      });

      // Se parent é Story, invalida Epic tree e stats
      if (data.story_id) {
        queryClient.invalidateQueries({
          queryKey: hierarchyKeys.epicTree(data.epic_id!)
        });
        queryClient.invalidateQueries({
          queryKey: hierarchyKeys.epicStats(data.epic_id!)
        });
      }
    },
  });
}

export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, newParentId }: { taskId: string; newParentId: string }) =>
      hierarchyService.moveTask(taskId, newParentId),
    onSuccess: () => {
      // Invalida todas as queries de hierarquia para simplificar
      queryClient.invalidateQueries({ queryKey: hierarchyKeys.all });
    },
  });
}
```

#### 2.3.4 Componentes de UI

**Location:** `archon-ui-main/src/features/projects/tasks/components/hierarchy/`

**Estrutura de componentes:**
```
hierarchy/
├── EpicCard.tsx           # Card de épico com estatísticas
├── EpicList.tsx           # Lista de épicos do projeto
├── EpicTreeView.tsx       # Visualização em árvore do épico
├── StoryCard.tsx          # Card de story com story points
├── StoryList.tsx          # Lista de stories do épico
├── TaskTreeItem.tsx       # Item de task na árvore
├── SubtaskList.tsx        # Lista de subtasks
├── CreateEpicModal.tsx    # Modal para criar épico
├── CreateStoryModal.tsx   # Modal para criar story
├── EpicStatistics.tsx     # Painel de estatísticas do épico
└── HierarchyBreadcrumb.tsx # Breadcrumb de navegação
```

**Exemplo - EpicCard.tsx:**
```typescript
import { Card } from "@/features/ui/primitives/card";
import { Badge } from "@/features/ui/primitives/badge";
import { Progress } from "@/features/ui/primitives/progress";
import { useEpicStatistics } from "../../hooks/useHierarchyQueries";
import type { HierarchicalTask } from "../../types/hierarchy";

interface EpicCardProps {
  epic: HierarchicalTask;
  onSelect?: (epic: HierarchicalTask) => void;
}

export function EpicCard({ epic, onSelect }: EpicCardProps) {
  const { data: stats, isLoading } = useEpicStatistics(epic.id);

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-accent/50"
      onClick={() => onSelect?.(epic)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{epic.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {epic.description}
          </p>
        </div>

        <Badge variant={getPriorityVariant(epic.priority)}>
          {epic.priority}
        </Badge>
      </div>

      {stats && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {Math.round(stats.completion_percentage)}%
            </span>
          </div>

          <Progress value={stats.completion_percentage} className="h-2" />

          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div>
              <span className="text-muted-foreground">Stories</span>
              <p className="font-semibold">{stats.story_count}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tasks</span>
              <p className="font-semibold">{stats.task_count}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Points</span>
              <p className="font-semibold">
                {stats.completed_story_points} / {stats.total_story_points}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function getPriorityVariant(priority: string) {
  const variants = {
    low: "secondary",
    medium: "default",
    high: "warning",
    critical: "destructive",
  };
  return variants[priority as keyof typeof variants] || "default";
}
```

**Exemplo - EpicTreeView.tsx:**
```typescript
import { useEpicTree } from "../../hooks/useHierarchyQueries";
import { Skeleton } from "@/features/ui/primitives/skeleton";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { HierarchicalTask } from "../../types/hierarchy";

interface EpicTreeViewProps {
  epicId: string;
}

export function EpicTreeView({ epicId }: EpicTreeViewProps) {
  const { data: tree, isLoading } = useEpicTree(epicId);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  if (isLoading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!tree) {
    return <div>Epic não encontrado</div>;
  }

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* Epic root */}
      <div className="font-bold text-lg p-2 bg-primary/10 rounded">
        📋 {tree.epic.title}
      </div>

      {/* Stories */}
      {tree.stories.map(({ story, tasks }) => (
        <div key={story.id} className="ml-4">
          <div
            className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
            onClick={() => toggleNode(story.id)}
          >
            {expandedNodes.has(story.id) ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span>📖 {story.title}</span>
            {story.story_points && (
              <Badge variant="secondary">{story.story_points} pts</Badge>
            )}
          </div>

          {/* Tasks (só exibe se expandido) */}
          {expandedNodes.has(story.id) && (
            <div className="ml-8 space-y-1">
              {tasks.map(({ task, subtasks }) => (
                <div key={task.id}>
                  <div
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                    onClick={() => toggleNode(task.id)}
                  >
                    {subtasks.length > 0 && (
                      <>
                        {expandedNodes.has(task.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </>
                    )}
                    <span className="ml-4">✓ {task.title}</span>
                    <Badge variant={getStatusVariant(task.status)}>
                      {task.status}
                    </Badge>
                  </div>

                  {/* Subtasks */}
                  {expandedNodes.has(task.id) && subtasks.length > 0 && (
                    <div className="ml-12 space-y-1">
                      {subtasks.map(subtask => (
                        <div
                          key={subtask.id}
                          className="p-1 text-sm hover:bg-accent rounded"
                        >
                          <span className="ml-4">⚡ {subtask.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function getStatusVariant(status: string) {
  const variants = {
    todo: "secondary",
    doing: "default",
    review: "warning",
    done: "success",
  };
  return variants[status as keyof typeof variants] || "default";
}
```

### 2.4 MCP Tools

**Location:** `python/src/mcp_server/features/hierarchy/hierarchy_tools.py` (novo arquivo)

```python
from mcp.server import Server
from mcp.types import Tool, TextContent
import json
from typing import Optional

from ....server.services.projects.task_hierarchy_service import TaskHierarchyService
from ....server.models.task_hierarchy import (
    CreateEpicRequest,
    CreateStoryRequest,
    CreateTaskRequest
)

def register_hierarchy_tools(server: Server):
    """Registra MCP tools para hierarquia de tasks"""

    @server.call_tool()
    async def find_epics(
        project_id: Optional[str] = None,
        epic_id: Optional[str] = None
    ):
        """
        Busca épicos por projeto ou ID específico

        Args:
            project_id: ID do projeto (lista todos os épicos)
            epic_id: ID do épico específico (retorna árvore completa)
        """
        service = TaskHierarchyService()

        if epic_id:
            # Retorna árvore completa do épico
            tree = await service.get_epic_tree(epic_id)
            stats = await service.get_epic_statistics(epic_id)

            return [
                TextContent(
                    type="text",
                    text=json.dumps({
                        "epic": tree["epic"].model_dump(),
                        "statistics": stats.model_dump(),
                        "stories_count": len(tree["stories"]),
                        "stories": [
                            {
                                "story": s["story"].model_dump(),
                                "tasks_count": len(s["tasks"])
                            }
                            for s in tree["stories"]
                        ]
                    }, indent=2, default=str)
                )
            ]

        elif project_id:
            # Lista épicos do projeto
            epics = await service.get_epics_by_project(project_id)

            # Busca estatísticas de cada épico
            epics_with_stats = []
            for epic in epics:
                stats = await service.get_epic_statistics(epic.id)
                epics_with_stats.append({
                    "epic": epic.model_dump(),
                    "statistics": stats.model_dump()
                })

            return [
                TextContent(
                    type="text",
                    text=json.dumps(epics_with_stats, indent=2, default=str)
                )
            ]

        else:
            return [
                TextContent(
                    type="text",
                    text=json.dumps({
                        "error": "Forneça project_id ou epic_id"
                    }, indent=2)
                )
            ]

    @server.call_tool()
    async def manage_epic(
        action: str,
        project_id: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        epic_metadata: Optional[dict] = None
    ):
        """
        Gerencia épicos (create, update, delete)

        Args:
            action: "create", "update", "delete"
            project_id: ID do projeto (obrigatório para create)
            title: Título do épico
            description: Descrição
            epic_metadata: Metadados estruturados (functional_requirements, etc)
        """
        service = TaskHierarchyService()

        if action == "create":
            if not project_id or not title:
                return [
                    TextContent(
                        type="text",
                        text=json.dumps({
                            "error": "project_id e title são obrigatórios"
                        })
                    )
                ]

            request = CreateEpicRequest(
                project_id=project_id,
                title=title,
                description=description or "",
                epic_metadata=epic_metadata
            )

            epic = await service.create_epic(request)

            return [
                TextContent(
                    type="text",
                    text=json.dumps({
                        "success": True,
                        "epic": epic.model_dump()
                    }, indent=2, default=str)
                )
            ]

        # TODO: implementar update e delete

        return [
            TextContent(
                type="text",
                text=json.dumps({"error": f"Ação '{action}' não implementada"})
            )
        ]

    @server.call_tool()
    async def manage_story(
        action: str,
        parent_task_id: Optional[str] = None,  # Epic ID
        title: Optional[str] = None,
        description: Optional[str] = None,
        story_points: Optional[int] = None,
        acceptance_criteria: Optional[list[str]] = None
    ):
        """
        Gerencia stories (create, update, delete)

        Args:
            action: "create", "update", "delete"
            parent_task_id: ID do épico pai (obrigatório para create)
            title: Título da story
            description: Descrição
            story_points: Pontos da story
            acceptance_criteria: Lista de critérios de aceitação
        """
        service = TaskHierarchyService()

        if action == "create":
            if not parent_task_id or not title:
                return [
                    TextContent(
                        type="text",
                        text=json.dumps({
                            "error": "parent_task_id (epic) e title são obrigatórios"
                        })
                    )
                ]

            request = CreateStoryRequest(
                parent_task_id=parent_task_id,
                title=title,
                description=description or "",
                story_points=story_points,
                acceptance_criteria=acceptance_criteria or []
            )

            story = await service.create_story(request)

            return [
                TextContent(
                    type="text",
                    text=json.dumps({
                        "success": True,
                        "story": story.model_dump()
                    }, indent=2, default=str)
                )
            ]

        # TODO: implementar update e delete

        return [
            TextContent(
                type="text",
                text=json.dumps({"error": f"Ação '{action}' não implementada"})
            )
        ]

    # Registra as tools
    server.list_tools_handlers.append(
        lambda: [
            Tool(
                name="archon:find_epics",
                description="Busca épicos por projeto ou ID específico. Retorna árvore completa com stories, tasks e estatísticas.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "project_id": {
                            "type": "string",
                            "description": "ID do projeto (lista todos os épicos)"
                        },
                        "epic_id": {
                            "type": "string",
                            "description": "ID do épico (retorna árvore completa)"
                        }
                    }
                }
            ),
            Tool(
                name="archon:manage_epic",
                description="Gerencia épicos (create, update, delete). Use action='create' para criar novo épico.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["create", "update", "delete"]
                        },
                        "project_id": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "epic_metadata": {"type": "object"}
                    },
                    "required": ["action"]
                }
            ),
            Tool(
                name="archon:manage_story",
                description="Gerencia stories (create, update, delete). Stories são criadas dentro de épicos.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["create", "update", "delete"]
                        },
                        "parent_task_id": {
                            "type": "string",
                            "description": "ID do épico pai"
                        },
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "story_points": {"type": "integer"},
                        "acceptance_criteria": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["action"]
                }
            )
        ]
    )
```

---

## 3. Roadmap de Implementação

### Fase 1: Fundação (Backend) - 1 semana

**Objetivos:**
- Estrutura de dados completa e validada
- Service layer funcional
- API endpoints operacionais

**Tasks:**
1. [ ] Criar enum `task_type` e alterar tabela `archon_tasks`
2. [ ] Adicionar novos campos JSONB (epic_metadata, acceptance_criteria, dependencies)
3. [ ] Criar constraints de validação de hierarquia
4. [ ] Criar views `task_hierarchy` e `epic_statistics`
5. [ ] Implementar modelos Pydantic em `task_hierarchy.py`
6. [ ] Implementar `TaskHierarchyService` completo
7. [ ] Criar endpoints em `task_hierarchy_api.py`
8. [ ] Escrever testes unitários para service layer
9. [ ] Escrever testes de integração para API

**Critérios de Aceitação:**
- ✅ Todos os endpoints retornam 200/201 para requests válidos
- ✅ Validações de hierarquia funcionando (constraints)
- ✅ Views retornando dados corretos
- ✅ Testes com 80%+ de cobertura

### Fase 2: Frontend Foundation - 1 semana

**Objetivos:**
- Tipos TypeScript completos
- Service layer frontend
- Query hooks funcionais

**Tasks:**
1. [ ] Criar tipos em `hierarchy.ts`
2. [ ] Implementar `hierarchyService.ts`
3. [ ] Criar query hooks em `useHierarchyQueries.ts`
4. [ ] Criar query keys factory
5. [ ] Escrever testes para hooks
6. [ ] Validar integração com backend via Postman/Insomnia

**Critérios de Aceitação:**
- ✅ Todos os hooks funcionando
- ✅ Query keys seguindo padrão estabelecido
- ✅ Testes de hooks com 80%+ cobertura
- ✅ Integração com backend validada

### Fase 3: UI Components - 2 semanas

**Objetivos:**
- Componentes de visualização de hierarquia
- Modals de criação
- Estatísticas e dashboards

**Tasks:**
1. [ ] Criar `EpicCard.tsx` e `EpicList.tsx`
2. [ ] Criar `StoryCard.tsx` e `StoryList.tsx`
3. [ ] Criar `EpicTreeView.tsx` (visualização em árvore)
4. [ ] Criar `EpicStatistics.tsx` (dashboard de métricas)
5. [ ] Criar `CreateEpicModal.tsx`
6. [ ] Criar `CreateStoryModal.tsx`
7. [ ] Criar `HierarchyBreadcrumb.tsx` (navegação)
8. [ ] Implementar drag-and-drop para reorganizar stories/tasks
9. [ ] Implementar collapse/expand de nodes na árvore
10. [ ] Adicionar animações e transições
11. [ ] Escrever testes de componentes com React Testing Library

**Critérios de Aceitação:**
- ✅ Todos os componentes renderizando corretamente
- ✅ Drag-and-drop funcional
- ✅ Responsivo em mobile/tablet/desktop
- ✅ Acessibilidade (ARIA labels, keyboard navigation)
- ✅ Testes de componentes com 70%+ cobertura

### Fase 4: MCP Tools - 1 semana

**Objetivos:**
- Tools para AI IDEs (Cursor, Windsurf)
- Integração completa com workflow de desenvolvimento

**Tasks:**
1. [ ] Criar `hierarchy_tools.py` no MCP server
2. [ ] Implementar `find_epics` tool
3. [ ] Implementar `manage_epic` tool
4. [ ] Implementar `manage_story` tool
5. [ ] Implementar `find_stories` tool
6. [ ] Testar tools via MCP Inspector
7. [ ] Documentar uso dos tools no CLAUDE.md
8. [ ] Criar exemplos de prompts para AI

**Critérios de Aceitação:**
- ✅ Todos os tools funcionando via MCP
- ✅ Respostas estruturadas e úteis
- ✅ Documentação completa
- ✅ Exemplos testados com Claude/Cursor

### Fase 5: BMAD Workflow Integration - 1 semana

**Objetivos:**
- Integração completa com princípios BMAD
- Geração automática de hierarquia a partir de PRD
- AI agents para epic sharding e story creation

**Tasks:**
1. [ ] Criar agent `ProductManager` em `python/src/agents/`
2. [ ] Criar agent `ScrumMaster` para story creation
3. [ ] Implementar prompt templates BMAD
4. [ ] Criar endpoint `/api/bmad/generate-epics` (PRD → Epics)
5. [ ] Criar endpoint `/api/bmad/shard-epic` (Epic → Stories)
6. [ ] Criar UI para "Generate from PRD" button
7. [ ] Criar modal de revisão de épicos gerados
8. [ ] Testar workflow completo end-to-end
9. [ ] Documentar processo BMAD no docs

**Critérios de Aceitação:**
- ✅ AI gera épicos válidos a partir de PRD
- ✅ Epic sharding produz stories detalhadas
- ✅ Stories incluem acceptance criteria
- ✅ Workflow completo testado
- ✅ Documentação clara

### Fase 6: Polish & Optimization - 1 semana

**Objetivos:**
- Performance optimization
- UX refinement
- Documentation

**Tasks:**
1. [ ] Otimizar queries de hierarquia (índices, views)
2. [ ] Implementar caching agressivo (ETags)
3. [ ] Adicionar skeleton loaders
4. [ ] Implementar error boundaries
5. [ ] Adicionar tooltips e help texts
6. [ ] Criar tutorial interativo
7. [ ] Revisar e atualizar documentação
8. [ ] Preparar release notes

**Critérios de Aceitação:**
- ✅ Queries < 200ms para projetos com 100+ items
- ✅ Zero estados de erro sem feedback
- ✅ Documentação completa e atualizada
- ✅ Tutorial funcional

---

## 4. Considerações Técnicas

### 4.1 Migração de Dados Existentes

**Estratégia:**
- Todas as tasks existentes receberão `task_type = 'task'` por padrão (via ALTER TABLE)
- Não haverá conversão automática de tasks para épicos/stories
- Usuários podem manualmente converter tasks em épicos via UI (futuro feature)

**Script de Migração:**
```sql
-- Backup de segurança
CREATE TABLE archon_tasks_backup AS SELECT * FROM archon_tasks;

-- Adiciona enum e campo task_type
CREATE TYPE task_type AS ENUM ('epic', 'story', 'task', 'subtask');

ALTER TABLE archon_tasks
  ADD COLUMN task_type task_type DEFAULT 'task' NOT NULL,
  ADD COLUMN epic_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN story_points INTEGER,
  ADD COLUMN acceptance_criteria JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN dependencies JSONB DEFAULT '[]'::jsonb;

-- Adiciona índices
CREATE INDEX idx_archon_tasks_type ON archon_tasks(task_type);
CREATE INDEX idx_archon_tasks_parent_type ON archon_tasks(parent_task_id, task_type);

-- Adiciona constraints (DEFERED para não quebrar dados existentes)
ALTER TABLE archon_tasks
  ADD CONSTRAINT chk_epic_no_parent
  CHECK (task_type != 'epic' OR parent_task_id IS NULL) NOT VALID;

-- Valida constraints após verificação manual
ALTER TABLE archon_tasks VALIDATE CONSTRAINT chk_epic_no_parent;
```

### 4.2 Performance

**Otimizações Necessárias:**
1. **Índices:**
   - Composite index `(parent_task_id, task_type)` para queries hierárquicas
   - Index em `task_type` para filtros
   - Index em `(project_id, task_type)` para listagens

2. **Views Materializadas:**
   - Considerar `MATERIALIZED VIEW` para `epic_statistics` se queries > 500ms
   - Refresh automático via triggers

3. **Caching:**
   - ETags em todas as rotas de leitura
   - TanStack Query com `staleTime` apropriado (30s para lists, 5s para stats)

4. **Paginação:**
   - Implementar paginação em `GET /hierarchy/projects/{id}/hierarchy` se > 50 épicos

### 4.3 Segurança

**Validações:**
- Validar que usuário tem acesso ao projeto antes de criar épicos/stories
- Validar ciclos na hierarquia (task não pode ser parent de si mesmo)
- Sanitizar inputs em epic_metadata e acceptance_criteria (evitar XSS)

**Rate Limiting:**
- Limitar criação de épicos a 10/minuto por usuário
- Limitar queries de hierarquia completa a 30/minuto

### 4.4 Testes

**Estratégia de Testes:**
1. **Backend:**
   - Unit tests para service layer (pytest)
   - Integration tests para API endpoints
   - Tests de constraints do database

2. **Frontend:**
   - Unit tests para hooks (Vitest + React Testing Library)
   - Component tests para UI
   - Integration tests com MSW (Mock Service Worker)

3. **E2E:**
   - Playwright tests para workflows críticos:
     - Criar épico → Criar story → Criar task
     - Drag-and-drop de reorganização
     - Geração BMAD de épicos

---

## 5. Documentação

### 5.1 Atualizar CLAUDE.md

Adicionar seção:
```markdown
## Epic-Story-Task Hierarchy (BMAD Method)

Archon suporta hierarquia ágil completa seguindo princípios do BMAD Method:

**Estrutura:**
- **Epic**: Unidade autocontida de desenvolvimento (várias semanas)
- **Story**: User story com acceptance criteria (1-2 sprints)
- **Task**: Tarefa granular (1 dia de desenvolvimento)
- **Subtask**: Subtarefa (algumas horas)

**Comandos:**
```bash
# Criar épico
curl -X POST /api/hierarchy/epics \
  -d '{"project_id": "...", "title": "User Authentication"}'

# Listar épicos
curl /api/hierarchy/projects/{project_id}/epics

# Ver árvore de épico
curl /api/hierarchy/epics/{epic_id}/tree
```

**MCP Tools:**
- `archon:find_epics` - Busca épicos e suas árvores
- `archon:manage_epic` - Cria/atualiza épicos
- `archon:manage_story` - Cria/atualiza stories

**UI:**
- Nova aba "Epics" na página de projetos
- Visualização em árvore expansível
- Dashboard de estatísticas por épico
- Geração automática via BMAD AI workflow
```

### 5.2 Criar Novo Doc: BMAD_WORKFLOW.md

Criar documentação completa do workflow BMAD no Archon, incluindo:
- Princípios do BMAD Method
- Como escrever PRDs efetivos
- Como AI agents fazem epic sharding
- Como Scrum Master cria stories
- Exemplos práticos
- Best practices

---

## 6. Métricas de Sucesso

**KPIs:**
1. **Adoção:**
   - 50%+ dos novos projetos usam épicos após 1 mês
   - 80%+ dos projetos existentes migram para épicos após 3 meses

2. **Performance:**
   - Tempo de carregamento de hierarquia < 200ms (p95)
   - Zero crashes ou erros 500 relacionados a hierarquia

3. **Usabilidade:**
   - Usuários conseguem criar épico completo (epic → story → task) em < 2min
   - Net Promoter Score (NPS) > 8 para feature de hierarquia

4. **AI Integration:**
   - 70%+ de épicos gerados via BMAD AI precisam de < 20% de edição manual
   - Stories geradas têm acceptance criteria válidos em 90%+ dos casos

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Performance degradation com > 1000 items | Média | Alto | Implementar views materializadas e paginação |
| Complexidade de UI confunde usuários | Alta | Médio | Tutorial interativo + tooltips contextuais |
| Migration quebra tasks existentes | Baixa | Crítico | Backup completo + rollback plan + testes extensivos |
| AI gera épicos inválidos | Média | Médio | Validação humana obrigatória + feedback loop |
| Constraints SQL causam deadlocks | Baixa | Alto | DEFERRABLE constraints + monitoring |

---

## 8. Próximos Passos

1. **Aprovação:** Revisar plano com stakeholders
2. **Kickoff:** Criar branch `feature/epic-story-task-hierarchy`
3. **Fase 1:** Iniciar implementação backend (1 semana)
4. **Checkpoints:** Review semanal de progresso
5. **Beta:** Release para early adopters após Fase 3
6. **GA:** Release geral após Fase 6

---

## Apêndices

### A. Referências

- **BMAD Method:** https://github.com/bmad-code-org/BMAD-METHOD
- **Atlassian Agile:** https://www.atlassian.com/agile/project-management/epics-stories-themes
- **Archon Architecture:** `PRPs/ai_docs/ARCHITECTURE.md`
- **Query Patterns:** `PRPs/ai_docs/QUERY_PATTERNS.md`

### B. Glossário

- **Epic**: Unidade grande de trabalho que pode ser quebrada em stories (típico: 1-3 meses)
- **Story**: User story com critérios de aceitação (típico: 1-2 sprints)
- **Task**: Trabalho técnico granular (típico: 1 dia)
- **Subtask**: Menor unidade de trabalho (típico: 2-4 horas)
- **Epic Sharding**: Processo de quebrar PRD em épicos autocontidos (BMAD)
- **Story Points**: Estimativa de complexidade relativa (Fibonacci: 1, 2, 3, 5, 8, 13...)
- **Acceptance Criteria**: Condições que devem ser atendidas para story ser considerada completa

### C. Exemplos Práticos

**Exemplo de Hierarquia Completa:**
```
📋 Epic: User Authentication System
  └─ 📖 Story: Login with Email/Password (5 pts)
      ├─ ✓ Task: Create login API endpoint
      │   ├─ ⚡ Subtask: Add password hashing with bcrypt
      │   └─ ⚡ Subtask: Implement JWT token generation
      ├─ ✓ Task: Build login form UI
      └─ ✓ Task: Add form validation

  └─ 📖 Story: Social Login (OAuth) (8 pts)
      ├─ ✓ Task: Integrate Google OAuth
      ├─ ✓ Task: Integrate GitHub OAuth
      └─ ✓ Task: Handle OAuth callbacks

  └─ 📖 Story: Password Reset Flow (3 pts)
      ├─ ✓ Task: Send reset email
      ├─ ✓ Task: Validate reset token
      └─ ✓ Task: Update password
```

**Exemplo de Epic Metadata (BMAD):**
```json
{
  "functional_requirements": [
    "Users must be able to log in with email/password",
    "Support OAuth with Google and GitHub",
    "Password reset via email link"
  ],
  "technical_requirements": [
    "Use JWT for session management",
    "Hash passwords with bcrypt (cost factor 12)",
    "Rate limit login attempts (5/minute)"
  ],
  "user_personas": [
    "Developer",
    "Product Manager",
    "AI IDE Agent"
  ],
  "success_metrics": [
    "Login success rate > 95%",
    "Password reset completion rate > 80%",
    "Zero security vulnerabilities in penetration test"
  ],
  "risks": [
    "Brute force attacks on login endpoint",
    "OAuth provider downtime",
    "Email delivery failures for password reset"
  ]
}
```

**Exemplo de Story com Acceptance Criteria:**
```json
{
  "title": "Login with Email/Password",
  "description": "As a user, I want to log in with my email and password so that I can access my account securely.",
  "story_points": 5,
  "acceptance_criteria": [
    {
      "criteria": "User can enter email and password in login form",
      "completed": true,
      "tested_by": "User",
      "tested_at": "2025-01-15T10:30:00Z"
    },
    {
      "criteria": "System validates credentials against database",
      "completed": true
    },
    {
      "criteria": "On success, user receives JWT token valid for 24 hours",
      "completed": false
    },
    {
      "criteria": "On failure, user sees clear error message without exposing security details",
      "completed": false
    },
    {
      "criteria": "Login attempts are rate-limited to 5 per minute per IP",
      "completed": false
    }
  ]
}
```

---

**Fim do Plano de Implementação**
