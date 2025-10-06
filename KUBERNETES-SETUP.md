# Configuração Kubernetes para Archon

## 🔍 Problema Identificado

O erro `FileNotFoundError(2, 'No such file or directory')` no MCP Dashboard ocorre porque:

1. **Docker Compose**: O código usa Docker API (`/var/run/docker.sock`) para verificar status do container MCP
2. **Kubernetes**: Não há Docker socket disponível nos pods
3. **Arquivo problemático**: `/home/lperl/Archon/python/src/server/api_routes/mcp_api.py:25`

```python
# Linha 25 - Tenta conectar ao Docker socket (NÃO FUNCIONA NO K8S!)
docker_client = docker.from_env()
container = docker_client.containers.get("archon-mcp")
```

## ✅ Solução

### 1. Arquitetura no Kubernetes

Você precisa de **3 deployments separados**:

```
┌─────────────────────────────────────────────────────┐
│         archon.automatizase.com.br                  │
│              (Nginx Ingress)                        │
└────────┬──────────────┬─────────────────────┬───────┘
         │              │                     │
    /api │         /socket.io             / (tudo resto)
         │              │                     │
    ┌────▼────┐    ┌────▼────┐          ┌────▼────┐
    │ Server  │◄───┤ Server  │          │Frontend │
    │ (8181)  │    │ (8181)  │          │ (3737)  │
    └────┬────┘    └─────────┘          └─────────┘
         │
         │ HTTP interno
         ▼
    ┌────────┐
    │  MCP   │
    │ (8051) │
    └────────┘
```

### 2. Arquivos de Manifesto

**Arquivo único**: `k8s-manifests-complete.yaml`

Contém:
- ✅ Namespace `archon`
- ✅ Secret com credenciais (Supabase, OpenAI, etc)
- ✅ ConfigMap com configurações
- ✅ 3 Deployments (server, mcp, frontend)
- ✅ 3 Services (ClusterIP)
- ✅ 1 Ingress com rotas para todos os serviços

### 3. Modificações Necessárias no Código

**OPÇÃO A - Recomendada**: Criar variável de ambiente para detectar K8s

Adicione ao `mcp_api.py`:

```python
# python/src/server/api_routes/mcp_api.py

import os
import httpx  # Adicione ao pyproject.toml

def get_container_status() -> dict[str, Any]:
    """Get MCP container status - supports both Docker and Kubernetes."""

    # Detectar se está rodando no Kubernetes
    service_discovery = os.getenv("SERVICE_DISCOVERY_MODE", "docker_compose")

    if service_discovery == "kubernetes":
        # Modo Kubernetes - usar HTTP health check
        return get_k8s_mcp_status()
    else:
        # Modo Docker Compose - usar Docker API
        return get_docker_mcp_status()

def get_k8s_mcp_status() -> dict[str, Any]:
    """Get MCP status via HTTP (for Kubernetes)."""
    try:
        mcp_url = os.getenv("MCP_SERVICE_URL", "http://archon-mcp-service:8051")

        # Tentar conectar ao MCP via HTTP
        response = httpx.get(f"{mcp_url}/health", timeout=5.0)

        if response.status_code == 200:
            return {
                "status": "running",
                "uptime": None,  # K8s não tem uptime do container facilmente
                "logs": [],
                "container_status": "running"
            }
        else:
            return {
                "status": "unhealthy",
                "uptime": None,
                "logs": [],
                "container_status": f"http_{response.status_code}"
            }
    except httpx.ConnectError:
        return {
            "status": "not_found",
            "uptime": None,
            "logs": [],
            "container_status": "not_reachable",
            "message": "MCP service not reachable"
        }
    except Exception as e:
        return {
            "status": "error",
            "uptime": None,
            "logs": [],
            "container_status": "error",
            "error": str(e)
        }

def get_docker_mcp_status() -> dict[str, Any]:
    """Get MCP status via Docker API (for Docker Compose)."""
    # Código original aqui (linhas 21-75 do arquivo atual)
    docker_client = None
    try:
        docker_client = docker.from_env()
        container = docker_client.containers.get("archon-mcp")
        # ... resto do código original
```

**OPÇÃO B - Simples**: Desabilitar verificação Docker no K8s

```python
def get_container_status() -> dict[str, Any]:
    """Get simple MCP container status."""

    # Se estiver no Kubernetes, sempre retornar "running"
    if os.getenv("SERVICE_DISCOVERY_MODE") == "kubernetes":
        return {
            "status": "running",
            "uptime": None,
            "logs": [],
            "container_status": "running",
            "message": "Running in Kubernetes"
        }

    # Código Docker original...
```

### 4. Variáveis de Ambiente Importantes

```yaml
# No ConfigMap
SERVICE_DISCOVERY_MODE: "kubernetes"  # Detecta modo K8s

# No Deployment do Server
- name: MCP_SERVICE_URL
  value: "http://archon-mcp-service.archon.svc.cluster.local:8051"
```

### 5. Build das Imagens Docker

