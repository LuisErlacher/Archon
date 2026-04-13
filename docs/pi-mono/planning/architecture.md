---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: complete
completedAt: "2026-04-09"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/product-brief-pi-mono.md"
  - "_bmad-output/planning-artifacts/product-brief-pi-mono-distillate.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/project-context.md"
  - "docs/index.md"
workflowType: 'architecture'
project_name: 'pi-mono'
user_name: 'Luis'
date: '2026-04-09'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

54 FRs organizados em 8 dominios que mapeiam directamente para componentes arquitecturais:

| Dominio | FRs | Implicacao Arquitectural |
|---------|-----|--------------------------|
| Development Orchestration | FR1-FR8 | Orchestrator service com state machine por story/epic, handoff deterministico entre fases BMAD |
| Quality Assurance & Verification | FR9-FR15 | Quality gate engine que parseia resultados reais (stdout/stderr), retry com escalacao, code review adversarial |
| Painel & Monitoring | FR16-FR21 | Frontend real-time com board kanban, pipeline view, streaming de eventos, trail auditavel |
| Human Intervention & Control | FR22-FR29 | Pausa/retoma granular (story e epic), notificacoes contextuais com accoes sugeridas, injecao de contexto |
| Project Onboarding & Context | FR30-FR37 | Auto-discovery de codebase, geracao de project-context e skills, persistencia e aplicacao automatica |
| Code Review & Delivery | FR38-FR42 | Integracao GitHub bidirecional (branches, PRs), diff viewer integrado (V1.5+) |
| Agent Execution & Isolation | FR43-FR48 | Container sandbox efemero por story, credenciais seguras, crash recovery via git checkpoint, provider failover |
| Platform Configuration | FR49-FR54 | Configuracao por projecto (providers, quality gates, workflows), team de agentes auto-configurado |

**Non-Functional Requirements:**

26 NFRs agrupados em 4 categorias com impacto directo na arquitectura:

- **Performance (NFR1-7):** Painel <3s load, streaming <500ms latencia, accao <2s, notificacao bloqueio <30s, transicao gate <60s, UI responsiva
- **Security (NFR8-13):** Containers com rede limitada, credenciais nunca em logs/output, encriptacao at-rest, isolamento filesystem/rede entre containers, auth com tokens expiraveis
- **Reliability (NFR14-19):** Crash recovery <1 task perdida (git checkpoint), failover provider <5s, uptime 99% (V1.5+), reconexao frontend sem perda, eventos idempotentes, dados criticos em armazenamento duravel
- **Integration (NFR20-23):** GitHub API com backoff exponencial, timeouts configuraveis por provider, Docker health-check pre-spawn, EventStream com reconexao e estado actual

**Scale & Complexity:**

- Dominio primario: full-stack (web app + orquestracao backend + container management)
- Nivel de complexidade: media-alta
- Componentes arquitecturais estimados: 8-12 (orchestrator, quality gate engine, agent runtime/sandbox, event streaming, frontend SPA, GitHub integration, project context/skills engine, notification service, configuration store, session/state persistence)

### Technical Constraints & Dependencies

**Constraints do motor pi-mono (nao negociaveis):**
- TypeScript ESM, ES2022, strict mode
- EventStream com 9+ eventos tipados como contrato backend-frontend
- Sessoes JSONL com tree e fork como propriedade da plataforma
- Provider pluggavel com failover chain (17+ providers via pi-ai)
- Extension system via jiti com hooks em agent, turn, message, tool, session
- RPC mode (JSON-RPC stdin/stdout) para operacao headless

**Constraints de stack (alinhamento com pi-mono existente):**
- Frontend: Lit Web Components + Tailwind CSS 4 (pi-web-ui ja existe)
- Backend: Node.js 22+, TypeScript ESM
- Build: tsgo (TypeScript Go compiler preview)
- Lint/Format: Biome (tabs, indent 3, line width 120)
- Testes: Vitest
- CI: GitHub Actions (Node 22, ubuntu-latest)

**Constraints de design:**
- Dark mode first, light mode disponivel
- Desktop-first design, mobile-complete funcionalidade
- Layout hybrid board + slide-over (decisao UX ja tomada)
- Design tokens via Tailwind config, padroes shadcn/ui como referencia
- WCAG 2.1 AA

**Dependencias externas:**
- GitHub API (PRs, branches, commits, status checks)
- LLM Provider APIs (Anthropic, OpenAI, Google, Mistral, Bedrock + 12 outros)
- Docker runtime (containers efemeros por story)

### Cross-Cutting Concerns Identified

1. **Event Streaming.** Permeia toda a arquitectura: agente emite eventos -> orchestrator processa -> frontend renderiza em tempo real. O EventStream do pi-mono (9+ eventos tipados) e o contrato base, mas a plataforma precisa de estender com eventos de orquestracao (story state transitions, quality gate results, escalation events). Reconexao sem perda de eventos criticos (NFR23).

2. **Seguranca e Isolamento.** Container sandbox efemero por story com rede limitada. Credenciais injectadas via env vars efemeras, nunca em logs/output. Isolamento filesystem/rede entre containers. Auth com tokens expiraveis. Implicacao: cada componente que toca em credenciais ou containers precisa de security review.

3. **State Management e Crash Recovery.** Git como checkpoint — estado so avanca apos commit+push confirmado. Eventos de orquestracao persistidos com idempotencia. Dados criticos (sprint-status, story files, skills) fora do container. Implicacao: pattern de event sourcing ou state machine persistido para orquestracao.

4. **Provider Abstraction e Failover.** 17+ providers LLM com failover chain configuravel. Timeout configuravel por provider. Plataforma nunca para por indisponibilidade de um unico provider. Account Pool Manager com scoring algorithm (0-1) que ranqueia credenciais por confiabilidade. Swap proativo via polling a cada 30s (detecta cooldown/rate-limit antes de falhar). Swap reativo em <5s quando recebe 429/401. Implicacao: circuit breaker pattern, health monitoring de providers, account pool como camada entre orchestrator e provider.

5. **Auto-aprendizado e Contexto Cumulativo.** Skills geradas a partir de padroes e correccoes humanas. Project-context auto-gerado por codebase scan. Cada correccao humana e sinal de aprendizado. Pipeline pos-epic (retrospectiva): analisa diferencas entre output esperado e real, extrai licoes, gera/atualiza skills automaticamente. Shared Memory como canal lateral distinto de skills — armazena conhecimento cross-agent dentro de um epic (ex: decisoes de API, padroes descobertos) com escopo e expiracao. Skills sao persistentes e versionadas; shared memory e efemera por epic. Implicacao: pipeline de ingestao de sinais -> geracao de skills -> aplicacao automatica. Storage persistente e versionado de skills e contexto. Shared memory como store separado com TTL.

6. **Evolucao Multi-fase.** V1 single-tenant single-user -> V1.5 cloud multi-projecto -> V2+ multi-user RBAC -> V3+ multi-tenant. Implicacao: abstraccoes de tenant/user/projecto desde V1 mesmo que single-tenant, para evitar redesign. Dados isolados por projecto desde o inicio.

