---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
status: complete
completedAt: "2026-04-09"
totalEpics: 7
totalStories: 56
frCoverage: "55/55"
nfrCoverage: "26/26"
uxDrCoverage: "19/19"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad/bmm/module-help.csv"
  - ".claude/skills/bmad-*/workflow.md (32 BMAD skill workflows)"
---

# pi-mono - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the AI Software Factory OS, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories. The platform transforms the SDLC cycle into a controlled, visible, and replicable process built on pi-mono and the BMAD methodology.

## Requirements Inventory

### Functional Requirements

FR1: Developer pode disparar o desenvolvimento de uma story individual, seleccionando-a no painel
FR2: Developer pode disparar o desenvolvimento de um epico inteiro, executando todas as stories em sequencia
FR3: Developer pode disparar o desenvolvimento de todos os epicos pendentes de um projecto
FR4: Sistema executa o ciclo BMAD completo por story: create-story -> dev-story -> code-review -> QA -> PR
FR5: Sistema faz handoff deterministico entre fases — a transicao so ocorre quando a fase anterior cumpre todos os criterios
FR6: Sistema executa stories sequencialmente dentro de um epico, com possibilidade de paralelismo entre epicos (V1.5+)
FR7: Sistema retoma automaticamente o fluxo apos intervencao humana sem reiniciar a story
FR8: Sistema estima duracao do fluxo com base em historico de projectos anteriores (V1.5+)
FR9: Sistema executa checagens deterministicas por transicao: testes unitarios/integracao passam, lint limpo, typecheck sem erros, aplicacao inicia, ACs verificados
FR10: Sistema parseia resultados reais de execucao (stdout/stderr) — nunca aceita auto-report do agente
FR11: Sistema bloqueia avanco quando qualquer quality gate falha, independentemente do que o agente reporta
FR12: Sistema faz retry automatico ate N tentativas quando quality gate falha, com feedback especifico ao agente sobre o que falhou
FR13: Sistema escala para humano apos N tentativas sem resolucao, com contexto completo do bloqueio
FR14: Sistema executa code review adversarial como fase obrigatoria do ciclo
FR15: Sistema executa QA review com testes reais contra a aplicacao como fase obrigatoria
FR16: Developer ve board kanban com todas as stories do projecto organizadas por estado (backlog, dev, review, QA, done)
FR17: Developer ve pipeline view por story com fases como checkpoints visuais (verde/amarelo/vermelho)
FR18: Developer ve streaming real-time de actividade dos agentes (eventos de progresso enquanto trabalham)
FR19: Developer ve estado macro do projecto em 3 segundos ao abrir o painel — quantas stories concluidas, em progresso, bloqueadas
FR20: Developer ve trail auditavel por story: cada decisao de agente, cada quality gate, cada intervencao humana com timestamps
FR21: Developer ve detalhes de quality gate por transicao: que checagens passaram, quais falharam, output completo
FR22: Developer pode pausar uma story em execucao a qualquer momento
FR23: Developer pode pausar um epico inteiro, parando todas as stories associadas
FR24: Developer pode retomar uma story ou epico pausado
FR25: Developer recebe notificacao quando o sistema precisa de intervencao, com contexto completo (problema, tentativas, logs, accoes sugeridas)
FR26: Developer pode injectar contexto (texto, links, instrucoes) numa story bloqueada que o agente incorpora ao retomar
FR27: Developer pode redirecionar a abordagem de uma story (alterar instrucoes ao agente mid-flight)
FR28: Developer pode cancelar uma story ou epico em execucao
FR29: Developer pode configurar canal de notificacao (email, webhook) e nivel de urgencia
FR30: Developer pode criar novo projecto apontando para repositorio GitHub
FR31: Sistema analisa codebase existente e gera project-context automaticamente (stack, padroes, estrutura, convencoes)
FR32: Developer pode revisar e editar o project-context gerado antes de confirmar
FR33: Sistema gera skills automaticamente a partir de padroes detectados no codebase
FR34: Sistema gera skills automaticamente a partir de correccoes humanas durante o fluxo
FR35: Sistema persiste skills geradas e aplica-as automaticamente em ciclos subsequentes
FR36: Developer pode revisar, editar e eliminar skills geradas pelo sistema
FR37: Sistema alimenta cada agente automaticamente com project-context, skills e memoria relevantes
FR38: Sistema cria branch por story no repositorio GitHub
FR39: Sistema cria Pull Request no GitHub quando story completa o ciclo com sucesso
FR40: Developer pode revisar diff de codigo produzido pelo agente (via deep link para GitHub em V1, diff viewer integrado em V1.5+)
FR41: Developer pode aprovar ou rejeitar PR directamente do painel (V1.5+)
FR42: Sistema inclui no PR: descricao da story, ACs cumpridos, quality gates passados, trail de decisoes
FR43: Sistema executa cada agente de desenvolvimento dentro de container efemero isolado
FR44: Sistema garante zero acesso do container a ambientes de staging/producao
FR45: Sistema injeta credenciais necessarias (API keys, tokens) no container de forma segura, sem exposicao ao agente
FR46: Sistema persiste estado critico fora do container de forma duravel, recuperavel apos crash sem perda de trabalho confirmado
FR47: Sistema recupera de crash de container sem perda de trabalho — retoma do ultimo checkpoint confirmado
FR48: Sistema suporta failover entre providers LLM quando o provider primario esta indisponivel
FR49: Developer pode configurar providers LLM por projecto (API keys, modelo preferido, failover chain)
FR50: Developer pode configurar quality gates por projecto (quais checagens obrigatorias, thresholds, max retries)
FR51: Developer pode configurar workflows BMAD por projecto (quais fases activar, parametros por fase)
FR52: Developer pode ver metricas de utilizacao: stories processadas, intervencoes, tokens consumidos, tempo medio por story
FR53: Sistema configura automaticamente o team de agentes (roles, skills, modelos) com base no stack detectado do projecto
FR54: Sistema aplica workflows BMAD como template base; developer pode configurar pontos de extensao por projecto sem alterar o template pai

### NonFunctional Requirements

NFR1: Painel carrega estado completo do projecto em < 3 segundos (incluindo board, pipeline e estado macro)
NFR2: Eventos de streaming de agentes chegam ao frontend com < 500ms de latencia apos emissao pelo backend
NFR3: Accao de "Iniciar desenvolvimento" confirma e inicia execucao em < 2 segundos apos click
NFR4: Notificacoes de bloqueio chegam ao developer em < 30 segundos apos o sistema detectar o bloqueio
NFR5: Injecao de contexto pelo developer e processada e incorporada pelo agente em < 10 segundos
NFR6: Transicao entre fases (quality gate check + handoff) completa em < 60 segundos por transicao
NFR7: UI funcional em desktop (>= 1024px) e mobile (>= 375px) — todas as accoes core acessiveis em ambos
NFR8: Containers de agente executam com acesso a rede limitado — apenas repositorio GitHub e LLM providers autorizados
NFR9: Credenciais (API keys, tokens) nunca presentes em logs, eventos de streaming, ou output visivel no painel
NFR10: Credenciais armazenadas encriptadas at-rest; injectadas no container de forma segura e efemera
NFR11: Nenhum container tem acesso a filesystem ou rede de outros containers
NFR12: Codigo de projecto acessivel apenas pelo projecto associado — isolamento a nivel de filesystem e git
NFR13: Sessoes de utilizador autenticadas com token de duracao maxima de 24 horas; expiram apos 30 minutos de inactividade
NFR14: Crash de container nao perde mais de 1 task de trabalho — recovery do ultimo git checkpoint confirmado
NFR15: Falha de provider LLM activa failover chain em < 5 segundos sem intervencao humana
NFR16: Sistema opera 24/7 sem reinicio programado a partir de V1.5 (uptime target: 99%)
NFR17: Perda de conexao do frontend (browser) nao afecta execucao de agentes no backend — retoma streaming ao reconectar
NFR18: Eventos de orquestracao persistidos com idempotencia — replay seguro apos crash sem duplicacao de trabalho
NFR19: Dados criticos (sprint-status, story files, skills, project-context) persistidos em armazenamento duravel
NFR20: GitHub API rate limits respeitados com backoff exponencial
NFR21: LLM provider API timeouts configuraveis por provider com defaults sensatos (30s-120s)
NFR22: Container runtime health-checked antes de spawnar agente — fallback gracioso se runtime indisponivel
NFR23: EventStream compativel com reconexao — cliente pode reconectar e receber estado actual sem perder eventos criticos
NFR24: Painel opera com teclado para accoes frequentes — keyboard-first como Linear
NFR25: Contraste de cores suficiente para leitura em ambientes com luz variavel (WCAG AA minimo para texto)
NFR26: Estado comunicado por cor + texto/icone — nunca apenas por cor (acessibilidade a daltonismo)

