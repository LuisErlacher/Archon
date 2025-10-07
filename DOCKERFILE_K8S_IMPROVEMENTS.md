# Dockerfile K8s Optimization Report

## Executive Summary

Os Dockerfiles atuais funcionam, mas **NÃO estão otimizados para produção em Kubernetes**. Principais problemas:

- ⚠️ **Segurança**: Todos rodam como root
- ⚠️ **Graceful Shutdown**: CMD não propaga sinais corretamente
- ⚠️ **Redundância**: HEALTHCHECKs duplicados (K8s já tem probes)
- ⚠️ **Cache de Layers**: Oportunidades de otimização perdidas

## Problemas por Dockerfile

### 1. python/Dockerfile.server

**Problemas Críticos:**
```dockerfile
# LINHA 78 - ❌ PROBLEMA
CMD sh -c "python -m uvicorn src.server.main:socket_app --host 0.0.0.0 --port ${ARCHON_SERVER_PORT} --workers 1"

# Problemas:
# 1. sh -c não propaga SIGTERM para o processo Python
# 2. Kubernetes rolling updates podem falhar ou ter downtime
# 3. Conexões podem ser abortadas abruptamente
```

**Solução:**
```dockerfile
# ✅ CORRETO - Exec form com array
CMD ["python", "-m", "uvicorn", "src.server.main:socket_app", \
     "--host", "0.0.0.0", "--port", "8181", "--workers", "1"]

# Se precisar de variável de ambiente:
CMD ["sh", "-c", "exec python -m uvicorn src.server.main:socket_app --host 0.0.0.0 --port ${ARCHON_SERVER_PORT}"]
```

**Outras Melhorias:**

```dockerfile
# REMOVER linhas 74-75 (HEALTHCHECK redundante)
# K8s já tem liveness/readiness probes definidos

# ADICIONAR antes do COPY (depois da linha 56):
RUN groupadd -r appuser -g 1001 && \
    useradd -r -g appuser -u 1001 appuser && \
    mkdir -p /app && chown -R appuser:appuser /app

# ADICIONAR antes do CMD (linha 77):
USER appuser

# OTIMIZAR CACHE - Mover COPY tests/ para DEPOIS se não for necessário em produção
```

### 2. python/Dockerfile.mcp

**Problemas:**
```dockerfile
# LINHA 42 - ❌ Roda como root, sem healthcheck
CMD ["python", "-m", "src.mcp_server.mcp_server"]
```

**Solução Completa:**
```dockerfile
# ADICIONAR depois da linha 30:
RUN groupadd -r appuser -g 1001 && \
    useradd -r -g appuser -u 1001 appuser && \
    chown -R appuser:appuser /app

# ADICIONAR antes do CMD (linha 41):
USER appuser

# CMD já está correto (exec form)
```

### 3. python/Dockerfile.agents

**Problemas Similares ao MCP:**
```dockerfile
# LINHA 34 - ❌ Roda como root
CMD sh -c "python -m uvicorn src.agents.server:app --host 0.0.0.0 --port ${ARCHON_AGENTS_PORT}"

# LINHAS 30-31 - ❌ HEALTHCHECK redundante para K8s
```

**Solução:**
```dockerfile
# REMOVER linhas 30-31 (HEALTHCHECK)

# ADICIONAR depois da linha 22:
RUN groupadd -r appuser -g 1001 && \
    useradd -r -g appuser -u 1001 appuser && \
    chown -R appuser:appuser /app

# ADICIONAR antes do CMD (linha 33):
USER appuser

# CORRIGIR CMD (linha 34):
CMD ["sh", "-c", "exec python -m uvicorn src.agents.server:app --host 0.0.0.0 --port ${ARCHON_AGENTS_PORT}"]
```

### 4. archon-ui-main/Dockerfile.production

**Problemas:**
```dockerfile
# LINHA 41-42 - ❌ HEALTHCHECK redundante
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3737/ || exit 1

# Nginx roda como root por padrão
```

**Solução:**
```dockerfile
# REMOVER linhas 41-42 (HEALTHCHECK)

# ADICIONAR depois da linha 29:
# Configurar nginx para rodar como non-root
RUN addgroup --system --gid 1001 nginx && \
    adduser --system --uid 1001 --gid 1001 nginx && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# ADICIONAR antes do CMD (linha 44):
USER nginx

# MODIFICAR nginx.conf para ouvir em porta não-privilegiada (>1024)
# Ou manter 3737 e usar CAP_NET_BIND_SERVICE no K8s
```

## Otimizações de Cache de Layers

### Dockerfile.server - Otimização

