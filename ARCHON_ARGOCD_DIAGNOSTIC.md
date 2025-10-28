# Diagnóstico da Aplicação Archon no ArgoCD

**Data**: 2025-10-27
**Cluster**: argo.automatizase.com.br
**Namespace**: automatizase
**Aplicação**: archon

## Status Atual

- **Sync Status**: Synced to HEAD (90e9ecd)
- **Health Status**: Healthy
- **ArgoCD Status**: Operacional, mas com problemas de funcionamento

## Recursos Ativos

| Tipo | Nome | Status | Health |
|------|------|--------|--------|
| ConfigMap | archon-config | Synced | - |
| Deployment | archon-frontend | Synced | Healthy |
| Deployment | archon-mcp | Synced | Healthy |
| Deployment | archon-server | Synced | Healthy |
| Service | archon-frontend-service | Synced | Healthy |
| Service | archon-mcp-service | Synced | Healthy |
| Service | archon-server-service | Synced | Healthy |
| Ingress | archon-ingress | Synced | Healthy |

## Problemas Identificados

### 1. ConfigMap Vazio ⚠️ CRÍTICO

**Problema**: O ConfigMap `archon-config` está completamente vazio, mas os deployments referenciam as seguintes chaves:

```yaml
# Chaves referenciadas mas NÃO existentes:
- ARCHON_SERVER_PORT
- ARCHON_MCP_PORT
- HOST
- SERVICE_DISCOVERY_MODE
- LOG_LEVEL
```

**Impacto**:
- Pods podem falhar ao iniciar ou ter comportamento incorreto
- Variáveis de ambiente não são injetadas corretamente

**Solução**: Preencher o ConfigMap com as variáveis necessárias.

### 2. MCP Não Consegue Se Conectar ao Backend ⚠️ CRÍTICO

**Problema**: Logs do MCP mostram:

```
2025-10-07 23:38:57 | mcp | INFO | Checking API service health at: http://localhost:8181/api/health
2025-10-07 23:38:57 | mcp | WARNING | API service health check failed: All connection attempts failed
2025-10-07 23:38:57 | __main__ | WARNING | Health check failed: {'status': 'degraded', 'api_service': False, 'agents_service': False}
```

**Causa**: O MCP está tentando se conectar a `localhost:8181` em vez do service Kubernetes `archon-server-service:8181`.

**Variável faltante**: `API_SERVICE_URL` não está configurada no deployment do MCP.

**Solução**: Adicionar variável de ambiente:
```yaml
- name: API_SERVICE_URL
  value: http://archon-server-service:8181
```

### 3. Deployment de Agents Ausente ⚠️ IMPORTANTE

**Problema**: Não existe deployment para `archon-agents`, mas:
- O docker-compose.yml inclui este serviço
- O MCP verifica health do agents service
- Logs mostram: `'agents_service': False`

**Impacto**: Funcionalidades de AI agents não estão disponíveis.

**Solução**: Adicionar deployment e service para archon-agents.

### 4. Variáveis de Ambiente Incompletas

**Deployments atuais faltam**:

**archon-mcp**:
- `API_SERVICE_URL` (crítico)
- `AGENTS_ENABLED`
- `AGENTS_SERVICE_URL`
- `ARCHON_SERVER_PORT` (está no ConfigMap vazio)
- `ARCHON_AGENTS_PORT`
- `ARCHON_MCP_PORT` (está no ConfigMap vazio)
- `TRANSPORT` (já está: sse)

**archon-server**:
- `ARCHON_SERVER_PORT`
- `ARCHON_MCP_PORT`
- `ARCHON_AGENTS_PORT`
- `AGENTS_ENABLED`
- `ARCHON_HOST`
- `SERVICE_DISCOVERY_MODE` (deve ser "kubernetes")

**archon-frontend**:
- Configuração parece OK

## Configuração de Rede Atual

### Ingress
- **Host**: `archon.automatizase.com.br`
- **Paths**:
  - `/api` → archon-server-service:8181
  - `/health` → archon-server-service:8181
  - `/socket.io` → archon-server-service:8181
  - `/mcp` → archon-mcp-service:8051
  - `/` → archon-frontend-service:3737

### Services Internos
- `archon-server-service:8181` (ClusterIP)
- `archon-mcp-service:8051` (ClusterIP)
- `archon-frontend-service:3737` (ClusterIP)

