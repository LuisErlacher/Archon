# Docker vs Kubernetes Build Strategy

## Overview

O projeto Archon agora mantém **duas versões de imagens Docker** para cada serviço:

1. **Docker Version** - Imagens originais para uso com Docker Compose
2. **Kubernetes Version** - Imagens otimizadas para produção em Kubernetes

## Arquivos Dockerfile

### Docker Compose (Original)
- `python/Dockerfile.server` → `server:latest`, `server:docker-latest`
- `python/Dockerfile.mcp` → `mcp:latest`, `mcp:docker-latest`
- `python/Dockerfile.agents` → `agents:latest`, `agents:docker-latest`
- `archon-ui-main/Dockerfile.production` → `frontend:latest`, `frontend:docker-latest`

### Kubernetes (Optimized)
- `python/Dockerfile.k8s.server` → `server:k8s-latest`
- `python/Dockerfile.k8s.mcp` → `mcp:k8s-latest`
- `python/Dockerfile.k8s.agents` → `agents:k8s-latest`
- `archon-ui-main/Dockerfile.k8s.production` → `frontend:k8s-latest`

## Image Tags

### Docker Version Tags
```bash
git.automatizase.com.br/luis.erlacher/archon/server:latest
git.automatizase.com.br/luis.erlacher/archon/server:docker-latest
git.automatizase.com.br/luis.erlacher/archon/server:docker-{commit-sha}

# Mesma estrutura para: mcp, agents, frontend
```

### Kubernetes Version Tags
```bash
git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest
git.automatizase.com.br/luis.erlacher/archon/server:k8s-{commit-sha}

# Mesma estrutura para: mcp, agents, frontend
```

## Diferenças Entre as Versões

### Docker Version (Original)
- ✅ Compatível com Docker Compose
- ✅ Roda como root (compatibilidade)
- ✅ Inclui HEALTHCHECK no Dockerfile
- ✅ Estrutura simplificada para desenvolvimento local

### Kubernetes Version (Optimized)
- ✅ **Non-root user** (UID/GID 1001) - Segurança
- ✅ **Proper signal propagation** - Graceful shutdown em rolling updates
- ✅ **No HEALTHCHECK** - K8s usa liveness/readiness probes
- ✅ **Cache cleanup** - Imagens menores (remove ~/.cache/pip, ~/.cache/uv)
- ✅ **Production-only** - Não inclui `tests/` directory
- ✅ **Optimized layers** - Melhor aproveitamento de cache

## Otimizações Kubernetes

### 1. Non-Root User
```dockerfile
# Cria usuário e grupo com IDs fixos
RUN groupadd -r appuser -g 1001 && \
    useradd -r -g appuser -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser
```

**Benefícios:**
- Segurança: Reduz risco de container escape
- Compliance: Atende policies de segurança K8s (PodSecurityStandards)
- Best Practice: Recomendado pela OWASP e CIS Benchmarks

### 2. Signal Propagation
```dockerfile
# ✅ CORRETO - Propagation com exec
CMD ["sh", "-c", "exec python -m uvicorn ..."]

# ❌ INCORRETO - Shell não propaga sinais
CMD sh -c "python -m uvicorn ..."
```

**Benefícios:**
- Graceful shutdown: SIGTERM chega ao processo Python
- Zero downtime: Rolling updates funcionam corretamente
- Connection draining: Conexões fecham gracefully

### 3. No HEALTHCHECK
```dockerfile
# Docker version tem:
HEALTHCHECK --interval=30s CMD ...

# K8s version NÃO tem (redundante)
# K8s já define em livenessProbe/readinessProbe
```

**Benefícios:**
- Menor tamanho de imagem
- Menos processos rodando no container
- Health checks gerenciados pelo K8s (mais flexível)

### 4. Cache Cleanup
```dockerfile
RUN uv pip install --system --group mcp && \
    rm -rf ~/.cache/uv ~/.cache/pip
```

**Benefícios:**
- Imagens 10-15% menores
- Menos I/O no registry
- Pull mais rápido nos nodes K8s

## Como Usar

### Para Docker Compose (Desenvolvimento Local)
```yaml
# docker-compose.yml
services:
  archon-server:
    image: git.automatizase.com.br/luis.erlacher/archon/server:latest
    # ou
    image: git.automatizase.com.br/luis.erlacher/archon/server:docker-latest
```