7. **Hierarquia Multi-Agent.** Scrum Master (SM) orquestra epics. Cada epic recebe um container dedicado com Team Lead agent que coordena Workers (um por story). Cada Worker opera num worktree git isolado dentro do container. Comunicacao hierarquica: SM -> Team Lead -> Workers, com Shared Memory como canal lateral. Implicacao: container-per-epic com worktree-per-story como dupla camada de isolamento.

## Starter Template Evaluation

### Dominio Tecnologico Primario

Full-stack web application (painel + orquestracao backend + container management), construida como pacote (`packages/ai-factory`) dentro do monorepo pi-mono.

### Abordagem de Projeto: Pacote no Monorepo

**Decisao:** Pacote `packages/ai-factory` dentro do monorepo pi-mono, usando npm workspaces como os demais pacotes. pi-mono e o motor de agentes; ai-factory e a aplicacao completa construida sobre ele.

**Racional:**
- Agentes AI operam num unico workspace — acesso directo ao motor e plataforma sem troca de contexto
- CI/CD unificado — uma pipeline para lint, typecheck, testes, build e deploy de todos os pacotes
- Iteracao rapida — mudancas no motor (pi-mono) e na plataforma (ai-factory) no mesmo PR
- Futuro multi-engine (claude-code, opencode) via abstraction layer, sem mudar estrutura de repo
- Lockstep versioning com pi-mono (consistencia de releases)
- Camada de abstracao fina nos pontos de contacto com o motor — se precisar trocar engine, o impacto e isolado

**Dependencias do pi-mono (via workspace):**
- `@mariozechner/pi-ai` — API LLM unificada, providers, streaming
- `@mariozechner/pi-agent-core` — Agent loop, tool calling, EventStream, sessoes
- `@mariozechner/pi-coding-agent` — Agente de codificacao (RPC mode para operacao headless)
- `@mariozechner/pi-web-ui` — Web Components Lit para interfaces de chat (reutilizar componentes existentes)

### Stack Tecnica Selecionada

**Linguagem & Runtime:**
- TypeScript ESM, ES2022, strict mode (alinhado com pi-mono)
- Node.js 22+
- Build: tsgo (mesmo do pi-mono)
- Lint/Format: Biome (tabs, indent 3, line width 120)

**API Framework: Hono**
- Leve (~14KB), TypeScript-first, performance excelente
- `@hono/zod-openapi` para gerar OpenAPI spec automaticamente a partir de schemas Zod
- Hono RPC para type-safety end-to-end com frontend TypeScript (como tRPC, sem code generation)
- Suporte nativo a WebSocket para streaming real-time
- Roda em Node.js, compativel com Docker e Kubernetes

**Validacao: Zod**
- Integracao nativa com Hono (`@hono/zod-openapi`) e Prisma (`zod-prisma-types`)
- Ecossistema vasto, DX superior
- Zod v4 com JIT para performance otimizada
- Gera OpenAPI spec automaticamente — contratos tipados do backend ao frontend

**ORM: Prisma 7**
- Schema-first com migracoes automaticas (`prisma migrate`)
- Prisma 7 reescrito em TypeScript (sem binario Rust, de 14MB para 1.6MB)
- Suporte nativo SQLite e PostgreSQL com troca transparente
- Tipos gerados automaticamente do schema
- Prisma Studio para debugging visual
- MCP server disponivel para integracao com agentes

**Database:**
- **Desenvolvimento e testes:** SQLite — simples, agil, zero setup, ficheiro local
- **Deploy/producao:** PostgreSQL — robusto, escalavel, suporta concorrencia
- Troca transparente via Prisma (mesmo schema, driver diferente)

**Frontend:**
- Lit Web Components + Tailwind CSS 4 (alinhado com pi-web-ui)
- Design tokens via Tailwind config
- Padroes shadcn/ui como referencia de design (nao dependencia)
- Dark mode first

**Testes:**
- Vitest (alinhado com pi-mono)
- Testes de integracao com SQLite em memoria

**CI/CD:**
- GitHub Actions (Node 22, ubuntu-latest)

### Infraestrutura: Docker Local / Kubernetes Producao

- **Local:** Docker Compose para subir a stack (app + SQLite + containers de sandbox)
- **Producao:** Kubernetes com manifests/Helm charts
- **Decisao arquitetural:** Containerizar a aplicacao desde o inicio com Dockerfile multi-stage. O mesmo container roda em Docker Compose (local) e K8s (producao) sem refatoracao
- Sandbox agents: containers efemeros geridos pela plataforma, tanto em Docker (local) quanto em K8s (producao via Jobs/Pods)

### Cadeia de Contratos Tipados

```
Prisma Schema (.prisma)
    | prisma generate
    v
Prisma Client (tipos do DB)
    | usados em
    v
Zod Schemas (validacao de request/response)
    | via @hono/zod-openapi
    v
Hono Routes (API tipada + OpenAPI spec gerado)
    | via Hono RPC
    v
Frontend Lit (type-safe, sem code generation)
```

Cada camada e validada pela anterior. Erro no schema Prisma -> erro de tipo no Zod -> erro de tipo no Hono -> erro de tipo no frontend. Tudo em compile-time.

### Geracao de Clientes API

- **Interno (frontend):** Hono RPC — type-safety end-to-end sem code generation
- **OpenAPI spec:** Gerado automaticamente pelo `@hono/zod-openapi`
- **Externo (futuro):** Orval disponivel como fallback para gerar clientes a partir do OpenAPI spec

### Estrutura de Projeto Proposta

```
packages/ai-factory/
├── package.json          # workspace package, herda biome/tsconfig do root
├── tsconfig.json         # extends ../../tsconfig.base.json
├── prisma/
│   └── schema.prisma
├── docker/
│   ├── Dockerfile        # build context: monorepo root (../../)
│   └── docker-compose.yml
├── k8s/
│   └── manifests/
├── src/
│   ├── orchestrator/
│   ├── quality-gates/
│   ├── sandbox/
│   ├── streaming/
│   ├── github/
│   ├── context/
│   ├── notifications/
│   ├── team-lead/
│   ├── account-pool/
│   ├── shared-memory/
│   ├── skill-creator/
│   ├── retrospective/
│   ├── workflow-templates/
│   ├── config/
│   ├── db/
│   ├── api/
│   └── web/
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       ├── views/
│       └── styles/
└── test/
```

**Nota:** A inicializacao do pacote e configuracao do workspace sera a primeira story de implementacao.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Bloqueiam Implementacao):**
- Workflow Template Engine + State Machine Transacional
- Stack frontend (React 19 + shadcn/ui + TanStack)
- API framework (Hono + Zod + OpenAPI)
- ORM e database (Prisma 7, SQLite/PostgreSQL)
- Comunicacao orquestrador <-> sandbox (AgentRuntime abstraction)
- Container runtime (Docker local / K8s producao)

**Important Decisions (Moldam Arquitetura):**
- Auth (JWT simples V1, RBAC futuro)
- Seguranca de containers (network policy, credenciais efemeras)
- Streaming (SSE para eventos com endpoints escopados, HTTP REST para acoes)
- Error handling padronizado (codigos tipados Zod, classificacao transient/fatal/unknown, budget caps maxBudgetUsd)
- Monitoring e logging (JSON estruturado)
- Account Pool Manager (scoring algorithm, swap proativo 30s, swap reativo 429/401, credential vault)
- Hierarquia multi-agent (SM -> Team Lead -> Workers, container-per-epic, worktree-per-story)
- Shared Memory vs Skills (shared memory efemera por epic para comunicacao lateral, skills persistentes e versionadas para aprendizado)
- Zustand para estado real-time (SSE de alta frequencia) + TanStack Query para CRUD server state

