# Arquitetura: @mariozechner/pi-agent-core

## Resumo Executivo

`pi-agent-core` e uma biblioteca TypeScript ESM que implementa um runtime de agente IA generico. Fornece duas camadas de abstracao: um loop de eventos stateless (`agent-loop.ts`) e um wrapper stateful (`Agent` class em `agent.ts`). O design permite que agentes executem ferramentas em modo sequencial ou paralelo, com hooks extensiveis em cada etapa do ciclo de vida.

## Stack Tecnologico

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript ESM |
| Runtime | Node.js |
| Testes | vitest (3 arquivos) |
| Dependencia Principal | @mariozechner/pi-ai |

## Padrao Arquitetural

**Event Loop de Duas Camadas**

A arquitetura consiste em dois loops aninhados:

1. **Loop externo (follow-up)**: Gerencia mensagens de acompanhamento apos a conclusao de um turno.
2. **Loop interno (steering + tool calls)**: Processa mensagens de direcionamento e execucao de ferramentas.

A execucao de ferramentas segue um pipeline de 3 etapas: **prepare -> execute -> finalize**, com suporte a execucao paralela ou sequencial.

```
Agent (stateful) -> agent-loop (stateless)
                      |
                      +-> Loop Externo (follow-up messages)
                      |     |
                      |     +-> Loop Interno (steering + tool calls)
                      |           |
                      |           +-> prepare -> execute -> finalize
                      |
                      +-> StreamFn (pi-ai) -> LLM
```

## Modulos Principais

### types.ts
Define os tipos centrais do sistema:
- `AgentMessage` - Mensagem extensivel via declaration merging do TypeScript
- `AgentState` - Estado do agente
- `AgentTool` - Interface de ferramenta com metodos `prepareArguments` e `execute`
- `AgentToolResult` - Resultado de execucao de ferramenta
- `StreamFn` - Funcao de streaming (ponte com pi-ai)
- `ToolExecutionMode` - `sequential` ou `parallel`
- `AgentLoopConfig` - Configuracao com hooks: `transformContext`, `getSteeringMessages`, `getFollowUpMessages`, `beforeToolCall`, `afterToolCall`
- `AgentEvent` - 9 tipos de evento: `agent_start/end`, `turn_start/end`, `message_start/update/end`, `tool_execution_start/update/end`

### agent-loop.ts
Implementacao stateless do loop principal do agente. Contem a logica dos dois loops aninhados (externo e interno). Gerencia o ciclo de vida completo de um turno: receber mensagem -> consultar LLM -> executar ferramentas -> responder. Suporta execucao paralela e sequencial de ferramentas com pipeline prepare-execute-finalize.

### agent.ts
Classe `Agent` - wrapper stateful sobre o agent-loop. Metodos principais:
- `prompt()` - Envia mensagem ao agente
- `continue()` - Continua execucao
- `steer()` - Mensagem de direcionamento
- `followUp()` - Mensagem de acompanhamento
- `subscribe()` - Inscreve listener de eventos
- `abort()` - Cancela execucao
- `reset()` - Reinicia estado

Inclui `PendingMessageQueue` com modos `"all"` (processar todas) ou `"one-at-a-time"` (processar uma por vez).

### proxy.ts
Alternativa ao `StreamFn` para cenarios de proxy. Realiza POST para `{proxyUrl}/api/stream` e recebe resposta via SSE (Server-Sent Events). Permite que o agente opere remotamente.

## API Publica / Exports

- Classe `Agent` com metodos `prompt()`, `continue()`, `steer()`, `followUp()`, `subscribe()`, `abort()`, `reset()`
- Funcao `agentLoop()` para uso stateless
- Funcao de proxy para cenarios remotos
- Todos os tipos: `AgentMessage`, `AgentState`, `AgentTool`, `AgentToolResult`, `StreamFn`, `ToolExecutionMode`, `AgentLoopConfig`, `AgentEvent`

## Dependencias Internas e Externas

### Dependencias Internas
| Pacote | Finalidade |
|---|---|
| `@mariozechner/pi-ai` | API unificada de LLM para streaming |

### Dependencias Externas
Nenhuma dependencia externa direta alem do pi-ai.

## Testes

- **Framework**: vitest
- **Cobertura**: 3 arquivos de teste
- **Foco**: Validacao do loop do agente, execucao de ferramentas e gerenciamento de estado