### Para Kubernetes (Produção)
```yaml
# k8s-manifests.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: archon-server
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      containers:
      - name: server
        image: git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
              - ALL
```

## CI/CD Workflow

O workflow `.gitea/workflows/build-images.yml` constrói ambas as versões automaticamente:

### Trigger
- Push para branch `main`
- Workflow manual dispatch

### Jobs Executados

**Docker Version (4 jobs):**
- `build-server-docker`
- `build-mcp-docker`
- `build-agents-docker`
- `build-frontend-docker`

**Kubernetes Version (4 jobs):**
- `build-server-k8s`
- `build-mcp-k8s`
- `build-agents-k8s`
- `build-frontend-k8s`

**Total:** 8 jobs paralelos (quando possível)

## Atualizar Manifests Kubernetes

Para usar as imagens K8s otimizadas, atualize `k8s-manifests-complete.yaml`:

```yaml
# ANTES (versão Docker)
image: git.automatizase.com.br/luis.erlacher/archon/server:latest

# DEPOIS (versão K8s)
image: git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest
```

Faça isso para todos os deployments:
- archon-server
- archon-mcp
- archon-agents
- archon-frontend

## Tamanhos das Imagens

### Estimativa de Redução (K8s vs Docker)

| Service | Docker | K8s | Redução |
|---------|--------|-----|---------|
| Server  | ~1.2GB | ~1.1GB | ~8% |
| MCP     | ~450MB | ~420MB | ~7% |
| Agents  | ~480MB | ~450MB | ~6% |
| Frontend| ~50MB  | ~48MB  | ~4% |

**Economia total:** ~100MB por deploy completo

## Testes

### Verificar Non-Root
```bash
# Docker
docker run --rm git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest id
# Esperado: uid=1001(appuser) gid=1001(appuser)

# Kubernetes
kubectl exec -it deployment/archon-server -n archon -- id
# Esperado: uid=1001(appuser) gid=1001(appuser)
```

### Testar Graceful Shutdown
```bash
# Docker
docker run -d --name test git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest
docker stop test  # Deve parar em ~2-3 segundos

# Kubernetes
kubectl rollout restart deployment/archon-server -n archon
kubectl rollout status deployment/archon-server -n archon
# Deve ser smooth, sem downtime
```

### Verificar Tamanho das Imagens
```bash
docker images | grep archon
# Compare tags 'latest' vs 'k8s-latest'
```

## Migration Checklist

Se você está migrando de Docker para K8s:

- [ ] Pull das novas imagens K8s
- [ ] Atualizar manifests K8s para usar `:k8s-latest`
- [ ] Adicionar `securityContext` nos deployments (veja exemplo acima)
- [ ] Adicionar `terminationGracePeriodSeconds: 30`
- [ ] Remover HEALTHCHECKs se você tinha configurado manualmente
- [ ] Testar rolling updates funcionam corretamente
- [ ] Verificar logs não mostram permission errors

## Manutenção

### Quando Modificar Dockerfiles

**Docker Version (Original):**
- Modificar apenas para compatibilidade com Docker Compose
- Manter simples e focado em desenvolvimento local

**Kubernetes Version (Optimized):**
- Aplicar todas as otimizações de produção
- Seguir best practices de segurança
- Manter alinhado com Docker version (funcionalidades)

### Sincronização

As duas versões devem ter as **mesmas funcionalidades**, apenas diferindo em:
- User (root vs non-root)
- Signal propagation (CMD format)
- Health checks (Dockerfile vs K8s)
- Optimizations (cache cleanup, layer ordering)

## Troubleshooting

### Erro: Permission Denied no K8s
```
Error: EACCES: permission denied, open '/app/file'
```

**Solução:** Verifique se todos os arquivos foram copiados com `--chown=appuser:appuser`

### Erro: Rolling Update com Downtime
```
502 Bad Gateway durante deploy
```

**Solução:** Verifique se CMD usa exec form para propagação de sinais

### Erro: Imagem Pull Failed
```
ImagePullBackOff
```

**Solução:** Verifique se as imagens K8s foram construídas e pushed:
```bash
# No servidor Gitea Actions
docker images | grep k8s-latest
```

## Referências

- [DOCKERFILE_K8S_IMPROVEMENTS.md](./DOCKERFILE_K8S_IMPROVEMENTS.md) - Análise detalhada
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [OWASP Docker Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [12 Factor App](https://12factor.net/)
