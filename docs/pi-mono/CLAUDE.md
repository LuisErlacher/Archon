# Pi Monorepo — Contexto para Agentes AI

Ferramentas para construir agentes AI e gerenciar deployments LLM.
Autor: Mario Zechner (badlogic). Licenca: MIT. Repo: github.com/badlogic/pi-mono

## Regras Obrigatorias

LEIA E SIGA `AGENTS.md` na raiz do repositorio. Ele contem regras criticas que prevalecem sobre comportamento padrao. Resumo dos pontos mais importantes:

### Qualidade de Codigo
- Sem tipos `any` salvo necessidade absoluta
- Verificar `node_modules` para tipos de APIs externas em vez de adivinhar
- **NUNCA usar inline imports** — sem `await import("./foo.js")`, sem `import("pkg").Type`
- Nunca remover ou fazer downgrade de codigo para corrigir erros de tipo — atualizar a dependencia
- Sempre perguntar antes de remover funcionalidade intencional

### Comandos
- Apos mudancas de codigo: `npm run check` (output completo, sem tail). Corrigir tudo antes de commitar
- `npm run check` NAO executa testes
- **NUNCA executar**: `npm run dev`, `npm run build`, `npm test`
- Testes especificos: `npx tsx ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts` (a partir do package root)
- Se criar ou modificar um teste, DEVE executa-lo e iterar ate passar
- Para `packages/coding-agent/test/suite/`, usar `harness.ts` + faux provider. Sem APIs reais ou tokens pagos
- **NUNCA commitar sem o usuario pedir**

### Git — Regras Criticas
- **APENAS commitar ficheiros que VOCE alterou NESTA sessao**
- Sempre usar `git add <ficheiros-especificos>` — NUNCA `git add -A` ou `git add .`
- NUNCA: `git reset --hard`, `git checkout .`, `git clean -fd`, `git stash`, `git commit --no-verify`
- Incluir `fixes #<number>` ou `closes #<number>` quando houver issue relacionada
- Se conflito de rebase em ficheiro que nao modificou, abortar e perguntar ao usuario

### Estilo
- Respostas curtas e concisas
- Sem emojis em commits, issues, PRs, comentarios ou codigo
- Sem texto filler ou excessivamente cordial
- Prosa tecnica apenas, gentil mas direta
- **Idioma de comunicacao: Portugues do Brasil (PT-BR)** — nunca usar portugues de Portugal

### Changelog
- Localizacao: `packages/*/CHANGELOG.md` (cada pacote tem o seu)
- Novas entradas SEMPRE sob `## [Unreleased]`
- NUNCA modificar secoes de versoes ja lancadas
- Formato de atribuicao: `Fixed foo bar ([#123](url))` ou com `by [@user](url)` para contribuicoes externas

### Releasing
- **Lockstep versioning**: todos os pacotes compartilham a mesma versao
- `npm run release:patch` (fixes e features) ou `npm run release:minor` (breaking changes)

### Leitura de Ficheiros
- NUNCA usar sed/cat para ler ficheiros — sempre usar a tool read (com offset + limit para ranges)
- DEVE ler todo ficheiro que modificar antes de editar

## Estrutura do Projeto

Monorepo npm workspaces com 7 pacotes TypeScript ESM. Versao atual: 0.66.0.
O pacote `ai-factory` usa stack diferente (React 19, Vite, Prisma 7, Hono) e tem typecheck proprio.

```
pi-tui ──────────────────────┐
                              ├──> pi-coding-agent ──> pi-mom
pi-ai ──> pi-agent-core ─────┘         │
  │                                     │
  └──> pi-web-ui (legado)         pi-pods (tipos apenas)

ai-factory (plataforma web, usa pi-ai + pi-agent-core + pi-coding-agent)
```

| Pacote | Tipo | Path | Descricao |
|--------|------|------|-----------|
| `@mariozechner/pi-ai` | library | `packages/ai` | API LLM unificada multi-provider (Anthropic, OpenAI, Google, Mistral, Bedrock + 17 outros) |
| `@mariozechner/pi-agent-core` | library | `packages/agent` | Runtime de agente com tool calling, state management, streaming |
| `@mariozechner/pi-coding-agent` | cli | `packages/coding-agent` | Agente de codificacao interativo CLI/TUI com tools (read, bash, edit, write, grep, find, ls), extensoes, skills, sessoes |
| `@mariozechner/pi-mom` | backend | `packages/mom` | Bot Slack que delega mensagens ao coding agent (Docker/host sandbox) |
| `@mariozechner/pi` | cli | `packages/pods` | CLI para gerenciar deployments vLLM em GPU pods via SSH |
| `@mariozechner/pi-tui` | library | `packages/tui` | Biblioteca TUI com rendering diferencial, Kitty protocol, componentes |
| `ai-factory` | web app | `packages/ai-factory` | AI Software Factory OS — painel web de orquestracao de agentes com quality gates, Hono + React 19 + Prisma 7 + Vite |
| `@mariozechner/pi-web-ui` | web (legado) | `packages/web-ui` | Web Components Lit + Tailwind — LEGADO, removido do `npm run check` |

