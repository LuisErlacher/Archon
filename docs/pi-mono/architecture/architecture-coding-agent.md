# Arquitetura: @mariozechner/pi-coding-agent

## Resumo Executivo

`pi-coding-agent` e um agente de codificacao interativo com interface CLI/TUI. Construido em TypeScript ESM (Node >= 20.6), oferece uma experiencia completa de assistencia a codificacao via terminal, com 7 ferramentas integradas, sistema de extensoes, compactacao automatica de contexto, persistencia de sessoes em arvore e 3 modos de operacao (TUI interativo, Print para piping e RPC via JSON-RPC).

O sistema e o pacote mais complexo do monorepo, com ~1000 LOC apenas na classe `AgentSession` e 89 arquivos de teste.

## Stack Tecnologico

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript ESM |
| Runtime | Node.js >= 20.6 |
| Build | tsgo |
| Testes | vitest (89 arquivos) |
| TUI | pi-tui (~36 componentes) |
| Agent Runtime | pi-agent-core |
| LLM | pi-ai |
| Plugin Loader | @mariozechner/jiti |
| Schemas | @sinclair/typebox |
| Outros | diff, glob, marked, yaml |

## Padrao Arquitetural

**Pipeline Multi-Camada com Extensoes**

O fluxo principal segue uma pipeline linear com pontos de extensao em cada camada:

```
CLI Entry -> main.ts -> AgentSessionRuntime -> AgentSession -> Agent -> LLM
                                                    |
                                                    +-> Tools (7 built-in)
                                                    +-> Extensions (plugins TypeScript)
                                                    +-> TUI (rendering)
```

- **AgentSessionRuntime**: Gerencia ciclo de vida, troca de sessoes, fork e importacao
- **AgentSession** (~1000 LOC): Coracao do sistema - estado do agente, eventos, cycling de modelo (Ctrl+P), compactacao, extensoes
- **AgentSessionServices**: Servicos vinculados ao diretorio de trabalho (SettingsManager, ModelRegistry, ResourceLoader, AuthStorage)

## Modulos Principais

### AgentSession
Classe central com ~1000 linhas. Gerencia:
- Estado completo do agente
- Despacho de eventos
- Cycling de modelo (Ctrl+P para trocar modelo)
- Compactacao automatica de contexto
- Carregamento e coordenacao de extensoes

### AgentSessionRuntime
Gerenciamento de ciclo de vida:
- Troca entre sessoes
- Fork de sessoes existentes
- Importacao de sessoes

### AgentSessionServices
Servicos vinculados ao CWD:
- `SettingsManager` - Configuracoes em 3 niveis
- `ModelRegistry` - Registro e resolucao de modelos
- `ResourceLoader` - Carregamento de recursos
- `AuthStorage` - Armazenamento de credenciais

### Ferramentas (7 built-in)
Cada ferramenta expoe uma interface `Operations` plugavel para seguranca e testabilidade:
1. **read** - Leitura de arquivos
2. **bash** - Execucao de comandos shell
3. **edit** - Edicao de arquivos
4. **write** - Escrita de arquivos
5. **grep** - Busca em conteudo
6. **find** - Busca de arquivos (glob)
7. **ls** - Listagem de diretorios

Inclui fila de mutacao de arquivos para seguranca em execucao paralela.

### Sistema de Extensoes
Plugins TypeScript carregados via jiti. Eventos disponiveis:
- `agent`, `turn`, `message`, `tool`, `session`, `input`, `context`, `resources`

API de extensao: primitivas de UI, `registerTool`, `registerCommand`, `setModel`, `exec`.

### Compactacao
Gerenciamento automatico de contexto:
- Percorre mensagens de tras para frente acumulando tokens
- Corta na fronteira user/assistant
- Gera resumo via LLM
- Sumarizacao de branches para navegacao em arvore

### Sessoes
- Persistencia em formato JSONL
- Estrutura em arvore (id/parentId)
- Suporte a branching
- 8 tipos de entrada
- Armazenamento em `~/.pi/agent/sessions/`

### Skills
Arquivos Markdown com frontmatter YAML:
- Descoberta em `~/.pi/agent/skills/` e `.pi/skills/`
- Injecao como XML no system prompt

### Comandos Slash
19 comandos built-in. Resolver de modelo com fuzzy matching, padroes glob e aliases.

### Modos de Operacao
- **Interactive TUI** - ~36 componentes de interface terminal
- **Print** - Modo para piping entre comandos
- **RPC** - Protocolo JSON-RPC para integracao programatica

### Sistema de Configuracao
Merge em 3 niveis: global + projeto + overrides.

### System Prompt
Reconstrucao dinamica incluindo:
- Ferramentas disponiveis
- Guidelines
- Arquivos de contexto (AGENTS.md, CLAUDE.md)
- Skills carregadas
- Extensoes ativas

## API Publica / Exports

- `AgentSession` - Classe principal de sessao
- `AgentSessionRuntime` - Gerenciamento de ciclo de vida
- `AgentSessionServices` - Servicos do diretorio de trabalho
- Ferramentas individuais com interfaces `Operations`
- API de extensao (registerTool, registerCommand, etc.)
- 19 comandos slash

## Dependencias Internas e Externas

### Dependencias Internas
| Pacote | Finalidade |
|---|---|
| `@mariozechner/pi-agent-core` | Runtime do agente |
| `@mariozechner/pi-ai` | API unificada de LLM |
| `@mariozechner/pi-tui` | Componentes de interface terminal |

### Dependencias Externas
| Pacote | Finalidade |
|---|---|
| `@sinclair/typebox` | Definicao de schemas |
| `@mariozechner/jiti` | Carregamento dinamico de plugins TypeScript |
| `diff` | Calculo de diferencas em texto |
| `glob` | Pattern matching de arquivos |
| `marked` | Parsing de Markdown |
| `yaml` | Parsing de YAML |

## Testes

- **Framework**: vitest
- **Cobertura**: 89 arquivos de teste
- **Build**: tsgo
- **Escopo**: Ferramentas, sessoes, compactacao, extensoes, comandos, resolucao de modelo
