# Product Requirements Document — Archon AI Dark Factory

**Autor:** Luis Erlacher
**Data:** 2026-04-13
**Origem:** Pivot do pi-mono AI Software Factory OS para fork do Archon
**Versão:** 1.0

---

## Executive Summary

O Archon evolui de "remote agentic coding platform" para **AI Dark Factory** — uma plataforma web hospedada em VPS onde developers acessam via browser para acionar agentes AI que desenvolvem software autonomamente. A inversão do paradigma atual: em vez de cada developer rodar agentes localmente na sua máquina, todos acessam uma instância centralizada que gerencia repositórios, executa workflows, e entrega código via GitHub.

### Decisão de Pivot

O projeto pi-mono (AI Software Factory OS) previa construir uma plataforma nova sobre o motor pi-mono. Análise revelou que o Archon já atendia ~40% dos requisitos: workflow DAG engine, multi-platform adapters (Web/Slack/Telegram/GitHub/Discord), SSE streaming, worktree isolation, conversation management, quality gates. A decisão foi pivotar: desenvolver dentro do fork do Archon em vez de construir do zero.

### Modelo Arquitetural Escolhido

**Workflows determinísticos com agentes single-instance**, não hierarquia de subagentes.

O PRD original do pi-mono previa times com spawn de subagentes (Scrum Master → Team Lead → Workers). Após análise de viabilidade:

- O Claude Agent SDK **não suporta** subagents spawning subagents (limitação documentada)
- Subagentes adicionam complexidade sem garantia proporcional de qualidade
- Workflows DAG pré-construídos são mais determinísticos, modulares, e debugáveis
- O Archon já tem engine de DAG madura com nodes (prompt, command, bash, loop, approval, script)

**Decisão:** Manter a estrutura de utilização de agentes como o Archon hoje usa — sempre **um agente por node**, via SDK (Claude Code SDK, Codex SDK, ou pi-ai SDK). O workflow é o processo determinístico; o agente é o executor criativo dentro de cada node. Quality gates entre nodes impedem alucinações e garantem que o trabalho foi realmente feito.

### O Que Torna Isto Especial

1. **Autonomia verificada, não autonomia cega.** O workflow determina o fluxo; quality gates verificam cada transição executando comandos reais (testes, lint, typecheck). O agente nunca auto-reporta — o sistema verifica.

2. **Dark Factory acessível via web.** Nenhuma instalação local necessária. Developers acessam via browser, acionam agentes na VPS, e o código vai direto para GitHub. Zero setup por máquina.

3. **Container-per-project.** Cada repositório vinculado roda em container isolado com seu dev stack (postgres, redis, etc). Agentes operam dentro do container — blast radius zero.

4. **Multi-provider com 3 SDKs.** Claude Code SDK, Codex SDK, e pi-ai SDK (17+ providers LLM) como engines intercambiáveis. Failover configurável entre providers.

5. **Visual workflow builder + roadmap.** Criar, editar e monitorar workflows visualmente. Acompanhar roadmap e features em pipeline view integrada.

---

## Classificação do Projeto

- **Tipo:** Plataforma Web (SaaS-ready, inicialmente single-tenant)
- **Domínio:** AI/DevOps Orchestration — desenvolvimento assistido por agentes com quality gates
- **Complexidade:** Média-Alta — container orchestration, multi-provider, SSE streaming, DAG engine
- **Contexto:** Brownfield — construído sobre Archon v0.3.5 (9 packages TypeScript, Bun + Hono + React)
- **Inspirações:** Archon (workflow DAGs), pi-mono (quality gates, multi-provider), Auto-Claude (kanban, parallel execution, visual pipeline)

---

## Arquitetura Core

### Princípio Fundamental: Workflow Determinístico + Agente Criativo

```
[Workflow DAG]  ──determina──>  [Ordem dos Nodes]
     │                              │
     │                    ┌─────────┼─────────┐
     │                    │         │         │
     ▼                    ▼         ▼         ▼
[Quality Gate]    [Node: Prompt] [Node: Bash] [Node: Loop]
  verifica            │              │            │
  stdout real    [Agent SDK]    [Shell cmd]  [Agent SDK]
                  (1 agente)                 (1 agente)
                      │                          │
                      ▼                          ▼
                 [Código]                   [Iteração]
```

