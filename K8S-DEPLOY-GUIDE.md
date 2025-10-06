# Guia Completo de Deploy do Archon no Kubernetes

## 📋 Visão Geral

Este guia contém instruções passo a passo para fazer build das imagens Docker e deploy do Archon no Kubernetes.

**Arquivos importantes criados:**
- `archon-ui-main/Dockerfile.production` - Dockerfile de produção do frontend (Nginx)
- `archon-ui-main/nginx.conf` - Configuração Nginx para o frontend
- `python/src/server/api_routes/mcp_api.py` - MODIFICADO para suportar K8s
- `build-images.sh` - Script para build de todas as imagens
- `push-images.sh` - Script para push das imagens
- `k8s-manifests-complete.yaml` - Manifestos completos do Kubernetes

## 🔧 Modificações Realizadas

### 1. Backend - Suporte a Kubernetes

**Arquivo**: `python/src/server/api_routes/mcp_api.py`

✅ **Modificado** para detectar automaticamente o ambiente:
- **Docker Compose**: usa Docker API (`docker.from_env()`)
- **Kubernetes**: usa HTTP health check (`httpx`)

```python
def get_container_status() -> dict[str, Any]:
    service_discovery = os.getenv("SERVICE_DISCOVERY_MODE", "docker_compose")

    if service_discovery == "kubernetes":
        return get_k8s_mcp_status()  # HTTP check
    else:
        return get_docker_mcp_status()  # Docker API
```

**Resultado**: O erro `FileNotFoundError(2, 'No such file or directory')` será corrigido! ✅

### 2. Frontend - Produção com Nginx

**Novos arquivos**:
- `archon-ui-main/Dockerfile.production` - Multi-stage build com Nginx
- `archon-ui-main/nginx.conf` - Serve arquivos estáticos otimizados

**Diferença do Dockerfile antigo**:
| Antes | Depois |
|-------|--------|
| `CMD ["npm", "run", "dev"]` | Build produção + Nginx |
| Porta 3737 com Vite dev | Porta 3737 com Nginx (produção) |
| Hot reload | Arquivos estáticos minificados |

## 🚀 Passo a Passo Completo

### ETAPA 1: Build das Imagens

#### Opção A: Script Automatizado (Recomendado)

```bash
cd /home/lperl/Archon

# Build com registry local (para testes)
./build-images.sh localhost:5000

# Build com registry remoto (Docker Hub exemplo)
./build-images.sh docker.io/seu-usuario

# Build com registry remoto e versão específica
./build-images.sh docker.io/seu-usuario v1.0.0
```

#### Opção B: Manual (builds individuais)

```bash
cd /home/lperl/Archon

# 1. Build Server
cd python
docker build -f Dockerfile.server -t docker.io/seu-usuario/archon-server:latest .

# 2. Build MCP
docker build -f Dockerfile.mcp -t docker.io/seu-usuario/archon-mcp:latest .

# 3. Build Agents (opcional)
docker build -f Dockerfile.agents -t docker.io/seu-usuario/archon-agents:latest .

# 4. Build Frontend
cd ../archon-ui-main
docker build -f Dockerfile.production -t docker.io/seu-usuario/archon-frontend:latest .
```

#### Verificar imagens criadas

```bash
docker images | grep archon
```

Você deve ver:
```
seu-usuario/archon-server     latest    xxx    xxx MB
seu-usuario/archon-mcp        latest    xxx    xxx MB
seu-usuario/archon-agents     latest    xxx    xxx MB
seu-usuario/archon-frontend   latest    xxx    xxx MB
```

### ETAPA 2: Push das Imagens

#### Opção A: Script Automatizado

```bash
# Login no registry (se necessário)
docker login docker.io

# Push automático
./push-images.sh docker.io/seu-usuario
```

#### Opção B: Manual

```bash
docker push docker.io/seu-usuario/archon-server:latest
docker push docker.io/seu-usuario/archon-mcp:latest
docker push docker.io/seu-usuario/archon-agents:latest
docker push docker.io/seu-usuario/archon-frontend:latest
```

### ETAPA 3: Preparar Manifestos Kubernetes

#### 3.1. Editar Secrets

Abra `k8s-manifests-complete.yaml` e atualize:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: archon-secrets
  namespace: archon
