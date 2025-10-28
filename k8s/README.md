# Archon Kubernetes Manifests

Manifestos para deploy do Archon em cluster Kubernetes.

## Estrutura

```
k8s/
├── 01-secret.yaml                 # Secret unificado com variáveis de ambiente
├── 02-deployment-server.yaml      # Deployment do backend (FastAPI)
├── 03-deployment-mcp.yaml         # Deployment do MCP server
├── 04-deployment-agents.yaml      # Deployment dos AI agents
├── 05-deployment-frontend.yaml    # Deployment do frontend (React)
├── 06-service-server.yaml         # Service do backend
├── 07-service-mcp.yaml            # Service do MCP
├── 08-service-agents.yaml         # Service dos agents
├── 09-service-frontend.yaml       # Service do frontend
└── 10-ingress.yaml                # Ingress unificado com todos os domínios
```

## Pré-requisitos

1. **Namespace**: O namespace `unlkd` deve existir no cluster
2. **Ingress Controller**: Nginx Ingress Controller instalado
3. **Cert Manager**: Para geração automática de certificados TLS
4. **Issuer**: ClusterIssuer `letsencrypt` configurado

## Build e Push das Imagens

Antes de aplicar os manifestos, você precisa fazer build e push das imagens Docker:

### Backend Server
```bash
cd /home/luis/projetos/Archon
docker build -t your-registry/archon-server:latest -f python/Dockerfile.server python/
docker push your-registry/archon-server:latest
```

### MCP Server
```bash
docker build -t your-registry/archon-mcp:latest -f python/Dockerfile.mcp python/
docker push your-registry/archon-mcp:latest
```

### Agents
```bash
docker build -t your-registry/archon-agents:latest -f python/Dockerfile.agents python/
docker push your-registry/archon-agents:latest
```

### Frontend
```bash
docker build -t your-registry/archon-frontend:latest archon-ui-main/
docker push your-registry/archon-frontend:latest
```

**IMPORTANTE**: Substitua `your-registry` pelo seu registry real (ex: `gcr.io/project-id`, `registry.digitalocean.com/your-registry`, etc.)

## Configuração

### 1. Editar o Secret

Edite `01-secret.yaml` e configure as seguintes variáveis obrigatórias:

```yaml
SUPABASE_URL: "https://your-project.supabase.co"
SUPABASE_SERVICE_KEY: "your-service-role-key-here"
SUPABASE_ANON_KEY: "your-anon-key-here"
```

Opcionalmente, configure:
- `OPENAI_API_KEY`: Para funcionalidades de IA
- `LOGFIRE_TOKEN`: Para observabilidade

### 2. Atualizar as Imagens

Em cada arquivo `*-deployment-*.yaml`, substitua a linha:
```yaml
image: your-registry/archon-{service}:latest
```

Com o caminho real da sua imagem.

### 3. Configurar DNS

Configure os seguintes registros DNS apontando para o IP do seu Ingress Controller:

- `archon.digiworker.com.br` → Frontend
- `server.digiworker.com.br` → Backend API
- `mcp.digiworker.com.br` → MCP Server
- `agents.digiworker.com.br` → Agents

## Deploy

### Aplicar todos os manifestos

```bash
kubectl apply -f k8s/
```

Ou aplicar na ordem:

```bash
# 1. Secret primeiro
kubectl apply -f k8s/01-secret.yaml

# 2. Deployments
kubectl apply -f k8s/02-deployment-server.yaml
kubectl apply -f k8s/03-deployment-mcp.yaml
kubectl apply -f k8s/04-deployment-agents.yaml
kubectl apply -f k8s/05-deployment-frontend.yaml

# 3. Services
kubectl apply -f k8s/06-service-server.yaml
kubectl apply -f k8s/07-service-mcp.yaml
kubectl apply -f k8s/08-service-agents.yaml
kubectl apply -f k8s/09-service-frontend.yaml

# 4. Ingress
kubectl apply -f k8s/10-ingress.yaml
```

## Verificação

