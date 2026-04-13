---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-02b-vision", "step-02c-executive-summary", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
status: "complete"
completedAt: "2026-04-09"
classification:
  projectType: "saas_b2b"
  domain: "AI/DevOps Orchestration"
  complexity: "medium-high"
  projectContext: "brownfield"
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-pi-mono.md"
  - "_bmad-output/planning-artifacts/product-brief-pi-mono-distillate.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-04-08-19h00.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/project-context.md"
  - "docs/index.md"
  - "docs/ (14 project documentation files)"
  - "_bmad/_config/bmad-help.csv"
  - ".claude/skills/bmad-*/workflow.md (16 BMad Method workflow files)"
  - "https://docs.bmad-method.org/llms.txt"
documentCounts:
  briefs: 2
  research: 0
  brainstorming: 1
  projectDocs: 14
  uxDesign: 1
  projectContext: 1
  bmadWorkflows: 16
  bmadCatalog: 1
workflowType: 'prd'
---

# Product Requirements Document - pi-mono

**Author:** Luis
**Date:** 2026-04-08

## Executive Summary

O desenvolvimento de software assistido por agentes AI em 2026 sofre de uma lacuna fundamental: os agentes "procrastinam". Testes empiricos demonstram um padrao consistente — agentes LLM ignoram testes que falham, saltam checagens de lint e typecheck, continuam sobre premissas incorrectas, ou param arbitrariamente. 93% dos developers usam AI mas apenas ~10% reportam ganho real de produtividade (ShiftMag/CTO surveys 2025). O gap nao esta na inteligencia dos modelos — esta na ausencia de verificacao e processo sobre a AI.

A AI Software Factory OS e uma plataforma web que transforma o ciclo SDLC completo — de planeamento a deploy — num processo controlado, visivel e replicavel. Construida sobre o motor pi-mono (17+ providers LLM, tool calling, sessoes com fork, streaming de eventos, 66 releases) e a metodologia BMAD (workflows validados de analise, planeamento, solutioning e implementacao), adiciona tres camadas:

- **Controlo deterministico.** O LLM decide o fluxo de orquestracao; logica hard-coded verifica que o trabalho foi realmente feito. Testes passam, lint limpo, typecheck sem erros, aplicacao inicia, acceptance criteria verificados e funcionais. O fluxo nao avanca sem cumprir criterios. Apos N tentativas sem resolucao, o sistema notifica o humano com contexto completo em vez de falhar silenciosamente.

- **Painel interactivo.** Interface web que mostra o fluxo de desenvolvimento em tempo real: em que fase esta cada story, o que cada agente decidiu, onde houve intervencao humana, que quality gates passaram ou falharam. O developer pode pausar, injectar contexto, redirecionar ou aprovar directamente pelo painel.

- **Auto-aprendizado.** A plataforma gera automaticamente contexto de projecto, identifica padroes recorrentes, e cria skills especificas por dominio. Cada correccao humana a um agente e sinal de aprendizado que alimenta ciclos subsequentes.

A experiencia core e "fire to deliver": o developer dispara um epico, o sistema executa autonomamente o ciclo BMAD inteiro (create-story, dev-story, code-review, QA, PR), e so notifica quando precisa de intervencao humana ou quando o trabalho esta concluido. A inversao do paradigma actual onde o developer gasta mais tempo a gerir agentes do que os agentes gastam a desenvolver.

Utilizador primario (V1): developer tecnico que supervisiona multiplas stories em paralelo pelo painel. Utilizador secundario (V2+): Product Owner / Gestor que interage com agentes em modos de planeamento e resolucao. Beneficiario final: clientes da software house que recebem entregas mais rapidas, consistentes e auditaveis.

Objectivo imediato: arma estrategica interna — multiplicar capacidade de entrega como software house e acelerar produtos proprios. Medio prazo: o processo replicavel torna-se o proprio produto, empacotado para outras software houses.

### O Que Torna Isto Especial

**Autonomia verificada, nao autonomia cega.** O mercado esta ansioso com agentes autonomos imprevisiveis (DORA 2025: PRs maiores, vulnerabilidades, padroes inconsistentes). Esta plataforma oferece o oposto: autonomia com guardrails deterministicos validados empiricamente. Duas abordagens foram testadas — script deterministico (falha: loop infinito quando agente nao cumpre) e orchestrador LLM (falha: ignora testes, "procrastina" checagens). O modelo hibrido e o resultado directo destas licoes.

**Pipeline completo, nao peca isolada.** Nenhum concorrente cobre o pipeline inteiro de planning a deploy com quality gates deterministicos. Devin resolve tasks isoladas. OpenHands resolve codigo sem metodologia. Copilot/Cursor assistem individualmente. O mais proximo — Xebia ACE (50-60% automacao SDLC) — e proprietario e interno. Esta plataforma empacota motor, metodologia e verificacao num produto coeso.

**Motor proprio com independencia de vendor.** O pi-mono nao e wrapper sobre API — e plataforma com provider pluggavel, engine abstraction (preparada para pi-mono, Claude Code SDK, LangGraph), e MCP como bridge universal de tools. Cinco primitivas universais (ToolRegistry, MessageThread, AgentLoop, EventStream, SessionState) normalizam qualquer engine.

**Aprendizado cumulativo por projecto.** Cada projecto enriquece a plataforma: contexto de dominio, skills especificas, padroes de falha e correccao. Apos N projectos, estimativas data-driven, prevencao de erros recorrentes, e auto-expansao de capacidades.

## Classificacao do Projecto

- **Tipo:** Plataforma SaaS B2B (web app com painel, orquestracao de agentes, multi-projecto)
- **Dominio:** AI/DevOps Orchestration — desenvolvimento de software assistido por agentes com quality gates deterministicos
- **Complexidade:** Media-Alta — orquestracao multi-agente, streaming real-time, sandboxing, engine abstraction; sem compliance regulatoria
- **Contexto:** Brownfield — construido sobre pi-mono existente (7 pacotes TypeScript, 208+ ficheiros fonte, v0.66.0)

## Success Criteria

### User Success