**Deferred Decisions (Pos-MVP):**
- Caching (Redis quando PostgreSQL + multi-user)
- Vault externo (quando multi-tenant)
- WebSocket (se chat bidirecional real-time for necessario)
- SSR (se SEO ou performance de first load virar problema)
- Observabilidade avancada (Prometheus/Grafana/Loki)

### Data Architecture

**Workflow Template Engine:**
- Multiplos templates de workflow configuraveis persistidos no banco (Prisma) — NUNCA no repositorio
- Estados, transicoes, quality gates e agent roles definidos como dados, nao codigo
- Templates so podem ser criados e modificados via tools/API — nunca editando ficheiros diretamente
- Template BMAD (create-story -> dev -> review -> QA -> PR) como default instalado automaticamente
- Mapeamento de estados para plataformas externas (Azure DevOps, Linear, GitHub Projects)
- Versionamento de templates com migracao de stories em andamento
- Visual Workflow Builder: editor ReactFlow bidirecional — arrastar estados, conectar transicoes, configurar gates visualmente. Alteracoes no visual refletem no modelo e vice-versa

**Modelo do Template:**
```
Workflow Template (persistido no banco)
+-- States[] (ex: backlog, dev, review, QA, done, blocked, custom...)
+-- Transitions[] (ex: backlog->dev, dev->review, review->QA...)
|   +-- source_state
|   +-- target_state
|   +-- quality_gates[] (checagens obrigatorias para esta transicao)
|   +-- agent_role (qual agente executa nesta fase)
|   +-- requires_human_approval: boolean
+-- External Mappings[] (mapeamento para Azure DevOps, Linear, etc.)
|   +-- platform
|   +-- internal_state -> external_state
|   +-- sync_direction (in, out, bidirectional)
+-- Metadata (nome, descricao, projeto, versao)
+-- Visual Builder Metadata
|   +-- nodes[] (posicoes x,y de cada estado no canvas)
|   +-- viewport (zoom, pan position)
|   +-- layout_version (para migracao de formato visual)
```

**Novos Modelos de Dados:**

AccountPool (credenciais LLM com scoring)
- id: string (CUID2)
- projectId: string (FK Project)
- provider: string (anthropic, openai, google, etc.)
- label: string (descricao amigavel)
- credentialsEncrypted: string (JSON encriptado)
- status: enum (ACTIVE, COOLDOWN, DISABLED, RATE_LIMITED)
- score: float (0-1, calculado por scoring algorithm)
- cooldownUntil: DateTime?
- usageStats: JSON (requests, tokens, erros nas ultimas 24h)
- lastUsedAt: DateTime
- createdAt, updatedAt: DateTime

SharedMemoryEntry (comunicacao cross-agent)
- id: string (CUID2)
- projectId: string (FK Project)
- epicId: string? (FK Epic, escopo opcional)
- key: string (chave estruturada, ex: "api-patterns.auth")
- content: string (conteudo livre, markdown)
- sourceAgentId: string
- sourceStoryId: string?
- tags: string[]
- expiresAt: DateTime?
- createdAt, updatedAt: DateTime
- @@unique([projectId, key])

SkillVersion (versionamento de skills)
- id: string (CUID2)
- skillId: string
- version: int
- content: string
- source: enum (HUMAN, RETROSPECTIVE, CORRECTION, DISCOVERY)
- confidence: float (0-1)
- sourceStoryId: string?
- changelog: string?
- createdAt: DateTime

WorktreeState (worktrees git dentro de containers)
- id: string (CUID2)
- containerId: string
- storyId: string (FK Story)
- branch: string
- worktreePath: string
- status: enum (CREATING, ACTIVE, MERGING, MERGED, FAILED, CLEANED)
- mergeStrategy: enum? (AUTO_GIT, AI_CONFLICT_REGIONS, AI_FULL_FILE)
- createdAt, updatedAt: DateTime
- @@unique([containerId, storyId])

**State Machine Transacional:**
- Cada transicao e atomica (DB transaction com optimistic locking via version field)
- Quality gates validados dentro da transacao
- Evento de transicao inserido no log append-only (trail auditavel)
- Outbox pattern para sync com plataformas externas e notificacoes (processados apos commit)
- Se gates falham: retry_count incrementado; apos max_retries, transicao para "blocked" com escalacao

**Padrao de Transicao Atomica:**
```
BEGIN TRANSACTION
  1. Validar que story esta no source_state esperado (optimistic locking via version)
  2. Executar quality gates da transicao
  3. Se gates passam:
     a. Atualizar estado da story (source -> target)
     b. Incrementar version (previne conflito concorrente)
     c. Inserir evento de transicao no log (append-only)
     d. Inserir evento no outbox (para notificacoes e sync externo)
  4. Se gates falham:
     a. Inserir evento de falha no log
     b. Incrementar retry_count
     c. Se retry_count >= max_retries: transicao para "blocked"
COMMIT TRANSACTION

-- Apos commit (fora da transacao):
5. Emitir evento via SSE para frontend (real-time)
6. Processar outbox: sync com plataformas externas, notificacoes
```

**ORM: Prisma 7**
- Schema-first com migracoes automaticas
- Prisma 7 reescrito em TypeScript (1.6MB, sem binario Rust)
- SQLite (dev/testes) e PostgreSQL (producao) com troca transparente
- Tipos gerados automaticamente do schema
- Validacao Zod na startup para fail-fast

**Caching:** Sem caching dedicado para V1. SQLite local e suficiente. Avaliar Redis em V1.5+ se latencia virar problema.

### Authentication & Security

**Autenticacao:**
- JWT simples para V1 (token gerado no setup, claims com role para RBAC futuro)
- Middleware de auth no Hono pronto para V2+ (login real, OAuth)
- Claims JWT: userId, role (developer | tech_lead | po | admin), projectIds

**Seguranca de Containers Sandbox:**
- Network policy: container so acessa GitHub API e LLM providers autorizados
- Docker: custom network com regras iptables. K8s: NetworkPolicy nativa
- Credenciais: environment variables efemeras, injetadas no spawn, nunca em logs ou EventStream
- Filesystem: volume isolado por container, destruido apos conclusao
- Recursos: limites de CPU/memoria por container

**Gestao de Credenciais:**
- V1: Account Pool como credential vault — credenciais encriptadas no banco via AccountPool model
- Account Pool substitui campos de credencial avulsos: todas as chaves LLM vivem no pool com scoring e rotacao
- V2+: migrar para vault externo (Infisical/HashiCorp Vault) quando multi-tenant

**Anti-Hallucination:**
- Agentes NUNCA inventam resultados de quality gates — gates executam comandos reais e parseiam stdout/stderr
- Agentes NUNCA editam workflow templates diretamente — apenas via API/tools que validam transicoes
- Workers NUNCA acessam worktrees de outras stories — isolamento por path e permissoes

**Isolamento de Worktrees:**
- Cada worker recebe apenas o path do seu worktree. Acesso a outros paths e bloqueado
- Merge entre worktrees e operacao exclusiva do Team Lead, nunca de workers individuais

