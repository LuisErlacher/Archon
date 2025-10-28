# 🎯 Guia de Integração: Sprint Planning & Workflow Status

> **Sistema de gerenciamento de workflow integrado ao BMad e Archon MCP**

Este documento explica como o sistema de Sprint Planning e Workflow Status foi integrado ao Archon para permitir que agentes e desenvolvedores se orientem facilmente.

---

## 🎨 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                   ARCHON WORKFLOW SYSTEM                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│                  │        │                  │        │                  │
│   BMad Agents    │◄──────►│  Workflow Docs   │◄──────►│  Archon MCP DB   │
│   (PM, SM, Dev)  │        │  (Markdown)      │        │  (PostgreSQL)    │
│                  │        │                  │        │                  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
         │                           │                            │
         │                           │                            │
         │                           ▼                            │
         │                  ┌──────────────────┐                 │
         │                  │                  │                 │
         └─────────────────►│  .ai/context     │◄────────────────┘
                            │  (Agent Cache)   │
                            │                  │
                            └──────────────────┘
```

### Fluxo de Informação

1. **PM Cria Epic** → Archon MCP Database
2. **PM Gera Sprint Planning** → `sprint-current.md`
3. **PM Atualiza Workflow** → `workflow-status.md`
4. **System Gera Context** → `.ai/current-context.md`
5. **Agents Read Context** → Sabem o que fazer
6. **Dev Atualiza Tasks** → Archon MCP
7. **System Syncs Docs** ← Archon MCP

---

## 📁 Estrutura Criada

### Novos Diretórios

```bash
docs/
├── sprints/              # 🆕 Gerenciamento de sprints
│   ├── sprint-current.md
│   └── sprint-archive/
│
└── workflow/            # 🆕 Status de workflow
    ├── README.md
    ├── workflow-status.md
    ├── workflow-history.md
    └── workflow-templates/

.ai/                     # 🆕 Contexto para agentes
├── current-context.md
└── quick-ref.md
```

### Novos Templates

```bash
.bmad-core/templates/
├── sprint-planning-tmpl.yaml    # 🆕 Template de sprint
└── workflow-status-tmpl.yaml    # 🆕 Template de workflow
```

### Nova Task BMad

```bash
.bmad-core/tasks/
└── manage-sprint.md             # 🆕 Gerenciamento de sprints
```

### Configuração Atualizada

```yaml
# .bmad-core/core-config.yaml (updated)

sprint:
  sprintLocation: docs/sprints
  currentSprintFile: docs/sprints/sprint-current.md
  sprintArchiveLocation: docs/sprints/sprint-archive
  sprintFilePattern: sprint-{n}-*.md

workflow:
  workflowLocation: docs/workflow
  currentWorkflowFile: docs/workflow/workflow-status.md
  workflowHistoryFile: docs/workflow/workflow-history.md
  workflowTemplatesLocation: docs/workflow/workflow-templates

agentContext:
  contextLocation: .ai
  currentContextFile: .ai/current-context.md
  quickRefFile: .ai/quick-ref.md
  agentLoadAlwaysFiles:
    - .ai/current-context.md
    - docs/sprints/sprint-current.md
    - docs/workflow/workflow-status.md
```

---

## 🚀 Como Usar

### Para PM/SM (Product Manager / Scrum Master)

#### 1. Iniciar Novo Sprint

```bash
# Ativar agente PM
/BMad:agents:pm

# Executar task de sprint management
# (ler .bmad-core/tasks/manage-sprint.md para comandos)

# Ou manualmente:
# 1. Arquivar sprint anterior (se existir)
# 2. Criar novo sprint-current.md baseado no template
# 3. Preencher com épicos e stories
# 4. Atualizar workflow-status.md
# 5. Atualizar .ai/current-context.md
```

#### 2. Atualizar Progresso Diário

```bash
# Opção 1: Via Archon MCP
# Query tasks e atualizar documentos baseado no status

# Opção 2: Manual
# Editar sprint-current.md → seção Daily Progress
# Atualizar workflow-status.md → seção Active Work
# Atualizar .ai/current-context.md → seção Progress
```

#### 3. Concluir Sprint

```bash
# 1. Calcular métricas finais
# 2. Conduzir retrospectiva
# 3. Preencher seção Retrospective no sprint-current.md
# 4. Arquivar sprint: mv sprint-current.md sprint-archive/sprint-01-completed.md
# 5. Criar próximo sprint
```

---

### Para Desenvolvedores

#### 1. Descobrir O Que Fazer

```bash
# Leitura rápida (2 minutos)
cat .ai/current-context.md

