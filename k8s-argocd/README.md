# Manifestos Kubernetes para ArgoCD - Archon

Este diretório contém os manifestos Kubernetes corrigidos para deploy do Archon via ArgoCD.

## Estrutura

```
k8s-argocd/
├── kustomization.yaml         # Kustomize configuration
├── configmap.yaml             # ConfigMap com variáveis de ambiente
├── deployment-server.yaml     # Deployment do backend (FastAPI)
├── deployment-mcp.yaml        # Deployment do MCP server (CORRIGIDO)
├── deployment-agents.yaml     # Deployment dos AI agents (NOVO)
├── deployment-frontend.yaml   # Deployment do frontend (React)
├── service-server.yaml        # Service ClusterIP para backend
├── service-mcp.yaml           # Service ClusterIP para MCP
├── service-agents.yaml        # Service ClusterIP para agents (NOVO)
├── service-frontend.yaml      # Service ClusterIP para frontend
└── ingress.yaml               # Ingress com path /agents (ATUALIZADO)
```

## Correções Aplicadas

### 1. ConfigMap Preenchido ✅
O `configmap.yaml` agora contém todas as variáveis necessárias:
- `ARCHON_SERVER_PORT: "8181"`
- `ARCHON_MCP_PORT: "8051"`
- `ARCHON_AGENTS_PORT: "8052"`
- `HOST: "archon.automatizase.com.br"`
- `SERVICE_DISCOVERY_MODE: "kubernetes"`
- `LOG_LEVEL: "INFO"`

### 2. Deployment MCP Corrigido ✅
Adicionadas as seguintes variáveis críticas:
- `API_SERVICE_URL: http://archon-server-service:8181` - Corrige conexão com backend
- `AGENTS_SERVICE_URL: http://archon-agents-service:8052` - Conexão com agents
- `AGENTS_ENABLED: "true"`
- `TRANSPORT: "sse"`
- Todas as portas configuradas via ConfigMap

### 3. Deployment Agents Criado ✅
Novo deployment para o serviço de AI agents:
- Porta 8052
- Health checks configurados
- Conectado ao Supabase
- Recursos: 500m CPU / 1Gi RAM (request), 2000m CPU / 4Gi RAM (limit)

### 4. Service Agents Criado ✅
Novo service ClusterIP para agents na porta 8052

### 5. Ingress Atualizado ✅
Adicionado novo path para agents:
- `/agents` → `archon-agents-service:8052`

## Como Atualizar no ArgoCD

### Opção 1: Atualizar Repositório Git (Recomendado)

1. **Copie estes manifestos para o repositório k8s-templates**:
   ```bash
   # Clone o repositório (se ainda não tiver)
   git clone git@github.com:LuisErlacher/k8s-templates.git
   cd k8s-templates

   # Copie os manifestos
   cp -r /home/luis/projetos/Archon/k8s-argocd/* apps/custom/archon/base/

   # Commit e push
   git add apps/custom/archon/base/
   git commit -m "fix: Corrige configuração do Archon

   - Preenche ConfigMap com variáveis necessárias
   - Adiciona API_SERVICE_URL no MCP para comunicação com backend
   - Adiciona deployment e service de archon-agents
   - Atualiza ingress com path /agents
   - Corrige todas as variáveis de ambiente"

   git push origin main
   ```

2. **Force sync no ArgoCD**:
   ```bash
   # Login no ArgoCD (já feito)
   argocd login argo.automatizase.com.br --username admin --password 'ngVMwCYWN0GynH0g' --grpc-web

   # Sync com prune
   argocd app sync argocd/archon --prune
   ```

### Opção 2: Aplicar Diretamente via kubectl

Se tiver acesso kubectl ao cluster:

```bash
kubectl apply -k k8s-argocd/
```

**IMPORTANTE**: Esta opção não sincroniza com o Git e pode causar divergências no ArgoCD.

## Verificação Após Deploy

### 1. Verificar Status no ArgoCD
```bash
argocd app get argocd/archon
```