```bash
# 1. Build Server
cd /home/lperl/Archon/python
docker build -f Dockerfile.server -t seu-registry/archon-server:latest .
docker push seu-registry/archon-server:latest

# 2. Build MCP
docker build -f Dockerfile.mcp -t seu-registry/archon-mcp:latest .
docker push seu-registry/archon-mcp:latest

# 3. Build Frontend
cd /home/lperl/Archon/archon-ui-main
docker build -t seu-registry/archon-frontend:latest .
docker push seu-registry/archon-frontend:latest
```

### 6. Deploy no Kubernetes

```bash
# 1. Editar secrets no arquivo
# Substitua os valores em stringData do Secret

# 2. Aplicar manifestos
kubectl apply -f k8s-manifests-complete.yaml

# 3. Verificar status
kubectl get pods -n archon
kubectl get svc -n archon
kubectl get ingress -n archon

# 4. Ver logs
kubectl logs -n archon -l app=archon-server --tail=50
kubectl logs -n archon -l app=archon-mcp --tail=50
kubectl logs -n archon -l app=archon-frontend --tail=50

# 5. Testar internamente
kubectl port-forward -n archon svc/archon-server-service 8181:8181
# Abra http://localhost:8181/health

kubectl port-forward -n archon svc/archon-mcp-service 8051:8051
# Teste conexão MCP

kubectl port-forward -n archon svc/archon-frontend-service 3737:3737
# Abra http://localhost:3737
```

### 7. Configurar DNS

No seu provedor DNS (Cloudflare, Route53, etc):

```
Tipo: A
Nome: archon.automatizase.com.br
Valor: <IP-DO-SEU-INGRESS-CONTROLLER>
```

Obter IP do Ingress:
```bash
kubectl get svc -n ingress-nginx
```

### 8. Cert-Manager (SSL/TLS)

Se ainda não tiver cert-manager instalado:

```bash
# Instalar cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Criar ClusterIssuer para Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: seu-email@dominio.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 9. Troubleshooting

**Pods não iniciam:**
```bash
kubectl describe pod -n archon <pod-name>
kubectl logs -n archon <pod-name>
```

**MCP ainda não funciona:**
```bash
# Testar conectividade interna
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n archon -- sh
# Dentro do pod:
curl http://archon-mcp-service:8051/health
curl http://archon-server-service:8181/health
```

**Ingress não responde:**
```bash
kubectl describe ingress -n archon archon-ingress
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

## 📊 Comparação: Docker Compose vs Kubernetes

| Aspecto | Docker Compose | Kubernetes |
|---------|---------------|------------|
| **Service Discovery** | Nome do container | DNS interno (service.namespace.svc.cluster.local) |
| **Networking** | Bridge network | ClusterIP + Ingress |
| **Health Check** | Docker API | HTTP/TCP probes |
| **Scaling** | Manual | Horizontal Pod Autoscaler |
| **Load Balancing** | Round-robin | Service com múltiplos pods |
| **Volume** | Local mounts | PersistentVolumeClaims |

## 🎯 Checklist de Deploy

- [ ] Modificar código `mcp_api.py` para suportar Kubernetes
- [ ] Build e push das 3 imagens Docker
- [ ] Editar secrets no manifesto
- [ ] Aplicar manifestos no cluster
- [ ] Verificar pods rodando
- [ ] Configurar DNS apontando para Ingress
- [ ] Verificar certificado SSL gerado
- [ ] Testar acesso: https://archon.automatizase.com.br
- [ ] Testar MCP Dashboard (não deve mais dar erro)
- [ ] Testar WebSocket (Socket.IO)

## 📝 Notas Importantes

1. **Sem Docker Socket**: Kubernetes não expõe `/var/run/docker.sock` para os pods por segurança
2. **Service Discovery**: Use nomes DNS dos Services, não IPs
3. **ConfigMaps**: Sempre que mudar ConfigMap, recrie os pods (`kubectl rollout restart deployment -n archon`)
4. **Secrets**: Para rotacionar secrets, use `kubectl create secret` e atualize o deployment
5. **Resources**: Ajuste `requests` e `limits` conforme seu cluster
6. **Replicas**: Server e Frontend podem ter múltiplas réplicas; MCP geralmente 1 é suficiente

## 🔗 Comunicação Entre Serviços

```
Frontend (Browser)
  ↓ HTTPS
Ingress (archon.automatizase.com.br)
  ↓
  ├─ /api → Server Service (8181)
  ├─ /socket.io → Server Service (8181)
  └─ / → Frontend Service (3737)

Server Pod
  ↓ HTTP interno
MCP Service (8051)
  ↓
MCP Pod
```

## 🚀 Próximos Passos

1. Implementar Horizontal Pod Autoscaler (HPA)
2. Configurar PersistentVolumes para dados
3. Adicionar monitoring (Prometheus + Grafana)
4. Configurar backups do Supabase
5. Implementar CI/CD com GitOps (ArgoCD/Flux)