- **"Fire and forget" funcional.** O developer dispara um epico e sai sem ansiedade. Medido pela ausencia de "check-ins" voluntarios no painel — se fica a olhar, o produto falhou.
- **Tempo ate "fire" < 30 segundos.** Entre abrir o painel e disparar um fluxo. Zero configuracao repetitiva, zero setup de contexto, zero repeticao de instrucoes.
- **Intervencao rapida < 2 minutos.** Quando o sistema escala um bloqueio, a notificacao contem contexto completo + accoes sugeridas. O developer decide e age sem investigacao previa.
- **Retorno apos ausencia imediato.** Ao reabrir o painel depois de horas ou dias, o developer entende o estado completo em 3 segundos — o que foi feito, o que falhou, o que espera decisao.
- **Zero repeticao.** O developer nunca envia a mesma instrucao duas vezes. Regras, contexto e padroes persistidos e aplicados automaticamente.

### Business Success

- **Um projecto completo end-to-end.** Todos os epicos e stories de um projecto real passam pelo fluxo de implementacao (fase 4 BMAD) com handoff automatizado ate deploy em staging.
- **70%+ autonomia mensuravel.** Pelo menos 70% das stories completam o ciclo (dev -> review -> QA -> PR) sem intervencao humana alem de aprovacao final.
- **Replicabilidade validada.** O segundo projecto funciona com setup minimo (horas, nao dias). O contexto acumulado do primeiro informa o proximo.
- **Multiplicacao de capacidade.** Um developer supervisiona multiplas stories em paralelo — throughput mensuravel superior ao processo manual.
- **Cada projecto entregue e demo viva** da plataforma — growth organico para produtizacao.

### Technical Success

- **Quality gates deterministicos funcionais.** Cada transicao entre fases tem criterios hard-coded que bloqueiam avanco: testes unitarios/integracao passam, lint limpo, typecheck sem erros, aplicacao inicia, tasks resolvidas, QA review executou testes reais, ACs verificados e funcionais.
- **Modelo hibrido operacional.** LLM decide fluxo, logica deterministica verifica execucao. Apos N tentativas sem resolucao, escalacao para humano com contexto completo — sem loops infinitos, sem falhas silenciosas.
- **Anti-procrastinacao de agentes.** O sistema impede agentes de ignorar testes falhando, saltar verificacoes, ou continuar sobre premissas incorrectas.
- **Contexto auto-gerado.** Skills e memoria de projecto criadas automaticamente pela plataforma e utilizadas pelos agentes nos ciclos subsequentes — sem instrucao manual.
- **Streaming real-time funcional.** Frontend mostra actividade dos agentes em tempo real via EventStream (agent_start/end, turn_start/end, message, tool_execution).

### Measurable Outcomes

| Metrica | Alvo MVP | Metodo de Medicao |
|---------|----------|-------------------|
| Stories autonomas (sem intervencao) | >= 70% | Ratio stories completadas sem human escalation vs total |
| Tempo de intervencao em bloqueio | < 2 min | Timestamp notificacao -> timestamp accao do developer |
| Setup de novo projecto | < 4 horas | Tempo ate primeiro fluxo disparado com sucesso |
| Quality gates pass rate | 100% | Nenhuma story avanca sem todos os gates cumpridos |
| Falhas silenciosas | 0 | Bloqueios nao reportados ao humano |

## User Journeys

### Jornada 1: Carlos — "Fire to Deliver" (Sucesso)

Carlos e dev backend senior numa software house. Trabalha em 3 projectos de cliente simultaneamente. Hoje recebeu a confirmacao de que o PRD, arquitectura e epicos do projecto "HealthTracker" estao prontos para implementacao. Antes da plataforma, isto significava semanas a operar agentes manualmente — abrir terminal, carregar contexto, monitorar cada story, repetir instrucoes, babysit code reviews.

**Cena de abertura.** Carlos abre o painel no browser. Ve o board com os 3 epicos do HealthTracker, cada um com as stories planeadas. Tudo em "backlog". Selecciona "Todos os epicos pendentes", clica "Iniciar desenvolvimento". O sistema mostra: "24 stories, estimativa baseada em historico: ~18 horas. Iniciar?" Carlos confirma. Os cards mudam para "Em progresso". Carlos fecha o browser e vai trabalhar noutro projecto.

**Accao crescente.** Durante a manha, Carlos abre o painel uma vez por curiosidade. Ve 3 stories ja em "code review", 2 em "dev", 1 em "QA". Quality gates verdes em cascata. Fecha o browser — nao precisa de fazer nada.

**Climax.** Ao final da tarde, recebe notificacao: "Story 2.3 bloqueada: testes de integracao falhando apos 3 tentativas. O agente tentou 3 abordagens diferentes. [Ver detalhes]". Carlos clica, cai no contexto da story: ve o que o agente tentou, os logs dos testes, a analise do agente sobre o problema. O agente identificou que precisa de credenciais de API externa que nao estao no environment. Carlos injeta as credenciais via painel, clica "Retomar". O sistema continua. 40 segundos de intervencao.

**Resolucao.** Dia seguinte, notificacao: "Epico 1 completo. 8/8 stories finalizadas. Todos os quality gates passaram. PRs criados." Carlos abre o painel, revisa os PRs no diff viewer integrado, aprova. Epico 2 ja esta a 60%. O trail auditavel mostra: 24 stories, 2 intervencoes humanas, 22 autonomas. Carlos percebe que fez em 2 dias o que antes levava 2 semanas.

**Requisitos revelados:** Painel com board e pipeline view, botao "Iniciar desenvolvimento" com estimativa, streaming real-time de progresso, notificacoes com contexto + accoes, injecao de contexto inline, diff viewer integrado, trail auditavel.

### Jornada 2: Carlos — Intervencao em Cascata (Edge Case)

Carlos esta a supervisionar o desenvolvimento do projecto "FinanceApp". Epico 3 (integracao com pagamentos) esta a correr. Tres stories falham em sequencia — todas no mesmo quality gate (testes de integracao) porque o servico externo de pagamentos mudou a API sem aviso.

**Cena de abertura.** Carlos recebe 3 notificacoes em 10 minutos. Em vez de panico, abre o painel. Ve as 3 stories bloqueadas, todas com o mesmo padrao: "testes de integracao falhando — endpoint /v2/payments retorna 404".

**Accao crescente.** Carlos percebe que e um problema transversal, nao de story individual. Usa a funcao "Pausar epico" para parar todas as stories do Epico 3. As stories de outros epicos continuam normalmente — bloqueio de um nao trava os demais.