## Comparação com Configuração Docker Compose

| Serviço | Docker Compose | Kubernetes | Status |
|---------|----------------|------------|--------|
| archon-server | ✅ Port 8181 | ✅ Port 8181 | OK |
| archon-mcp | ✅ Port 8051 | ✅ Port 8051 | Falta config |
| archon-agents | ✅ Port 8052 | ❌ AUSENTE | Falta criar |
| archon-frontend | ✅ Port 3737 | ✅ Port 3737 | OK |

## Ações Necessárias

### Ação 1: Preencher ConfigMap ⚠️ URGENTE

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: archon-config
  namespace: automatizase
data:
  ARCHON_SERVER_PORT: "8181"
  ARCHON_MCP_PORT: "8051"
  ARCHON_AGENTS_PORT: "8052"
  HOST: "archon.automatizase.com.br"
  SERVICE_DISCOVERY_MODE: "kubernetes"
  LOG_LEVEL: "INFO"
```

### Ação 2: Adicionar Variáveis no Deployment MCP ⚠️ URGENTE

No deployment `archon-mcp`, adicionar:

```yaml
env:
  # ... variáveis existentes ...
  - name: API_SERVICE_URL
    value: http://archon-server-service:8181
  - name: AGENTS_ENABLED
    value: "true"
  - name: AGENTS_SERVICE_URL
    value: http://archon-agents-service:8052
  - name: ARCHON_SERVER_PORT
    value: "8181"
  - name: ARCHON_MCP_PORT
    value: "8051"
  - name: ARCHON_AGENTS_PORT
    value: "8052"
  - name: TRANSPORT
    value: "sse"
```

### Ação 3: Criar Deployment e Service de Agents

Adicionar novos recursos para archon-agents (ver manifesto completo no repositório).

### Ação 4: Atualizar Deployment Server

Adicionar variáveis faltantes no `archon-server`:

```yaml
env:
  # ... variáveis existentes ...
  - name: ARCHON_SERVER_PORT
    value: "8181"
  - name: ARCHON_MCP_PORT
    value: "8051"
  - name: ARCHON_AGENTS_PORT
    value: "8052"
  - name: AGENTS_ENABLED
    value: "true"
  - name: ARCHON_HOST
    value: "archon.automatizase.com.br"
  - name: SERVICE_DISCOVERY_MODE
    value: "kubernetes"
```

### Ação 5: Atualizar Ingress para Agents

Adicionar path para agents no ingress:

```yaml
- backend:
    service:
      name: archon-agents-service
      port:
        number: 8052
  path: /agents
  pathType: Prefix
```

## Recursos Órfãos

A aplicação tem 32 recursos órfãos (principalmente secrets TLS de outras aplicações).
Estes não afetam o funcionamento do Archon, mas podem ser limpos se desejado.

## Localização dos Manifestos no Git

**Repositório**: git@github.com:LuisErlacher/k8s-templates.git
**Path**: apps/custom/archon/base
**Commit Atual**: 90e9ecd

## Próximos Passos

1. ✅ Atualizar os manifestos no repositório Git
2. Fazer commit e push das alterações
3. Executar sync no ArgoCD: `argocd app sync argocd/archon`
4. Verificar logs e health checks após sync
5. Testar conectividade entre serviços

## Testes Recomendados Após Correção

```bash
# Verificar status
argocd app get argocd/archon

# Ver logs
argocd app logs argocd/archon --kind Deployment --name archon-mcp
argocd app logs argocd/archon --kind Deployment --name archon-server
argocd app logs argocd/archon --kind Deployment --name archon-agents

# Verificar health checks
curl https://archon.automatizase.com.br/health
curl https://archon.automatizase.com.br/api/health

# Testar MCP
curl https://archon.automatizase.com.br/mcp/health
```

## Observações Importantes

1. **Namespace**: A configuração usa `automatizase`, não `unlkd`
2. **Domínio**: Usa um único domínio com paths, não múltiplos domínios
3. **Supabase**: Configurado em `https://supabase.automatizase.com.br`
4. **Secret**: Usa `supabase-jwt` secret com chave `serviceKey`
5. **Cert Manager**: Usa ClusterIssuer `letsencrypt-prod`
