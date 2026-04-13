# Arquitetura: @mariozechner/pi-mom

## Resumo Executivo

`pi-mom` e um backend TypeScript ESM que opera como bot Slack, delegando mensagens recebidas ao agente de codificacao (`pi-coding-agent`). Gerencia estado por canal, execucao em sandbox (Docker ou host), agendamento de eventos via cron e persistencia de conversas. Funciona como uma ponte entre o Slack e o sistema de agentes IA.

## Stack Tecnologico

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript ESM |
| Runtime | Node.js |
| Comunicacao | Slack Socket Mode + Web API |
| Sandbox | Docker (DockerExecutor) ou Host (HostExecutor) |
| Agendamento | croner |
| Agente | pi-agent-core + pi-ai + pi-coding-agent |

## Padrao Arquitetural

**Pipeline de Eventos Slack -> Agente -> Sandbox**

O fluxo principal segue uma pipeline de eventos:

```
Slack Events -> Handler -> AgentRunner -> Agent -> Tools -> Sandbox (Docker/Host)
                              |
                              +-> EventsWatcher (cron)
                              +-> ChannelStore (persistencia)
```

Cada canal Slack recebe seu proprio `AgentRunner` com estado isolado, garantindo que conversas em canais diferentes nao interfiram entre si.

## Modulos Principais

### main.ts
Ponto de entrada da aplicacao. Processa argumentos CLI (`--sandbox`, `--download`) e inicializa o estado por canal.

### slack.ts
Classe `SlackBot` que gerencia toda a comunicacao com o Slack:
- Conexao via Socket Mode (WebSocket)
- Interacao via Web API
- Gerenciamento de usuarios e canais
- Backfill de historico de mensagens
- `ChannelQueue` para processamento ordenado de mensagens
- Download de anexos

### agent.ts
`AgentRunner` - uma instancia por canal Slack:
- Encapsula `AgentSession` do pi-coding-agent
- System prompt customizado com formatacao Slack mrkdwn
- Gerencia ciclo de vida do agente por canal

### context.ts
Sincronizacao de contexto:
- Sincroniza `log.jsonl` com `SessionManager`
- Integra com `SettingsManager`

### events.ts
`EventsWatcher` - sistema de agendamento baseado em filesystem:
- Utiliza croner para expressoes cron
- Suporte a eventos imediatos, one-shot e periodicos
- Monitora diretorio de eventos

### store.ts
`ChannelStore` - persistencia por canal:
- Armazenamento isolado por canal
- Download assincrono de anexos
- Gerenciamento de estado de conversas

### sandbox.ts
Camada de abstracao para execucao de comandos:
- `HostExecutor` - execucao direta no host
- `DockerExecutor` - execucao isolada em container Docker

### Ferramentas
- **bash** - Execucao de comandos shell (via sandbox)
- **read** - Leitura de arquivos
- **write** - Escrita de arquivos
- **edit** - Edicao de arquivos
- **attach** - Upload de arquivos para o Slack
- **truncate** - Truncamento de conteudo

## API Publica / Exports

Este pacote e um backend executavel, nao uma biblioteca. Nao possui exports publicos para consumo externo. A interface principal e via Slack (mensagens e eventos).

## Dependencias Internas e Externas

### Dependencias Internas
| Pacote | Finalidade |
|---|---|
| `@mariozechner/pi-agent-core` | Runtime do agente |
| `@mariozechner/pi-ai` | API unificada de LLM |
| `@mariozechner/pi-coding-agent` | Agente de codificacao e ferramentas |

### Dependencias Externas
| Pacote | Finalidade |
|---|---|
| `@slack/socket-mode` | Conexao WebSocket com Slack |
| `@slack/web-api` | API REST do Slack |
| `@anthropic-ai/sandbox-runtime` | Runtime de sandbox Anthropic |
| `croner` | Agendamento cron |
| `diff` | Calculo de diferencas |

## Testes

- **Sem testes automatizados** no momento.
- A validacao e feita manualmente via interacao com o bot no Slack.
