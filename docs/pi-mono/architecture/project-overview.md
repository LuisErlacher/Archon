# Pi Monorepo - Visao Geral do Projeto

## Sobre

Pi Monorepo e um conjunto de ferramentas para construir agentes AI e gerenciar deployments de LLM.

- **Autor:** Mario Zechner (badlogic)
- **Licenca:** MIT
- **Repositorio:** [github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono)
- **Website:** [shittycodingagent.ai](https://shittycodingagent.ai) / [pi.dev](https://pi.dev)
- **Versao:** 0.66.0
- **Versionamento:** lockstep - todos os pacotes compartilham a mesma versao

## Pacotes

O monorepo contem 7 pacotes:

| Pacote | Tipo | Descricao |
|--------|------|-----------|
| `@mariozechner/pi-ai` | library | API LLM unificada multi-provider (Anthropic, OpenAI, Google, Mistral, Bedrock) |
| `@mariozechner/pi-agent-core` | library | Runtime de agente com tool calling e state management |
| `@mariozechner/pi-coding-agent` | cli | Agente de codificacao interativo CLI/TUI |
| `@mariozechner/pi-mom` | backend | Bot Slack que delega ao coding agent |
| `@mariozechner/pi-tui` | library | Biblioteca TUI com rendering diferencial |
| `@mariozechner/pi-web-ui` | web | Web Components para chat AI (Lit + Tailwind) |
| `@mariozechner/pi` | cli | CLI para gerenciar vLLM em GPU pods |

## Arquitetura

- **Gerenciador de workspaces:** npm workspaces monorepo
- **Linguagem:** TypeScript ESM
- **Build:** tsgo (TypeScript Go compiler)
- **Lint:** Biome
- **Testes:** Vitest + node:test
- **CI:** GitHub Actions

## Cadeia de Dependencias

A cadeia principal de dependencias entre os pacotes segue esta ordem:

```
pi-ai <- pi-agent-core <- pi-coding-agent <- pi-mom
```

Dependencias adicionais:

- `pi-tui` <- `pi-coding-agent`
- `pi-web-ui` usa `pi-ai` + `pi-tui`