### Stack Tecnologico
- **Linguagem:** TypeScript (ESM, ES2022, strict mode)
- **Build:** tsgo (TypeScript Go compiler preview)
- **Lint/Format:** Biome (tabs, indent 3, line width 120)
- **Testes:** Vitest (ai, agent, coding-agent), node:test (tui)
- **CI:** GitHub Actions (Node 22, ubuntu-latest)

## Documentacao

A documentacao completa esta em `docs/`. Ponto de entrada: `docs/index.md`.

### Documentacao Gerada (em `docs/`)
- `index.md` — Indice mestre com links para tudo
- `project-overview.md` — Visao geral, pacotes, dependencias
- `source-tree-analysis.md` — Arvore anotada de todos os ~208 ficheiros fonte
- `integration-architecture.md` — Grafo de dependencias e interfaces entre pacotes
- `operational-reference.md` — **Guia operacional consolidado**: como usar, estender, configurar e construir sobre o pi (providers, SDK, extensoes, skills, RPC, sessoes, packages)
- `architecture-ai.md` — Arquitetura do pi-ai (providers, streaming, OAuth, 10 APIs)
- `architecture-agent.md` — Arquitetura do agent-core (agent loop, eventos, hooks)
- `architecture-coding-agent.md` — Arquitetura do coding-agent (tools, extensoes, compaction, TUI)
- `architecture-mom.md` — Arquitetura do mom (Slack bot, sandbox, eventos)
- `architecture-pods.md` — Arquitetura do pods (SSH, vLLM, GPU)
- `architecture-tui.md` — Arquitetura do tui (rendering diferencial, componentes)
- `architecture-web-ui.md` — Arquitetura do web-ui (Lit, IndexedDB, sandbox, artifacts)
- `development-guide.md` — Setup, build, testes, CI/CD
- `contribution-guide.md` — Processo de contribuicao, estilo, changelog

### Documentacao Operacional do Coding Agent (em `packages/coding-agent/docs/`)
27 documentos cobrindo operacao e construcao com o pi:
- **Configuracao:** `providers.md`, `models.md`, `settings.md`, `custom-provider.md`
- **Extensibilidade:** `extensions.md`, `skills.md`, `packages.md`, `prompt-templates.md`, `themes.md`, `tui.md`
- **Integracao:** `sdk.md`, `rpc.md`, `json.md`
- **Sessoes:** `session.md`, `compaction.md`, `tree.md`
- **Plataforma:** `windows.md`, `termux.md`, `tmux.md`, `terminal-setup.md`, `shell-aliases.md`, `keybindings.md`
- **Desenvolvimento:** `development.md`

### Exemplos
- `packages/coding-agent/examples/extensions/` — ~60 extensoes de exemplo (seguranca, git, UI, tools, providers, games)
- `packages/coding-agent/examples/sdk/` — 13 exemplos de uso programatico (01-minimal ate 13-session-runtime)

### ai-factory (packages/ai-factory)
- Stack propria: Hono + React 19 + Vite 8 + Prisma 7 + TanStack + Zod 4 + shadcn/ui
- Excluido do `tsgo` global — tem `npm run check` proprio (biome + tsc node + tsc app)
- Biome: herda do root com overrides (semicolons asNeeded, trailingCommas all, noExplicitAny warn)
- Antes do primeiro typecheck: `cd packages/ai-factory && npx prisma generate --config prisma/prisma.config.ts`
- Iniciar server: `cd packages/ai-factory && npx tsx src/api/server.ts`
- Testes API: `cd packages/ai-factory && npx vitest --run`
- Testes Web: `cd packages/ai-factory && npx vitest --run --config vitest.config.web.ts`
- Migrations: `cd packages/ai-factory && npx prisma migrate dev --config prisma/prisma.config.ts`
- `.env` requer `JWT_SECRET` (min 32 chars), `JWT_EXPIRATION`, `SESSION_IDLE_TIMEOUT`
- DATABASE_URL `file:./dev.db` — Prisma resolve relativo a `prisma/`, server resolve via `import.meta.url`
- Artefatos de planejamento (PRD, epics, arquitetura): `_bmad-output/planning-artifacts/`

## Guia Rapido para Tarefas Comuns

### Antes de trabalhar num pacote
1. Ler o README.md do pacote
2. Se precisar de contexto arquitetural, ler `docs/architecture-{pacote}.md`
3. Se for sobre o coding-agent, consultar `docs/operational-reference.md`

### Apos fazer alteracoes de codigo
```bash
npm run check    # Obrigatorio — corrigir TUDO antes de commitar
```

### Para executar um teste especifico
```bash
cd packages/{pacote}
npx tsx ../../node_modules/vitest/dist/cli.js --run test/nome.test.ts
```

### Para executar o pi a partir dos fontes
```bash
./pi-test.sh
```

### Adicionar entrada ao changelog
- Ler a secao `[Unreleased]` existente primeiro
- Adicionar sob a subseccao correta (Added, Changed, Fixed, Removed, Breaking Changes)
- Nunca duplicar subseccoes

### Adicionar um novo provider LLM
Seguir o checklist completo em `AGENTS.md` secao "Adding a New LLM Provider" — envolve mudancas em 7 areas (types, provider, exports, model generation, tests, coding-agent, documentation).