# Ou leitura detalhada
cat docs/sprints/sprint-current.md
cat docs/workflow/workflow-status.md
```

#### 2. Iniciar Task

```bash
# 1. Ler descrição do task no sprint-current.md
# 2. Revisar acceptance criteria
# 3. Marcar como "doing" no Archon UI
# 4. Começar desenvolvimento
```

#### 3. Concluir Task

```bash
# 1. Verificar acceptance criteria
# 2. Marcar como "done" no Archon UI
# 3. (Opcional) Adicionar nota em sprint-current.md → Daily Progress
```

#### 4. Reportar Blocker

```bash
# Editar workflow-status.md
# Adicionar na seção "Blockers & Risks":

### Active Blockers

#### 🚨 Blocker 1: [Título do Blocker]

**Severity:** High/Medium/Low
**Impact:** [Descrição do impacto]
**Blocking:** Task IDs afetados
**Owner:** [Seu nome]
**Reported:** [Data]

**Resolution Plan:**
[Plano de resolução]

**Status:** Active
```

---

### Para Agentes de IA

#### 1. Ler Contexto na Ativação

```python
# Todo agente deve ler ao iniciar:
context = read_file(".ai/current-context.md")
sprint = read_file("docs/sprints/sprint-current.md")
workflow = read_file("docs/workflow/workflow-status.md")

# Extrair informações chave:
# - Sprint atual
# - Próximo task a trabalhar
# - Blockers ativos
# - Progresso atual
```

#### 2. Atualizar Status de Tasks

```python
# Após completar um task:
mcp__archon__manage_task(
    action="update",
    task_id="task-id-aqui",
    status="done"
)

# Depois, atualizar documentos:
# - sprint-current.md (adicionar à seção Completed)
# - workflow-status.md (mover para Recently Completed)
# - .ai/current-context.md (atualizar próximo task)
```

#### 3. Consultar Status Atual

```python
# Usar Archon MCP como fonte da verdade:
tasks = mcp__archon__find_tasks(
    project_id="91fa5f8d-630b-4fff-b325-343494f87b36",
    filter_by="status",
    filter_value="todo"
)

# Comparar com sprint-current.md
# Se houver discrepância, MCP prevalece
```

---

## 🔄 Workflow de Atualização

### Fluxo Diário Recomendado

```
09:00 - Início do Dia
├─► PM/SM: Revisa sprint-current.md
├─► PM/SM: Atualiza workflow-status.md
└─► PM/SM: Atualiza .ai/current-context.md

Durante o Dia
├─► Dev: Trabalha em tasks
├─► Dev: Atualiza status no Archon UI
└─► Agent: Lê context antes de cada task

17:00 - Fim do Dia
├─► PM/SM: Adiciona Daily Progress ao sprint-current.md
├─► PM/SM: Atualiza métricas (burndown, velocity)
└─► PM/SM: Documenta blockers em workflow-status.md
```

---

## 🎯 Exemplo Prático: Epic #1

### Estado Atual (2025-10-28)

```
Archon Project
└─ Epic #1: Frontend Authentication System
   ├─ Sprint 1: Week 1-2 (Day 1)
   │  ├─ Story 1: Frontend Authentication Foundation (todo)
   │  │  ├─ Task 1.1: Setup Supabase Auth Client (todo) ← NEXT
   │  │  ├─ Task 1.2: Create Auth Context and Provider (todo)
   │  │  ├─ Task 1.3: Implement Custom Auth Hooks (todo)
   │  │  ├─ Task 1.4: Integrate Auth Tokens with API Client (todo)
   │  │  └─ Task 1.5: Create Auth Service Layer (todo)
   │  │
   │  └─ Story 2: Login/Signup UI Components (todo)
   │     ├─ Task 2.1: Create Login Page Component (todo)
   │     ├─ Task 2.2: Create Signup Page Component (todo)
   │     ├─ Task 2.3: Implement Password Reset Flow (todo)
   │     ├─ Task 2.4: Create Protected Route Wrapper (todo)
   │     ├─ Task 2.5: Add Auth Routes to React Router (todo)
   │     └─ Task 2.6: Implement Logout Functionality (todo)
   │
   └─ Sprint 2: Week 3-4 (Planned)
      └─ Story 3: Backend Authentication & RLS Integration (todo)
```

### Arquivos Criados

- ✅ `docs/prd/epic-1-frontend-authentication.md` - Epic detalhado
- ✅ `docs/prd/epic-1-tasks.md` - Breakdown de tasks
- ✅ `docs/sprints/sprint-current.md` - Sprint 1 planejamento
- ✅ `docs/workflow/workflow-status.md` - Status atual
- ✅ `.ai/current-context.md` - Contexto para agentes

### Como um Agente Usaria

```python
# 1. Agent inicia e lê contexto
context = read_file(".ai/current-context.md")