**Climax.** Carlos abre conversa com o agente no contexto do Epico 3. Injeta a informacao: "API de pagamentos migrou para /v3/. Nova documentacao em [link]." O agente incorpora o contexto. Carlos clica "Retomar epico". O sistema re-executa as 3 stories bloqueadas com o contexto actualizado.

**Resolucao.** As 3 stories passam nos quality gates com a nova API. O sistema gera automaticamente uma skill de projecto: "FinanceApp: API de pagamentos usa /v3/ desde [data]". Na proxima story que tocar em pagamentos, o agente ja tem este contexto. Carlos nao precisa de repetir a informacao.

**Requisitos revelados:** Deteccao de padroes entre bloqueios, pausa/retoma por epico, conversa contextual com agente, injecao de contexto que persiste como skill, isolamento de falhas entre epicos.

### Jornada 3: Carlos — Primeiro Projecto (Onboarding Brownfield)

Carlos quer usar a plataforma pela primeira vez num projecto existente — uma app React+Node com 2 anos de codigo, sem documentacao formal.

**Cena de abertura.** Carlos cria um novo projecto no painel e aponta para o repositorio GitHub. O sistema inicia auto-discovery: analisa o codebase, detecta stack (React 18, Node 20, PostgreSQL, Jest, ESLint), mapeia estrutura de pastas, identifica padroes de codigo, gera documentacao automatica.

**Accao crescente.** Em 20 minutos, o sistema apresenta: "Projecto analisado. Stack: React+Node+PostgreSQL. 847 ficheiros, 12 rotas API, 34 componentes React, cobertura de testes 45%. Contexto de projecto gerado. Deseja revisar?" Carlos revisa o project-context gerado, ajusta 2-3 detalhes (credenciais de staging, convencoes de naming especificas), e confirma.

**Climax.** Carlos passa pelo fluxo BMAD de planeamento com os agentes — ja alimentados com o contexto auto-gerado. Cria PRD, arquitectura, epicos. O sistema sugere skills baseadas nos padroes detectados no codebase. Em 4 horas, tem o primeiro epico pronto para "fire".

**Resolucao.** Carlos dispara o primeiro epico. O agente desenvolve a primeira story seguindo os padroes detectados do projecto — mesma estrutura de pastas, mesmas convencoes de naming, mesmos padroes de teste. O codigo produzido parece escrito por alguem que conhece o projecto ha meses.

**Requisitos revelados:** Auto-discovery de codebase, geracao de project-context, deteccao de stack e padroes, configuracao guiada com defaults inteligentes, skills auto-geradas por projecto.

### Jornada 4: Ricardo — Visibilidade sem Esforco (Tech Lead, V2+)

Ricardo e tech lead e supervisiona 3 developers que usam a plataforma em 5 projectos. Nao quer operar agentes — quer saber o estado de tudo sem perguntar a ninguem.

**Cena de abertura.** Ricardo abre o painel. O painel mostra os 5 projectos com status macro: 3 verdes (tudo a correr), 1 amarelo (story em retry), 1 vermelho (bloqueio a espera de developer). Zero reunioes de status necessarias.

**Accao crescente.** Ricardo faz drill-down no projecto amarelo. Ve que a story esta na terceira tentativa de code review — o agente reviewer encontrou um problema de seguranca que o agente developer nao consegue resolver. Ricardo ve o historico completo: tentativas, feedback do reviewer, respostas do developer agent.

**Climax.** Ricardo decide intervir. Adiciona um comentario tecnico no contexto da story com a solucao correcta. O developer (Carlos) recebe a notificacao com o input do tech lead ja incorporado.

**Resolucao.** No final da semana, Ricardo gera um relatorio automatico: 47 stories concluidas, 5 intervencoes humanas, tempo medio por story, quality gates pass rate. Apresenta ao cliente sem ter pedido status a ninguem. Cada numero e derivado da actividade real, nao de reports manuais.

**Requisitos revelados:** Painel multi-projecto, status macro por cor, drill-down progressivo, input de tech lead em contexto de story, relatorios automaticos, zero-ask status intelligence.

### Journey Requirements Summary

| Jornada | Capacidades Reveladas |
|---------|----------------------|
| Fire to Deliver | Board + pipeline view, estimativas, streaming, notificacoes contextuais, diff viewer, trail auditavel |
| Intervencao em Cascata | Deteccao de padroes, pausa/retoma por epico, conversa com agente, skills auto-geradas, isolamento de falhas |
| Onboarding Brownfield | Auto-discovery, project-context, deteccao de stack, configuracao guiada, skills por projecto |
| Visibilidade Tech Lead | Painel multi-projecto, drill-down, input contextual, relatorios automaticos, zero-ask status |

## Domain-Specific Requirements

### Seguranca e Isolamento de Agentes

- **Sandbox obrigatorio.** Cada agente de desenvolvimento executa dentro de container efemero com recursos isolados. Zero acesso a ambientes de staging/producao. Blast radius zero — um agente comprometido ou com bug nao afecta o host nem outros projectos.
- **CI/CD como unico gate.** Apenas o pipeline de CI/CD tem credenciais para staging/producao. Separacao absoluta entre quem escreve codigo (agentes) e quem deploya (pipeline). Agentes nunca fazem push directo nem deploy.
- **Hooks deterministicos.** Commits de seguranca, worktrees separadas, merge controlado. O agente e criativo no conteudo; o processo e deterministico e imutavel.
- **Credenciais centralizadas.** API keys e tokens injectados transparentemente no container, nunca expostos ao agente nem persistidos em codigo. Vault integration para rotacao.

### Integridade de Processo

- **Anti-procrastinacao como requisito de dominio.** O maior risco tecnico neste dominio e o agente LLM nao cumprir o que afirma ter cumprido. Checagens deterministicas nao sao "nice to have" — sao o mecanismo central de confianca. Testes passam (executados, nao simulados), lint limpo (saida real verificada), typecheck sem erros (compilador executado), aplicacao inicia (health check real).
- **Idempotencia de eventos.** Eventos de orquestracao persistidos com idempotencia (deduplicacao por ID). Crash de container nao perde estado — git como checkpoint, estado critico fora do container.
- **Max retries com escalacao.** Apos N tentativas sem resolver, escalacao obrigatoria para humano com contexto completo. Sem loops infinitos, sem falhas silenciosas, sem "procrastinacao" de retry.

### Constraints Tecnicos do Motor (pi-mono)