### API & Communication Patterns

**Streaming Real-Time: SSE**
- SSE (Server-Sent Events) para streaming de eventos (alinhado com EventStream do pi-mono)
- HTTP REST para acoes do developer (pausar, retomar, injetar contexto)
- Sem WebSocket em V1 — SSE + REST cobre todos os casos
- Reconexao nativa (EventSource API) + endpoint HTTP para estado atual apos reconexao

**Comunicacao Orquestrador <-> Sandbox Agents:**
```typescript
type AgentRole = "scrum-master" | "team-lead" | "worker"

// Hierarquia: SM -> Team Lead -> Workers
// SM: 1 por projeto, orquestra epics
// Team Lead: 1 por epic, coordena workers dentro do container
// Worker: 1 por story, opera num worktree isolado

interface AgentRuntime {
   // Container lifecycle (1 container por epic)
   spawnContainer(epicId: string, config: ContainerConfig): Promise<ContainerHandle>
   destroyContainer(handle: ContainerHandle): Promise<void>

   // Worktree lifecycle (1 worktree por story, dentro do container)
   createWorktree(container: ContainerHandle, storyId: string, branch: string): Promise<WorktreeHandle>
   mergeWorktree(handle: WorktreeHandle, strategy: MergeStrategy): Promise<MergeResult>
   cleanWorktree(handle: WorktreeHandle): Promise<void>

   // Agent lifecycle
   spawnAgent(container: ContainerHandle, role: AgentRole, config: AgentConfig): Promise<AgentHandle>
   send(handle: AgentHandle, message: AgentMessage): Promise<void>
   onEvent(handle: AgentHandle, callback: (event: AgentEvent) => void): void
   terminate(handle: AgentHandle): Promise<void>

   // Account Pool
   selectAccount(provider: string): Promise<AccountSelection>
   reportAccountIssue(accountId: string, error: AccountError): Promise<void>
}

interface IPlatformAdapter {
   // Abstrai Docker vs Kubernetes
   createContainer(config: ContainerConfig): Promise<string>
   execInContainer(containerId: string, cmd: string[]): Promise<ExecResult>
   destroyContainer(containerId: string): Promise<void>
   getContainerStatus(containerId: string): Promise<ContainerStatus>
}

// Implementacoes:
// DockerLocalRuntime — spawn container, comunica via stdin/stdout
// KubernetesRuntime — spawn pod/job, comunica via HTTP/SSE
```

**Error Handling:**
- Codigos de erro tipados em Zod (enum, nao strings livres)
- HTTP status codes semanticos (400, 404, 409 conflito de versao, 503 provider indisponivel)
- Resposta de erro padronizada com schema Zod validado (code, message, details, storyId, retryable)
- Classificacao de erros: transient (retry automatico com backoff), fatal (escala para humano), unknown (loga e escala)
- Budget caps por story/epic: maxBudgetUsd configuravel. Quando atingido, story vai para blocked com motivo "budget_exceeded"
- Error tracker pattern: cada story acumula erros. Apos N erros transient consecutivos, reclassifica como fatal e escala

### Frontend Architecture

**Framework: React 19 + Vite**
- React 19 para componentes e hooks
- Vite para build, dev server e HMR (sem Next.js — nao precisa de SSR)
- Justificativa: padronizacao maxima para desenvolvimento agentico. Um padrao de hooks para tudo. Agentes AI conhecem React melhor que qualquer outro framework.

**Componentes: shadcn/ui**
- 50+ componentes prontos, todos seguindo o mesmo padrao
- Codigo copiado para o projeto (nao dependencia) — customizavel sem sair do padrao
- Componentes custom seguem o mesmo padrao (cva para variantes, mesma estrutura)
- Componentes do pi-web-ui (Lit Web Components) consumidos dentro de React onde fizer sentido (interoperaveis)

**Estado:**
- Estado do servidor (CRUD): TanStack Query (cache, loading, errors, mutations, retry, invalidacao)
- Estado real-time (execucao): Zustand stores para dados efemeros de alta frequencia:
  - `workflow-live` store: estados de execucao de stories em tempo real
  - `agent-stream` store: mensagens e tool calls do agente ativo
  - `account-pool` store: status de contas LLM, swaps, cooldowns
  - `notification` store: notificacoes com prioridade e accoes
- Estado local: useState / useReducer (UI state: slide-over, tab ativa, selecao)
- SSE -> Zustand stores (atualiza estado real-time) + TanStack Query invalidation (revalida CRUD)
- Regra: TanStack Query para dados que vem de REST. Zustand para dados que vem de SSE em alta frequencia

**Routing: TanStack Router**
- Type-safe, file-based routing
- Integra com TanStack Query (loader pattern)
- URLs refletem estado (/board, /board/story-123/pipeline) para deep links e refresh

**Cadeia de Contratos Tipados End-to-End:**
```
Prisma Schema -> Prisma Client (tipos DB)
  -> Zod Schemas (validacao request/response)
  -> Hono Routes (@hono/zod-openapi: API tipada + OpenAPI spec)
  -> Hono RPC (hc client: type-safe fetch)
  -> TanStack Query (useQuery/useMutation: cache + loading + errors)
  -> shadcn/ui componentes (render padronizado)
```

**Styling: Tailwind CSS 4**
- Design tokens via Tailwind config (cores, tipografia, espacamento da UX spec)
- Dark mode first (classe dark)
- Padroes shadcn/ui como referencia de design

### Infrastructure & Deployment

**Container Runtime (container-per-epic, worktree-per-story):**
- Modelo: 1 container por epic. Dentro do container, 1 worktree git por story. Team Lead agent coordena workers no mesmo container
- Docker local: Docker Engine API via dockerode. Spawn container por epic, criar worktrees, limitar recursos, destruir apos epic
- K8s producao: Jobs efemeros com limites, NetworkPolicy, volume persistente durante epic
- Containerizacao desde o inicio: Dockerfile multi-stage. Mesmo container em Docker Compose (local) e K8s (producao)
- Lifecycle: spawn container -> clone repo -> Team Lead inicia -> cria worktrees por story -> workers operam -> merge worktrees -> destroy container
- AI-Powered Merge (3 tiers):
  1. AUTO_GIT: merge automatico via git. Se sem conflitos, aceita direto
  2. AI_CONFLICT_REGIONS: agente resolve apenas as regioes com conflito marcadas pelo git
  3. AI_FULL_FILE: agente reescreve ficheiros inteiros quando conflitos sao complexos demais para resolucao parcial

**Monitoring e Logging:**
- Logs estruturados em JSON (timestamp, level, component, storyId, eventType)
- V1: stdout (Docker logs) + trail auditavel no banco (Prisma)
- V1.5+: Prometheus/Grafana (metricas), Loki (logs centralizados)

**Configuracao de Ambientes:**
- Environment variables para configuracao sensivel
- Arquivo de configuracao (YAML/JSON) para configuracao de projeto
- .env.local, .env.staging, .env.production com validacao Zod no startup (fail-fast)
- Prisma gerencia migrations entre ambientes

**CI/CD: GitHub Actions**
```
Push to main
  -> Lint (Biome) + Type check (tsgo) + Testes (Vitest + SQLite)
  -> Build (Vite frontend + tsgo backend)
  -> Docker build (multi-stage)
  -> Push image to registry
  -> K8s deploy (manifests/Helm)
```

