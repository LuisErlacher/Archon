# Recursos Kubernetes do Archon

Este documento lista todos os recursos Kubernetes criados para o Archon.

## Estrutura de Arquivos

```
k8s/
├── .env.k8s.example           # Exemplo de variáveis de ambiente
├── 01-secret.yaml             # Secret unificado
├── 02-deployment-server.yaml  # Deployment do backend
├── 03-deployment-mcp.yaml     # Deployment do MCP
├── 04-deployment-agents.yaml  # Deployment dos agents
├── 05-deployment-frontend.yaml # Deployment do frontend
├── 06-service-server.yaml     # Service do backend
├── 07-service-mcp.yaml        # Service do MCP
├── 08-service-agents.yaml     # Service dos agents
├── 09-service-frontend.yaml   # Service do frontend
├── 10-ingress.yaml            # Ingress unificado
├── build-and-push.sh          # Script para build das imagens
├── deploy.sh                  # Script de deploy
├── QUICKSTART.md              # Guia rápido
├── README.md                  # Documentação completa
└── RESOURCES.md               # Este arquivo
```

## Recursos Criados

### 1. Secret
**Arquivo**: `01-secret.yaml`
**Nome**: `archon-secret`
**Tipo**: Opaque
**Namespace**: unlkd

Contém todas as variáveis de ambiente necessárias para os 4 serviços:
- Credenciais Supabase
- API keys (OpenAI, Logfire)
- Configurações de portas e hosts
- Configurações de serviço

### 2. Deployments

#### Backend Server
**Arquivo**: `02-deployment-server.yaml`
**Nome**: `archon-server`
**Namespace**: unlkd
**Portas**: 8181

Recursos:
- Requests: 500m CPU, 4Gi Memory
- Limits: 2000m CPU, 8Gi Memory

Probes:
- Liveness: GET /health (40s delay)
- Readiness: GET /health (20s delay)

#### MCP Server
**Arquivo**: `03-deployment-mcp.yaml`
**Nome**: `archon-mcp`
**Namespace**: unlkd
**Portas**: 8051

Recursos:
- Requests: 250m CPU, 512Mi Memory
- Limits: 1000m CPU, 2Gi Memory

Probes:
- Liveness: TCP 8051 (60s delay)
- Readiness: TCP 8051 (30s delay)

#### Agents
**Arquivo**: `04-deployment-agents.yaml`
**Nome**: `archon-agents`
**Namespace**: unlkd
**Portas**: 8052

Recursos:
- Requests: 500m CPU, 1Gi Memory
- Limits: 2000m CPU, 4Gi Memory

Probes:
- Liveness: GET /health (40s delay)
- Readiness: GET /health (20s delay)

#### Frontend
**Arquivo**: `05-deployment-frontend.yaml`
**Nome**: `archon-frontend`
**Namespace**: unlkd
**Portas**: 3737

Recursos:
- Requests: 100m CPU, 256Mi Memory
- Limits: 500m CPU, 1Gi Memory

Probes:
- Liveness: GET / (30s delay)
- Readiness: GET / (10s delay)

### 3. Services

Todos os services são do tipo ClusterIP e roteiam tráfego interno entre os pods.

| Service | Arquivo | Porta | Target |
|---------|---------|-------|--------|
| archon-server | 06-service-server.yaml | 8181 | archon-server:8181 |
| archon-mcp | 07-service-mcp.yaml | 8051 | archon-mcp:8051 |
| archon-agents | 08-service-agents.yaml | 8052 | archon-agents:8052 |
| archon-frontend | 09-service-frontend.yaml | 3737 | archon-frontend:3737 |

### 4. Ingress

**Arquivo**: `10-ingress.yaml`
**Nome**: `archon`
**Namespace**: unlkd
**IngressClass**: nginx

#### Hosts e Rotas

| Host | Service | Porta | Descrição |
|------|---------|-------|-----------|
| archon.digiworker.com.br | archon-frontend | 3737 | Interface web |
| server.digiworker.com.br | archon-server | 8181 | API backend |
| mcp.digiworker.com.br | archon-mcp | 8051 | MCP server |
| agents.digiworker.com.br | archon-agents | 8052 | AI agents |

#### Certificados TLS

| Secret | Host |
|--------|------|
| archon-frontend-tls | archon.digiworker.com.br |
| archon-server-tls | server.digiworker.com.br |
| archon-mcp-tls | mcp.digiworker.com.br |
| archon-agents-tls | agents.digiworker.com.br |

Todos os certificados são gerenciados automaticamente pelo Cert Manager usando o ClusterIssuer `letsencrypt`.

#### Annotations

```yaml
cert-manager.io/cluster-issuer: letsencrypt
nginx.ingress.kubernetes.io/proxy-body-size: 50M
nginx.ingress.kubernetes.io/client-max-body-size: 50M
nginx.ingress.kubernetes.io/proxy-connect-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
nginx.ingress.kubernetes.io/websocket-services: archon-server
```