- **EventStream como contrato.** 9+ eventos tipados (agent_start/end, turn_start/end, message_start/update/end, tool_execution_start/update/end) sao o contrato entre backend e frontend. Extensao do contrato e possivel; quebra nao.
- **Session portability.** Sessoes JSONL com tree e fork pertencem a plataforma, nao ao engine. Migracao de engine nao perde historico ou contexto.
- **Provider pluggavel.** Failover chain configuravel (Claude Opus -> GPT-4o -> Gemini -> modelo local). Plataforma nunca para por indisponibilidade de um unico provider.
- **Extension system.** Extensoes TypeScript via jiti com hooks em agent, turn, message, tool, session, input, context, resources. Platform-level security hooks possiveis via Operations interface.

### Riscos de Dominio e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Agente gera codigo inseguro | Vulnerabilidades em producao | Code review adversarial obrigatorio + security linting no quality gate |
| Agente ignora testes falhando | Codigo quebrado avanca no pipeline | Verificacao deterministica: testes executados e resultado parseado, nao reportado pelo agente |
| Context window overflow em stories complexas | Agente perde contexto e gera codigo inconsistente | Auto-compaction de sessao + skills persistentes por projecto + limite de scope por story |
| Provider LLM indisponivel | Fluxo de desenvolvimento para | Provider failover chain + fila de retry com backoff |
| Container crash mid-story | Perda de trabalho em progresso | Git-as-checkpoint: estado so avanca apos commit+push confirmado. Estado critico fora do container |
| Conflito entre agentes paralelos | Merge conflicts, regressions | Worktree-per-story isola codigo; merge controlado por Team Lead com resolucao AI-powered em 3 tiers (auto-merge trivial -> LLM resolve com contexto -> escalacao humana) |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Modelo hibrido LLM + deterministico (inovacao central).** A combinacao de orquestracao por LLM com verificacao por logica hard-coded e uma abordagem nova e validada empiricamente. O mercado actual oferece dois extremos: scripts deterministicos (rigidos, sem recuperacao) ou agentes autonomos (flexiveis, sem garantias). Este modelo hibrido e o primeiro a combinar ambos de forma intencional — o LLM decide fluxo, a logica verifica execucao. A "procrastinacao de agentes" como problema nomeado e enquadrado e em si uma contribuicao nova ao discurso.

**2. Pipeline SDLC completo com quality gates deterministicos.** Nenhum produto no mercado cobre o pipeline inteiro de planning a deploy com verificacao deterministica em cada transicao. Devin, OpenHands, Factory AI e Copilot cobrem pecas. O conceito de aplicar quality gates de CI/CD a cada fase do SDLC (nao so build/test, mas spec -> dev -> review -> QA -> PR) e uma extensao nova do paradigma.

**3. MCP como bridge universal de tools entre engines.** Uma unica implementacao de tools (via MCP server) serve qualquer engine que suporte o protocolo. Isto permite trocar engine sem reimplementar tools — inovacao pratica que resolve o vendor lock-in a nivel de tooling.

**4. Auto-aprendizado cumulativo por projecto.** A geracao automatica de skills por projecto (cada correccao humana e sinal, cada padrao detectado e skill) cria um flywheel de conhecimento. Nenhuma plataforma concorrente faz isto de forma estruturada — ferramentas como Cursor/Copilot nao persistem aprendizado entre sessoes.

**5. Cinco primitivas universais para normalizacao de engine.** ToolRegistry, MessageThread, AgentLoop, EventStream, SessionState como interface minima que normaliza pi-mono, Claude Code SDK e LangGraph. Abstracacao derivada de analise comparativa real de 7+ engines — nao teoria, mas denominador comum pratico.

### Market Context & Competitive Landscape

| Concorrente | Cobertura | Lacuna que esta plataforma preenche |
|-------------|-----------|--------------------------------------|
| Devin ($500/mo) | Task isolada | Sem orquestracao multi-fase, sem quality gates, sem gestao de projectos |
| OpenHands (64k stars) | Resolucao de codigo | Sem metodologia de planeamento, sem quality gates, sem multi-user |
| Factory AI | Coding enterprise | Sem cobertura end-to-end planning-to-deploy |
| Xebia ACE | SDLC 50-60% | Proprietario, interno, nao vendido |
| Copilot/Cursor | Assistencia IDE individual | Sem orquestracao, sem workflow estruturado, sem verificacao |
| Archon | Framework multi-agente YAML DAGs | Sem quality gates deterministicos, sem methodology integration, sem worktree isolation, sem multi-user |
| Auto-Claude | Orquestracao de Claude Code desktop | Single-engine (Claude), sem multi-provider, sem account pool, sem visual workflow builder, sem pipeline pos-epico |

O mercado de AI orchestration platforms esta em ~$15-18B (2026) com 21% CAGR ate $58B+ (2032). A industria transita de Level 1-2 (autocomplete/chat) para Level 3 (agentic) — 2026 e ano de inflexao. Nenhum produto domina o pipeline completo.

### Validation Approach

- **Marco 0 (Smoke test).** Uma story end-to-end valida que o modelo hibrido funciona: spec -> dev -> review -> QA -> PR com quality gates deterministicos a controlar cada transicao.
- **V1 (Epico completo).** Um epico inteiro com orquestracao hierarquica (SM -> Team Lead -> Workers), stories em paralelo via worktrees, account pool com rotacao, e pipeline pos-epico (retrospectiva -> skills -> memoria). Metrica: 70%+ stories autonomas.
- **Replicabilidade.** Segundo projecto com setup < 4 horas valida que o contexto acumulado e as skills geradas sao transferiveis e uteis.
- **Comparacao A/B.** Mesmo projecto implementado manualmente vs. via plataforma — medir throughput, qualidade (bugs pos-deploy), e tempo de developer.

### Risk Mitigation

| Inovacao | Risco | Fallback |
|----------|-------|----------|
| Modelo hibrido | Quality gates demasiado rigidos travam o fluxo | Configurabilidade: gates additive-only (exigir mais, nunca menos), thresholds ajustaveis por projecto |
| Pipeline SDLC completo | Complexidade de orquestracao demasiado alta para V1 | Marco 0 como validacao minima; reduzir scope para single-story antes de multi-story |
| MCP bridge universal | Overhead de protocolo, latencia | Fallback para tool injection directa no engine nativo; MCP como camada opcional |
| Auto-aprendizado | Skills geradas sao ruidosas ou incorrectas | Curadoria humana de skills; flag de confianca por skill; revisao antes de aplicar |
| Primitivas universais | Abstracacao perde features especificas de cada engine | Extension ports para features nao-universais; graceful degradation ao trocar engine |