### Verificar Pods
```bash
kubectl get pods -n unlkd -l app.kubernetes.io/instance=archon
```

### Verificar Services
```bash
kubectl get svc -n unlkd -l app.kubernetes.io/instance=archon
```

### Verificar Ingress
```bash
kubectl get ingress -n unlkd archon
```

### Verificar Certificados TLS
```bash
kubectl get certificate -n unlkd
```

### Logs dos Pods
```bash
# Backend
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-server -f

# MCP
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-mcp -f

# Agents
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-agents -f

# Frontend
kubectl logs -n unlkd -l app.kubernetes.io/name=archon-frontend -f
```

## Recursos

### CPU e Memória

Os recursos foram configurados baseados no docker-compose.yml:

| Serviço | Request CPU | Request Memory | Limit CPU | Limit Memory |
|---------|-------------|----------------|-----------|--------------|
| Server  | 500m        | 4Gi            | 2000m     | 8Gi          |
| MCP     | 250m        | 512Mi          | 1000m     | 2Gi          |
| Agents  | 500m        | 1Gi            | 2000m     | 4Gi          |
| Frontend| 100m        | 256Mi          | 500m      | 1Gi          |

Ajuste conforme necessário para seu cluster.

## Health Checks

Todos os serviços possuem:
- **Liveness Probe**: Verifica se o pod está vivo
- **Readiness Probe**: Verifica se o pod está pronto para receber tráfego

### Endpoints de Health

- Backend: `GET /health`
- Agents: `GET /health`
- MCP: TCP check na porta 8051
- Frontend: `GET /`

## Troubleshooting

### Pods não iniciam

```bash
kubectl describe pod -n unlkd <pod-name>
kubectl logs -n unlkd <pod-name>
```

### Certificados TLS não são gerados

```bash
kubectl describe certificate -n unlkd
kubectl describe certificaterequest -n unlkd
kubectl logs -n cert-manager -l app=cert-manager
```

### Ingress não roteia corretamente

```bash
kubectl describe ingress -n unlkd archon
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Verificar conectividade entre serviços

```bash
# Entrar em um pod
kubectl exec -it -n unlkd <pod-name> -- /bin/sh

# Testar conectividade
curl http://archon-server:8181/health
curl http://archon-mcp:8051/health
curl http://archon-agents:8052/health
```

## Atualizações

### Atualizar uma imagem

```bash
# Build nova versão
docker build -t your-registry/archon-server:v1.2.3 -f python/Dockerfile.server python/
docker push your-registry/archon-server:v1.2.3

# Atualizar deployment
kubectl set image deployment/archon-server -n unlkd archon-server=your-registry/archon-server:v1.2.3

# Ou editar o arquivo e aplicar
kubectl apply -f k8s/02-deployment-server.yaml
```

### Restart de um serviço

```bash
kubectl rollout restart deployment/archon-server -n unlkd
```

## Remoção

Para remover toda a aplicação:

```bash
kubectl delete -f k8s/
```

Ou remover serviço por serviço:

```bash
kubectl delete ingress archon -n unlkd
kubectl delete svc archon-frontend archon-server archon-mcp archon-agents -n unlkd
kubectl delete deployment archon-frontend archon-server archon-mcp archon-agents -n unlkd
kubectl delete secret archon-secret -n unlkd
```

## Notas Importantes

1. **Secret Management**: Em produção, considere usar um solution como Sealed Secrets ou External Secrets Operator para gerenciar secrets
2. **Image Registry**: Use um registry privado e configure imagePullSecrets se necessário
3. **Resource Limits**: Ajuste os limites de CPU e memória baseado no uso real
4. **Scaling**: Os deployments estão configurados com 1 réplica. Ajuste conforme necessário
5. **Persistent Storage**: Este setup não inclui PersistentVolumes. Se precisar de storage persistente, adicione PVCs aos deployments
6. **Database**: Certifique-se que o Supabase esteja acessível do cluster
7. **Network Policies**: Considere adicionar NetworkPolicies para segurança adicional