```dockerfile
# Ordem atual desperdiça cache se código muda
COPY src/server/ src/server/
COPY tests/ tests/

# ✅ MELHOR: Copiar apenas o necessário para produção
COPY src/server/ src/server/
COPY src/__init__.py src/

# Se tests/ for necessário APENAS para dev, remover do build de produção
```

### Todos os Dockerfiles Python

```dockerfile
# ADICIONAR após instalação de dependências:
# Limpar cache do pip/uv
RUN rm -rf ~/.cache/pip ~/.cache/uv
```

## Configuração K8s Necessária

### SecurityContext nos Deployments

```yaml
# Adicionar em TODOS os deployments (k8s-manifests-complete.yaml):
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
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
              - ALL
          readOnlyRootFilesystem: false  # true depois de ajustar volumes
```

### Graceful Shutdown (Deployment spec)

```yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30  # Adicionar
      containers:
      - name: server
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5"]  # Dar tempo para conexões fecharem
```

## Dockerfile Otimizado - Exemplo Server

```dockerfile
# Server Service - Web crawling and document processing microservice
FROM python:3.12 AS builder

WORKDIR /build

# Install build dependencies and uv
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

# Copy pyproject.toml for dependency installation
COPY pyproject.toml .

# Install server dependencies to a virtual environment using uv
RUN uv venv /venv && \
    . /venv/bin/activate && \
    uv pip install --group server --group server-reranking && \
    rm -rf ~/.cache/uv ~/.cache/pip

# Runtime stage
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies for Playwright (minimal set)
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create non-root user BEFORE copying files
RUN groupadd -r appuser -g 1001 && \
    useradd -r -g appuser -u 1001 appuser && \
    mkdir -p /app && chown -R appuser:appuser /app

# Copy the virtual environment from builder
COPY --from=builder --chown=appuser:appuser /venv /venv

# Install Playwright browsers as root (needs permissions)
ENV PATH=/venv/bin:$PATH
RUN playwright install chromium

# Copy server code (NO tests in production)
COPY --chown=appuser:appuser src/server/ src/server/
COPY --chown=appuser:appuser src/__init__.py src/

# Set environment variables
ENV PYTHONPATH="/app:$PYTHONPATH"
ENV PYTHONUNBUFFERED=1
ENV PATH="/venv/bin:$PATH"

# Expose Server port
ARG ARCHON_SERVER_PORT=8181
ENV ARCHON_SERVER_PORT=${ARCHON_SERVER_PORT}
EXPOSE ${ARCHON_SERVER_PORT}

# Switch to non-root user
USER appuser

# Run the Server service with proper signal handling
CMD ["sh", "-c", "exec python -m uvicorn src.server.main:socket_app --host 0.0.0.0 --port ${ARCHON_SERVER_PORT} --workers 1"]
```

## Checklist de Implementação

### Prioridade ALTA (Segurança)
- [ ] Adicionar usuário non-root em todos os Dockerfiles
- [ ] Adicionar `USER appuser` antes do CMD
- [ ] Configurar `securityContext` nos deployments K8s
- [ ] Remover todos os HEALTHCHECKs dos Dockerfiles

### Prioridade ALTA (Confiabilidade)
- [ ] Corrigir CMD para exec form com propagação de sinais
- [ ] Adicionar `terminationGracePeriodSeconds` nos deployments
- [ ] Testar rolling updates funcionam corretamente

### Prioridade MÉDIA (Otimização)
- [ ] Otimizar ordem de COPY para melhor cache
- [ ] Limpar cache pip/uv após instalações
- [ ] Remover `tests/` do build de produção (se não necessário)

### Prioridade BAIXA (Melhoria Contínua)
- [ ] Considerar distroless images para mais segurança
- [ ] Implementar multi-arch builds (amd64/arm64)
- [ ] Adicionar SBOM (Software Bill of Materials)

## Testes Recomendados

```bash
# Testar se containers rodam como non-root
docker run --rm your-image id
# Deve retornar: uid=1001(appuser) gid=1001(appuser)

# Testar graceful shutdown
docker run -d --name test your-image
docker stop test  # Deve parar em ~2-3 segundos, não 10

# Testar no K8s
kubectl rollout restart deployment/archon-server -n archon
kubectl rollout status deployment/archon-server -n archon
# Deve ser smooth sem downtime
```

## Referências

- [Kubernetes Best Practices - Dockerfile](https://kubernetes.io/docs/concepts/configuration/overview/)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Python Docker Best Practices](https://docs.python.org/3/using/docker.html)
- [FastAPI Deployment - Docker](https://fastapi.tiangolo.com/deployment/docker/)