## SaaS B2B Specific Requirements

### Project-Type Overview

Plataforma SaaS B2B de orquestracao de desenvolvimento AI. V1 e single-tenant (uso interno da software house). Multi-tenancy e V3+. O modelo de negocio imediato e interno; a produtizacao e medio prazo. A arquitectura deve suportar a evolucao sem redesign.

### Tenant Model

**V1 — Single-tenant (interno):**
- Uma instancia, um utilizador (developer), multiplos projectos
- Cada projecto tem contexto isolado: skills, memoria, configuracoes, sessoes
- Containers efemeros por story — isolamento a nivel de execucao, nao de tenant

**V1.5 — Multi-projecto:**
- Mesmo tenant, multiplos projectos em paralelo
- Projecto como unidade de isolamento: repositorio, contexto, skills, historico
- Recursos partilhados (LLM providers, container pool) com limites por projecto

**V2+ — Multi-utilizador:**
- Multiplos developers no mesmo tenant, cada um com vista sobre os seus projectos
- Projecto atribuido a developer(s) com visibilidade cruzada para tech lead

**V3+ — Multi-tenant:**
- Isolamento completo entre tenants (dados, containers, credenciais)
- Resource governor por tenant com limites configuraveis

### RBAC Matrix (Evolucao por Versao)

| Role | V1 | V2+ | Permissoes |
|------|-----|------|------------|
| Developer | Unico utilizador | Multiplos | Disparar fluxos, intervir em bloqueios, revisar PRs, configurar projectos, ver trail |
| Tech Lead | — | Sim | Tudo de Developer + visao multi-projecto, input em stories de outros, relatorios |
| Product Owner | — | Sim | Planeamento e resolucao com agentes (sem implementation), ver status, editar stories |
| Admin | Implicito | Sim | Configuracao de plataforma, gestao de providers, gestao de utilizadores, limites |

### Subscription Tiers (Produtizacao Futura)

**Nao aplicavel a V1** (uso interno). Para produtizacao (V2+), modelo previsto:

- **Starter:** Single developer, 1 projecto activo, provider BYOK (bring your own key)
- **Team:** Multiplos developers, multi-projecto, integrações GitHub
- **Enterprise:** Multi-tenant, RBAC completo, audit trail, SSO, SLA

Decisao de pricing adiada ate validacao interna — o modelo de custos LLM (tokens por story/epic) precisa de dados reais da V1.

### Integration List

**V1 (MVP):**

| Integracao | Tipo | Descricao |
|------------|------|-----------|
| GitHub | Bidirecional | PRs, branches, commits, status checks. Agentes criam branches e PRs; plataforma sincroniza estado |
| LLM Providers (17+) | Outbound | Anthropic, OpenAI, Google, Mistral, Bedrock + 12 outros via pi-ai. Failover chain configuravel |
| Container Runtime | Interno | Docker para sandboxes efemeros. Container por epico com multiplos agentes; worktree por story para isolamento de codigo. Lifecycle gerido pela plataforma |
| EventStream (SSE) | Interno | Streaming real-time com subscricoes SSE por scope: global (dashboard), por epico, por story. Zustand para estado real-time no frontend, complementando TanStack Query. Baseado no proxy.ts existente no agent-core |

**V1.5:**

| Integracao | Tipo | Descricao |
|------------|------|-----------|
| Notificacoes | Outbound | Email, webhook, push — configuravel por developer. Contexto completo + accoes sugeridas |
| Persistencia | Interno | Sessoes JSONL, sprint-status.yaml, skills, memoria de projecto — em filesystem ou DB |

**V2+ (Fora de scope MVP):**

| Integracao | Tipo | Descricao |
|------------|------|-----------|
| Linear / Azure DevOps | Bidirecional | Sincronizacao de work items, status, comments |
| Slack / Teams | Bidirecional | Notificacoes, comandos, feedback ingestion |
| Observability (OTel/Loki/GlitchTip) | Inbound | Eventos de monitoring como input para auto-fix pipeline |

### Compliance Requirements

**Sem compliance regulatoria** (nao e healthcare, fintech, govtech). Requisitos de seguranca sao de dominio tecnico, nao legal:

- **Isolamento de codigo.** Codigo de cliente nunca acessivel por outros clientes (quando multi-tenant)
- **Credenciais seguras.** API keys de providers LLM e de repositorios armazenadas em vault, nunca em plaintext
- **Audit trail.** Cada decisao de agente, cada quality gate, cada intervencao humana registada — valioso para clientes enterprise e como diferenciador
- **Data residency (V3+).** Quando multi-tenant, opcao de regiao para dados e execucao

### Implementation Considerations

- **Stack alinhada com pi-mono.** TypeScript ESM, Node.js 22+, Lit + Tailwind para frontend. Nao introduzir frameworks novos sem justificacao — o pi-web-ui ja tem Web Components Lit funcionais.
- **Backend web sobre pi-mom pattern.** O pi-mom ja implementa agent-to-sandbox via Slack -> Docker. Reutilizar o padrao para web: HTTP/WebSocket -> container isolado. Per-project isolation mapeia para o per-channel isolation existente.
- **RPC mode do coding agent.** JSON-RPC via stdin/stdout ja disponivel — modo headless ideal para backend web. EventStream com 9+ eventos tipados ja serve como contrato.
- **Sessoes como propriedade da plataforma.** JSONL tree com fork — migrar de pi-mono para outro engine nao perde sessoes. Session portability e decisao arquitectural ja tomada.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Abordagem MVP: Problem-Solving MVP.** O objectivo nao e demonstrar features — e provar que o modelo hibrido (LLM + deterministico) resolve o problema da procrastinacao de agentes. O menor artefacto que prova isto e uma story end-to-end com quality gates a controlar cada transicao.

**Filosofia: Vertical slice, nao horizontal layer.** Em vez de construir toda a camada de orquestracao e depois toda a UI, cada marco entrega uma fatia vertical completa — backend + orquestracao + frontend — para um cenario especifico.

**Recurso: Solo developer (Luis)** com agentes AI como multiplicador. A plataforma e construida usando a propria plataforma (dogfooding progressivo a partir de Marco 0).

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Jornada 1 (Fire to Deliver) — parcial: single epic, nao multi-projecto
- Jornada 3 (Onboarding Brownfield) — parcial: auto-discovery basico