### Decision Impact Analysis

**Sequencia de Implementacao:**
1. Setup do projeto (repo, Prisma, Hono, React+Vite, Tailwind, shadcn/ui)
2. Schema Prisma + migracoes (workflow template, stories, events, config, account pool, shared memory)
3. API Hono + Zod schemas + OpenAPI
4. Frontend shell (React + TanStack Router + shadcn/ui layout + Zustand stores)
5. Account Pool Manager (CRUD + scoring algorithm + swap proativo/reativo)
6. Orchestrator + state machine transacional
7. AgentRuntime — container-per-epic (Docker local primeiro)
8. Team Lead agent + worktree-per-story lifecycle
9. Quality gate engine
10. SSE streaming (endpoints escopados) + Zustand integration
11. Board view + Story card + Pipeline visualizer
12. GitHub integration (branches, PRs)
13. Shared Memory (store cross-agent + API + cleanup)
14. AI-Powered Merge (3 tiers: AUTO_GIT, AI_CONFLICT_REGIONS, AI_FULL_FILE)
15. Post-Epic Pipeline (retrospectiva + geracao de skills + shared memory cleanup)

**Dependencias Cross-Component:**
- Zod schemas sao compartilhados entre API (Hono), validacao (quality gates) e frontend (TanStack Query types)
- Workflow template afeta: board rendering, orquestrador, quality gates, integracoes externas
- AgentRuntime afeta: orquestrador, streaming, crash recovery
- Prisma schema e source of truth para tipos em toda a aplicacao

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**32 pontos de conflito potencial identificados** onde agentes AI poderiam tomar decisoes diferentes. Padroes definidos para garantir consistencia.

### Naming Patterns

**Database (Prisma Schema):**
- Tabelas/Models: PascalCase singular (Story, WorkflowTemplate, QualityGate)
- Colunas: camelCase (storyId, createdAt, retryCount)
- Foreign keys: `<entidade>Id` camelCase (projectId, templateId)
- Enums: PascalCase + valores SCREAMING_SNAKE (enum StoryStatus { IN_PROGRESS, BLOCKED, DONE })
- Indices: Prisma gera automaticamente (@@index([projectId, status]))
- Prisma converte para snake_case no banco via @map. Codigo TypeScript sempre ve camelCase.

**API (Hono Routes):**
- Endpoints: kebab-case, plural, REST (/api/stories, /api/workflow-templates)
- Parametros de rota: camelCase (/api/stories/:storyId)
- Query params: camelCase (?projectId=123&status=blocked)
- Verbos: GET (ler), POST (criar), PATCH (atualizar parcial), DELETE (remover)
- Nested resources: maximo 2 niveis (/api/projects/:projectId/stories)

**Codigo TypeScript:**
- Arquivos: kebab-case (story-card.tsx, quality-gate.ts, use-sse.ts)
- Componentes React: PascalCase (StoryCard, PipelineVisualizer)
- Hooks: camelCase com prefixo use (useSSE, useStories, usePauseStory)
- Funcoes/variaveis: camelCase (fetchStories, storyCount)
- Tipos/Interfaces: PascalCase (Story, QualityGateResult)
- Constantes: SCREAMING_SNAKE_CASE (MAX_RETRY_COUNT, DEFAULT_TEMPLATE)
- Zod schemas: camelCase com sufixo Schema (storySchema, createStorySchema)
- Enums TS: Type unions, nao enum (type StoryStatus = "in_progress" | "blocked" | "done")

**Eventos SSE:**
- Nomes: dot.notation, lowercase (story.transition, agent.message, gate.passed)
- Payloads: Zod schema tipado (storyTransitionEventSchema)
- Namespace: `<dominio>.<acao>` (story.started, story.blocked, epic.completed)

### Structure Patterns

**Organizacao por feature (nao por tipo):**
```
src/
+-- features/
|   +-- orchestrator/
|   |   +-- orchestrator.service.ts
|   |   +-- orchestrator.routes.ts
|   |   +-- orchestrator.schemas.ts
|   |   +-- orchestrator.test.ts
|   +-- quality-gates/
|   |   +-- quality-gate.service.ts
|   |   +-- quality-gate.runner.ts
|   |   +-- gates/
|   |   |   +-- test-runner.gate.ts
|   |   |   +-- lint-check.gate.ts
|   |   |   +-- typecheck.gate.ts
|   |   |   +-- coverage.gate.ts
|   |   +-- quality-gate.test.ts
|   +-- sandbox/
|   +-- streaming/
|   +-- github/
|   +-- context/
|   +-- notifications/
|   +-- team-lead/
|   +-- account-pool/
|   +-- shared-memory/
|   +-- skill-creator/
|   +-- retrospective/
+-- shared/
|   +-- schemas/        (Zod schemas compartilhados)
|   +-- types/          (Tipos compartilhados)
|   +-- utils/          (Utilitarios puros)
|   +-- errors/         (Error types e handlers)
+-- db/                 (Prisma client + helpers)
+-- api/                (Hono app + middleware setup)
+-- web/
    +-- components/
    |   +-- ui/          (shadcn/ui components)
    |   +-- story-card/
    |   +-- pipeline-visualizer/
    |   +-- agent-chat/
    +-- hooks/
    |   +-- use-sse.ts
    |   +-- use-stories.ts
    |   +-- use-pause-story.ts
    +-- stores/          (Zustand stores para estado real-time)
    |   +-- workflow-live.store.ts
    |   +-- agent-stream.store.ts
    |   +-- account-pool.store.ts
    |   +-- notification.store.ts
    +-- routes/          (TanStack Router file-based)
    +-- layouts/
    +-- lib/             (API client hc, utils frontend)
```

**Regras de organizacao:**
- Testes co-localizados com o codigo (*.test.ts ao lado do source)
- Cada feature e autocontida: service, routes, schemas, testes
- shared/ so contem codigo usado por 2+ features
- web/components/ui/ sao shadcn/ui (nao modificar padrao deles)
- Componentes custom ficam em pasta propria com teste

**Padrao de sufixo por arquivo:**
- .service.ts — Logica de negocio
- .routes.ts — Hono routes + Zod schemas de request/response
- .schemas.ts — Zod schemas compartilhados da feature
- .test.ts — Testes Vitest
- .gate.ts — Quality gate individual
- .tsx — Componente React

### Format Patterns

**Resposta de API — formato padrao:**
- Sucesso: retorno direto sem wrapper (GET /api/stories -> Story[])
- Erro: formato padronizado { error: { code, message, details, retryable } }
- Paginacao: { data: T[], pagination: { total, page, pageSize, hasMore } }

**Formato de dados:**
- JSON fields: camelCase ({ storyId, createdAt, retryCount })
- Datas: ISO 8601 string ("2026-04-09T14:30:00Z")
- Booleanos: true/false (nunca 1/0)
- Nulls: null explicito (nunca undefined em JSON)
- IDs: string CUID2 via Prisma
- Enums em JSON: snake_case lowercase ("in_progress", "code_review")

### Communication Patterns

