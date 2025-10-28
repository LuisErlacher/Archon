# Workflow & Sprint Management

> **Sistema integrado de gerenciamento de sprints e workflow para Archon**

Este diretório contém documentos de workflow e status que permitem que agentes de IA e desenvolvedores humanos se orientem sobre o estado atual do projeto.

---

## 📁 Estrutura de Arquivos

```
Archon/
├── docs/
│   ├── sprints/                  # Gerenciamento de sprints
│   │   ├── sprint-current.md     # Sprint ativo (sempre atualizado)
│   │   ├── sprint-{n}-*.md       # Sprints históricos
│   │   └── sprint-archive/       # Sprints antigos arquivados
│   │
│   └── workflow/                 # Status do workflow
│       ├── README.md             # Este arquivo
│       ├── workflow-status.md    # Status atual do workflow
│       ├── workflow-history.md   # Histórico de mudanças
│       └── workflow-templates/   # Templates de workflow
│
├── .ai/                          # Contexto para agentes de IA
│   ├── current-context.md        # Referência rápida para agentes
│   └── quick-ref.md              # Guia rápido para desenvolvedores
│
└── .bmad-core/
    ├── templates/
    │   ├── sprint-planning-tmpl.yaml   # Template de sprint
    │   └── workflow-status-tmpl.yaml   # Template de workflow
    └── tasks/
        └── manage-sprint.md            # Task para gerenciar sprints
```

---

## 🤖 Para Agentes de IA

### Arquivos Essenciais a Ler (Nesta Ordem)

1. **`.ai/current-context.md`**
   - 📍 Contexto rápido (TL;DR)
   - 🎯 Próximo task a trabalhar
   - 🚧 Blockers ativos
   - 🔗 Links para documentos detalhados

2. **`docs/sprints/sprint-current.md`**
   - Sprint ativo com todas as stories e tasks
   - Progresso diário
   - Métricas de velocidade

3. **`docs/workflow/workflow-status.md`**
   - Status detalhado de todos os épicos
   - Fases do workflow
   - Trabalho em progresso
   - Próximos passos

### Como Consultar

```bash
# Ler contexto rápido
cat .ai/current-context.md

# Ver sprint atual
cat docs/sprints/sprint-current.md

# Consultar workflow completo
cat docs/workflow/workflow-status.md
```

### Como Atualizar Status de Task

```python
# Marcar task como "doing"
mcp__archon__manage_task(
    action="update",
    task_id="<task-id>",
    status="doing"
)

# Marcar task como "done"
mcp__archon__manage_task(
    action="update",
    task_id="<task-id>",
    status="done"
)
```

---

## 👤 Para Desenvolvedores Humanos

### Início do Dia

1. **Leia o contexto atual:**
   ```bash
   cat .ai/current-context.md
   ```

2. **Verifique seu próximo task:**
   - Procure por seu nome no `sprint-current.md`
   - Veja prioridade e estimativa
   - Revise acceptance criteria

3. **Marque task como "doing" no Archon UI:**
   - Acesse a interface do Archon
   - Encontre seu task
   - Mude status para "doing"

### Durante o Desenvolvimento

1. **Trabalhe no task normalmente**

2. **Se encontrar um blocker:**
   - Adicione ao `workflow-status.md` na seção de blockers
   - Notifique o PM ou Scrum Master
   - Continue com próximo task disponível (se possível)

### Fim do Dia

1. **Atualize progresso:**
   - Marque tasks concluídos como "done" no Archon
   - Adicione nota de progresso em `sprint-current.md`

2. **Atualize workflow-status.md se necessário**

---

## 📊 Estrutura do Sprint

### sprint-current.md

Contém:
- **Sprint Metadata** - Número, datas, meta
- **Epic Focus** - Épico principal sendo trabalhado
- **Sprint Backlog** - Stories e tasks planejados
- **Daily Progress** - Atualizações diárias
- **Sprint Metrics** - Velocidade, burndown, completion rate
- **Retrospective** - (preenchido no final)