**Marco 0 — Smoke Test (Must-Have Absoluto):**

| Capacidade | Descricao | Justificacao |
|------------|-----------|--------------|
| Story orchestrator | Executa ciclo completo de uma story: create-story -> dev-story -> code-review -> QA. Interface AgentRuntime desenhada para extensao multi-agente (V1) mesmo que Marco 0 use single agent sequencial com single template | Valida o modelo hibrido |
| Quality gates | Checagens deterministicas por transicao (testes, lint, typecheck, ACs) | Core da proposta de valor |
| Container sandbox | Agente dev executa em container efemero isolado | Seguranca e isolamento |
| Event streaming | Backend emite eventos de agente em tempo real | Base para UI real-time |
| Painel minimo | UI web mostra estado do fluxo (story em que fase, gates pass/fail) | Visibilidade minima |
| GitHub integration | Agente cria branch e PR | Output tangivel |

**V1 — Epico Completo (Must-Have para Validacao):**

| Capacidade | Descricao | Justificacao |
|------------|-----------|--------------|
| Epic orchestrator | Orquestracao hierarquica: SM -> Team Lead -> Workers. Stories em paralelo via worktrees dentro de container-per-epic. Account pool com scoring e rotacao. Separacao skills (pre-loaded por agente) vs memoria partilhada (contexto de projecto). Handoff deterministico entre fases | Prova automacao multi-agente a escala |
| Pausa/retoma | Developer pode pausar story/epic e retomar | Controlo humano |
| Notificacoes com contexto | Quando bloqueio, notifica com problema + tentativas + accoes sugeridas | Intervencao rapida |
| Injecao de contexto | Developer injeta informacao via painel que o agente incorpora | Resolucao de bloqueios |
| Board view | Kanban com stories e estados visuais (backlog, dev, review, QA, done) | Overview do progresso |
| Pipeline view | Drill-down de story mostrando fases como checkpoints visuais | Detalhe por story |
| Auto-discovery | Analisa codebase existente, gera project-context | Onboarding de projectos |
| Skill generation | Gera skills via agente skill-creator apos retrospectivas. Pipeline pos-epico: retrospectiva -> documentacao -> skills -> memoria -> proximo epico | Auto-aprendizado cumulativo |

**Pode ser manual/simplificado em V1:**
- Diff viewer — developer usa GitHub para review de codigo (deep link na notificacao)
- Estimativas — sem dados historicos em V1, sem estimativa data-driven
- Relatorios — trail auditavel raw, sem painel formatado
- Conversa com agente — via inject de texto, nao chat completo

### Post-MVP Features

**Phase 2 — Cloud + Multi-projecto (V1.5):**

| Capacidade | Justificacao |
|------------|--------------|
| Deploy em servidor remoto | Operacao 24/7 sem maquina local |
| Multi-projecto | Varias projectos em paralelo |
| Diff viewer integrado | Code review sem sair da plataforma |
| Chat contextual com agente | Conversa natural para intervencao em bloqueios |
| Trail auditavel formatado | Timeline interactiva por story |
| Estimativas data-driven | Baseadas em historico real apos N projectos |
| Persistencia robusta | DB para sessoes, skills, metricas |

**Phase 3 — Multi-user + Integracoes (V2+):**

| Capacidade | Justificacao |
|------------|--------------|
| Multi-utilizador + RBAC | Developer, Tech Lead, PO com permissoes diferenciadas |
| Painel multi-projecto | Visao Ricardo (Tech Lead) |
| Integracoes bidirecionais | Linear, Azure DevOps, Slack |
| Multi-engine | Claude Code SDK, LangGraph via engine abstraction |
| PO workflow mode | Planeamento e resolucao sem implementation |
| Observability-to-action | Issues de monitoring como input automatico |

**Phase 4 — Produtizacao (V3+):**

| Capacidade | Justificacao |
|------------|--------------|
| Multi-tenancy | Isolamento completo entre clientes |
| Subscription tiers | Modelo de negocio externo |
| Template marketplace | Workflows reutilizaveis |
| SSO + compliance enterprise | Requisitos de clientes grandes |

### Risk Mitigation Strategy

**Riscos Tecnicos:**

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Orquestracao demasiado complexa para solo dev | Alta | Bloqueante | Marco 0 como validacao minima antes de investir em V1 completo. Se Marco 0 falhar, simplificar modelo |
| pi-mono como dependencia externa (upstream changes) | Media | Alto | Interface de abstracao fina (Opcao C validada no brainstorming). Nao forkar, nao abstrair tudo — wrapper fino nos pontos de contacto |
| Latencia de LLM providers impacta UX | Media | Medio | Streaming ja nativo no pi-mono. Failover chain. UI mostra progresso mesmo com latencia |
| Context window limits em stories complexas | Alta | Medio | Auto-compaction existente no pi-mono. Skills como contexto persistente fora da sessao. Scope por story controlado |

**Riscos de Mercado:**

| Risco | Mitigacao |
|-------|-----------|
| Produto resolve problema que ninguem mais tem | Uso interno primeiro — se resolve o nosso problema, ja tem valor. Produtizacao so apos validacao |
| Concorrente lanca produto similar antes | Motor proprio + metodologia propria = diferenciacao dificil de replicar. First-mover em pipeline completo com quality gates |
| LLM providers mudam pricing/terms | Multi-provider ja suportado (17+). Nenhuma dependencia de vendor unico |

**Riscos de Recurso:**

| Risco | Mitigacao |
|-------|-----------|
| Solo developer e bottleneck | A propria plataforma e o multiplicador — dogfooding progressivo. Cada marco aumenta a capacidade de desenvolvimento |
| Scope creep | Marcos claros com criterios de sucesso. Nao avançar para V1 sem Marco 0 validado. Nao avançar para V1.5 sem V1 com projecto real |

## Functional Requirements

### Development Orchestration