Headers de segurança:
```
X-Frame-Options: deny
Content-Security-Policy: frame-ancestors 'none'
X-Permitted-Cross-Domain-Policies: none
Referrer-Policy: no-referrer
```

## Recursos Totais do Cluster

### Requests Totais (Mínimo Necessário)
- CPU: 1350m (1.35 cores)
- Memory: 5.75Gi

### Limits Totais (Máximo Possível)
- CPU: 5500m (5.5 cores)
- Memory: 15Gi

### Portas Utilizadas
- 8181: Backend API
- 8051: MCP Server
- 8052: Agents
- 3737: Frontend

### Volumes
Este deployment não utiliza PersistentVolumes. Todos os dados são armazenados no Supabase.

## Labels Padrão

Todos os recursos usam labels consistentes:

```yaml
app.kubernetes.io/name: archon-{service}
app.kubernetes.io/instance: archon
app.kubernetes.io/component: {backend|mcp|agents|frontend}
```

Para listar todos os recursos:
```bash
kubectl get all -n unlkd -l app.kubernetes.io/instance=archon
```

## Dependências Entre Serviços

```
archon-frontend
    └── archon-server (via API calls)

archon-mcp
    ├── archon-server (API_SERVICE_URL)
    └── archon-agents (AGENTS_SERVICE_URL)

archon-agents
    └── Standalone (pode ser usado por outros serviços)

archon-server
    └── Standalone (faz calls para Supabase)
```

## Endpoints de Health Check

| Serviço | Endpoint | Tipo | Resposta |
|---------|----------|------|----------|
| Backend | /health | HTTP | 200 OK + JSON |
| Agents | /health | HTTP | 200 OK + JSON |
| MCP | porta 8051 | TCP | Conexão aceita |
| Frontend | / | HTTP | 200 OK + HTML |

## Segurança

### HTTPS/TLS
- Todos os domínios usam HTTPS
- Certificados gerenciados pelo Let's Encrypt
- Redirecionamento automático HTTP → HTTPS

### Headers de Segurança
- X-Frame-Options: Previne clickjacking
- CSP: Previne XSS e embedding não autorizado
- Referrer-Policy: Protege URLs sensíveis

### Secrets
- Todas as credenciais estão no Secret
- Secret não é versionado (use .gitignore)
- Considere usar Sealed Secrets ou External Secrets para produção

### Network
- Services são ClusterIP (internos)
- Apenas Ingress expõe serviços externamente
- Considere adicionar NetworkPolicies para maior isolamento

## Monitoring

### Logs
```bash
# Ver logs de todos os serviços
kubectl logs -n unlkd -l app.kubernetes.io/instance=archon --all-containers=true -f

# Logs específicos
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-server -f
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-mcp -f
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-agents -f
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-frontend -f
```

### Métricas
Adicione Prometheus e Grafana para monitoramento:
```bash
# Exemplo com prometheus-operator
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml
```

### Alertas
Configure alertas para:
- Pods em CrashLoopBackOff
- Alta utilização de CPU/Memory
- Certificados próximos do vencimento
- Health checks falhando

## Backup e Restore

### Backup do Secret
```bash
# Exportar secret
kubectl get secret archon-secret -n unlkd -o yaml > archon-secret-backup.yaml

# Armazenar em local seguro (NÃO commitar no git!)
```

### Backup da Configuração
```bash
# Exportar todos os recursos
kubectl get all,ingress,secret -n unlkd -l app.kubernetes.io/instance=archon -o yaml > archon-backup.yaml
```

### Restore
```bash
# Aplicar backup
kubectl apply -f archon-backup.yaml
```

## Scaling

### Horizontal Pod Autoscaling (HPA)
```bash
# Autoscaling baseado em CPU
kubectl autoscale deployment archon-server -n unlkd \
  --cpu-percent=70 \
  --min=1 \
  --max=5

kubectl autoscale deployment archon-agents -n unlkd \
  --cpu-percent=70 \
  --min=1 \
  --max=3
```

### Vertical Pod Autoscaling (VPA)
Instale VPA no cluster e crie recursos VPA para ajuste automático de recursos.

### Manual Scaling
```bash
# Escalar manualmente
kubectl scale deployment archon-server -n unlkd --replicas=3
```

## Custos Estimados

Baseado nos recursos totais:

### Requests (Mínimo)
- 1.35 CPU cores
- 5.75Gi Memory

Em um cluster gerenciado (GKE, EKS, AKS):
- Estimativa: $50-100/mês por nó
- Requer pelo menos 1 nó com 2 cores e 8Gi RAM

### Limits (Máximo)
- 5.5 CPU cores
- 15Gi Memory

Em picos de uso:
- Pode necessitar até 2-3 nós dependendo da configuração
- Estimativa máxima: $150-300/mês

**Nota**: Custos variam significativamente entre providers e regiões.