type: Opaque
stringData:
  # ⚠️ PREENCHA SEUS VALORES AQUI ⚠️
  SUPABASE_URL: "https://seu-projeto.supabase.co"
  SUPABASE_SERVICE_KEY: "sua-service-role-key-completa-aqui"
  OPENAI_API_KEY: "sk-..."  # Se usar OpenAI
  LOGFIRE_TOKEN: ""  # Opcional
```

**IMPORTANTE**: Use a **SERVICE_ROLE** key do Supabase, NÃO a anon key!

#### 3.2. Substituir Registry

**Busque e substitua** `REGISTRY/` pelo seu registry:

```bash
# Usando sed (Linux/Mac)
sed -i 's|REGISTRY/|docker.io/seu-usuario/|g' k8s-manifests-complete.yaml

# OU edite manualmente no seu editor
# Procure por "REGISTRY/" e substitua por "docker.io/seu-usuario/"
```

**Resultado esperado**:
```yaml
image: docker.io/seu-usuario/archon-server:latest
image: docker.io/seu-usuario/archon-mcp:latest
image: docker.io/seu-usuario/archon-frontend:latest
```

### ETAPA 4: Deploy no Kubernetes

#### 4.1. Aplicar Manifestos

```bash
# Aplicar tudo de uma vez
kubectl apply -f k8s-manifests-complete.yaml
```

#### 4.2. Verificar Status

```bash
# Ver pods
kubectl get pods -n archon

# Ver services
kubectl get svc -n archon

# Ver ingress
kubectl get ingress -n archon
```

**Saída esperada** (após alguns segundos):
```
NAME                               READY   STATUS    RESTARTS   AGE
archon-server-xxxx-xxxxx          1/1     Running   0          30s
archon-server-xxxx-xxxxx          1/1     Running   0          30s
archon-mcp-xxxx-xxxxx             1/1     Running   0          30s
archon-frontend-xxxx-xxxxx        1/1     Running   0          30s
archon-frontend-xxxx-xxxxx        1/1     Running   0          30s
```

#### 4.3. Ver Logs

```bash
# Server
kubectl logs -n archon -l app=archon-server --tail=50 -f

# MCP
kubectl logs -n archon -l app=archon-mcp --tail=50 -f

# Frontend
kubectl logs -n archon -l app=archon-frontend --tail=50 -f
```

### ETAPA 5: Configurar DNS e SSL

#### 5.1. Obter IP do Ingress

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Ou se seu ingress controller estiver em outro namespace:
kubectl get svc --all-namespaces | grep ingress
```

Anote o **EXTERNAL-IP**.

#### 5.2. Configurar DNS

No seu provedor DNS (Cloudflare, Route53, etc):

```
Tipo: A
Nome: archon.automatizase.com.br
Valor: <EXTERNAL-IP-DO-INGRESS>
TTL: 300
```

#### 5.3. Verificar Certificado SSL

O cert-manager deve provisionar automaticamente. Verifique:

```bash
# Ver certificado
kubectl get certificate -n archon

# Ver desafio ACME (se houver problemas)
kubectl get challenges -n archon
```

**Certificado válido** quando STATUS = `True`:
```
NAME             READY   SECRET           AGE
archon-tls-cert  True    archon-tls-cert  2m
```

### ETAPA 6: Testar Aplicação

#### 6.1. Teste Local (Port Forward)

Antes do DNS propagar, teste localmente:

```bash
# Frontend
kubectl port-forward -n archon svc/archon-frontend-service 3737:3737
# Abra: http://localhost:3737

# Server
kubectl port-forward -n archon svc/archon-server-service 8181:8181
# Teste: curl http://localhost:8181/health

# MCP
kubectl port-forward -n archon svc/archon-mcp-service 8051:8051
# Teste: curl http://localhost:8051/health
```

#### 6.2. Teste Produção

Após DNS propagar (pode levar até 5 minutos):

```bash
# Health check
curl https://archon.automatizase.com.br/health

# Frontend
open https://archon.automatizase.com.br

# API
curl https://archon.automatizase.com.br/api/mcp/status
```

**✅ MCP Status deve retornar**:
```json
{
  "status": "running",
  "uptime": null,
  "logs": [],
  "container_status": "running",
  "mode": "kubernetes"
}
```

**🎉 Sucesso!** O erro `FileNotFoundError` está corrigido!

## 🐛 Troubleshooting

