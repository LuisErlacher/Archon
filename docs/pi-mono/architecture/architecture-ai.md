# Arquitetura: @mariozechner/pi-ai

## Resumo Executivo

`pi-ai` e uma biblioteca TypeScript ESM que fornece uma API LLM unificada multi-provider. Abstrai as diferencas entre 10+ APIs de provedores de IA (Anthropic, OpenAI, Google, AWS Bedrock, Mistral, etc.) em uma interface unica de streaming-first baseada em `AsyncIterable`. Requer Node >= 20.

A biblioteca registra provedores via plugin registry com lazy loading, oferece um catalogo de modelos auto-gerado, sistema de autenticacao OAuth com 5 fluxos distintos, e utilitarios para parsing parcial de JSON, deteccao de overflow e validacao de schemas.

## Stack Tecnologico

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript ESM |
| Runtime | Node.js >= 20 |
| Build | tsgo |
| Testes | vitest (52 arquivos) |
| Validacao | AJV + @sinclair/typebox |
| HTTP | undici, proxy-agent |

## Padrao Arquitetural

**Plugin Registry com Lazy Loading**

O sistema utiliza um registro global (`Map`) onde cada provedor e registrado como plugin. Os provedores sao carregados sob demanda (lazy loading) quando requisitados, evitando o custo de inicializacao de SDKs nao utilizados.

O fluxo principal e streaming-first: todas as interacoes com LLMs retornam `AsyncIterable` de eventos tipados, permitindo processamento incremental de respostas.

```
Client -> stream()/complete() -> api-registry (Map) -> Provider Plugin (lazy loaded) -> LLM API
```

## Modulos Principais

### types.ts
Define todos os tipos centrais do sistema: `Message`, `Context`, `Model`, `Tool`, `StreamOptions` e 12 tipos de eventos de streaming. E o contrato que todos os provedores devem implementar.

### stream.ts
Implementa as 4 funcoes principais da API: `stream()`, `complete()`, `streamSimple()` e `completeSimple()`. Todas operam sobre o registry de provedores e produzem `AsyncIterable` de eventos.

### api-registry.ts
Registro global baseado em `Map` que mapeia identificadores de provedores para suas implementacoes. Ponto central de resolucao de provedores.

### models.ts + models.generated.ts
Catalogo de modelos disponíveis. `models.generated.ts` e auto-gerado e contem metadados de todos os modelos conhecidos. `models.ts` fornece funcoes de consulta e filtragem.

### Provedores (10 APIs)
Cada provedor implementa a interface de streaming para sua API respectiva:
- `anthropic-messages` - Anthropic Messages API
- `openai-completions` - OpenAI Chat Completions
- `openai-responses` - OpenAI Responses API
- `azure-openai-responses` - Azure OpenAI Responses
- `openai-codex-responses` - OpenAI Codex Responses
- `google-generative-ai` - Google Generative AI
- `google-gemini-cli` - Google Gemini CLI
- `google-vertex` - Google Vertex AI
- `bedrock-converse-stream` - AWS Bedrock Converse Stream
- `mistral-conversations` - Mistral Conversations

### Sistema OAuth
5 fluxos de autenticacao:
- Anthropic PKCE
- GitHub Device Code
- Google Gemini CLI
- Google Antigravity
- OpenAI Codex

### Utilitarios
- `json-parse` - Parsing parcial de JSON para processamento de streaming
- Deteccao de overflow - 18+ padroes para identificar limites de contexto
- `sanitize-unicode` - Limpeza de caracteres Unicode problematicos
- Validacao via AJV - Validacao de schemas JSON
- `transform-messages` - Transformacao de mensagens para compatibilidade cross-provider

## API Publica / Exports

O ponto de entrada principal e `index.ts` (barrel export), que expoe:

- Funcoes de streaming: `stream()`, `complete()`, `streamSimple()`, `completeSimple()`
- Registry: funcoes de registro e consulta de provedores
- Tipos: `Message`, `Context`, `Model`, `Tool`, `StreamOptions`, tipos de eventos
- Catalogo de modelos: consulta e filtragem de modelos

Pontos de entrada secundarios:
- `cli.ts` - Comandos CLI (`pi-ai login`, `pi-ai list`)
- `oauth.ts` - Fluxos de autenticacao OAuth
- `bedrock-provider.ts` - Provider AWS Bedrock

## Dependencias Internas e Externas

### Dependencias Externas
| Pacote | Finalidade |
|---|---|
| `@anthropic-ai/sdk` | SDK Anthropic |
| `openai` | SDK OpenAI |
| `@google/genai` | SDK Google Generative AI |
| `@aws-sdk/client-bedrock-runtime` | SDK AWS Bedrock |
| `@mistralai/mistralai` | SDK Mistral |
| `@sinclair/typebox` | Definicao de schemas TypeScript |
| `ajv` | Validacao JSON Schema |
| `partial-json` | Parsing parcial de JSON |
| `proxy-agent` | Suporte a proxy HTTP |
| `undici` | Cliente HTTP |

### Dependencias Internas
Nenhuma - `pi-ai` e um pacote de base no monorepo.

### 22 Provedores Conhecidos
anthropic, openai, google, amazon-bedrock, github-copilot, xai, groq, cerebras, openrouter, mistral, entre outros.

## Testes

- **Framework**: vitest
- **Cobertura**: 52 arquivos de teste
- **Build**: tsgo