- **FR1:** Developer pode disparar o desenvolvimento de uma story individual, seleccionando-a no painel
- **FR2:** Developer pode disparar o desenvolvimento de um epico inteiro, executando todas as stories em sequencia
- **FR3:** Developer pode disparar o desenvolvimento de todos os epicos pendentes de um projecto
- **FR4:** Sistema executa o workflow seleccionado por story (BMAD por defeito: create-story -> dev-story -> code-review -> QA -> PR), com suporte a multiplos templates de workflow armazenados em DB
- **FR5:** Sistema faz handoff deterministico entre fases — a transicao so ocorre quando a fase anterior cumpre todos os criterios
- **FR6:** Sistema executa stories em paralelo dentro de um epico via worktrees isoladas, controladas pelo Team Lead agent que gere dependencias e concorrencia (V1); Marco 0 executa sequencialmente como simplificacao
- **FR7:** Sistema retoma automaticamente o fluxo apos intervencao humana sem reiniciar a story
- **FR8:** Sistema estima duracao do fluxo com base em historico de projectos anteriores (V1.5+)

### Quality Assurance & Verification

- **FR9:** Sistema executa checagens deterministicas por transicao: testes unitarios/integracao passam, lint limpo, typecheck sem erros, aplicacao inicia, ACs verificados
- **FR10:** Sistema parseia resultados reais de execucao (stdout/stderr) — nunca aceita auto-report do agente
- **FR11:** Sistema bloqueia avanco quando qualquer quality gate falha, independentemente do que o agente reporta
- **FR12:** Sistema faz retry automatico ate N tentativas quando quality gate falha, com feedback especifico ao agente sobre o que falhou
- **FR13:** Sistema escala para humano apos N tentativas sem resolucao, com contexto completo do bloqueio
- **FR14:** Sistema executa code review adversarial como fase obrigatoria do ciclo
- **FR15:** Sistema executa QA review com testes reais contra a aplicacao como fase obrigatoria

### Painel & Monitoring

- **FR16:** Developer ve board kanban com todas as stories do projecto organizadas por estado (backlog, dev, review, QA, done)
- **FR17:** Developer ve pipeline view por story com fases como checkpoints visuais (verde/amarelo/vermelho)
- **FR18:** Developer ve streaming real-time de actividade dos agentes (eventos de progresso enquanto trabalham)
- **FR19:** Developer ve estado macro do projecto em 3 segundos ao abrir o painel — quantas stories concluidas, em progresso, bloqueadas
- **FR20:** Developer ve trail auditavel por story: cada decisao de agente, cada quality gate, cada intervencao humana com timestamps
- **FR21:** Developer ve detalhes de quality gate por transicao: que checagens passaram, quais falharam, output completo

### Human Intervention & Control

- **FR22:** Developer pode pausar uma story em execucao a qualquer momento
- **FR23:** Developer pode pausar um epico inteiro, parando todas as stories associadas
- **FR24:** Developer pode retomar uma story ou epico pausado
- **FR25:** Developer recebe notificacao quando o sistema precisa de intervencao, com contexto completo (problema, tentativas, logs, accoes sugeridas)
- **FR26:** Developer pode injectar contexto (texto, links, instrucoes) numa story bloqueada que o agente incorpora ao retomar
- **FR27:** Developer pode redirecionar a abordagem de uma story (alterar instrucoes ao agente mid-flight)
- **FR28:** Developer pode cancelar uma story ou epico em execucao
- **FR29:** Developer pode configurar canal de notificacao (email, webhook) e nivel de urgencia

### Project Onboarding & Context

- **FR30:** Developer pode criar novo projecto apontando para repositorio GitHub
- **FR31:** Sistema analisa codebase existente e gera project-context automaticamente (stack, padroes, estrutura, convencoes)
- **FR32:** Developer pode revisar e editar o project-context gerado antes de confirmar
- **FR33:** Sistema gera skills automaticamente a partir de padroes detectados no codebase
- **FR34:** Sistema gera skills automaticamente a partir de correccoes humanas durante o fluxo
- **FR35:** Sistema persiste skills geradas e aplica-as automaticamente em ciclos subsequentes
- **FR36:** Developer pode revisar, editar e eliminar skills geradas pelo sistema
- **FR37:** Sistema alimenta cada agente automaticamente com project-context, skills e memoria relevantes

### Code Review & Delivery

- **FR38:** Sistema cria branch por story no repositorio GitHub
- **FR39:** Sistema cria Pull Request no GitHub quando story completa o ciclo com sucesso
- **FR40:** Developer pode revisar diff de codigo produzido pelo agente (via deep link para GitHub em V1, diff viewer integrado em V1.5+)
- **FR41:** Developer pode aprovar ou rejeitar PR directamente do painel (V1.5+)
- **FR42:** Sistema inclui no PR: descricao da story, ACs cumpridos, quality gates passados, trail de decisoes

### Agent Execution & Isolation

- **FR43:** Sistema executa cada epico dentro de container efemero isolado, com multiplos agentes (Team Lead + Workers) a operar dentro do mesmo container; cada story usa worktree separada para isolamento de codigo
- **FR44:** Sistema garante zero acesso do container a ambientes de staging/producao
- **FR45:** Sistema injeta credenciais necessarias (API keys, tokens) no container de forma segura, sem exposicao ao agente
- **FR46:** Sistema persiste estado critico fora do container de forma duravel, recuperavel apos crash sem perda de trabalho confirmado
- **FR47:** Sistema recupera de crash de container sem perda de trabalho — retoma do ultimo checkpoint confirmado
- **FR48:** Sistema suporta failover entre providers LLM quando o provider primario esta indisponivel

### Platform Configuration

- **FR49:** Developer pode configurar providers LLM por projecto com account pool: multiplas API keys por provider com scoring de fiabilidade, rotacao proactiva quando limites de rate/budget sao atingidos, e failover chain configuravel entre providers
- **FR50:** Developer pode configurar quality gates por projecto (quais checagens obrigatorias, thresholds, max retries)
- **FR51:** Developer pode criar e gerir multiplos templates de workflow por projecto via visual builder (ReactFlow); templates armazenados em DB, modificaveis apenas via UI/API (nunca por agentes directamente); BMAD como template base editavel com fases, parametros e quality gates configuraveis
- **FR52:** Developer pode ver metricas de utilizacao: stories processadas, intervencoes, tokens consumidos, tempo medio por story
- **FR53:** Sistema configura automaticamente o team hierarquico de agentes com base no stack detectado: Scrum Master (orquestracao por epico) -> Team Lead (gestao de stories e workers) -> Workers especializados (dev, review, QA), cada um com skills pre-carregadas e modelo LLM optimizado para o seu papel
- **FR54:** Sistema aplica workflows BMAD como template base; developer pode configurar pontos de extensao por projecto sem alterar o template pai
- **FR55:** Quality gate de coverage consome json-summary do Vitest para decisao PASS/FAIL baseada em threshold configuravel; coverage delta por story (linhas novas cobertas vs nao cobertas) e registado no trail auditavel

