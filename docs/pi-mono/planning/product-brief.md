---
title: "Product Brief: AI-Native SDLC Platform"
status: "complete"
created: "2026-04-08"
updated: "2026-04-08"
inputs:
  - "_bmad-output/brainstorming/brainstorming-session-2026-04-08-19h00.md"
  - "_bmad-output/project-context.md"
  - "docs/ (pi-mono documentation)"
  - "web research: competitive landscape, market sizing"
  - "3-lens review: skeptic, opportunity, DX friction"
  - "testes empiricos: script YAML + orchestrador LLM"
---

# Product Brief: AI Software Factory OS

## Resumo Executivo

O desenvolvimento de software assistido por agentes AI em 2026 e um processo fragmentado e manual. Ferramentas como Cursor, Copilot e Devin resolvem pedacos isolados — autocompletar codigo, resolver uma task, gerar um PR — mas nenhuma empacota o ciclo completo num fluxo estruturado, controlado e replicavel. Equipas reportam apenas ~10% de ganho real de produtividade apesar de 93% dos developers usarem AI (ShiftMag/CTO surveys 2025). O gap nao esta na AI — esta na ausencia de processo e controlo sobre a AI.

Esta plataforma e o sistema operacional de uma fabrica de software AI-native. Construida sobre o motor pi-mono e a metodologia BMAD — ambos ja validados e funcionais — adiciona tres camadas que faltam ao processo actual: **controlo deterministico** sobre cada etapa do desenvolvimento, **painel interactivo** para visualizar e intervir no fluxo em tempo real, e **auto-aprendizado** que gera contexto e skills especificos por projecto sem depender de instrucao manual do developer.

O ciclo de desenvolvimento BMAD ja funciona com agentes — testes empiricos demonstraram epicos inteiros desenvolvidos em sequencia, tanto com script deterministico quanto com orchestrador LLM. Mas ambas as abordagens falham em pontos opostos: scripts nao detectam quando o agente nao cumpriu a tarefa (loop infinito); orchestradores LLM ignoram testes falhando, "procrastinam" checagens obrigatorias, ou param por decisoes arbitrarias. A plataforma resolve esta lacuna com um modelo hibrido: **LLM decide o fluxo, logica deterministica verifica que o trabalho foi feito** — testes passam, lint limpo, app inicia, acceptance criteria verificados. Quando precisa de intervencao humana, notifica e aguarda orientacao em vez de falhar silenciosamente.

O objetivo imediato e uma arma estrategica interna: multiplicar a capacidade de entrega como software house (pacotes de horas a clientes) e acelerar produtos proprios (SaaS, white-label). A medio prazo, o processo replicavel torna-se o proprio produto.

## O Problema

O desenvolvimento agentico em 2026 sofre de tres lacunas fundamentais:

**Procrastinacao de agentes.** Testes empiricos revelam um padrao consistente: agentes LLM "procrastinam" tarefas obrigatorias. Ignoram testes que falham por considerar irrelevantes, saltam checagens de lint e typecheck, continuam o fluxo sobre premissas incorrectas, ou param arbitrariamente por achar que a sessao durou demasiado. Sem verificacao externa, o developer so descobre estes problemas no output final — quando o custo de correccao ja e alto. Abordagens puramente deterministicas (scripts) resolvem a verificacao mas entram em loop quando o agente nao cumpre o esperado. Nenhuma das duas abordagens isoladas funciona.

**Contexto manual e efemero.** A responsabilidade de alimentar o agente com contexto de projecto recai sobre o developer. E ele que instrui o agente a pesquisar documentacao, citar skills existentes, e pedir para salvar contexto relevante. Conhecimento adquirido num ciclo de desenvolvimento nao flui automaticamente para o proximo — cada sessao começa quase do zero. Padroes de erro corrigidos hoje repetem-se amanha porque o agente nao tem memoria do que aprendeu.

**Orquestracao invisivel.** Mesmo com agentes autonomos, nao existe um painel que mostre onde o fluxo esta, o que cada agente decidiu, onde falhou ou precisou de intervencao. O developer trabalha as cegas. Sem visibilidade, nao ha confianca — e sem confianca, nao ha autonomia real. Quando o agente precisa de ajuda (credenciais, decisao tecnica, bloqueio), falha silenciosamente em vez de notificar o humano.

## A Solucao

Uma plataforma que adiciona tres camadas sobre o processo BMAD ja validado:

**Modelo hibrido LLM + deterministico.** O LLM decide o fluxo de orquestracao — qual agente acionar, como resolver problemas, quando mudar de abordagem. A logica deterministica verifica que o trabalho foi realmente feito: testes unitarios e de integracao passam, lint e typecheck estao limpos, a aplicacao inicia sem erros, todas as tasks da story foram resolvidas, o QA review realmente testou a aplicacao, e os criterios de aceitacao foram todos verificados e estao funcionais. Se alguma verificacao falha, o fluxo nao avanca — o agente recebe feedback especifico do que falhou e tenta corrigir. Apos N tentativas sem resolucao, o sistema notifica o humano com contexto completo do bloqueio em vez de falhar silenciosamente ou entrar em loop.

**Painel interactivo.** Interface web que mostra o fluxo de desenvolvimento em tempo real: em que fase esta cada story, o que cada agente decidiu, onde houve intervencao humana, que quality gates passaram ou falharam. O developer pode pausar, injetar contexto, redirecionar, ou aprovar directamente pelo painel. Visibilidade total sobre o processo.

**Auto-aprendizado e geracao de contexto.** A plataforma gera automaticamente contexto de projecto, identifica padroes recorrentes, e cria skills especificas por dominio. Cada correccao humana a um agente e sinal de aprendizado: o que foi corrigido, porque, e como prevenir. Conhecimento acumulado num ciclo alimenta automaticamente o proximo — sem o developer precisar de instruir manualmente.