**Eventos SSE — estrutura padronizada:**
```typescript
interface SSEEvent<T = unknown> {
  id: string           // CUID2, idempotencia
  type: string         // dot.notation: "story.transition"
  timestamp: string    // ISO 8601
  storyId?: string     // Contexto da story (quando aplicavel)
  epicId?: string      // Contexto do epic (quando aplicavel)
  projectId: string    // Sempre presente
  data: T              // Payload tipado por Zod
}
```

**Endpoints SSE com escopo:**
- `/__dashboard__` — todos os eventos do projeto (painel principal)
- `/epic/:id` — eventos filtrados por epic (Team Lead view)
- `/story/:id` — eventos filtrados por story (Worker view)
- Heartbeat a cada 30s para manter conexao viva e detectar desconexao

**Eventos definidos (15 tipos):**
- story.started — { storyId, templateState, agentRole }
- story.transition — { storyId, from, to, gateResults }
- story.blocked — { storyId, reason, retryCount, maxRetries }
- story.completed — { storyId, epicId, duration, autonomous: boolean }
- agent.message — { storyId, content, role }
- agent.tool — { storyId, tool, args, result }
- agent.spawned — { agentId, role, containerId, storyId? }
- agent.terminated — { agentId, role, reason, exitCode }
- gate.passed — { storyId, gateName, output }
- gate.failed — { storyId, gateName, error, retryable }
- epic.started — { epicId, totalStories, containerId }
- epic.completed — { epicId, stats: { total, autonomous, interventions } }
- account.swapped — { provider, fromAccountId, toAccountId, reason }
- account.exhausted — { provider, allAccountsInCooldown: boolean }
- merge.started — { storyId, strategy, branch }
- merge.completed — { storyId, success, conflicts?: string[] }
- retro.completed — { epicId, skillsCreated, skillsUpdated, lessonsCount }
- system.heartbeat — { uptime, activeContainers, activeAgents }
- system.error — { component, message, severity, recoverable }

**Hooks React — padrao unico:**
- Leitura de dados CRUD: SEMPRE useQuery do TanStack Query
- Mutacao: SEMPRE useMutation do TanStack Query
- Estado real-time: Zustand stores (workflow-live, agent-stream, account-pool, notification)
- SSE: hook custom useSSE que alimenta Zustand stores + invalida cache do TanStack Query
- NUNCA: fetch manual, axios, estado local para dados do servidor, TanStack Query para dados SSE de alta frequencia

### Process Patterns

**Error handling — 3 camadas:**
1. API layer (Hono): middleware global captura erros, formata na estrutura padrao, loga
2. Frontend (React): TanStack Query onError + Error Boundary para erros inesperados
3. UI (shadcn): Toast para erros de acao, inline error para formularios

**Loading states — padrao TanStack Query:**
- SEMPRE usar isLoading/isPending do TanStack Query
- NUNCA criar useState<boolean> para loading manual
- Skeleton (shadcn) para loading de conteudo estruturado
- Spinner para acoes pontuais

**Validacao — onde acontece:**
- Frontend input: Zod + React Hook Form (onChange/onBlur para UX)
- API request: Hono + Zod via @hono/zod-openapi (seguranca)
- DB write: Prisma schema constraints (integridade)
- Config startup: Zod (fail-fast)

### Enforcement Guidelines

**Todo agente AI DEVE:**
1. Seguir os naming patterns exatamente — sem variacao
2. Usar TanStack Query para CRUD server state e Zustand para real-time state (SSE) — NUNCA fetch manual
3. Usar shadcn/ui como base de componentes — componentes custom seguem mesmo padrao (cva, cn)
4. Definir Zod schema para toda rota Hono — NUNCA rota sem validacao
5. Escrever teste co-localizado para toda feature service e componente
6. Usar a estrutura de feature folders — NUNCA arquivo solto na raiz
7. Logar em JSON estruturado — NUNCA console.log com string solta
8. Usar type unions em vez de enum do TypeScript

**Anti-patterns (PROIBIDO):**
- fetch() manual no frontend (usar Hono RPC + TanStack Query)
- useState para dados do servidor (usar useQuery)
- any em tipos (usar Zod inference: z.infer<typeof schema>)
- Arquivo de componente sem pasta propria (exceto ui/ do shadcn)
- Rota Hono sem Zod schema de request E response
- Evento SSE sem schema Zod
- Log sem JSON estruturado
- ID numerico (usar CUID2 string)
- TanStack Query para dados efemeros de alta frequencia (usar Zustand stores para SSE real-time)
- Workflow template como ficheiro no repositorio (sempre no banco, via API)
- Agente editando workflow template diretamente (sempre via tools/API com validacao)
- Credenciais LLM hardcoded ou em .env (usar Account Pool com encriptacao)
- Worker acessando worktree de outra story (isolamento obrigatorio)

## Project Structure & Boundaries

### Complete Project Directory Structure