- **Workflows** são YAML DAGs pré-construídos: determinísticos, versionados, editáveis via UI
- **Cada node** executa UMA tarefa com UM agente (ou um comando bash/script)
- **Quality gates** entre nodes executam verificações reais (testes, lint, typecheck, health check)
- **Agentes** são instâncias de SDK (Claude/Codex/pi-ai) — fazem APENAS edição de código e avaliação
- **O workflow NÃO é decidido pelo agente** — é pré-definido e imutável durante execução

### Infraestrutura Multi-Tenant

```
┌─────────────────────────────────────────────────┐
│                  VPS / K8s Cluster               │
│                                                  │
│  ┌──────────────┐   ┌──────────────────────────┐ │
│  │ Archon Server │──▸│ Container: Project A     │ │
│  │ (Control Plane)│  │  ├─ Agent SDK (Claude)   │ │
│  │  ├─ Web UI    │  │  ├─ Repo clone + worktrees│ │
│  │  ├─ API       │  │  ├─ Sidecar: postgres     │ │
│  │  ├─ DB (SQLite│  │  └─ Sidecar: redis        │ │
│  │  │   /PgSQL)  │  └──────────────────────────┘ │
│  │  ├─ SSE Stream│                                │
│  │  └─ Auth      │  ┌──────────────────────────┐ │
│  └──────┬───────┘  │ Container: Project B      │ │
│         │          │  ├─ Agent SDK (Codex)      │ │
│         ├─────────▸│  ├─ Repo clone + worktrees │ │
│         │          │  └─ Sidecar: evolution-api  │ │
│         │          └──────────────────────────┘ │
│         │                                        │
│         │          ┌──────────────────────────┐ │
│         └─────────▸│ Container: Project C      │ │
│                    │  ├─ Agent SDK (pi-ai)      │ │
│                    │  ├─ Repo clone + worktrees │ │
│                    │  └─ (no sidecars)          │ │
│                    └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- **Control Plane (Archon Server):** Gerencia projetos, workflows, auth, UI. Nunca executa código de agente.
- **Data Plane (Project Containers):** Um container por projeto com SDK + repo + sidecars. Agentes operam aqui.
- **Comunicação:** HTTP/SSE entre server e containers. Proxy para injeção de credenciais.
- **Estado:** DB centralizado (workflow runs, node states, gate results). Git como checkpoint dentro dos containers.

### SDKs Suportados

| SDK | Tipo | Uso |
|-----|------|-----|
| Claude Code SDK (`@anthropic-ai/claude-agent-sdk`) | Subprocess (spawna CLI) | Provider primário. Hooks, MCP, skills, subpath permissions |
| Codex SDK (`@openai/codex-sdk`) | Subprocess (spawna CLI) | Provider alternativo. Structured output, thread resumption |
| pi-ai SDK (`@mariozechner/pi-ai` + `pi-agent-core`) | In-process | 17+ providers LLM. Failover chain. Streaming nativo |

Cada node de workflow pode especificar qual provider usar. O default é herdado do `.archon/config.yaml`.

---

## Success Criteria

### User Success

| Critério | Meta | Medição |
|----------|------|---------|
| Fire-and-forget funcional | Developer dispara workflow e sai | Ausência de check-ins voluntários |
| Tempo até "fire" | < 30 segundos | Do painel ao workflow iniciado |
| Intervenção rápida | < 2 minutos | Notificação → ação do developer |
| Zero setup local | 0 instalações | Acesso 100% via browser |
| Retorno após ausência | Estado claro em 3 segundos | Ao reabrir o painel |

### Technical Success

| Critério | Meta |
|----------|------|
| Quality gates determinísticos | 100% das transições verificadas |
| Anti-procrastinação | Sistema impede agentes de ignorar testes/lint/typecheck |
| Container isolation | Cada projeto em container isolado |
| Multi-provider | 3 SDKs operacionais com failover |
| Crash recovery | < 1 task de trabalho perdida por crash |

### Business Success

| Critério | Meta |
|----------|------|
| Um projeto completo end-to-end | Todos os workflows de um projeto real executados |
| 70%+ autonomia | Stories completam ciclo sem intervenção humana |
| Replicabilidade | Segundo projeto funciona com setup mínimo |

---

## Functional Requirements

### FR01-FR08: Development Orchestration

- **FR01:** Developer dispara workflow individual ou batch de workflows via painel web
- **FR02:** Sistema executa workflow DAG: cada node sequencial ou paralelo conforme `depends_on`
- **FR03:** Handoff determinístico entre nodes — transição só ocorre quando quality gates passam
- **FR04:** Stories/tasks executam em worktrees isoladas dentro do container do projeto
- **FR05:** Sistema retoma workflow após intervenção humana sem reiniciar (approval nodes)
- **FR06:** Sistema suporta loop nodes com iteração até completion signal + quality gate bash
- **FR07:** Workflows são YAML DAGs no filesystem (`.archon/workflows/`) ou DB — agentes NUNCA editam workflows
- **FR08:** Resume de workflows falhados (skip completed nodes, retry from failure point)

### FR09-FR15: Quality Assurance & Verification

- **FR09:** Quality gates executam comandos reais e parseiam stdout — nunca aceitam auto-report do agente
- **FR10:** Gates com severity (p0=blocker, p1=warn+retry, p2=advisory)
- **FR11:** Retry automático até N tentativas com feedback específico ao agente
- **FR12:** Escalação para humano após N tentativas, com contexto completo do bloqueio
- **FR13:** Code review como gate obrigatório (node separado no workflow)
- **FR14:** Gate types: test (bun test), lint (eslint), typecheck (tsc), health-check (curl), custom (bash)
- **FR15:** Coverage gate consome JSON summary para decisão PASS/FAIL com threshold configurável

### FR16-FR21: Painel & Monitoring

- **FR16:** Dashboard com workflow runs por projeto (status, progresso, tempo)
- **FR17:** Pipeline view por workflow run com nodes como checkpoints visuais (verde/amarelo/vermelho)
- **FR18:** SSE streaming real-time de atividade dos agentes
- **FR19:** Estado macro do projeto em 3 segundos ao abrir o painel
- **FR20:** Trail auditável por workflow run: decisões, gates, intervenções, timestamps
- **FR21:** Roadmap view: features/epics como cards com status de implementação

### FR22-FR29: Human Intervention & Control

- **FR22:** Pausar/retomar workflow run a qualquer momento
- **FR23:** Approval nodes pausam workflow até developer aprovar/rejeitar via painel
- **FR24:** Injetar contexto (texto, links) num node bloqueado que o agente incorpora ao retomar
- **FR25:** Cancelar workflow run em execução
- **FR26:** Notificações com contexto completo (problema, tentativas, logs, ações sugeridas)
- **FR27:** Redirecionar abordagem mid-flight (alterar prompt do node seguinte)
- **FR28:** Canal de notificação configurável (web, email, webhook, Slack, Telegram)
- **FR29:** Developer pode configurar max budget por workflow (maxBudgetUsd)

### FR30-FR37: Project Management & Context

- **FR30:** Criar projeto apontando para repositório GitHub (clone ou path local)
- **FR31:** Auto-discovery: analisa codebase, detecta stack, gera project-context
- **FR32:** Container-per-project: cada projeto roda em container isolado
- **FR33:** Dev stack sidecars configuráveis por projeto (postgres, redis, etc)
- **FR34:** Skills auto-geradas a partir de padrões detectados no codebase
- **FR35:** Skills persistidas e aplicadas automaticamente em workflows subsequentes
- **FR36:** Environment variables por projeto injetados via proxy (nunca expostos ao agente)
- **FR37:** CLAUDE.md e project-context carregados automaticamente por cada sessão de agente

### FR38-FR42: Code Delivery

- **FR38:** Agente cria branch por workflow/task no repositório
- **FR39:** Agente cria Pull Request no GitHub quando workflow completa com sucesso
- **FR40:** PR inclui: descrição, gates passados, trail de decisões
- **FR41:** Diff viewer integrado no painel (V1.5+)
- **FR42:** Approve/reject PR diretamente do painel (V1.5+)

### FR43-FR48: Container & Isolation

- **FR43:** Container por projeto com Agent SDK + repo clone + worktrees
- **FR44:** Sidecars opcionais por projeto (postgres, redis, etc) — lifecycle atrelado ao container
- **FR45:** Container network restrito: apenas GitHub API + LLM providers (via proxy)
- **FR46:** Credenciais injetadas via proxy externo — agente nunca vê keys reais
- **FR47:** Estado crítico persistido fora do container (DB central + git como checkpoint)
- **FR48:** Crash recovery: retoma do último checkpoint confirmado (< 1 task perdida)

### FR49-FR55: Platform Configuration

- **FR49:** Configurar provider LLM por projeto ou por workflow node (Claude/Codex/pi-ai)
- **FR50:** Configurar quality gates por projeto (checagens, thresholds, max retries)
- **FR51:** Visual workflow builder (ReactFlow) com YAML export/import
- **FR52:** Métricas de utilização: workflows executados, tokens consumidos, custo, tempo médio
- **FR53:** Failover chain configurável entre providers (ex: Claude → Codex → pi-ai/GPT-4o)
- **FR54:** Account pool: múltiplas API keys por provider com rotação em rate limit
- **FR55:** Error classification: transient (retry), fatal (escalate), unknown (retry N, then escalate)

---

## Non-Functional Requirements

### Performance

- **NFR1:** Painel carrega em < 3 segundos
- **NFR2:** SSE events com < 500ms de latência
- **NFR3:** Workflow inicia em < 2 segundos após click
- **NFR4:** Notificações de bloqueio em < 30 segundos
- **NFR5:** Quality gate check + handoff em < 60 segundos

### Security

- **NFR6:** Containers com `--network none` + proxy para credenciais (per Claude Agent SDK docs)
- **NFR7:** Credenciais nunca em logs, SSE events, ou output visível
- **NFR8:** Credenciais encrypted at-rest, injected via proxy
- **NFR9:** Isolamento de filesystem e rede entre containers de projetos
- **NFR10:** Auth JWT/HMAC com token de duração máxima 24h

### Reliability

- **NFR11:** Crash recovery: < 1 task de trabalho perdida
- **NFR12:** Provider failover em < 5 segundos
- **NFR13:** Operação 24/7 a partir de V1.5 (99% uptime)
- **NFR14:** Frontend reconnect sem perda de estado
- **NFR15:** Eventos idempotentes — replay seguro após crash

---

## Phased Development

### Phase 1 — Foundation (Atual)

| Feature | Status | Issue |
|---------|--------|-------|
| Docker Compose deployment | ✅ Done | #7 Phase 1 |
| Quality Gate Engine | 🔄 In Progress | #3 |
| Hybrid Workflow Storage (DB + FS) | 🔄 Partial | #5 |
| HMAC Auth (WEB_UI_PASSWORD) | ✅ Done | #6 partial |
| SSE Streaming | ✅ Exists | — |
| Workflow DAG Engine | ✅ Exists | — |
| Worktree Isolation | ✅ Exists | — |

### Phase 2 — Dark Factory Core

| Feature | Issue |
|---------|-------|
| pi-ai SDK integration (multi-provider) | #4 (reformular) |
| Dynamic container orchestration API | #40 |
| Dev stack sidecars per project | #38 |
| Container sandbox security (proxy pattern) | #22 + #39 (mesclar) |
| Provider failover chain (intra-SDK) | #10 (reformular) |
| Codebase auto-discovery | #11 |
| Kanban/pipeline view (workflow runs) | #8 (reformular) |
| Cost tracking per workflow | #19 |
| Budget management | #23 |
| Audit trail melhorado | #25 |

### Phase 3 — Multi-User & Visual

| Feature | Issue |
|---------|-------|
| Multi-user JWT + project scoping | #6 |
| Visual workflow builder (ReactFlow) | #21 |
| Diff viewer integrado | #24 |
| Notification system | #20 (parcial) |
| SSE heartbeat + reconnection | #28 (parcial) |
| Skills system | #13 |
| Account pool manager | #12 |

### Phase 4 — AI-Powered Automation

| Feature | Issue |
|---------|-------|
| AI merge resolution (3-tier) | #15 |
| Shared memory (cross-workflow knowledge) | #16 |
| Post-workflow pipeline (retro → skills → docs) | #17 |
| External integrations (Linear, Azure DevOps) | #27 |
| Auto team config by stack | #26 |

### Phase 5 — Multi-Tenant (V3+)

| Feature | Issue |
|---------|-------|
| K8s deployment (pod-per-project) | #7 Phase 2 |
| Tenant isolation completa | — (nova) |
| Subscription tiers | — (nova) |
| SSO + RBAC enterprise | — (nova) |

---

## Decisões Arquiteturais Chave

### DA01: Workflows DAG, não hierarquia de subagentes

**Decisão:** Usar workflow YAML DAGs com um agente por node, não hierarquia SM→TL→Worker.

**Motivo:**
- Claude Agent SDK não suporta subagents spawning subagents
- Codex SDK não tem subagents
- DAGs são determinísticos, debugáveis, versionáveis
- Modularidade: ajustar um node não afeta os demais
- Quality gates entre nodes são pontos de verificação naturais

### DA02: Container-per-project, não container-per-workflow

**Decisão:** Um container persistente por projeto, não containers efêmeros por workflow.

**Motivo:**
- Amortiza cold start (container já running quando workflow inicia)
- Dev stack sidecars (postgres, redis) não precisam de restart por workflow
- Worktrees dentro do container isolam branches sem overhead de container
- Session files do SDK ficam no mesmo path (session resumption funciona)

### DA03: pi-ai SDK como provider in-process, não motor de agente

**Decisão:** Usar `@mariozechner/pi-ai` como provider LLM (API adapter), não `pi-agent-core` como motor de agente.

**Motivo:**
- O motor de agente é o workflow DAG engine do Archon
- pi-ai provê acesso a 17+ providers LLM (Anthropic, OpenAI, Google, Mistral, Bedrock, etc.)
- Encapsular pi-agent-core como `IAssistantClient` seria motor dentro de motor
- pi-ai como provider = apenas API LLM, sem agent loop duplicado

### DA04: Quality gates executam, não confiam

**Decisão:** Gates executam comandos reais e parseiam stdout. Nunca aceitam auto-report do agente.

**Motivo:**
- Problema central do pi-mono PRD: "agentes procrastinam" — ignoram testes, saltam checks
- Trust boundary: agente é untrusted, sistema verifica todas as claims
- Testes passam = sistema rodou `bun test` e parseou exit code + output, não "agente disse que passa"

### DA05: Server como control plane, containers como data plane

**Decisão:** Archon server gerencia estado e UI. Containers executam código de agente.

**Motivo:**
- Separação de concerns: server nunca roda código untrusted
- Estado crítico fora do container (DB central) — crash de container não perde estado
- Múltiplos containers podem ser gerenciados por um server
- Path para K8s: server = deployment, containers = pods

### DA06: Credenciais via proxy, não via environment

**Decisão:** Per Claude Agent SDK docs — proxy externo injeta credenciais, container com `--network none`.

**Motivo:**
- Agente nunca vê API keys reais
- Proxy faz domain allowlist (só GitHub + LLM providers)
- Proxy loga todos os requests para audit
- Container comprometido não exfiltra credenciais

---

## Glossário

| Termo | Definição no Archon |
|-------|-------------------|
| Workflow | YAML DAG com nodes sequenciais/paralelos. Determinístico. |
| Node | Unidade de execução dentro do workflow. Tipos: prompt, command, bash, loop, approval, script |
| Quality Gate | Verificação determinística entre nodes. Executa comando real, parseia stdout. |
| Conversation | Sessão de chat entre usuário e plataforma. Pode disparar workflows. |
| Codebase/Project | Repositório registrado com contexto, skills, e configurações. |
| Worktree | Branch isolada dentro do mesmo clone git. Múltiplas por projeto. |
| Container | Ambiente isolado por projeto. Contém SDK + repo + sidecars. |
| Sidecar | Serviço auxiliar dentro do pod do projeto (postgres, redis, etc). |
| Provider | SDK/API para execução de agente (Claude, Codex, pi-ai). |
| Dark Factory | A plataforma rodando em VPS, acessível via web, executando agentes autonomamente. |

---

## Referências

- [Archon CLAUDE.md](../CLAUDE.md) — Documentação técnica completa do codebase
- [Claude Agent SDK - Hosting](docs/claude-code/agent-sdk/hosting.md) — Padrões de deploy
- [Claude Agent SDK - Secure Deployment](docs/claude-code/agent-sdk/secure-deployment.md) — Container security
- [pi-mono PRD Original](docs/pi-mono/planning/prd.md) — PRD completo do projeto pivotado
- [pi-mono Brainstorming](docs/pi-mono/brainstorming.md) — Sessão de brainstorming original
- [Auto-Claude](https://github.com/AndyMik90/Auto-Claude) — Inspiração para kanban, parallel execution
- [Codex SDK](docs/codex-sdk/README.md) — Documentação do SDK