### Orchestration & Multi-Agent

- **FR56:** Templates de workflow armazenados em DB com versionamento; modificaveis apenas via tools validadas ou API — agentes nunca editam workflows directamente (anti-hallucination protection)
- **FR57:** Account Pool Manager gere multiplas credenciais LLM por provider com scoring de fiabilidade (latencia, erros, custo), rotacao proactiva ao atingir limites, e credential vault para armazenamento seguro
- **FR58:** Orquestracao hierarquica: Scrum Master agent coordena epicos e dispara Container/Epic agents; Team Lead agent dentro do container gere stories, distribui trabalho e controla paralelismo; Worker agents executam tarefas especializadas (dev, review, QA) por story
- **FR59:** Cada story em execucao opera numa worktree git separada dentro do container do epico; merge para branch principal do epico controlado pelo Team Lead apos quality gates
- **FR60:** Memoria partilhada por projecto (shared memory) acessivel a todos os agentes do mesmo projecto; distinta de skills (skills = direccao focada pre-carregada por agente; memoria = contexto de projecto partilhado)
- **FR61:** Agente skill-creator evolui skills especificas do projecto apos cada retrospectiva, analisando padroes de sucesso/falha e correccoes humanas para gerar ou refinar skills
- **FR62:** Pipeline pos-epico automatico: retrospectiva -> geracao de documentacao -> evolucao de skills -> actualizacao de memoria partilhada -> preparacao do proximo epico
- **FR63:** Classificacao de erros em tres categorias (transient/fatal/unknown) com budget caps configuraveis por story (maxBudgetUsd) e por workflow; erros fatais escalam imediatamente, transient fazem retry, unknown escalam apos N tentativas
- **FR64:** Resolucao de conflitos AI-powered em 3 tiers para merges de worktrees: (1) auto-merge trivial, (2) LLM analisa contexto e propoe resolucao, (3) escalacao para humano com diff anotado e sugestao do agente
- **FR65:** Anti-hallucination: workflows, quality gates e configuracoes de orquestracao so modificaveis via tools validadas com schema checking; tentativas de modificacao por agentes fora do canal autorizado sao bloqueadas e registadas

## Non-Functional Requirements

### Performance

- **NFR1:** Painel carrega estado completo do projecto em < 3 segundos (incluindo board, pipeline e estado macro)
- **NFR2:** Eventos de streaming de agentes chegam ao frontend com < 500ms de latencia apos emissao pelo backend
- **NFR3:** Accao de "Iniciar desenvolvimento" confirma e inicia execucao em < 2 segundos apos click
- **NFR4:** Notificacoes de bloqueio chegam ao developer em < 30 segundos apos o sistema detectar o bloqueio
- **NFR5:** Injecao de contexto pelo developer e processada e incorporada pelo agente em < 10 segundos
- **NFR6:** Transicao entre fases (quality gate check + handoff) completa em < 60 segundos por transicao
- **NFR7:** UI funcional em desktop (>= 1024px) e mobile (>= 375px) — todas as accoes core (disparar fluxo, pausar, injectar contexto, aprovar) acessiveis em ambos; tempo de interaccao nao excede 2x o desktop em mobile

### Security

- **NFR8:** Containers de agente executam com acesso a rede limitado — apenas repositorio GitHub e LLM providers autorizados
- **NFR9:** Credenciais (API keys, tokens) nunca presentes em logs, eventos de streaming, ou output visivel no painel
- **NFR10:** Credenciais armazenadas encriptadas at-rest; injectadas no container de forma segura e efemera, sem persistencia apos termino da execucao
- **NFR11:** Nenhum container tem acesso a filesystem ou rede de outros containers
- **NFR12:** Codigo de projecto acessivel apenas pelo projecto associado — isolamento a nivel de filesystem e git
- **NFR13:** Sessoes de utilizador autenticadas com token de duracao maxima de 24 horas; expiram apos 30 minutos de inactividade

### Reliability

- **NFR14:** Crash de container nao perde mais de 1 task de trabalho — recovery do ultimo git checkpoint confirmado
- **NFR15:** Falha de provider LLM activa failover chain em < 5 segundos sem intervencao humana
- **NFR16:** Sistema opera 24/7 sem reinicio programado a partir de V1.5 (uptime target: 99% medido por health check endpoint em janela rolling de 30 dias)
- **NFR17:** Perda de conexao do frontend (browser) nao afecta execucao de agentes no backend — retoma streaming ao reconectar
- **NFR18:** Eventos de orquestracao persistidos com idempotencia — replay seguro apos crash sem duplicacao de trabalho
- **NFR19:** Dados criticos (sprint-status, story files, skills, project-context) persistidos em armazenamento duravel, nao apenas em memoria de container

### Integration

- **NFR20:** GitHub API rate limits respeitados com backoff exponencial — operacao nao falha por throttling
- **NFR21:** LLM provider API timeouts configuraveis por provider com defaults sensatos (30s-120s dependendo da operacao)
- **NFR22:** Container runtime health-checked antes de spawnar agente — fallback gracioso se runtime indisponivel
- **NFR23:** EventStream compativel com reconexao — cliente pode reconectar e receber estado actual sem perder eventos criticos

### Accessibility

- **NFR24:** Painel opera com teclado para accoes frequentes (disparar fluxo, pausar, aprovar) — keyboard-first como Linear
- **NFR25:** Contraste de cores suficiente para leitura em ambientes com luz variavel (WCAG AA minimo para texto)
- **NFR26:** Estado comunicado por cor + texto/icone — nunca apenas por cor (acessibilidade a daltonismo)

### Budget & Resource Control

- **NFR27:** Budget cap configuravel por story e por workflow (maxBudgetUsd); execucao suspensa automaticamente ao atingir o limite com escalacao para humano — previne agentes runaway
- **NFR28:** Account swap entre credenciais LLM completo em < 5 segundos quando provider atinge rate limit ou budget limit, sem interrupcao visivel no fluxo do agente
- **NFR29:** Propagacao de escrita em memoria partilhada (shared memory) para outros agentes activos no mesmo projecto em < 30 segundos