```
ai-factory/
+-- .github/
|   +-- workflows/
|       +-- ci.yml
|       +-- deploy.yml
+-- .env.example
+-- .gitignore
+-- biome.json
+-- docker/
|   +-- Dockerfile
|   +-- Dockerfile.sandbox
|   +-- docker-compose.yml
+-- k8s/
|   +-- namespace.yml
|   +-- deployment.yml
|   +-- service.yml
|   +-- ingress.yml
|   +-- network-policy.yml
|   +-- job-template.yml
+-- package.json
+-- tsconfig.json
+-- vite.config.ts
+-- prisma/
|   +-- schema.prisma
|   +-- migrations/
|   +-- seed.ts
+-- src/
|   +-- features/
|   |   +-- orchestrator/
|   |   |   +-- orchestrator.service.ts
|   |   |   +-- orchestrator.routes.ts
|   |   |   +-- orchestrator.schemas.ts
|   |   |   +-- orchestrator.events.ts
|   |   |   +-- orchestrator.test.ts
|   |   +-- quality-gates/
|   |   |   +-- quality-gate.service.ts
|   |   |   +-- quality-gate.routes.ts
|   |   |   +-- quality-gate.schemas.ts
|   |   |   +-- gates/
|   |   |   |   +-- test-runner.gate.ts
|   |   |   |   +-- lint-check.gate.ts
|   |   |   |   +-- typecheck.gate.ts
|   |   |   |   +-- app-start.gate.ts
|   |   |   |   +-- acceptance.gate.ts
|   |   |   |   +-- coverage.gate.ts
|   |   |   +-- quality-gate.test.ts
|   |   +-- sandbox/
|   |   |   +-- agent-runtime.interface.ts
|   |   |   +-- docker-local.runtime.ts
|   |   |   +-- kubernetes.runtime.ts
|   |   |   +-- sandbox.service.ts
|   |   |   +-- sandbox.routes.ts
|   |   |   +-- sandbox.schemas.ts
|   |   |   +-- sandbox.test.ts
|   |   +-- streaming/
|   |   |   +-- sse.service.ts
|   |   |   +-- sse.routes.ts
|   |   |   +-- sse.schemas.ts
|   |   |   +-- event-log.service.ts
|   |   |   +-- outbox.service.ts
|   |   |   +-- streaming.test.ts
|   |   +-- github/
|   |   |   +-- github.service.ts
|   |   |   +-- github.routes.ts
|   |   |   +-- github.schemas.ts
|   |   |   +-- github.test.ts
|   |   +-- context/
|   |   |   +-- discovery.service.ts
|   |   |   +-- skills.service.ts
|   |   |   +-- project-context.service.ts
|   |   |   +-- context.routes.ts
|   |   |   +-- context.schemas.ts
|   |   |   +-- context.test.ts
|   |   +-- notifications/
|   |   |   +-- notification.service.ts
|   |   |   +-- notification.routes.ts
|   |   |   +-- notification.schemas.ts
|   |   |   +-- notification.test.ts
|   |   +-- team-lead/
|   |   |   +-- team-lead.service.ts
|   |   |   +-- team-lead.routes.ts
|   |   |   +-- team-lead.schemas.ts
|   |   |   +-- team-lead.test.ts
|   |   +-- account-pool/
|   |   |   +-- account-pool.service.ts
|   |   |   +-- account-pool.routes.ts
|   |   |   +-- account-pool.schemas.ts
|   |   |   +-- scoring.algorithm.ts
|   |   |   +-- account-pool.test.ts
|   |   +-- shared-memory/
|   |   |   +-- shared-memory.service.ts
|   |   |   +-- shared-memory.routes.ts
|   |   |   +-- shared-memory.schemas.ts
|   |   |   +-- shared-memory.test.ts
|   |   +-- skill-creator/
|   |   |   +-- skill-creator.service.ts
|   |   |   +-- skill-creator.routes.ts
|   |   |   +-- skill-creator.schemas.ts
|   |   |   +-- skill-creator.test.ts
|   |   +-- retrospective/
|   |   |   +-- retrospective.service.ts
|   |   |   +-- retrospective.routes.ts
|   |   |   +-- retrospective.schemas.ts
|   |   |   +-- retrospective.test.ts
|   |   +-- workflow-templates/
|   |   |   +-- template.service.ts
|   |   |   +-- template.routes.ts
|   |   |   +-- template.schemas.ts
|   |   |   +-- template.seed.ts
|   |   |   +-- template.test.ts
|   |   +-- projects/
|   |       +-- project.service.ts
|   |       +-- project.routes.ts
|   |       +-- project.schemas.ts
|   |       +-- project.test.ts
|   +-- shared/
|   |   +-- schemas/
|   |   |   +-- story.schema.ts
|   |   |   +-- epic.schema.ts
|   |   |   +-- event.schema.ts
|   |   |   +-- error.schema.ts
|   |   |   +-- pagination.schema.ts
|   |   +-- types/
|   |   |   +-- index.ts
|   |   +-- utils/
|   |   |   +-- id.ts
|   |   |   +-- logger.ts
|   |   |   +-- env.ts
|   |   +-- errors/
|   |       +-- app-error.ts
|   |       +-- error-codes.ts
|   +-- db/
|   |   +-- client.ts
|   |   +-- helpers.ts
|   +-- api/
|   |   +-- app.ts
|   |   +-- middleware/
|   |   |   +-- auth.ts
|   |   |   +-- cors.ts
|   |   |   +-- request-id.ts
|   |   +-- server.ts
|   +-- web/
|       +-- index.html
|       +-- main.tsx
|       +-- app.tsx
|       +-- components/
|       |   +-- ui/                     (shadcn/ui)
|       |   +-- story-card/
|       |   |   +-- story-card.tsx
|       |   |   +-- story-card.test.tsx
|       |   +-- pipeline-visualizer/
|       |   |   +-- pipeline-visualizer.tsx
|       |   |   +-- pipeline-visualizer.test.tsx
|       |   +-- agent-chat/
|       |   |   +-- agent-chat.tsx
|       |   |   +-- agent-chat.test.tsx
|       |   +-- slide-over/
|       |   |   +-- slide-over.tsx
|       |   +-- top-bar/
|       |   |   +-- top-bar.tsx
|       |   +-- notification-card/
|       |   |   +-- notification-card.tsx
|       |   +-- board/
|       |       +-- board-view.tsx
|       |       +-- board-view.test.tsx
|       +-- hooks/
|       |   +-- use-sse.ts
|       |   +-- use-stories.ts
|       |   +-- use-story-actions.ts
|       |   +-- use-project.ts
|       +-- stores/
|       |   +-- workflow-live.store.ts
|       |   +-- agent-stream.store.ts
|       |   +-- account-pool.store.ts
|       |   +-- notification.store.ts
|       +-- routes/
|       |   +-- __root.tsx
|       |   +-- board.tsx
|       |   +-- board.story.$storyId.tsx
|       |   +-- settings.tsx
|       |   +-- setup.tsx
|       +-- layouts/
|       |   +-- app-layout.tsx
|       |   +-- auth-layout.tsx
|       +-- lib/
|       |   +-- api-client.ts
|       |   +-- query-client.ts
|       |   +-- cn.ts
|       +-- styles/
|           +-- globals.css
|           +-- tailwind.config.ts
+-- test/
    +-- setup.ts
    +-- fixtures/
    |   +-- stories.ts
    |   +-- templates.ts
    |   +-- projects.ts
    +-- helpers/
        +-- db.ts
        +-- api.ts
```

### Architectural Boundaries