### Pods não iniciam

```bash
# Ver eventos
kubectl describe pod -n archon <pod-name>

# Ver logs
kubectl logs -n archon <pod-name>
```

**Problemas comuns**:
- `ImagePullBackOff`: Registry incorreto ou permissões
- `CrashLoopBackOff`: Erro na aplicação, veja os logs
- `CreateContainerConfigError`: Secret inválido

### MCP ainda não funciona

```bash
# Testar conectividade interna
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n archon -- sh

# Dentro do pod debug:
curl http://archon-mcp-service:8051/health
curl http://archon-server-service:8181/health
exit
```

### Ingress não responde

```bash
# Ver configuração
kubectl describe ingress -n archon archon-ingress

# Ver logs do nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=100
```

### Certificado SSL não provisiona

```bash
# Ver status do certificado
kubectl describe certificate -n archon archon-tls-cert

# Ver logs do cert-manager
kubectl logs -n cert-manager -l app=cert-manager --tail=100

# Forçar renovação
kubectl delete certificate -n archon archon-tls-cert
kubectl apply -f k8s-manifests-complete.yaml
```

## 📊 Arquitetura Final

```
                        Internet
                           |
                           v
                    [DNS: archon.automatizase.com.br]
                           |
                           v
                    [Nginx Ingress Controller]
                           |
           +---------------+---------------+
           |               |               |
        /api          /socket.io         / (resto)
           |               |               |
           v               v               v
    [Server Service]  [Server Service] [Frontend Service]
         :8181            :8181           :3737
           |                                |
           v                                v
    [Server Pods x2]                 [Frontend Pods x2]
           |                          (Nginx servindo
           |                           arquivos estáticos)
           v
    [MCP Service]
         :8051
           |
           v
    [MCP Pod x1]
```

## 🔐 Variáveis de Ambiente Importantes

### Server Pods
- `SERVICE_DISCOVERY_MODE=kubernetes` ← **Detecta K8s!**
- `MCP_SERVICE_URL=http://archon-mcp-service.archon.svc.cluster.local:8051`
- `SUPABASE_URL` (do Secret)
- `SUPABASE_SERVICE_KEY` (do Secret)

### MCP Pods
- `SERVICE_DISCOVERY_MODE=kubernetes`
- `API_SERVICE_URL=http://archon-server-service.archon.svc.cluster.local:8181`

### Frontend Pods
- `HOST=archon.automatizase.com.br`
- `PROD=true`

## 📝 Comandos Úteis

```bash
# Restart deployments
kubectl rollout restart deployment -n archon archon-server
kubectl rollout restart deployment -n archon archon-mcp
kubectl rollout restart deployment -n archon archon-frontend

# Escalar pods
kubectl scale deployment -n archon archon-server --replicas=3
kubectl scale deployment -n archon archon-frontend --replicas=3

# Ver recursos utilizados
kubectl top pods -n archon

# Deletar tudo
kubectl delete namespace archon
```

## 🎯 Checklist Final

- [ ] Build das 4 imagens concluído
- [ ] Push das imagens para o registry
- [ ] Secrets configurados no manifesto
- [ ] Registry substituído no manifesto
- [ ] Manifesto aplicado no cluster
- [ ] Pods rodando (kubectl get pods -n archon)
- [ ] DNS configurado
- [ ] Certificado SSL provisionado
- [ ] https://archon.automatizase.com.br acessível
- [ ] MCP Dashboard funcionando (sem erro FileNotFoundError)
- [ ] WebSocket funcionando (Socket.IO)

## 🎉 Conclusão

Todas as imagens foram preparadas para **PRODUÇÃO** e o código foi **modificado** para funcionar no Kubernetes.

**Principais melhorias**:
1. ✅ Frontend com Nginx (produção) ao invés de `npm run dev`
2. ✅ Backend detecta ambiente automaticamente (K8s vs Docker)
3. ✅ MCP usa HTTP health check no K8s (sem Docker socket)
4. ✅ Scripts automatizados para build e push
5. ✅ Manifestos K8s completos e prontos

**Próximos passos recomendados**:
- Configurar HorizontalPodAutoscaler (HPA)
- Implementar backups do Supabase
- Configurar monitoring (Prometheus + Grafana)
- Implementar CI/CD com GitOps (ArgoCD/Flux)