Tudo isto sobre uma base ja funcional: o motor pi-mono (17+ providers LLM, tool calling, sessoes com fork, streaming de eventos, execucao remota via SSE, 66 releases) e os workflows BMAD (analise, planeamento, solutioning, implementacao com code review, QA, e tratamento de falhas ja definidos).

## O Que Torna Isto Diferente

**Autonomia deterministica, nao autonomia cega.** O mercado esta ansioso com agentes autonomos imprevisiveis (DORA 2025: PRs maiores, vulnerabilidades, padroes inconsistentes). Esta plataforma oferece o oposto: autonomia com guardrails deterministicos. O LLM decide como resolver; a plataforma verifica que resolveu. Sem "procrastinacao" de agentes — testes, lint, typecheck, e ACs sao checagens obrigatorias, nao sugestoes.

**Validado empiricamente.** Nao e teoria — testes reais demonstraram epicos inteiros desenvolvidos em sequencia por agentes. Duas abordagens foram testadas (script deterministico e orchestrador LLM), identificando precisamente onde cada uma falha. O modelo hibrido da plataforma e o resultado directo destas licoes: combina a fluidez do LLM com a rigidez das verificacoes obrigatorias.

**Aprendizado continuo por projecto.** Cada projecto que passa pela plataforma enriquece-a: contexto de dominio, skills especificas, padroes de falha e correccao. Apos N projectos, a plataforma tem dados reais de quanto demora cada fase, onde humanos intervem mais, e que tipo de story causa problemas — gerando estimativas data-driven e prevencao de erros recorrentes.

**Motor proprio, nao integracao sobre API.** O pi-mono nao e um wrapper — e uma plataforma com provider pluggavel (17+ APIs), engine abstraction (preparada para pi-mono, Claude Code SDK, LangGraph), e MCP como bridge universal de tools. Independencia de vendor e flexibilidade de modelo por tarefa.

## Quem Serve

**Utilizador primario: Developer (eu e equipa futura).** Supervisiona o fluxo de desenvolvimento pelo painel, intervem quando necessario, valida decisoes criticas. Em vez de executar cada step manualmente, monitoriza multiplas stories em paralelo com confianca — porque a camada deterministica garante que nada avanca sem cumprir criterios.

**Utilizador secundario (V2+): Product Owner / Gestor de projecto.** Interage com agentes em modos de planeamento e resolucao. Ve status real derivado da actividade, nao de reports manuais. Estimativas fundamentadas com dados historicos da plataforma.

**Beneficiario final: Clientes da software house.** Entregas mais rapidas, consistentes e auditaveis — com trail completo de decisoes e quality gates.

## Criterios de Sucesso

O MVP e bem-sucedido quando:

- **Um projecto completo** passa pelo fluxo de implementacao (fase 4 BMAD) com handoff automatizado entre agentes ate deploy em staging — todos os epicos e stories
- **Autonomia mensuravel**: pelo menos 70% das stories completam o ciclo (dev -> review -> QA -> PR) sem intervencao humana alem de aprovacao final
- **Contexto auto-gerado**: skills e memoria de projecto sao criadas automaticamente pela plataforma e utilizadas pelos agentes nos ciclos subsequentes — sem instrucao manual
- **Verificacao deterministica funcional**: cada quality gate tem criterios hard-coded que bloqueiam avanco quando nao cumpridos
- **Replicavel**: o mesmo processo funciona para um segundo projecto com setup minimo (horas, nao dias)

## Scope

### Marco 0 — Smoke test
- Uma unica story end-to-end: spec -> agente dev em sandbox -> code review -> QA -> PR
- Validar que a camada deterministica controla transicoes correctamente
- Validar que o painel mostra o fluxo em tempo real

### V1 — Provar a automacao (local)
- Fluxo end-to-end de um epico completo com multiplas stories
- Orquestracao de workers especializados com handoff deterministico
- Geracao automatica de contexto e skills por projecto
- Painel web interactivo para visualizar, pausar, intervir
- Integracao com GitHub (PRs, branches)

### V1.5 — Cloud simples
- Mesmo fluxo em servidor remoto
- Multi-projecto sem escalabilidade
- Persistencia de sessoes, contexto, e skills acumuladas

### Fora de scope inicial
- Multi-engine (Claude Code SDK, LangGraph) — V2+
- Integracoes bidirecionais com Linear/Azure DevOps/Slack — V2+
- Multi-utilizador com roles e permissoes — V2+
- Escalabilidade e multi-tenancy — V3+
- Pipeline observability-to-action (auto-fix de issues) — V2+

## Visao

Se a automacao funcionar, torna-se tres coisas:

1. **Vantagem competitiva interna.** A software house entrega projectos em fraccao do tempo, com qualidade auditavel e trail completo. Pacotes de horas rendem mais, margens sobem, capacidade multiplica. Orcamentos passam a ser data-driven com base em historico real da plataforma.

2. **Fabrica de produtos.** Projectos pessoais (SaaS, white-label) que antes exigiam meses de desenvolvimento solitario passam a ser viaveis com supervisao de agentes. O bottleneck deixa de ser mao de obra e passa a ser ideias validadas.

3. **Produto replicavel.** O processo estruturado — metodologia + automacao + quality gates + aprendizado — empacotado como plataforma para outras software houses. Cada projecto entregue a um cliente e uma demo viva da plataforma. O que comeca como ferramenta interna torna-se o proprio produto.

A longo prazo: issues de monitoring, feedback de clientes, e eventos de observabilidade alimentam automaticamente o ciclo de desenvolvimento — correct course e auto-fix como extensoes naturais do processo ja estruturado e auto-evolutivo.