### Additional Requirements

- Pacote ai-factory dentro do monorepo pi-mono (packages/ai-factory), usando npm workspaces para dependencias internas (wrapper fino nos pontos de contacto com o motor)
- Stack: Hono + Prisma 7 + React 19 + shadcn/ui + TanStack Query/Router + Zod + Vite + Biome
- Workflow Template Engine: templates configuraveis com states, transitions, quality gates e agent roles persistidos no banco (Prisma)
- State Machine Transacional: cada transicao atomica com optimistic locking via version field, outbox pattern para sync e notificacoes
- AgentRuntime interface: DockerLocalRuntime (stdin/stdout via pi-mono RPC) + KubernetesRuntime (HTTP/SSE)
- SSE (Server-Sent Events) para streaming real-time, HTTP REST para accoes do developer
- Cadeia de contratos tipados end-to-end: Prisma -> Zod -> Hono (@hono/zod-openapi) -> Hono RPC (hc) -> TanStack Query -> React
- Organizacao por feature folders com sufixos (.service.ts, .routes.ts, .schemas.ts, .gate.ts, .test.ts)
- 32 pontos de conflito com padroes definidos: naming (DB PascalCase, API kebab-case, TS camelCase), structure, communication, process
- Auth: JWT simples V1 (claims: userId, role, projectIds), middleware Hono preparado para OAuth V2+
- Docker Compose local + K8s producao, Dockerfile multi-stage desde o inicio
- CI/CD: GitHub Actions (lint Biome + typecheck tsgo + testes Vitest + build Vite + Docker build + K8s deploy)
- Prisma 7 com SQLite (dev/testes) e PostgreSQL (producao), troca transparente
- Error handling padronizado com codigos tipados em Zod (code, message, details, storyId, retryable)
- Logs estruturados em JSON (timestamp, level, component, storyId, eventType)
- Eventos SSE com dot.notation (story.transition, agent.message, gate.passed), payloads Zod, idempotencia por CUID2
- Frontend: TanStack Query para server state, useState para UI state, hook useSSE que invalida cache

### UX Design Requirements

