# Arquitetura: @mariozechner/pi

## Resumo Executivo

`pi` e uma CLI TypeScript ESM para gerenciar deployments de modelos vLLM em GPU pods remotos. Fornece comandos para configurar pods, iniciar/parar modelos, monitorar logs e acessar shells remotos. Toda a comunicacao com os pods e feita via SSH/SCP, e a configuracao de modelos e selecionada automaticamente com base no tipo e quantidade de GPUs disponiveis.

## Stack Tecnologico

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript ESM |
| Runtime | Node.js |
| Comunicacao Remota | SSH / SCP |
| Inferencia | vLLM |
| UI CLI | chalk |

## Padrao Arquitetural

**CLI Simples com Comunicacao SSH**

A arquitetura segue um padrao de CLI direto, onde cada comando executa operacoes remotas via SSH:

```
CLI (cli.ts) -> Comando -> ssh.ts (SSH/SCP) -> GPU Pod Remoto
                  |
                  +-> config.ts (~/.pi/pods.json)
                  +-> model-configs.ts (models.json)
```

Nao ha servidor intermediario - a CLI se conecta diretamente aos pods via SSH.

## Modulos Principais

### cli.ts
Ponto de entrada com os seguintes comandos:
- `pods` - Gerenciamento de pods (setup, teste de conexao)
- `shell` - Shell interativo no pod
- `ssh` - Acesso SSH direto
- `start` - Iniciar modelo vLLM
- `stop` - Parar modelo
- `list` - Listar modelos em execucao
- `logs` - Visualizar logs do vLLM
- `agent` - Modo agente

Suporte a flag `--pod` para selecao de pod especifico.

### config.ts
Gerenciamento de configuracao:
- Persistencia em `~/.pi/pods.json`
- Operacoes CRUD para pods
- Seletor de pod ativo

### types.ts
Tipos do sistema:
- `GPU` - Informacoes de GPU (tipo, memoria, ID)
- `Model` - Configuracao de modelo vLLM
- `Pod` - Configuracao de pod remoto (host, usuario, GPUs)
- `Config` - Configuracao global da CLI

### ssh.ts
Camada de comunicacao remota:
- `sshExec()` - Execucao de comandos remotos
- `sshExecStream()` - Execucao com streaming de output
- `scpFile()` - Transferencia de arquivos
- Keepalive para conexoes longas

### model-configs.ts
Gerenciamento de configuracoes de modelos:
- Carrega `models.json` com configuracoes pre-definidas
- Seleciona melhor configuracao com base no tipo e quantidade de GPUs

### commands/pods.ts
Gerenciamento de pods:
- Teste de conexao SSH
- Script de setup inicial
- Deteccao de GPUs via `nvidia-smi`

### commands/models.ts
Gerenciamento de modelos vLLM:
- Start/stop de modelos
- Alocacao de GPUs (round-robin)
- Execucao do vLLM
- Deteccao de OOM (Out of Memory)

### commands/prompt.ts
Modulo para interacao direta com modelos (ainda nao implementado).

## API Publica / Exports

Este pacote e uma CLI executavel. Nao possui exports publicos para consumo como biblioteca. A interface principal e via linha de comando.

## Dependencias Internas e Externas

### Dependencias Internas
| Pacote | Finalidade |
|---|---|
| `@mariozechner/pi-agent-core` | Runtime do agente (para modo agent) |

### Dependencias Externas
| Pacote | Finalidade |
|---|---|
| `chalk` | Formatacao de output colorido no terminal |

## Testes

- **Sem testes automatizados** no momento.
- Validacao manual via execucao dos comandos contra pods reais.