Esperado:
- Sync Status: Synced
- Health Status: Healthy
- Todos os 11 recursos (antes eram 8)

### 2. Verificar Logs dos Pods

**Backend**:
```bash
argocd app logs argocd/archon --kind Deployment --name archon-server --tail 50
```

**MCP** (deve mostrar conexão OK com backend e agents):
```bash
argocd app logs argocd/archon --kind Deployment --name archon-mcp --tail 50
```

Esperado:
- ✅ `API service health check: OK`
- ✅ `Agents service health check: OK`

**Agents** (novo):
```bash
argocd app logs argocd/archon --kind Deployment --name archon-agents --tail 50
```

### 3. Testar Endpoints

```bash
# Health checks
curl https://archon.automatizase.com.br/health
curl https://archon.automatizase.com.br/api/health

# MCP (pode retornar 406 se não tiver sessão, mas deve responder)
curl -I https://archon.automatizase.com.br/mcp/health

# Agents
curl https://archon.automatizase.com.br/agents/health
```

### 4. Verificar Recursos Kubernetes

```bash
# Listar todos os recursos
argocd app resources argocd/archon

# Deve mostrar 11 recursos não-órfãos:
# - 1 ConfigMap
# - 4 Deployments (server, mcp, agents, frontend)
# - 4 Services
# - 1 Ingress
# - 1 Certificate (TLS)
```

## Rollback em Caso de Problemas

Se algo der errado, faça rollback para o commit anterior:

```bash
# No repositório Git
git revert HEAD
git push origin main

# Sync no ArgoCD
argocd app sync argocd/archon
```

Ou use a UI do ArgoCD para fazer rollback para uma revisão anterior.

## Configuração de Imagens

Atualmente usando imagens públicas do Docker Hub:
- `coleam00/archon-server:latest`
- `coleam00/archon-mcp:latest`
- `coleam00/archon-agents:latest`
- `coleam00/archon-frontend:latest`

Para usar suas próprias imagens, edite os deployments e substitua `image:` pelo seu registry.

## Variáveis que Podem Ser Customizadas

Edite `configmap.yaml` para ajustar:
- `LOG_LEVEL`: DEBUG, INFO, WARNING, ERROR
- `HOST`: Domínio público da aplicação

Edite os deployments para ajustar:
- `OPENAI_API_KEY`: Chave da API OpenAI (ou deixe vazio para configurar via UI)
- `LOGFIRE_TOKEN`: Token do Logfire para observabilidade

## Diferenças da Configuração Anterior

| Item | Antes | Depois |
|------|-------|--------|
| ConfigMap | Vazio | Preenchido com 6 variáveis |
| MCP - API_SERVICE_URL | ❌ Ausente | ✅ http://archon-server-service:8181 |
| MCP - AGENTS_SERVICE_URL | ❌ Ausente | ✅ http://archon-agents-service:8052 |
| Deployment Agents | ❌ Ausente | ✅ Criado |
| Service Agents | ❌ Ausente | ✅ Criado |
| Ingress /agents path | ❌ Ausente | ✅ Adicionado |
| Total de Recursos | 8 | 11 |

## Problemas Conhecidos Corrigidos

1. ✅ MCP não conseguia conectar ao backend (tentava localhost:8181)
2. ✅ Agents service não existia
3. ✅ ConfigMap vazio causava pods sem variáveis corretas
4. ✅ Ingress não expunha endpoint de agents

## Suporte

Para mais detalhes sobre os problemas identificados e corrigidos, consulte:
- `ARCHON_ARGOCD_DIAGNOSTIC.md` - Diagnóstico completo da aplicação

## Notas Importantes

- **Namespace**: automatizase (não altere sem atualizar todos os manifestos)
- **Domínio**: archon.automatizase.com.br (path-based routing)
- **Supabase**: Usa secret existente `supabase-jwt` com chave `serviceKey`
- **Cert Manager**: Usa ClusterIssuer `letsencrypt-prod`
- **Kustomize**: Usa kustomization.yaml para aplicar labels comuns