# Extrai:
# - Current Sprint: Sprint 1 (Day 1)
# - Current Task: Setup Supabase Auth Client
# - Task ID: b3dcb5d4-8beb-48ab-82db-3b662742ed7d
# - Priority: High (106)

# 2. Agent marca como "doing"
mcp__archon__manage_task(
    action="update",
    task_id="b3dcb5d4-8beb-48ab-82db-3b662742ed7d",
    status="doing"
)

# 3. Agent executa o trabalho
# - Instala @supabase/supabase-js
# - Cria archon-ui-main/src/lib/supabase.ts
# - Atualiza .env.example

# 4. Agent marca como "done"
mcp__archon__manage_task(
    action="update",
    task_id="b3dcb5d4-8beb-48ab-82db-3b662742ed7d",
    status="done"
)

# 5. Agent atualiza documentos
# - Adiciona ✅ ao sprint-current.md
# - Atualiza workflow-status.md (progress: 6%)
# - Atualiza .ai/current-context.md (next task: #2)
```

---

## 📊 Benefícios da Integração

### Para Agentes de IA

✅ **Orientação Clara** - Sempre sabem o que fazer próximo
✅ **Contexto Atualizado** - Documentos refletem estado real
✅ **Autonomia** - Podem trabalhar sem supervisão constante
✅ **Rastreabilidade** - Histórico completo de decisões

### Para Desenvolvedores

✅ **Visibilidade** - Status transparente do projeto
✅ **Alinhamento** - Todos sabem o objetivo do sprint
✅ **Comunicação** - Documentos substituem meetings
✅ **Onboarding** - Novos devs se orientam rapidamente

### Para PM/SM

✅ **Controle** - Visão completa do progresso
✅ **Métricas** - Dados para tomada de decisão
✅ **Histórico** - Retrospectivas baseadas em dados
✅ **Previsibilidade** - Velocidade rastreada sprint-a-sprint

---

## 🛠️ Manutenção

### Responsabilidades

| Arquivo | Atualizado Por | Frequência |
|---------|---------------|-----------|
| `sprint-current.md` | PM/SM + Devs | Diário |
| `workflow-status.md` | PM/SM | Diário |
| `.ai/current-context.md` | PM/SM | A cada mudança |
| `sprint-archive/*` | PM/SM | Fim de sprint |
| Archon MCP | Devs + Agents | Tempo real |

### Sincronização

**REGRA CRÍTICA:** O Archon MCP é sempre a fonte da verdade.

```python
# Sempre que atualizar documentos, sincronize:

# 1. Query estado atual do MCP
tasks = mcp__archon__find_tasks(project_id="...")

# 2. Atualizar documentos baseado no MCP
# 3. Se houver discrepância, MCP prevalece
# 4. Investigar por que documentos ficaram desatualizados
```

---

## 📚 Próximos Passos

### Fase 1: Adoção ✅
- [x] Estrutura de diretórios criada
- [x] Templates configurados
- [x] Documentação completa
- [x] Epic #1 como exemplo

### Fase 2: Automação (Futuro)
- [ ] Script para auto-sync MCP → Documentos
- [ ] Webhook do Archon para atualizar docs
- [ ] Dashboard de métricas de sprint
- [ ] Integração com GitHub Actions

### Fase 3: Extensões (Futuro)
- [ ] Burndown chart automático
- [ ] Velocity tracking histórico
- [ ] Notificações de blocker
- [ ] Agent auto-assignment

---

## 🤝 Contribuindo

Para manter esse sistema funcionando:

1. ✅ **Atualize diariamente** - Mesmo pequenas mudanças importam
2. ✅ **Sincronize com MCP** - Sempre use MCP como fonte da verdade
3. ✅ **Documente blockers** - Quanto mais cedo, melhor
4. ✅ **Mantenha agentes informados** - Atualize .ai/current-context.md
5. ✅ **Revise retrospectivas** - Use dados para melhorar

---

## 📞 Suporte

**Dúvidas sobre:**
- **Estrutura de arquivos** → Leia `docs/workflow/README.md`
- **Como usar** → Leia `.bmad-core/tasks/manage-sprint.md`
- **Templates** → Veja `.bmad-core/templates/sprint-planning-tmpl.yaml`
- **Archon MCP** → Consulte documentação do Archon

---

**Última Atualização:** 2025-10-28
**Versão do Sistema:** 1.0
**Mantido por:** PM John (BMad) + Archon Team