**API Boundaries:**
- /api/* — Todas as rotas Hono. Autenticacao via JWT middleware. Cada feature expoe suas rotas.
- /api/stream — Endpoint SSE dedicado. Conexao persistente, autenticada, filtrada por projectId.
- Sandbox containers NUNCA acessam a API diretamente. Comunicacao sempre via AgentRuntime.

**Component Boundaries:**
- Frontend -> Backend: exclusivamente via Hono RPC client (hc). NUNCA fetch direto.
- Feature -> Feature: via service imports (nunca imports de routes ou schemas internos de outra feature).
- Shared: codigo em shared/ e o contrato entre features. Mudanca em shared afeta todas.

**Data Boundaries:**
- Prisma client: unico ponto de acesso ao banco. NUNCA query SQL direta.
- Cada feature service acessa apenas as tabelas do seu dominio. Cross-domain via service-to-service.
- Eventos no outbox processados assincronamente — separacao entre write path e side effects.

### Requirements to Structure Mapping

- FR1-FR8 (Orchestration) -> features/orchestrator/ + features/workflow-templates/
- FR9-FR15 (Quality Gates) -> features/quality-gates/
- FR16-FR21 (Painel) -> web/components/ + web/routes/ + web/hooks/
- FR22-FR29 (Human Control) -> features/orchestrator/ (pause/resume) + features/notifications/ + web/hooks/use-story-actions.ts
- FR30-FR37 (Context) -> features/context/
- FR38-FR42 (Code Review) -> features/github/
- FR43-FR48 (Sandbox) -> features/sandbox/
- FR49-FR54 (Config) -> features/projects/ + features/workflow-templates/

**Cross-Cutting:**
- Event streaming: features/streaming/ + web/hooks/use-sse.ts + web/stores/
- Auth: api/middleware/auth.ts
- Error handling: shared/errors/ + api/app.ts (error middleware)
- Logging: shared/utils/logger.ts
- Account Pool: features/account-pool/ + web/stores/account-pool.store.ts
- Multi-agent hierarchy: features/team-lead/ + features/sandbox/ (container-per-epic, worktree-per-story)
- Shared Memory: features/shared-memory/
- Auto-aprendizado: features/skill-creator/ + features/retrospective/

### Data Flow

```
Developer (browser)
    |
    | Hono RPC (type-safe HTTP)
    v
Hono API (api/app.ts)
    |
    +--- Feature Routes (validacao Zod)
    |       |
    |       v
    |    Feature Services (logica de negocio)
    |       |
    |       v
    |    Prisma Client (DB read/write)
    |       |
    |       v
    |    Event Log + Outbox (trail + sync)
    |
    +--- SSE Endpoints (escopados)
    |       +--- /__dashboard__ (todos os eventos do projeto)
    |       +--- /epic/:id (eventos do epic)
    |       +--- /story/:id (eventos da story)
    |       |
    |       v
    |    SSE Service -> Zustand stores (real-time) + TanStack Query invalidation (CRUD)
    |
    v
Scrum Master (SM — orquestra epics)
    |
    | spawnContainer(epicId)
    v
Container per Epic (AgentRuntime)
    |
    +--- Team Lead Agent (coordena stories dentro do container)
    |       |
    |       +--- createWorktree(storyId, branch)
    |       |
    |       +--- Worker 1 (story A, worktree isolado)
    |       +--- Worker 2 (story B, worktree isolado)
    |       +--- Worker N (story N, worktree isolado)
    |       |
    |       +--- Shared Memory (canal lateral cross-worker)
    |       |
    |       +--- mergeWorktree() -> AI-Powered Merge (3 tiers)
    |
    +--- Account Pool Manager
    |       |
    |       +--- selectAccount(provider) -> melhor conta por score
    |       +--- polling 30s (swap proativo)
    |       +--- on 429/401 (swap reativo <5s)
    |       v
    |    LLM Providers (Anthropic, OpenAI, Google, etc.)
    |
    v
pi-mono agent (dentro do container, worktree isolado)
    |
    | EventStream (15+ eventos tipados)
    v
Orchestrator (processa eventos, executa gates, transiciona estado)
    |
    +--- Pos-Epic Pipeline
            +--- Retrospectiva automatica
            +--- Geracao/atualizacao de skills
            +--- Shared memory cleanup
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** Todas as tecnologias compatíveis. Hono + Zod + OpenAPI nativos. Prisma 7 + SQLite/PostgreSQL troca via config. React 19 + Vite + TanStack ecossistema maduro. Hono RPC -> TanStack Query sem adaptação. Biome funciona com TS, JSX, sem conflito com Tailwind. Nenhuma incompatibilidade encontrada.

**Pattern Consistency:** camelCase em TS, PascalCase em tipos/componentes, kebab-case em arquivos — consistente em todo o stack. TanStack Query para server state, useState para UI state — sem sobreposição. Zod em todas as camadas. Eventos dot.notation + Zod schema consistente do backend ao frontend.

**Structure Alignment:** Feature folders alinham com domínios de FR. Shared/ contém apenas contratos cross-feature. Test co-localizado alinha com Vitest e padrão feature-first.

### Requirements Coverage Validation

**Functional Requirements:** Todos os 54 FRs têm suporte arquitetural mapeado para diretórios específicos.

**Non-Functional Requirements:** Todos os 26 NFRs endereçados:
- Performance: SSE streaming, SQLite local, TanStack Query cache
- Security: JWT auth, container network policy, credenciais encriptadas
- Reliability: Git checkpoint, provider failover, outbox pattern, eventos idempotentes
- Integration: GitHub API backoff, provider timeouts, Docker health-check, SSE reconexão
- Accessibility: shadcn/ui WCAG AA built-in, keyboard shortcuts, cor + texto/ícone

### Implementation Readiness Validation

**Decision Completeness:** Stack completa documentada com justificativas. Versões verificadas via web search. Cadeia de contratos tipados end-to-end definida.

**Structure Completeness:** ~90 arquivos/diretórios explicitamente definidos. Cada feature com padrão consistente. Mapping FR -> diretório completo.

**Pattern Completeness:** 32 pontos de conflito identificados e endereçados. 8 regras obrigatórias + 8 anti-patterns proibidos.

### Gap Analysis Results

**Gaps Críticos:** Nenhum.

**Gaps Importantes (endereçáveis na implementação):**
1. Schema Prisma detalhado — definido na primeira story (intencional)
2. Estratégia operacional de migração SQLite -> PostgreSQL — definida na transição Marco 0 -> V1
3. Dockerfile.sandbox imagem base — refinada quando primeiro agente rodar em container

**Gaps Nice-to-Have (pós-MVP):**
- Swagger UI para documentação de API
- Storybook para componentes custom
- Testes E2E com Playwright
- Health check endpoint para K8s probes

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Contexto do projeto analisado (54 FRs, 26 NFRs, UX spec completa)
- [x] Escala e complexidade avaliados (média-alta)
- [x] Constraints técnicos identificados (pi-mono, TypeScript ESM, Docker, K8s)
- [x] Concerns transversais mapeados (7 concerns)

**Architectural Decisions**
- [x] Decisões críticas documentadas (stack, workflow engine, state machine, AgentRuntime)
- [x] Stack tecnológica especificada (Hono, Prisma 7, React 19, shadcn/ui, TanStack, Zod, Vite)
- [x] Padrões de integração definidos (Hono RPC, SSE, AgentRuntime, outbox pattern)
- [x] Performance, segurança e infraestrutura definidos

**Implementation Patterns**
- [x] Naming conventions estabelecidas (DB, API, código, eventos)
- [x] Structure patterns definidos (feature folders, sufixos)
- [x] Communication patterns especificados (SSE, hooks, errors)
- [x] Process patterns documentados (validação, loading, error handling)
- [x] Enforcement guidelines com anti-patterns proibidos

**Project Structure**
- [x] Estrutura de diretórios completa (~90 arquivos)
- [x] Component boundaries estabelecidos
- [x] Integration points mapeados
- [x] Requirements to structure mapping completo

### Architecture Readiness Assessment

**Overall Status:** PRONTO PARA IMPLEMENTACAO

**Nível de Confiança:** Alto

**Pontos Fortes:**
- Cadeia de contratos tipados end-to-end elimina classe inteira de bugs de integração
- Workflow Template Engine como dados permite customização sem refatoração
- State machine transacional com outbox garante consistência e auditabilidade
- Padronização React + shadcn/ui + TanStack maximiza produtividade agêntica
- AgentRuntime interface abstrai Docker/K8s sem mudar orquestrador
- Feature folders com sufixos torna navegação previsível para agentes

**Áreas para Melhoria Futura:**
- Caching (Redis) quando PostgreSQL + multi-user
- Vault externo quando multi-tenant
- Observabilidade avançada (Prometheus/Grafana/Loki) em V1.5+
- Multi-engine abstraction em V2+

### Implementation Handoff

**Guidelines para Agentes AI:**
- Seguir todas as decisões arquiteturais exatamente como documentadas
- Usar implementation patterns consistentemente em todos os componentes
- Respeitar estrutura do projeto e boundaries entre features
- Consultar este documento para todas as questões arquiteturais

**Primeira Prioridade de Implementação:**
1. Criar pacote packages/ai-factory no monorepo com estrutura base
2. Configurar package.json (workspace dependencies), tsconfig (extends root), Vite
3. Inicializar Prisma com schema base (Project, WorkflowTemplate, Story, Event)
4. Setup Hono app com middleware (auth, cors, error handler)
5. Setup React + TanStack Router + shadcn/ui shell