### workflow-status.md

Contém:
- **Current Position** - Sprint, épico, story atual
- **Active Work** - Trabalho em andamento com detalhes
- **Workflow Stage** - Fases e progresso
- **Epic & Story Status** - Visão geral de todos os épicos
- **Blockers & Risks** - Impedimentos e riscos identificados
- **Upcoming Work** - Próximos 3-5 dias
- **Recently Completed** - Últimos 7 dias
- **Team Status** - Status de cada membro do time
- **Quick Reference** - Links e referências importantes

---

## 🔄 Fluxo de Atualização

### Quando Atualizar

| Evento | Arquivo a Atualizar | Responsável |
|--------|-------------------|-------------|
| Novo sprint iniciado | `sprint-current.md` (novo) | PM/SM |
| Task completado | Archon MCP + `sprint-current.md` | Dev/Agent |
| Blocker encontrado | `workflow-status.md` | Dev/Agent |
| Fim do dia | `sprint-current.md` (Daily Progress) | Dev/Agent |
| Mudança de fase | `workflow-status.md` | PM/SM |
| Sprint concluído | `sprint-current.md` → arquivo + Retrospective | PM/SM |

### Sincronização Archon MCP

**IMPORTANTE:** O Archon MCP é a fonte da verdade para status de tasks. Os documentos de sprint/workflow devem refletir o estado do MCP.

```python
# Sempre que atualizar documentos, sincronize com MCP:

# 1. Query tasks atuais
tasks = mcp__archon__find_tasks(project_id="<project-id>")

# 2. Atualizar documentos baseado no MCP
# 3. Se houver discrepância, MCP prevalece
```

---

## 🛠️ Comandos do PM

Se estiver no modo PM (John), pode usar:

- `*create-epic` - Criar novo épico para sprint
- `*create-story` - Quebrar épico em stories
- `/sprint-start` - Iniciar novo sprint (via task manage-sprint)
- `/sprint-update` - Atualizar progresso do sprint
- `/sprint-complete` - Concluir sprint com retrospectiva
- `/sprint-status` - Ver status do sprint

---

## 📈 Métricas e Tracking

### Velocity
- **Planned Velocity**: Story points planejados no início
- **Completed Velocity**: Story points efetivamente completados
- **Carry-over**: Story points não finalizados (razões documentadas)

### Burndown
- Atualizado diariamente
- Mostra pontos restantes por dia
- Ajuda identificar se sprint está no ritmo

### Task Completion Rate
- Total de tasks vs. completados
- Percentual de conclusão
- Tasks bloqueados identificados

---

## 🚨 Troubleshooting

### "Não sei qual task trabalhar"
→ Leia `.ai/current-context.md` - seção "What to Work On Next"

### "Documentos desatualizados"
→ Sincronize com Archon MCP usando as ferramentas MCP

### "Encontrei um blocker"
→ Adicione em `workflow-status.md` → Seção "Blockers & Risks"

### "Sprint não está progredindo"
→ Revise `sprint-current.md` → Daily Progress + Metrics

---

## 📚 Recursos Adicionais

- **Epic Template**: `.bmad-core/templates/brownfield-epic.md`
- **Sprint Template**: `.bmad-core/templates/sprint-planning-tmpl.yaml`
- **Workflow Template**: `.bmad-core/templates/workflow-status-tmpl.yaml`
- **Task Management**: `.bmad-core/tasks/manage-sprint.md`

---

## 🤝 Contribuindo

Para manter esses documentos úteis:

1. ✅ **Atualize diariamente** - Mesmo pequenas mudanças
2. ✅ **Seja específico** - "Completed login form" não "Made progress"
3. ✅ **Documente blockers** - Quanto mais cedo, melhor
4. ✅ **Mantenha sincronizado** - MCP é a fonte da verdade
5. ✅ **Use para comunicação** - Substitui múltiplos status meetings

---

**Última Atualização:** 2025-10-28
**Mantido por:** PM John (BMad) + Archon Team
