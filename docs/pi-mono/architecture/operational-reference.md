# Referencia Operacional do Pi Coding Agent

> Guia consolidado para agentes AI que precisam operar, configurar, estender ou construir sobre o pi.
> Fonte: `packages/coding-agent/docs/` (23 documentos) + `examples/` (60+ extensoes, 13 SDK)

## Indice de Navegacao Rapida

| Preciso... | Documento | Secao aqui |
|------------|-----------|------------|
| Usar o pi pela primeira vez | [README](../packages/coding-agent/README.md) | [Quick Start](#quick-start) |
| Configurar um provider/modelo | [providers.md](../packages/coding-agent/docs/providers.md), [models.md](../packages/coding-agent/docs/models.md) | [Providers e Modelos](#providers-e-modelos) |
| Construir uma extensao | [extensions.md](../packages/coding-agent/docs/extensions.md), [tui.md](../packages/coding-agent/docs/tui.md) | [Sistema de Extensoes](#sistema-de-extensoes) |
| Usar o SDK programaticamente | [sdk.md](../packages/coding-agent/docs/sdk.md) | [SDK Programatico](#sdk-programatico) |
| Criar uma skill | [skills.md](../packages/coding-agent/docs/skills.md) | [Skills](#skills) |
| Integrar via RPC/JSON | [rpc.md](../packages/coding-agent/docs/rpc.md), [json.md](../packages/coding-agent/docs/json.md) | [Integracao Programatica](#integracao-programatica) |
| Customizar aparencia | [themes.md](../packages/coding-agent/docs/themes.md), [keybindings.md](../packages/coding-agent/docs/keybindings.md) | [Customizacao Visual](#customizacao-visual) |
| Entender sessoes/compaction | [session.md](../packages/coding-agent/docs/session.md), [compaction.md](../packages/coding-agent/docs/compaction.md) | [Sessoes e Compaction](#sessoes-e-compaction) |
| Distribuir pacotes | [packages.md](../packages/coding-agent/docs/packages.md) | [Pi Packages](#pi-packages) |
| Setup de plataforma | [windows.md](../packages/coding-agent/docs/windows.md), [termux.md](../packages/coding-agent/docs/termux.md), [tmux.md](../packages/coding-agent/docs/tmux.md), [terminal-setup.md](../packages/coding-agent/docs/terminal-setup.md) | [Setup de Plataforma](#setup-de-plataforma) |

---

## Quick Start

```bash
# Instalar
npm install -g @mariozechner/pi-coding-agent

# Autenticar (API key)
export ANTHROPIC_API_KEY=sk-ant-...
pi

# Autenticar (assinatura existente)
pi
/login  # Selecionar provider
```

**4 modos de execucao:**
- **Interativo** (default): TUI completa com editor, mensagens, tools
- **Print**: `pi -p "prompt"` — resposta no stdout e sai
- **JSON**: `pi --mode json "prompt"` — eventos JSON no stdout
- **RPC**: `pi --mode rpc` — protocolo JSONL bidirecional via stdin/stdout

**4 ferramentas built-in:** `read`, `write`, `edit`, `bash`

**Filosofia:** Core minimo, tudo extensivel. Sem sub-agents, plan mode, MCP, permissoes, ou todos built-in — tudo implementavel via extensoes.

---

## Providers e Modelos

### Autenticacao

**Ordem de resolucao de credenciais:** CLI flag > `auth.json` > variavel de ambiente > `models.json`

**Por assinatura** (`/login`):
- Anthropic Claude Pro/Max
- OpenAI ChatGPT Plus/Pro (Codex)
- GitHub Copilot
- Google Gemini CLI
- Google Antigravity

**Por API key** (variavel de ambiente):
| Provider | Variavel |
|----------|----------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google | `GOOGLE_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL` |
| Bedrock | AWS credentials (`AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, etc.) |
| Vertex AI | Application Default Credentials |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| GitHub Copilot | `GITHUB_TOKEN` |

Docs completos: [providers.md](../packages/coding-agent/docs/providers.md)

### Modelos Customizados (`models.json`)

Arquivo: `~/.pi/agent/models.json`

```json
{
  "my-ollama": {
    "api": "openai-completions",
    "baseUrl": "http://localhost:11434/v1",
    "apiKey": "ollama",
    "models": [
      { "id": "llama3.1", "name": "Llama 3.1", "contextWindow": 131072, "maxTokens": 4096 }
    ]
  }
}
```

**APIs suportadas:** `openai-completions`, `openai-responses`, `anthropic-messages`, `google-generative-ai`, `google-vertex`, `bedrock-converse-stream`, `mistral-conversations`

**Resolucao de API key:** `"!command"` (shell), nome de env var, valor literal

**Campo `compat`** para quirks OpenAI: `supportsDeveloperRole`, `supportsReasoningEffort`, `maxTokensField`, `thinkingFormat` ("openai" | "openrouter" | "zai" | "qwen"), `openRouterRouting`, `vercelGatewayRouting`

Docs completos: [models.md](../packages/coding-agent/docs/models.md), [custom-provider.md](../packages/coding-agent/docs/custom-provider.md)

---

## Sistema de Extensoes

Extensoes sao modulos TypeScript que estendem o pi com ferramentas, comandos, UI e event handlers.

### Estrutura Basica

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Registrar ferramenta
  pi.registerTool({
    name: "deploy",
    description: "Deploy to production",
    parameters: Type.Object({ env: Type.String() }),
    async execute(toolCallId, args) {
      return { content: [{ type: "text", text: "Deployed!" }], details: {} };
    }
  });

  // Registrar comando
  pi.registerCommand("stats", {
    description: "Show session stats",
    async execute(args, ctx) {
      ctx.ui.notify("Stats: ...");
    }
  });

  // Escutar eventos
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.arguments.command.includes("rm -rf")) {
      return { block: true, reason: "Dangerous command blocked" };
    }
  });

  // Interceptar input do usuario
  pi.on("input", async (event, ctx) => {
    // Pode modificar ou bloquear a mensagem
  });

  // Injetar contexto no system prompt
  pi.on("context", async (event, ctx) => {
    return { systemPromptAppend: "Additional context..." };
  });
}
```

### Locais de Extensoes

- `~/.pi/agent/extensions/` (global)
- `.pi/extensions/` (projeto)
- Via pi packages (`pi install npm:pkg`)

### Eventos Disponiveis

| Evento | Quando | Pode Retornar |
|--------|--------|---------------|
| `session_start` | Inicio de sessao | — |
| `session_shutdown` | Fim de sessao | — |
| `before_agent_start` | Antes de cada prompt | `systemPromptAppend` |
| `agent_start` / `agent_end` | Inicio/fim de run | — |
| `turn_start` / `turn_end` | Inicio/fim de turno LLM | — |
| `message_start` / `message_update` / `message_end` | Streaming de mensagem | — |
| `tool_call` | Antes de executar tool | `{ block, reason }` ou `{ arguments }` |
| `tool_result` | Apos executar tool | `{ content, details, isError }` |
| `tool_execution_start` / `tool_execution_update` / `tool_execution_end` | Ciclo de vida de tool | — |
| `context` | Construcao de contexto | `systemPromptAppend` |
| `input` | Mensagem do usuario | `{ block }` ou `{ text }` |
| `before_provider_request` | Antes de enviar ao LLM | — |
| `model_select` | Selecao de modelo | — |
| `resources_discover` | Descoberta de recursos | — |
| `session_before_compact` | Antes de compaction | `{ summary }` customizado |
| `session_before_tree` | Antes de nav de arvore | `{ summary }` customizado |

### API de UI para Extensoes

```typescript
// Dialogs interativos
const choice = await ctx.ui.select(items, { title: "Escolha" });
const confirmed = await ctx.ui.confirm("Tem certeza?");
const text = await ctx.ui.input({ title: "Nome" });
ctx.ui.notify("Mensagem para o usuario");

// Componentes persistentes
ctx.ui.setWidget("above", myComponent);  // ou "below"
ctx.ui.setStatus("Building...");
ctx.ui.setFooter(myFooterComponent);
ctx.ui.setEditorComponent(myVimEditor);

// Componente TUI customizado
await ctx.ui.custom(myComponent);  // Monta e aguarda
```

### Componentes TUI Disponiveis

Todos de `@mariozechner/pi-tui`:
- `Text`, `Box`, `Container`, `Spacer` — basicos
- `Markdown` — renderiza Markdown no terminal
- `Image` — imagens inline (Kitty/iTerm2)
- `SelectList` — lista com fuzzy filter
- `SettingsList` — toggles e opcoes
- `BorderedLoader` — loader com cancel
- `DynamicBorder` — borda adaptativa

**Interface `Component`:** `render(width): string[]`, `handleInput?(data): boolean`, `invalidate?(): void`

### Persistencia de Estado em Extensoes

```typescript
// Salvar estado na sessao (NAO vai pro LLM)
pi.appendEntry({ type: "my-extension-state", data: { ... } });

// Ler estado salvo
const entries = ctx.sessionManager.getEntries().filter(e => e.type === "custom" && e.customType === "my-extension-state");
```

### Exemplos de Referencia

60+ extensoes em `packages/coding-agent/examples/extensions/`:
- **Seguranca:** `permission-gate.ts`, `protected-paths.ts`, `confirm-destructive.ts`, `dirty-repo-guard.ts`
- **Git:** `git-checkpoint.ts`, `auto-commit-on-exit.ts`
- **UI:** `custom-footer.ts`, `custom-header.ts`, `widget-placement.ts`, `modal-editor.ts`, `rainbow-editor.ts`
- **Tools:** `tools.ts`, `dynamic-tools.ts`, `tool-override.ts`, `truncated-tool.ts`
- **Providers:** `custom-provider-anthropic/`, `custom-provider-gitlab-duo/`, `custom-provider-qwen-cli/`
- **Avancado:** `subagent/`, `plan-mode/`, `sandbox/`, `handoff.ts`, `ssh.ts`
- **Fun:** `doom-overlay/`, `snake.ts`, `space-invaders.ts`

Docs completos: [extensions.md](../packages/coding-agent/docs/extensions.md), [tui.md](../packages/coding-agent/docs/tui.md)

---

## SDK Programatico

### Uso Minimo

```typescript
import { createAgentSession } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession();
session.subscribe((event) => {
  if (event.type === "message_update") {
    process.stdout.write(event.message.content[0]?.text || "");
  }
});
await session.prompt("What files are in the current directory?");
```

### Controle Total

```typescript
import {
  AuthStorage, ModelRegistry, SessionManager, SettingsManager,
  createAgentSession, createCodingTools, readOnlyTools
} from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const settingsManager = SettingsManager.create();

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),    // ou .create(path)
  authStorage,
  modelRegistry,
  settingsManager,
  model: getModel("anthropic", "claude-sonnet-4-5"),
  thinkingLevel: "medium",
  tools: readOnlyTools,                         // ou codingTools, ou custom
  cwd: "/path/to/project",
});
```

### APIs do AgentSession

| Metodo | Descricao |
|--------|-----------|
| `prompt(text)` | Envia mensagem e inicia run |
| `subscribe(listener)` | Escuta eventos (retorna unsubscribe) |
| `steer(message)` | Injeta mensagem apos turno atual |
| `followUp(message)` | Injeta mensagem apos agente parar |
| `abort()` | Cancela run atual |
| `setModel(model)` | Troca modelo |
| `setThinkingLevel(level)` | Troca nivel de pensamento |
| `compact(prompt?)` | Compacta contexto manualmente |
| `navigateTree(targetId, opts)` | Navega para ponto da arvore |
| `dispose()` | Libera recursos |

### AgentSessionRuntime (multi-sessao)

```typescript
import { createAgentSessionRuntime } from "@mariozechner/pi-coding-agent";

const runtime = await createAgentSessionRuntime({ ... });
await runtime.newSession();
await runtime.switchSession(path);
await runtime.fork(entryId);
await runtime.importFromJsonl(path);
```

### Fabricas de Ferramentas

```typescript
import { codingTools, readOnlyTools, createCodingTools, createReadTool } from "@mariozechner/pi-coding-agent";

// Conjuntos pre-definidos (usam cwd do processo)
codingTools;        // [read, bash, edit, write]
readOnlyTools;      // [read, grep, find, ls]

// Fabricas para cwd customizado
const tools = createCodingTools("/custom/path");
const readTool = createReadTool("/custom/path");
```

Docs completos: [sdk.md](../packages/coding-agent/docs/sdk.md)
Exemplos: `packages/coding-agent/examples/sdk/` (01-minimal ate 13-session-runtime)

---

## Skills

Skills sao instrucoes especializadas em Markdown que o agente carrega sob demanda.

### Estrutura

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
---
name: my-skill
description: Use when the user asks about X
---

# Instructions

1. Do this first
2. Then do that
3. Finally verify with ...
```

### Locais de Descoberta

1. `~/.pi/agent/skills/` (global)
2. `.pi/skills/` (projeto)
3. `.agents/skills/` (compativel com Claude Code)
4. Diretorios pai (caminha ate a raiz)
5. Via pi packages

### Como Funciona

1. Skills aparecem no system prompt como XML (`<available_skills>`)
2. O LLM le a skill completa via tool `read` quando relevante
3. Usuario pode invocar diretamente: `/skill:my-skill argumentos`
4. `disable-model-invocation: true` impede o LLM de carregar automaticamente

### Compatibilidade

Skills sao compativeis com o padrao [Agent Skills](https://agentskills.io), usado tambem por Claude Code e OpenAI Codex.

Docs completos: [skills.md](../packages/coding-agent/docs/skills.md)

---

## Integracao Programatica

### Modo RPC (`pi --mode rpc`)

Protocolo JSONL bidirecional via stdin/stdout. Ideal para IDEs e UIs customizadas.

**Comandos disponíveis:**

| Comando | Descricao |
|---------|-----------|
| `prompt` | Envia mensagem |
| `steer` | Mensagem steering |
| `follow_up` | Mensagem follow-up |
| `abort` | Cancela run |
| `new_session` | Nova sessao |
| `get_state` | Estado atual (modelo, streaming, etc.) |
| `get_messages` | Historico de mensagens |
| `set_model` | Troca modelo |
| `cycle_model` | Cicla modelos |
| `set_thinking_level` | Troca nivel de pensamento |
| `compact` | Compacta contexto |

**Formato:**
```json
{"command": "prompt", "text": "Hello", "id": "req-1"}
```

**Resposta (eventos assincronos):**
```json
{"type": "message_update", "message": {...}}
{"type": "agent_end", "stopReason": "stop"}
```

Docs completos: [rpc.md](../packages/coding-agent/docs/rpc.md)

### Modo JSON (`pi --mode json "prompt"`)

Emite todos os eventos como linhas JSON no stdout. Util para pipelines.

Docs completos: [json.md](../packages/coding-agent/docs/json.md)

---

## Sessoes e Compaction

### Formato de Sessao

Arquivos JSONL com estrutura de arvore (cada entrada tem `id` + `parentId`).

**Localizacao:** `~/.pi/agent/sessions/{hash-do-cwd}/`

**Tipos de entrada:**
- `SessionMessageEntry` — mensagens LLM (user, assistant, toolResult)
- `ModelChangeEntry` — mudanca de modelo
- `CompactionEntry` — resumo de compaction
- `BranchSummaryEntry` — resumo de branch
- `CustomEntry` — dados de extensao (NAO vao ao LLM)
- `CustomMessageEntry` — mensagens de extensao (VAO ao LLM)
- `LabelEntry` — bookmarks
- `SessionInfoEntry` — metadados (nome da sessao)

### Compaction

Quando o contexto excede a janela do LLM:
1. Caminha de tras para frente acumulando tokens (`keepRecentTokens: 20000`)
2. Corta em fronteira user/assistant
3. Gera resumo via LLM com formato estruturado (Goal, Progress, Key Decisions, Next Steps)
4. Historico completo preservado no JSONL — `/tree` para revisitar

**Configuracoes:**
```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

**Customizavel via extensoes** (`session_before_compact` event).

Docs completos: [session.md](../packages/coding-agent/docs/session.md), [compaction.md](../packages/coding-agent/docs/compaction.md), [tree.md](../packages/coding-agent/docs/tree.md)

---

## Settings

**Locais:** `~/.pi/agent/settings.json` (global), `.pi/settings.json` (projeto — sobrescreve global)

### Configuracoes Principais

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4-6",
  "defaultThinkingLevel": "medium",
  "enabledModels": ["claude-opus-4-6:high", "claude-sonnet-4-5:medium", "gpt-5.4:high"],
  "compaction": { "enabled": true, "reserveTokens": 16384, "keepRecentTokens": 20000 },
  "retry": { "enabled": true, "maxRetries": 5, "baseDelayMs": 2000, "maxDelayMs": 64000 },
  "steeringMode": "one-at-a-time",
  "followUpMode": "one-at-a-time",
  "transport": "sse",
  "shellPath": "/bin/bash",
  "shellCommandPrefix": "",
  "npmCommand": ["npm"]
}
```

Docs completos: [settings.md](../packages/coding-agent/docs/settings.md)

---

## Context Files

O pi carrega automaticamente:
- `AGENTS.md` (ou `CLAUDE.md`) — do diretorio atual e pais ate a raiz
- `~/.pi/agent/AGENTS.md` — global

**System prompt customizado:**
- `.pi/SYSTEM.md` — substitui system prompt (projeto)
- `.pi/APPEND_SYSTEM.md` — adiciona ao system prompt
- `~/.pi/agent/SYSTEM.md` / `APPEND_SYSTEM.md` — global

---

## Prompt Templates

Snippets Markdown reutilizaveis que expandem com `/nome`.

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
---
description: Code review focado
---
Review this code for bugs and security issues.
Focus on: $1
Files: ${@:2}
```

**Argumentos:** `$1`, `$2`, `$@` (todos), `${@:N}` (a partir de N), `${@:N:L}` (N com limite L)

**Locais:** `~/.pi/agent/prompts/`, `.pi/prompts/`, via packages

Docs completos: [prompt-templates.md](../packages/coding-agent/docs/prompt-templates.md)

---

## Pi Packages

Sistema de distribuicao de extensoes, skills, prompts e temas.

```bash
pi install npm:@foo/pi-tools        # npm
pi install git:github.com/user/repo # git
pi install git:github.com/user/repo@v1  # versao especifica
pi remove npm:@foo/pi-tools
pi list
pi update
pi config                            # habilitar/desabilitar recursos
```

**Criar um pacote:** Adicionar campo `pi` ao `package.json`:
```json
{
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Docs completos: [packages.md](../packages/coding-agent/docs/packages.md)

---

## Customizacao Visual

### Temas

51 tokens de cor obrigatorios. Arquivo JSON em `~/.pi/agent/themes/` ou `.pi/themes/`.
Hot-reload automatico ao editar.
Built-in: `dark`, `light`.

Docs completos: [themes.md](../packages/coding-agent/docs/themes.md)

### Keybindings

Arquivo `~/.pi/agent/keybindings.json`. Namespaces: `tui.editor.*`, `tui.input.*`, `app.*`.
Hot-reload com `/reload`.

**Atalhos essenciais:**
| Tecla | Acao |
|-------|------|
| Ctrl+C | Limpa editor / Quit (2x) |
| Escape | Cancela / Abort |
| Ctrl+L | Seletor de modelo |
| Ctrl+P | Cicla modelos |
| Shift+Tab | Cicla thinking level |
| Ctrl+O | Colapsa/expande output de tools |
| `/tree` ou Escape 2x | Navega arvore de sessao |

Docs completos: [keybindings.md](../packages/coding-agent/docs/keybindings.md)

---

## Setup de Plataforma

| Plataforma | Documento | Notas Chave |
|------------|-----------|-------------|
| **Windows** | [windows.md](../packages/coding-agent/docs/windows.md) | Requer Git Bash, Cygwin/MSYS2 ou WSL. Config `shellPath` |
| **Android (Termux)** | [termux.md](../packages/coding-agent/docs/termux.md) | `pkg install nodejs termux-api git`. Sem imagens clipboard |
| **tmux** | [tmux.md](../packages/coding-agent/docs/tmux.md) | `set -g extended-keys on`, `extended-keys-format csi-u`. Requer 3.2+ |
| **Terminal geral** | [terminal-setup.md](../packages/coding-agent/docs/terminal-setup.md) | Kitty keyboard protocol. Configs para Ghostty, WezTerm, VS Code, IntelliJ |
| **Shell aliases** | [shell-aliases.md](../packages/coding-agent/docs/shell-aliases.md) | `shellCommandPrefix` com `shopt -s expand_aliases` |

---

## Mapa de Decisao para Agentes AI

```
Preciso adicionar capacidade ao pi?
├── E uma instrucao/workflow? → Criar SKILL (.md)
├── E um snippet de prompt? → Criar PROMPT TEMPLATE (.md)
├── Preciso de codigo executavel? → Criar EXTENSAO (.ts)
│   ├── Ferramenta para o LLM? → pi.registerTool()
│   ├── Comando para o usuario? → pi.registerCommand()
│   ├── Interceptar acoes? → pi.on("tool_call" | "input" | ...)
│   ├── UI customizada? → ctx.ui.custom() / setWidget() / setFooter()
│   ├── Provider customizado? → pi.registerProvider()
│   └── Compaction customizada? → pi.on("session_before_compact")
├── Preciso integrar programaticamente? → Usar SDK ou RPC
│   ├── Node.js/TypeScript? → createAgentSession() (SDK)
│   ├── Outra linguagem? → pi --mode rpc (JSONL)
│   └── Pipeline/CI? → pi -p "prompt" ou pi --mode json
└── Preciso distribuir? → Criar PI PACKAGE (npm/git)
```