UX-DR1: Sistema de cores dark-first com 18 tokens semanticos (bg-base #0d1117, bg-surface #161b22, status-success #3fb950, status-warning #d29922, status-error #f85149, status-info #58a6ff, accent-primary #1f6feb, text-primary #e6edf3, text-secondary #8b949e, etc.)
UX-DR2: Sistema de tipografia Inter (UI) + JetBrains Mono (codigo) com escala de 6 niveis (text-xs 11px a text-2xl 24px) e 3 pesos (normal 400, medium 500, semibold 600)
UX-DR3: Grid de espacamento base 4px com 7 tokens (space-1 4px a space-12 48px) e densidade alta estilo Linear/Vercel
UX-DR4: Layout hibrido Board + Slide-over: sidebar 240px colapsavel, top bar 48px fixo, slide-over 70% desktop / 100% mobile, sem footer
UX-DR5: 9 componentes de fundacao seguindo padroes shadcn/ui: Button (4 variantes), Input/Textarea, Badge (5 variantes), Dropdown/Select, Tabs, Toast/Notification (4 tipos), Dialog/Confirm, Tooltip, Skeleton
UX-DR6: Story Card como hub de informacao com 5 estados visuais (pending cinza, in-progress amarelo pulse, blocked vermelho, completed verde checkmark, review azul) contendo titulo, epico, agente, gates, tempo, tentativas
UX-DR7: Pipeline Visualizer com fases BMAD como checkpoints horizontais (desktop) / verticais (mobile) com 5 estados por fase (completed verde, in-progress amarelo, blocked vermelho, pending cinza, skipped cinza risco). Clique expande detalhes
UX-DR8: Agent Chat com streaming de mensagens, artefatos inline, 3 estados (active, waiting, idle), input fixo no bottom em mobile, role="log" aria-live="polite"
UX-DR9: Code Diff Viewer com side-by-side (desktop) / unified (mobile), inline comment threads, botoes Aprovar/Mudancas, keyboard J/K entre hunks
UX-DR10: Slide-over Container com tabs Pipeline/Chat/Code/Trail, 70% desktop 100% mobile, transicao slide da direita 200ms ease-out, ESC/click-outside fecha, role="dialog" aria-modal="true", focus trap
UX-DR11: Notification Card com 3 variantes (bloqueio vermelho, conclusao verde, info azul) contendo story, fase, tentativas, resumo do erro, sugestao de accao, botoes de accao
UX-DR12: Top Bar 48px fixo com logo, seletor de projecto, busca, badge de atencao com contagem, notificacoes dropdown, menu usuario
UX-DR13: Design responsivo desktop-first mobile-complete com 4 breakpoints (mobile <768px, tablet 768-1024px, desktop 1024-1440px, wide >1440px), touch targets 44px+, sidebar drawer em mobile, story cards full-width em mobile
UX-DR14: Acessibilidade WCAG 2.1 AA: contraste texto primario 12.4:1, secundario 4.6:1, focus ring 2px solid accent, ARIA roles em todos os componentes custom, prefers-reduced-motion respeitado, semantic HTML
UX-DR15: Atalhos de teclado: Cmd+K (command palette), F (fire), J/K (navegar stories), Enter (abrir), 1-4 (tabs), A (aprovar PR), Esc (fechar overlay), ? (mostrar atalhos)
UX-DR16: Padroes de feedback: toasts success 3s auto-dismiss, error persistente, warning persistente, info 5s, badges de cor em cards, contadores na top bar real-time, delta markers desde ultimo acesso
UX-DR17: Hierarquia de botoes 4 niveis: primario (solid accent, max 1 por contexto), secundario (outline), ghost (sem background), destrutivo (solid error, sempre com confirmacao)
UX-DR18: Command palette centrado 50% desktop / full-width mobile via Cmd+K, busca e accoes rapidas
UX-DR19: Board view kanban com stories por estado, bloqueados no topo, badge de contagem na top bar "N precisam de atencao", ultimo acesso registrado com delta markers

### FR Coverage Map

FR1: Epic 2 - Disparar story individual
FR2: Epic 5 - Disparar epico inteiro
FR3: Epic 5 - Disparar todos os epicos pendentes
FR4: Epic 2 - Ciclo BMAD completo por story
FR5: Epic 2 - Handoff deterministico entre fases
FR6: Epic 5 - Execucao sequencial dentro de epico
FR7: Epic 4 - Retoma apos intervencao humana
FR8: Epic 7 - Estimativa baseada em historico (V1.5+)
FR9: Epic 2 - Checagens deterministicas por transicao
FR10: Epic 2 - Parse de resultados reais (stdout/stderr)
FR11: Epic 2 - Bloqueio quando gate falha
FR12: Epic 2 - Retry automatico ate N tentativas
FR13: Epic 2 - Escalacao para humano apos N tentativas
FR14: Epic 2 - Code review adversarial obrigatorio
FR15: Epic 2 - QA review com testes reais
FR16: Epic 3 - Board kanban com stories por estado
FR17: Epic 3 - Pipeline view por story com checkpoints visuais
FR18: Epic 3 - Streaming real-time de actividade
FR19: Epic 3 - Estado macro em 3 segundos
FR20: Epic 3 - Trail auditavel por story
FR21: Epic 3 - Detalhes de quality gate por transicao
FR22: Epic 4 - Pausar story em execucao
FR23: Epic 4 + Epic 5 - Pausar epico inteiro
FR24: Epic 4 + Epic 5 - Retomar story ou epico pausado
FR25: Epic 4 - Notificacao com contexto completo
FR26: Epic 4 - Injectar contexto em story bloqueada
FR27: Epic 4 - Redirecionar abordagem mid-flight
FR28: Epic 4 + Epic 5 - Cancelar story ou epico
FR29: Epic 4 - Configurar canal de notificacao
FR30: Epic 1 - Criar projecto via repo GitHub
FR31: Epic 6 - Auto-discovery de codebase
FR32: Epic 6 - Editar project-context gerado
FR33: Epic 6 - Skills auto-geradas de padroes
FR34: Epic 6 - Skills auto-geradas de correccoes humanas
FR35: Epic 6 - Persistir e aplicar skills automaticamente
FR36: Epic 6 - Gestao de skills pelo developer
FR37: Epic 6 - Alimentacao automatica de contexto aos agentes
FR38: Epic 2 - Branch por story no GitHub
FR39: Epic 2 - PR no GitHub quando story completa
FR40: Epic 3 (deep link basico) / Epic 7 (diff integrado V1.5+)
FR41: Epic 7 - Aprovar/rejeitar PR do painel (V1.5+)
FR42: Epic 2 - PR com descricao, ACs, gates, trail
FR43: Epic 2 - Container efemero isolado por agente
FR44: Epic 2 - Zero acesso a staging/producao
FR45: Epic 2 - Credenciais injectadas seguramente
FR46: Epic 2 - Estado critico persistido fora do container
FR47: Epic 2 - Crash recovery via git checkpoint
FR48: Epic 2 - Provider failover
FR49: Epic 1 (basico) / Epic 7 (completo) - Configurar providers por projecto
FR50: Epic 7 - Configurar quality gates por projecto
FR51: Epic 7 - Configurar workflows BMAD por projecto
FR52: Epic 7 - Metricas de utilizacao
FR53: Epic 6 - Auto-configurar team de agentes
FR54: Epic 7 - Pontos de extensao por projecto
FR55: Epic 2 (gate basico) / Epic 3 (visual) / Epic 7 (configuracao threshold)

## Epic List

### Epic 1: Platform Foundation & Project Setup
Developer pode criar o pacote ai-factory dentro do monorepo pi-mono com toda a infraestrutura (logging, error handling, CI, test infra), configurar um novo projecto apontando para um repo GitHub, e configurar providers LLM basicos.
**FRs covered:** FR30, FR49 (basico)
**Stories:** 9 (1.1-1.9)

### Epic 2: Story Execution Pipeline (Marco 0)
Developer pode disparar uma story individual e ve-la completar o ciclo BMAD inteiro (create-story -> dev-story -> code-review -> QA -> PR) com quality gates deterministicos a controlar cada transicao. O agente executa em container isolado e o resultado e um PR no GitHub.
**FRs covered:** FR1, FR4, FR5, FR9-FR15, FR38-FR39, FR42-FR48
**Stories:** 13 (2.1-2.13)

### Epic 3: Development Dashboard
Developer ve o board kanban completo com stories por estado, pipeline view por story com fases como checkpoints visuais, streaming real-time de actividade, estado macro em 3 segundos, trail auditavel e detalhes de quality gates.
**FRs covered:** FR16-FR21, FR40 (deep link basico)
**Stories:** 7 (3.1-3.7)

### Epic 4: Human Control & Notifications
Developer pode pausar/retomar stories, receber notificacoes contextuais quando o sistema precisa de ajuda, injectar contexto numa story bloqueada, conversar com agentes, redirecionar abordagem, e cancelar stories. O sistema retoma automaticamente apos intervencao.
**FRs covered:** FR7, FR22-FR29
**Stories:** 5 (4.1-4.5)

### Epic 5: Epic Orchestration
Developer pode disparar um epico inteiro (ou todos os pendentes) e o sistema executa todas as stories em sequencia com handoff deterministico. Suporta pausa/retoma e cancelamento a nivel de epico.
**FRs covered:** FR2, FR3, FR6, FR23 (epic), FR24 (epic), FR28 (epic)
**Stories:** 7 (5.1-5.7)

### Epic 6: Project Intelligence & Brownfield Onboarding
Developer pode fazer onboarding de projectos existentes — o sistema analisa o codebase, gera project-context automaticamente, detecta padroes, gera skills, e aplica tudo nos ciclos de desenvolvimento. Cada correccao humana enriquece o sistema.
**FRs covered:** FR31-FR37, FR53
**Stories:** 8 (6.1-6.8)

### Epic 7: Configuration, Metrics & Extensibility
Developer tem controlo total sobre a plataforma — configura quality gates por projecto, personaliza workflows BMAD, ve metricas de utilizacao, e beneficia de estimativas baseadas em historico.
**FRs covered:** FR8, FR40 (integrado V1.5+), FR41, FR49-FR54 (scope completo)
**Stories:** 8 (7.1-7.8)


---

## Epic 1: Platform Foundation & Project Setup

Developer pode criar o pacote ai-factory dentro do monorepo pi-mono com toda a infraestrutura (logging, error handling, CI, test infra), configurar um novo projecto apontando para um repo GitHub, e configurar providers LLM basicos.

### Story 1.1: Repository & Infrastructure Setup

As a **developer building the platform**,
I want the **ai-factory package initialized within the pi-mono monorepo with the core tech stack, build tooling, and deployment infrastructure**,
So that **the project has a solid, reproducible foundation integrated with the monorepo CI, containers, and all tooling operational from day one**.

**Acceptance Criteria:**

**Given** o pacote packages/ai-factory nao existe no monorepo pi-mono
**When** o developer executa o setup inicial
**Then** packages/ai-factory/package.json existe com workspace dependencies (`@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-web-ui`) e dependencias externas: Hono, @hono/zod-openapi, Prisma 7, React 19, Vite, TanStack Query, TanStack Router, Zod, shadcn/ui, Tailwind CSS 4
**And** tsconfig.json extends configuracao base do monorepo, com path aliases para src/
**And** lint e formatacao herdados do biome.json do root do monorepo
**And** `npm install` na raiz do monorepo resolve dependencias do ai-factory sem erros e `npm run check` passa incluindo o pacote
**And** Prisma inicializado com schema base vazio e migration funcional (SQLite)
**And** docker/Dockerfile multi-stage (build context: raiz do monorepo) e docker-compose.yml configurados
**And** steps adicionados ao CI existente do monorepo (.github/workflows/) para lint, typecheck, test e build do ai-factory
**And** estrutura de pastas segue a arquitectura: src/features/, src/shared/, src/db/, src/api/, src/web/

### Story 1.2: Backend Server & Cross-Cutting Concerns

As a **developer building the platform**,
I want the **backend server running with health check, dev server, structured logging, error handling, and environment validation**,
So that **development can begin on a foundation with all cross-cutting concerns operational and consistent**.

**Acceptance Criteria:**

**Given** o pacote ai-factory inicializado no monorepo (Story 1.1)
**When** o developer inicia o servidor
**Then** Hono server inicia e responde em GET /api/health com status 200
**And** Vite dev server inicia e serve a app React
**And** logger estruturado configurado em src/shared/utils/logger.ts (JSON: timestamp, level, component, storyId, eventType)
**And** error handler padronizado em src/shared/errors/ com tipos Zod (code, message, details, retryable)
**And** env config com Zod validation em src/shared/utils/env.ts — fail-fast no startup se variaveis obrigatorias faltam
**And** .env.example com todas as variaveis documentadas

### Story 1.3: Test Infrastructure

As a **developer**,
I want **a solid test infrastructure with factories, fixtures, database helpers, and mock providers**,
So that **every story can write tests consistently without reinventing helpers**.

**Acceptance Criteria:**

**Given** o pacote ai-factory inicializado com servidor e cross-cutting concerns (Stories 1.1-1.2)
**When** o developer executa os testes
**Then** Vitest configurado com test/setup.ts que inicializa SQLite em memoria antes de cada suite
**And** test/helpers/db.ts fornece: createTestDb(), resetDb(), seedDb() com Prisma client de teste
**And** test/fixtures/ contem factories para entidades: createProject(), createWorkflowTemplate() com defaults sensiveis e overrides via builder pattern
**And** test/helpers/api.ts fornece: createTestApp() que retorna instancia Hono com middleware configurado
**And** test/helpers/mocks/ contem: mockAgentRuntime(), mockGitHubClient(), mockLLMProvider() com comportamentos configuraveis (success, failure, timeout)
**And** testes de exemplo demonstram cada helper
**And** `npm run test` executa todos os testes e produz report

### Story 1.4: Database Schema & API Foundation

As a **developer**,
I want **core database models and CRUD API routes with type-safe validation**,
So that **the platform has a solid data layer with contracts tipados end-to-end**.

**Acceptance Criteria:**

**Given** test infra configurada (Story 1.3)
**When** o developer executa Prisma migrate
**Then** tabela Project criada com: id (CUID2), name, repoUrl, status, createdAt, updatedAt
**And** tabela WorkflowTemplate criada com: id, name, states (JSON), transitions (JSON), qualityGates (JSON), agentRoles (JSON), version, isDefault
**And** Zod schemas definidos para create/update de Project e WorkflowTemplate
**And** Hono routes CRUD para Project e WorkflowTemplate com OpenAPI spec gerado via @hono/zod-openapi
**And** error handling middleware no Hono formata todos os erros na estrutura padronizada (shared/errors/)
**And** seed script cria template BMAD default (states: backlog, create-story, dev, review, QA, PR, done, blocked)
**And** codigo em src/features/projects/ e src/features/workflow-templates/
**And** testes de integracao cobrem CRUD completo usando factories e helpers de test infra

### Story 1.5: Frontend Shell, Layout & Design System

As a **developer**,
I want **the frontend shell with layout, design tokens, routing, data fetching, base UI components, and top bar**,
So that **todas as views futuras tenham uma fundacao visual consistente com design system, routing e data layer operacionais**.

**Acceptance Criteria:**

**Given** o backend API funcional (Story 1.4)
**When** o developer abre a app no browser
**Then** layout mostra sidebar (240px colapsavel), top bar (48px fixo) e area de conteudo principal
**And** design tokens via Tailwind config: 18 tokens de cor, tipografia Inter + JetBrains Mono (6 niveis), grid 4px (7 tokens)
**And** dark mode default, light mode via prefers-color-scheme
**And** TanStack Router com rotas: /board, /settings, /setup; TanStack Query com query client
**And** Hono RPC client (hc) configurado com teste que valida inferencia de tipos end-to-end
**And** componentes shadcn/ui: Button (4 variantes), Badge (5 variantes), Tabs, Toast, Skeleton, Dialog, Input/Textarea, Dropdown, Tooltip
**And** top bar com logo, seletor de projecto, notificacoes, menu usuario

### Story 1.6: Interactions, Keyboard Shortcuts & Accessibility

As a **developer**,
I want **command palette, global keyboard shortcuts, responsive breakpoints, and WCAG accessibility**,
So that **a plataforma seja keyboard-first, acessivel e funcional em qualquer dispositivo e contexto**.

**Acceptance Criteria:**

**Given** o frontend shell com layout e design system operacionais (Story 1.5)
**When** o developer interage com a app
**Then** Command Palette via Cmd+K: centrado 50% desktop / full-width mobile, busca e accoes rapidas (UX-DR18)
**And** atalhos globais: Cmd+K (palette), Esc (fechar overlay), ? (overlay de atalhos) (UX-DR15)
**And** breakpoints responsivos: mobile (<768px sidebar drawer, touch 44px+), tablet, desktop
**And** WCAG 2.1 AA: contraste >4.5:1, focus ring 2px, semantic HTML, skip links
**And** prefers-reduced-motion respeitado; transicao padrao: 150ms ease-out estados, 200ms ease-out overlays
**And** testes de componente com Vitest + Testing Library

### Story 1.7: Authentication & Session Management

As a **developer**,
I want **to authenticate with the platform and maintain a secure session**,
So that **my projects and configurations are protected**.

**Acceptance Criteria:**

**Given** a app frontend e API backend funcionais
**When** o developer acede sem token valido
**Then** redireccionado para pagina de setup/login
**And** pode gerar token JWT via setup (V1: gerado no setup, sem login externo)
**And** JWT com claims: userId, role (developer), projectIds
**And** middleware de auth (withAuth, withRole como HOF reutilizavel) valida JWT em /api/* excepto /api/health
**And** token expira 24h, sessao expira 30min inactividade
**And** rotas protegidas retornam 401 sem token; frontend mostra auth vs app layout
**And** middleware preparado para RBAC futuro (developer, tech_lead, po, admin)

### Story 1.8: Project Creation & Provider Setup

As a **developer**,
I want **to create a new project by providing a GitHub repo URL and configure a basic LLM provider**,
So that **I have a project configured and ready for development orchestration**.

**Acceptance Criteria:**

**Given** o developer esta autenticado
**When** clica em "Novo Projecto"
**Then** formulario pede: nome, URL GitHub, provider LLM (Anthropic, OpenAI, Google), API key
**And** projecto criado com template BMAD default associado
**And** credenciais encriptadas (Prisma + encryption library)
**And** developer redireccionado para pagina do projecto com confirmacao
**And** seletor de projecto na top bar permite trocar entre projectos
**And** validacao de URL GitHub; erro claro se API key invalida

### Story 1.9: CI/CD Pipeline

As a **developer**,
I want **a complete CI pipeline that runs all quality checks on every PR**,
So that **the platform that manages quality gates has quality gates on its own development**.

**Acceptance Criteria:**

**Given** o monorepo com GitHub Actions configurado
**When** um PR e aberto ou actualizado que afeta packages/ai-factory/
**Then** pipeline do monorepo executa steps do ai-factory: biome check, tsgo typecheck, vitest (unit + integration), vite build, prisma migrate check
**And** pipeline falha se qualquer step falha — PR nao pode ser merged
**And** execucao < 5 minutos (steps do ai-factory)
**And** Docker build validado como step opcional (build context: raiz do monorepo)
**And** steps integrados no workflow CI existente do monorepo (nao pipeline separado)

---

## Epic 2: Story Execution Pipeline (Marco 0)

Developer pode disparar uma story individual e ve-la completar o ciclo BMAD inteiro (create-story -> dev-story -> code-review -> QA -> PR) com quality gates deterministicos. O agente executa em container isolado e o resultado e um PR no GitHub.

### Story 2.1: Story & Epic Data Models with CRUD API

As a **developer**,
I want **Story and Epic data models with full CRUD API**,
So that **the orchestration system has entities to operate on**.

**Acceptance Criteria:**

**Given** o schema Prisma com Project e WorkflowTemplate (Epic 1)
**When** o developer executa Prisma migrate (incremental, sem destructive changes)
**Then** tabela Epic criada com: id (CUID2), projectId (FK), title, description, status, order, createdAt, updatedAt
**And** tabela Story criada com: id, epicId (FK), projectId (FK), title, description, userStory, acceptanceCriteria (JSON), status, currentPhase, retryCount, maxRetries, version (optimistic locking), agentRole, branchName, prUrl, timestamps
**And** tabela StoryEvent criada com: id (CUID2), storyId (FK), type (dot.notation), data (JSON), timestamp, idempotencyKey (unique)
**And** tabela QualityGateResult criada com: id, storyId (FK), transitionId, gateName, passed, output, executedAt
**And** Hono CRUD routes para Epic e Story com Zod validation em src/features/stories/ e src/features/epics/
**And** factories adicionadas: createEpic(), createStory(), createStoryEvent()
**And** testes de integracao cobrem CRUD + filtros + eventos

### Story 2.2: Container Sandbox Runtime

As a **developer**,
I want **agents to execute inside ephemeral Docker containers with network isolation and secure credential injection**,
So that **agent execution is sandboxed with zero access to staging/production**.

**Acceptance Criteria:**

**Given** Docker Engine disponivel no host
**When** o sistema spawna um agente
**Then** DockerLocalRuntime em src/features/sandbox/ spawna container efemero com volume isolado, limites CPU/memoria, network policy (GitHub + LLM providers apenas)
**And** repositorio clonado dentro do container com token GitHub (env var efemera)
**And** comunicacao via stdin/stdout (pi-mono RPC mode)
**And** credenciais como env vars efemeras, nunca em logs
**And** container destruido apos conclusao ou timeout (configurable, default 30min)
**And** cleanup automatico de containers orfaos
**And** health-check antes de spawn; Dockerfile.sandbox com Node.js 22, git, pi-mono CLI
**And** terminate() limpo; testes com container mock incluindo timeout e cleanup
**And** git worktree criado para a story (branch story/<storyId>-<slug>) dentro do volume do container
**And** interface ContainerContext com campos containerId, storyId, worktreePath, agentRole
**And** Marco 0: 1 story = 1 container (mapeamento directo); interface desenhada para V1 onde 1 container = 1 epic com multiplos worktrees

### Story 2.3: Quality Gate Engine

As a **developer**,
I want **deterministic quality gates that verify real execution results**,
So that **no story advances without meeting hard-coded criteria**.

**Acceptance Criteria:**

**Given** um agente completou uma fase
**When** o sistema avalia a transicao
**Then** quality gate engine em src/features/quality-gates/ executa gates configuradas
**And** gates: test-runner (testes reais), lint-check (biome), typecheck (tsgo/tsc), app-start (health check), acceptance (ACs), coverage (json-summary threshold, desactivado por default)
**And** cada gate parseia stdout/stderr real e retorna QualityGateResult; resultados salvos no banco
**And** se gate falha: transicao bloqueada, feedback especifico ao agente
**And** testes unitarios com fixtures de output real (stdout/stderr de lint, tsc, vitest)
**And** testes de falso-positivo: gate NAO passa quando output contem erros disfarçados
**And** testes de falso-negativo: gate NAO falha com warnings nao-criticos
**And** testes com output malformado/truncado: gate retorna erro claro, nao crash
**And** testes de timeout: gate respeita timeout e retorna falha

### Story 2.4: Transactional State Machine

As a **developer**,
I want **an atomic, transactional state machine for story lifecycle management**,
So that **state transitions are consistent, auditable, and resilient to concurrent access**.

**Acceptance Criteria:**

**Given** uma story com template BMAD associado
**When** uma transicao e solicitada
**Then** transicao dentro de DB transaction com optimistic locking via version field
**And** validacao de source_state antes de transicionar
**And** se valida: atualiza estado + version + evento no log append-only + outbox
**And** se version conflict: erro 409 sem side-effects
**And** outbox para processamento async (SSE, notificacoes)
**And** idempotencyKey (CUID2) em todos os eventos para deduplicacao
**And** codigo em src/features/orchestrator/state-machine.ts
**And** testes de concorrencia: duas transicoes simultaneas — apenas uma sucede
**And** testes de idempotencia: replay nao duplica trabalho
**And** testes de transicao invalida: estado errado retorna erro sem corrupcao
**And** state machine e template-agnostico — nao assume estados fixos do BMAD; estados e transicoes sao definidos pelo template
**And** testes com template BMAD default e com template customizado (menos fases)

### Story 2.5: Orchestrator Loop & BMAD Cycle

As a **developer**,
I want **the orchestrator that drives the BMAD cycle by spawning agents and managing retry logic**,
So that **stories progress through phases automatically with the right agent at each step**.

**Acceptance Criteria:**

**Given** uma story pronta para execucao
**When** o orchestrator inicia
**Then** ciclo BMAD: BACKLOG -> CREATE_STORY -> DEV -> REVIEW -> QA -> PR -> DONE; orchestrator carrega workflow template do banco e resolve sequencia de fases e transicoes; Marco 0 usa template BMAD default
**And** em cada fase, spawna agente com role correcto via AgentRuntime
**And** processa eventos do agente via onEvent callback
**And** apos fase, solicita transicao ao state machine (quality gates executados)
**And** se gate falha e retry < max: retry com feedback especifico
**And** se retry >= max: state machine transiciona para BLOCKED
**And** outbox consumer processa eventos apos commit: SSE + notificacoes
**And** codigo em src/features/orchestrator/orchestrator.service.ts e outbox.service.ts
**And** testes de integracao com agentes e gates mockados
**And** orchestrator e plugavel — recebe template como input, nao assume ciclo BMAD fixo
**And** testes com template customizado (3 fases apenas) para validar que o orchestrator e template-driven

### Story 2.6: GitHub Integration — Branches & Pull Requests

As a **developer**,
I want **the system to create a branch per story and a PR when it completes**,
So that **agent work results in reviewable code on GitHub**.

**Acceptance Criteria:**

**Given** uma story com repoUrl configurado
**When** entra na fase DEV
**Then** branch `story/<storyId>-<slug>` criada
**When** story completa com todos os gates passados
**Then** PR criado com: titulo, user story, ACs, gates passados, trail resumido
**And** prUrl salvo; GitHub API rate limits com backoff exponencial e retry ate 3
**And** codigo em src/features/github/; testes com API mockada incluindo rate limit

### Story 2.7: Real-Time Event Streaming (SSE)

As a **developer**,
I want **real-time events streamed via SSE**,
So that **I can see agent activity as it happens**.

**Acceptance Criteria:**

**Given** story em execucao
**When** developer tem painel aberto
**Then** GET /api/stream (SSE) emite eventos autenticados filtrados por projectId
**And** estrutura: { id (CUID2), type (dot.notation), timestamp, storyId, projectId, data }
**And** eventos: story.started/transition/blocked/completed, agent.message/tool, gate.passed/failed, epic.completed
**And** payloads Zod; hook useSSE em src/web/hooks/use-sse.ts invalida TanStack Query cache
**And** reconexao automatica + heartbeat 30s; GET /api/stories/:storyId/state para recovery
**And** eventos persistidos com idempotencyKey; codigo em src/features/streaming/
**And** testes de emissao, recepcao, reconexao, mensagens fora de ordem
**And** subscricoes SSE por scope: project:<projectId> (dashboard), story:<storyId> (slide-over), epic:<epicId> (V1); cliente especifica scopes via query param
**And** heartbeat a cada 30 segundos para manter conexao e detectar desconexoes

### Story 2.8: Trigger Single Story Execution

As a **developer**,
I want **to trigger a story through the full BMAD cycle from the UI**,
So that **I can fire a story, see real-time progress, and receive a PR on GitHub**.

**Acceptance Criteria:**

**Given** board view com stories em BACKLOG
**When** selecciona story e clica "Iniciar Desenvolvimento"
**Then** POST /api/stories/:storyId/start inicia orchestrator
**And** card actualiza em tempo real via SSE; pipeline view mostra progresso
**And** sucesso: story DONE, PR criado; falha: story BLOCKED, badge vermelho
**And** inicio em < 2 segundos (NFR3); link para PR visivel
**And** este e o teste end-to-end do Marco 0

### Story 2.9: Adversarial Code Review Phase

As a **developer**,
I want **an independent adversarial code review as mandatory phase**,
So that **code quality issues are caught by a reviewer independent of the dev agent**.

**Acceptance Criteria:**

**Given** story completou DEV com gates passados
**When** transiciona para REVIEW
**Then** agente reviewer com role adversarial (modelo/config diferente do dev)
**And** review focado em: bugs logicos, seguranca (OWASP top 10), qualidade, convencoes
**And** findings categorizados: critical, major, minor
**And** critical/major: volta para DEV com feedback; minor/nenhum: avanca para QA
**And** findings persistidos no trail auditavel

### Story 2.10: QA Review Phase

As a **developer**,
I want **QA with real test execution as mandatory phase**,
So that **acceptance criteria are verified by actual tests, not self-reported**.

**Acceptance Criteria:**

**Given** story passou REVIEW
**When** transiciona para QA
**Then** agente QA escreve e executa testes reais para cada AC
**And** resultado parseado de stdout/stderr (nao reportado pelo agente)
**And** falha: volta para DEV com output dos testes; sucesso: avanca para PR
**And** resultados e coverage persistidos no trail

### Story 2.11: Provider Failover & Crash Recovery (V1)

As a **developer**,
I want **automatic LLM provider failover and container crash recovery**,
So that **execution continues despite outages or failures**.

**Nota:** V1, nao Marco 0. Marco 0 opera com provider unico sem crash recovery automatico.

**Acceptance Criteria:**

**Given** provider primario falha (timeout, rate limit, 5xx)
**When** sistema detecta falha
**Then** failover em < 5 segundos (NFR15); chain configuravel; agente continua sem reiniciar

**Given** container crash
**When** detectado
**Then** recovery do ultimo git checkpoint; max 1 task perdida (NFR14)
**And** estado critico intacto fora do container; re-spawn e retoma
**And** testes de recovery + corrupcao parcial (crash mid-transition)
**And** Account Pool Manager: tabela ProviderAccount com id, projectId, provider, apiKey (encriptada), score, usageCount, lastUsedAt, cooldownUntil
**And** scoring por request: sucesso incrementa, falha decrementa, cooldown apos rate limit
**And** rotacao proactiva: se key proxima do limite (>80% consumido), troca antes de falhar

### Story 2.12: Error Classification & Budget Caps

As a **developer**,
I want **errors classified by type with budget caps per story**,
So that **the system handles failures intelligently and never burns unlimited resources**.

**FRs:** FR63 | **Scope:** V1

**Acceptance Criteria:**

**Given** um erro ocorre durante execucao
**When** o sistema processa o erro
**Then** classificado como transient (retry com backoff), fatal (bloqueio imediato), ou unknown (retry ate N, depois bloqueio)
**And** cada story tem budget caps: maxTokens, maxDuration, maxRetries, maxLLMCalls
**And** budget tracking em tempo real; warning a 80%; bloqueio a 100% com evento budget.exhausted
**And** codigo em src/features/orchestrator/error-classifier.ts e budget.service.ts
**And** testes: classificacao por tipo, budget tracking, bloqueio ao esgotar

### Story 2.13: Multiple Workflow Templates

As a **developer**,
I want **multiple workflow templates stored in the database**,
So that **different projects can use different development cycles**.

**FRs:** FR56 | **Scope:** Marco 0

**Acceptance Criteria:**

**Given** developer autenticado
**When** acede API de workflow templates
**Then** CRUD completo para templates com states, transitions, agentRoles, qualityGates
**And** template BMAD default no seed, marcado isDefault=true
**And** validacao: estados conectados, estado inicial e final obrigatorios
**And** templates versionados; stories usam versao do inicio
**And** templates so modificaveis via API/UI, nunca por agentes
**And** testes: CRUD, validacao de grafo, versionamento

---

## Epic 3: Development Dashboard

Developer ve board kanban, pipeline view, streaming real-time, trail auditavel e detalhes de quality gates.

### Story 3.1: Board Kanban View with Story Cards

As a **developer**,
I want **a kanban board with rich story cards**,
So that **I see the project state in 3 seconds and identify what needs attention**.

**Acceptance Criteria:**

**Given** projecto com stories
**When** /board carrega
**Then** kanban por estado: Backlog, Em Progresso, Bloqueado, Concluido; bloqueados no topo
**And** Story Card: badge estado (cor + icone, nunca so cor), fase BMAD, titulo, epico, agente, gates, tempo, tentativas
**And** 5 estados visuais: pending, in-progress (pulse), blocked, completed (checkmark), review
**And** top bar: contadores macro, badge "N precisam de atencao"
**And** load < 3s (NFR1); keyboard: J/K navegar, Enter abrir, F fire
**And** responsivo: kanban desktop, lista vertical mobile com swipe e touch 44px+
**And** TanStack Query com cache + invalidacao SSE
**And** estado vazio: mensagem + accao sugerida; loading: skeleton loaders
**And** erro conexao: banner com retry; delta markers desde ultimo acesso
**And** testes de componente
**And** vista hierarquica opcional: agrupar por Epic, com sub-agrupamento visual (Epic header colapsavel com progresso agregado: N/M stories completas)
**And** toggle entre vista plana (todas as stories) e vista hierarquica (Epic -> Stories)

### Story 3.2: Slide-over Panel & Pipeline Visualizer

As a **developer**,
I want **slide-over with pipeline visualization**,
So that **I can drill down into any story's BMAD progress**.

**Acceptance Criteria:**

**Given** board view
**When** clica Story Card
**Then** slide-over 70% desktop / 100% mobile (sheet, swipe down fecha)
**And** tabs: Pipeline, Chat, Code, Trail (placeholders excepto Pipeline)
**And** fases do workflow template como checkpoints: horizontal desktop / vertical mobile para templates lineares; DAG layout para templates com branches/parallelismo
**And** estados: completed (verde), in-progress (amarelo), blocked (vermelho), pending (cinza), skipped
**And** clique expande detalhes de fase; ESC/click-outside fecha
**And** URL deep link: /board/story/:storyId/pipeline
**And** 200ms ease-out (instantaneo se reduced-motion); role="dialog", focus trap; 1-4 tabs
**And** pipeline vazio: "Story aguardando inicio." + [Iniciar]
**And** testes de componente
**And** pipeline reflecte as fases do template associado a story (nao assume ciclo BMAD fixo)

### Story 3.3: Real-Time Activity Streaming in Dashboard

As a **developer**,
I want **real-time updates in the dashboard**,
So that **I see agent activity without manual refresh**.

**Acceptance Criteria:**

**Given** painel aberto com stories em execucao
**When** agentes activos
**Then** Story Cards, counters, pipeline atualizam em tempo real via SSE
**And** BLOCKED -> vermelho imediato; DONE -> verde + checkmark
**And** latencia < 500ms (NFR2)
**And** perda de conexao: banner "Reconectando..." com auto-retry; recovery de estado ao reconectar (NFR17, NFR23)
**And** Zustand store (useWorkflowExecutionStore) mantem estado de execucao em tempo real: story phases, agent status, gate results, budget usage
**And** SSE events atualizam Zustand store directamente; TanStack Query para server state (CRUD), Zustand para execution state (streaming)

### Story 3.4: Audit Trail & Quality Gate Details

As a **developer**,
I want **complete audit trail and gate details**,
So that **I understand every decision and verification**.

**Acceptance Criteria:**

**Given** slide-over de story aberto
**When** tab Trail
**Then** timeline cronologica: transicoes, decisoes, gates (pass/fail), intervencoes humanas
**And** cada evento: timestamp, tipo, descricao, actor; intervencoes com badge "Human"
**And** gate details: nome, resultado, output expandivel em monospace
**And** deep link para PR GitHub na fase PR e Story Card

### Story 3.5: Coverage Visualization in Quality Gate Details

As a **developer**,
I want **coverage metrics visualized per story in the quality gate details**,
So that **I see which new lines are covered, the coverage delta, and whether the coverage gate passed**.

**Acceptance Criteria:**

**Given** slide-over de story aberto com tab Trail
**When** gate de coverage executado para esta story
**Then** detalhes do gate mostram: coverage total (line, branch, function), delta antes/depois do desenvolvimento
**And** threshold visual: verde >= 80%, amarelo >= 60%, vermelho < 60% (configuraveis via Story 7.1)
**And** linhas novas sem cobertura listadas com ficheiro e numero de linha
**And** dados vindos de QualityGateResult (campo JSON com json-summary parseado)
**And** sem coverage (gate desactivado): secao nao aparece
**And** testes de componente com fixture de QualityGateResult contendo dados de coverage

### Story 3.6: ToolCallCard & WorkflowProgressCard

As a **developer**,
I want **dedicated components for tool call visibility and workflow progress**,
So that **I see exactly what each agent is doing**.

**FRs:** FR18, FR21 | **Scope:** V1

**Acceptance Criteria:**

**Given** slide-over de story aberto com agente executando
**Then** ToolCallCard inline no Chat: nome da tool, parametros colapsaveis, estado (spinner/check/X), duracao, output
**And** WorkflowProgressCard no Pipeline: fase actual, N/M gates passados, tempo na fase, budget restante
**And** WorkflowProgressCard mini-card na Story Card do board
**And** ambos consomem Zustand store (useWorkflowExecutionStore)
**And** testes de componente com fixtures de eventos SSE

### Story 3.7: Epic Container Monitor

As a **developer**,
I want **to monitor active containers, agents, and worktrees per epic**,
So that **I have visibility into resource consumption and agent orchestration**.

**FRs:** FR43, FR46 | **Scope:** V1

**Acceptance Criteria:**

**Given** epic com container activo
**Then** lista de containers com: containerId, epic, uptime, CPU/memoria, stories em execucao
**And** por container: worktrees activos com story, branch, estado
**And** por container: agentes activos com role, fase, duracao, estado
**And** accoes: forcar cleanup, ver logs
**And** dados via API GET /api/containers
**And** testes de componente com dados mockados

---

## Epic 4: Human Control & Notifications

Developer pode pausar/retomar, receber notificacoes, injectar contexto, conversar com agentes, e cancelar stories.

### Story 4.1: Pause & Resume Stories

As a **developer**,
I want **to pause and resume running stories**,
So that **I maintain control over execution**.

**Acceptance Criteria:**

**Given** story em execucao
**When** "Pausar"
**Then** PATCH /api/stories/:storyId/pause; agente terminado graciosamente; estado PAUSED; card visual; botao "Retomar"
**When** "Retomar"
**Then** PATCH /api/stories/:storyId/resume; agente re-spawna mesma fase; retoma sem reiniciar (FR7)
**And** story pausada >24h permanece pausada

### Story 4.2: Cancel Stories & Cleanup

As a **developer**,
I want **to cancel stories**,
So that **I can abandon unneeded work cleanly**.

**Acceptance Criteria:**

**Given** story em execucao ou pausada
**When** "Cancelar" + confirmacao
**Then** agente terminado, container limpo, estado CANCELLED, branch preservada
**And** evento no trail; card cinza com risco; recursos libertados

### Story 4.3: Contextual Notification System

As a **developer**,
I want **notifications with complete context and suggested actions**,
So that **I resolve blocks quickly without investigation**.

**Acceptance Criteria:**

**Given** story BLOCKED apos maxRetries
**When** detectado
**Then** notificacao < 30s (NFR4): story, fase, erro, tentativas, sugestao
**And** Notification Card no dropdown: icone estado, botoes [Injectar Contexto] [Ver Detalhes] [Dispensar]
**And** "Ver Detalhes" abre slide-over com deep link
**And** notificacao de conclusao: "Story X concluida. PR criado."
**And** config: email/webhook, nivel (bloqueios, conclusoes, tudo)

### Story 4.4: Context Injection

As a **developer**,
I want **to inject context into a blocked story for auto-resume**,
So that **I resolve blocks by providing what the agent needs**.

**Acceptance Criteria:**

**Given** story BLOCKED
**When** tab Chat no slide-over
**Then** historico resumido: ultima accao, erro, tentativas
**And** textarea para contexto; POST /api/stories/:storyId/inject
**And** processado < 10s (NFR5); story retoma automaticamente (FR7)
**And** evento de intervencao no trail
**And** opcao "Problema resolvido manualmente" retoma com re-execucao de gates

### Story 4.5: Agent Chat & Approach Redirect

As a **developer**,
I want **interactive conversation with agents and approach redirect**,
So that **I can guide agents through complex problems**.

**Acceptance Criteria:**

**Given** story em execucao ou bloqueada
**When** tab Chat
**Then** historico completo: mensagens, decisoes, artefatos inline (codigo)
**And** streaming caracter por caracter; indicador "agente pensando" (UX-DR8)
**And** scroll auto durante streaming, pausa se developer scrollou para cima
**And** input fixo bottom mobile; developer pode redirecionar abordagem (FR27)
**And** role="log", aria-live="polite"; estados: active, waiting, idle
**And** trail mostra redireccoes com contexto
**And** seletor de agente quando multiplos agentes activos na story (V1: Team Lead, Workers); Marco 0: agente unico, sem seletor
**And** cada mensagem mostra avatar/badge do agente (role + nome); mensagens de diferentes agentes visualmente distinguiveis
**And** ToolCallCard inline: tool calls do agente aparecem como card colapsavel (nome, input, output, duracao)

---

## Epic 5: Epic Orchestration

Developer pode disparar epicos inteiros com handoff deterministico.

### Story 5.1: Epic-Level Story Sequencing

As a **developer**,
I want **to trigger an entire epic with hierarchical agent orchestration**,
So that **the system autonomously manages story execution with container isolation and optional parallelism**.

**Acceptance Criteria:**

**Given** epico com N stories em BACKLOG
**When** "Iniciar Desenvolvimento"
**Then** sistema spawna container dedicado para o epic (1 container por epic)
**And** Team Lead Agent spawna dentro do container; analisa stories, decide ordem e paralelismo
**And** Team Lead spawna Worker agents em worktrees isolados dentro do container
**And** stories sem dependencia: paralelo via worktrees; stories com dependencia: sequencial (Team Lead decide)
**And** BLOCKED em qualquer story: Team Lead decide (retry, context injection, ou escalacao humana)
**And** todas completas: Team Lead merge worktrees, cria PR final do epic; epic.completed com stats
**And** eventos hierarquicos: epic.started, teamlead.decision, worker.started/completed

### Story 5.2: Trigger All Pending Epics

As a **developer**,
I want **to trigger all pending epics with a single action**,
So that **I can fire the entire project**.

**Acceptance Criteria:**

**Given** multiplos epicos em BACKLOG
**When** "Iniciar Todos"
**Then** resumo "N epicos, M stories. Iniciar?"
**And** epicos em sequencia; bloqueio num nao bloqueia outros (isolamento)
**And** accao rapida 1 clique
**And** Scrum Master Agent (SM) analisa dependencias entre epics e decide: sequencial (default), ou paralela para epics independentes
**And** SM spawna container por epic; cada container com seu Team Lead

### Story 5.3: Epic Pause, Resume & Cancel

As a **developer**,
I want **epic-level pause, resume, and cancel**,
So that **I control execution at epic level**.

**Acceptance Criteria:**

**Given** epico IN_PROGRESS
**When** "Pausar Epico"
**Then** stories activas pausadas; BACKLOG nao iniciadas; PAUSED; outros epicos continuam
**When** "Retomar"
**Then** pausadas retomam; BACKLOG elegiveis
**When** "Cancelar" + confirmacao
**Then** todas activas/pausadas/backlog canceladas; DONE preservadas; containers limpos

### Story 5.4: Team Lead Agent

As a **developer**,
I want **a Team Lead Agent that orchestrates story execution within an epic container**,
So that **stories are executed with intelligent ordering and merge coordination**.

**FRs:** FR58, FR6, FR5 | **Scope:** V1

**Acceptance Criteria:**

**Given** container de epic spawned
**When** Team Lead Agent inicia
**Then** analisa stories: dependencias, complexidade, stack requirements
**And** decide ordem e paralelismo; spawna Workers em worktrees isolados
**And** monitora Workers; quando completa: valida e merge worktree
**And** quando bloqueia: decide retry, inject, ou escalacao
**And** quando todos completam: PR final do epic
**And** Team Lead tem skills de projecto + memoria compartilhada
**And** codigo em src/features/orchestrator/team-lead.service.ts
**And** testes com workers mockados

### Story 5.5: Worktree-per-Story Isolation

As a **developer**,
I want **each story in its own git worktree within the epic container**,
So that **stories are isolated and merge conflicts manageable**.

**FRs:** FR59, FR43 | **Scope:** V1

**Acceptance Criteria:**

**Given** container com repositorio
**When** Worker inicia para story
**Then** worktree criado: git worktree add worktrees/<storyId> -b story/<storyId>-<slug>
**And** Worker opera exclusivamente no seu worktree
**And** cleanup apos complete; preservar em caso de block para debug
**And** limite configuravel de worktrees simultaneos (default: 3)
**And** codigo em src/features/sandbox/worktree.service.ts
**And** testes: criacao, isolamento, cleanup, limite

### Story 5.6: AI-Powered Merge Resolution

As a **developer**,
I want **3-tier merge for worktree conflicts**,
So that **parallel stories integrate without manual conflict resolution in most cases**.

**FRs:** FR64 | **Scope:** V1.5

**Acceptance Criteria:**

**Given** Team Lead merge worktree com conflitos
**Then** Tier 1: git merge --no-edit (auto)
**And** Tier 2: AI analisa regioes de conflito com contexto (ACs, codigo adjacente)
**And** Tier 3: AI recebe ficheiro completo de ambos lados
**And** apos cada tier: quality gates executados
**And** se todos falham: escalacao para humano com diff anotado
**And** resultado persistido no trail: tier usado, conflitos, resolucao
**And** codigo em src/features/orchestrator/merge-resolver.service.ts
**And** testes: merge sem conflito, com conflito, complexo, falha total

### Story 5.7: Post-Epic Pipeline

As a **developer**,
I want **automated post-epic pipeline that extracts learnings**,
So that **each epic makes the system smarter for the next**.

**FRs:** FR62, FR33, FR34 | **Scope:** V1

**Acceptance Criteria:**

**Given** epic completo (todas stories DONE, PR criado)
**Then** Fase 1 Retrospectiva: analisa tempo, bloqueios, retries, intervencoes
**And** Fase 2 Documentacao: atualiza project-context com novas APIs, componentes, padroes
**And** Fase 3 Skills: gera/atualiza skills via skill-creator agent
**And** Fase 4 Memoria: persiste insights no shared memory
**And** pipeline configuravel: developer pode desactivar fases
**And** resultados acessiveis no dashboard
**And** codigo em src/features/orchestrator/post-epic-pipeline.service.ts
**And** testes com epic mockado

---

## Epic 6: Project Intelligence & Brownfield Onboarding

Auto-discovery, skills, context management para onboarding de projectos existentes.

### Story 6.1: Codebase Auto-Discovery

As a **developer**,
I want **the system to analyze my codebase and generate project-context**,
So that **agents understand my project from day one**.

**Acceptance Criteria:**

**Given** projecto com repoUrl valido
**When** "Analisar Projecto"
**Then** clone em container temporario; analise de stack, estrutura, padroes, testes, CI
**And** project-context.md gerado; developer revisa e edita antes de confirmar (FR32)
**And** salvo no banco; < 5 min para repos ate 10k ficheiros

### Story 6.2: Skill Generation from Patterns

As a **developer**,
I want **automatic skill generation from codebase patterns**,
So that **agents follow conventions without manual instructions**.

**Acceptance Criteria:**

**Given** project-context gerado
**When** padroes detectados
**Then** skills geradas: naming, componentes, testes, API, config
**And** cada skill: nome, descricao, conteudo, confianca, data
**And** persistidas (FR35) e aplicadas automaticamente (FR37); developer notificado
**And** skills com stackTag (backend/frontend/infra/test) e roleTarget (dev/reviewer/qa)
**And** skills pre-carregadas no agente conforme seu role; DISTINTAS de shared memory

### Story 6.3: Skill Generation from Human Corrections

As a **developer**,
I want **skills generated from my corrections**,
So that **the system never repeats the same mistake**.

**Acceptance Criteria:**

**Given** intervencao resolve bloqueio
**When** story completa
**Then** skill gerada: "Quando [contexto], usar [abordagem]"
**And** fonte: human_correction; aplicada em stories futuras do mesmo dominio (FR34)

### Story 6.4: Skill Management

As a **developer**,
I want **to manage system-generated skills**,
So that **I control what the system learns**.

**Acceptance Criteria:**

**Given** Configuracoes > Skills
**When** carrega
**Then** lista: nome, fonte, confianca, data
**And** editar, desactivar, apagar, criar manual; filtros; CRUD API

### Story 6.5: Automatic Context Feed to Agents

As a **developer**,
I want **agents automatically fed with project context and skills**,
So that **they work with full context without repeated instructions**.

**Acceptance Criteria:**

**Given** agente spawned
**When** container inicia
**Then** contexto injectado em 3 camadas: (1) project-context.md, (2) skills filtradas por stackTag e roleTarget, (3) shared memory queries relevantes
**And** interface ContextPayload com campos separados: projectContext, skills[], memoryEntries[]
**And** contexto optimizado; agente segue convencoes
**And** team auto-configurado por stack (FR53)

### Story 6.6: Shared Memory Service

As a **developer**,
I want **per-project shared memory that all agents can read and write**,
So that **knowledge persists across stories and epics**.

**FRs:** FR60 | **Scope:** V1

**Acceptance Criteria:**

**Given** projecto com agentes em execucao
**Then** MemoryEntry: id, projectId, category (architecture_decision, tech_debt, pattern, lesson_learned, convention), content, source, relevanceScore
**And** API POST/GET /api/projects/:projectId/memory; agentes escrevem via tool dedicada
**And** busca por relevancia; deduplicacao contra existentes
**And** developer pode ver, editar, apagar via UI
**And** limite por projecto com eviction LRU (default 500)
**And** codigo em src/features/intelligence/memory.service.ts
**And** testes: CRUD, query, deduplicacao, eviction

### Story 6.7: skill-creator Agent

As a **developer**,
I want **a skill-creator agent that evolves project skills automatically**,
So that **skills improve without manual curation**.

**FRs:** FR61, FR33, FR53 | **Scope:** V1

**Acceptance Criteria:**

**Given** projecto com project-context
**When** setup inicial ou pipeline pos-epic
**Then** skill-creator analisa context e gera skills por stack e role
**And** apos retrospectiva: analisa correccoes, novos patterns, lessons learned
**And** cria novas skills ou atualiza existentes com confianca ajustada
**And** skills com confianca < threshold marcadas para revisao humana
**And** skill evolution log: historico por skill
**And** codigo em src/features/intelligence/skill-creator.service.ts
**And** testes: geracao inicial, evolucao, confianca, threshold

### Story 6.8: Skill-per-Stack Specialization

As a **developer**,
I want **skills organized by stack so agents receive only relevant instructions**,
So that **a backend agent gets Prisma skills while frontend gets React skills**.

**FRs:** FR37, FR53 | **Scope:** V1

**Acceptance Criteria:**

**Given** projecto com skills geradas
**When** agente spawned com role e stack
**Then** skill resolution filtra por stackTag e roleTarget
**And** stacks pre-definidos: backend, frontend, test, infra (extensivel)
**And** prioridade: skill especifica > generica; maior confianca > menor
**And** budget de skills por agente: max N ordenadas por prioridade
**And** codigo em src/features/intelligence/skill-resolver.service.ts
**And** testes: filtragem, prioridade, budget

---

## Epic 7: Configuration, Metrics & Extensibility

Controlo total sobre quality gates, workflows, providers, metricas e estimativas.

### Story 7.1: Quality Gate Configuration

As a **developer**,
I want **to configure quality gates per project**,
So that **verification matches my project's needs**.

**Acceptance Criteria:**

**Given** Configuracoes > Quality Gates
**When** carrega
**Then** gates: test-runner, lint, typecheck, app-start, acceptance, coverage; activar/desactivar por transicao
**And** parametros: maxRetries, timeout, comando custom, coverageThreshold (para gate coverage: line/branch/function thresholds)
**And** additive-only (FR54); aplicadas a stories futuras

### Story 7.2: Workflow Template Configuration

As a **developer**,
I want **to configure BMAD workflow phases per project**,
So that **the cycle adapts to different needs**.

**Acceptance Criteria:**

**Given** Configuracoes > Workflow
**When** carrega
**Then** template visual com fases e transicoes; activar/desactivar fases opcionais
**And** parametros por fase: modelo LLM, prompt, max duration
**And** pontos de extensao por projecto (FR54); versionado
**And** lista de workflow templates do projecto; seleccionar para editar ou criar novo
**And** editor visual com ReactFlow: nodes (fases) e edges (transicoes) arrastaveis
**And** Marco 0: editor simplificado (lista de fases com toggle); V1: ReactFlow completo

### Story 7.3: Utilization Metrics Dashboard

As a **developer**,
I want **utilization metrics**,
So that **I understand platform performance**.

**Acceptance Criteria:**

**Given** Dashboard de Metricas
**When** carrega
**Then** stories processadas, intervencoes, tokens, tempo medio, metricas por fase
**And** filtros por periodo; grafico stories/semana; ratio autonomia (target >=70%)
**And** top blockers; dados de StoryEvent e QualityGateResult

### Story 7.4: Full Provider Configuration

As a **developer**,
I want **multi-provider configuration with failover chain**,
So that **I optimize cost, quality, and reliability**.

**Acceptance Criteria:**

**Given** Configuracoes > Providers
**When** carrega
**Then** providers com key mascarada; adicionar novos; failover chain drag-and-drop
**And** modelo preferido por role; timeouts configuraveis (NFR21)
**And** teste de conectividade; credenciais encriptadas (NFR9, NFR10)
**And** por provider: lista de API keys (Account Pool) com status, score, usage count
**And** metricas por key: requests/hora, rate limits atingidos, latencia media

### Story 7.5: Integrated Diff Viewer & PR Approval (V1.5+)

As a **developer**,
I want **to review diffs and approve PRs from the platform**,
So that **I complete the review cycle without leaving**.

**Acceptance Criteria:**

**Given** story DONE com PR
**When** tab Code no slide-over
**Then** diff side-by-side (desktop) / unified (mobile); inline comments
**And** "Aprovar" ou "Pedir Mudancas" 1 clique; batch "Aprovar Todos"
**And** keyboard: A aprovar, J/K hunks

### Story 7.6: History-Based Estimates (V1.5+)

As a **developer**,
I want **flow duration estimates from historical data**,
So that **I can plan my time**.

**Acceptance Criteria:**

**Given** historico >= 10 stories
**When** dispara epico/story
**Then** estimativa: "N stories, ~Y horas" baseada em tempos, bloqueios, complexidade
**And** sem historico: "Primeiro fluxo — sem estimativa"; refina progressivamente

### Story 7.7: Account Pool Manager UI

As a **developer**,
I want **a dashboard for managing the account pool**,
So that **I have visibility and control over API key usage and rotation**.

**FRs:** FR57, FR49 | **Scope:** V1

**Acceptance Criteria:**

**Given** Configuracoes > Account Pool
**Then** tabela de ProviderAccounts: provider, key mascarada, score (barra), status (badge), usage, lastUsed
**And** historico de rotacao: timeline de swaps com razao
**And** graficos: usage por key, rate limits por dia
**And** accoes: adicionar, desactivar, forcar cooldown, remover
**And** alertas: key prestes a expirar, todas em cooldown
**And** testes de componente

### Story 7.8: Skill Manager Panel

As a **developer**,
I want **a full skill management panel organized by stack/role**,
So that **I control what the system learned and how skills evolve**.

**FRs:** FR36, FR33 | **Scope:** V1

**Acceptance Criteria:**

**Given** Configuracoes > Skills
**Then** skills organizadas por stackTag e roleTarget
**And** cada skill: nome, confianca (barra), fonte, evolucao, stories que usaram
**And** filtros por stack, role, confianca, fonte
**And** accoes: criar, editar, duplicar, desactivar, apagar
**And** indicator de skills pendentes de revisao humana
**And** testes de componente
