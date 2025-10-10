# Kubernetes Complete Adjustments Guide

## Executive Summary

Este documento descreve **todas as mudanças necessárias** para executar o Archon em produção no Kubernetes, não apenas o Playwright. As mudanças cobrem:

- ✅ Playwright browser binaries (JÁ CORRIGIDO)
- ⚠️ Variáveis de ambiente em K8s manifests
- ⚠️ Resource limits para crawling
- ⚠️ Nginx permissions e configuration
- ⚠️ Security contexts avançados
- ⚠️ Health checks otimizados
- ⚠️ Init containers para warm-up

---

## 1. Playwright Browser Binaries (✅ JÁ CORRIGIDO)

### Problema Identificado
Playwright instalava binários em `/root/.cache/ms-playwright` (root), mas container roda como `appuser` (UID 1001) e não tinha acesso.

### Solução Aplicada

**Dockerfile.k8s.server:**
```dockerfile
# Install Playwright browsers in a location accessible to appuser
ENV PATH=/venv/bin:$PATH
ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright
RUN mkdir -p /app/ms-playwright && \
    playwright install chromium && \
    chown -R appuser:appuser /app/ms-playwright

# Runtime environment
ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright
```

**Dockerfile.server (Docker Compose):**
```dockerfile
ENV PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright
RUN mkdir -p /tmp/ms-playwright && \
    playwright install chromium && \
    chmod -R 777 /tmp/ms-playwright

ENV PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright
```

### ⚠️ AÇÃO NECESSÁRIA: Adicionar em K8s Manifests

**Adicionar em `k8s-manifests-complete.yaml` - archon-server deployment:**

```yaml
spec:
  template:
    spec:
      containers:
      - name: server
        env:
        # ... outras variáveis ...

        # ADICIONAR ESTA LINHA:
        - name: PLAYWRIGHT_BROWSERS_PATH
          value: "/app/ms-playwright"
```

---

## 2. Resource Limits para Crawling com Chromium

### Problema
Chromium consome significativa memória e CPU durante crawling. Os limites atuais podem ser insuficientes:

**Atual:**
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Solução Recomendada

**Atualizar em `k8s-manifests-complete.yaml` - archon-server:**

```yaml
resources:
  requests:
    memory: "768Mi"      # Aumentado de 512Mi
    cpu: "500m"
  limits:
    memory: "2Gi"        # Aumentado de 1Gi (Chromium pode usar 1.5Gi em picos)
    cpu: "2000m"         # Aumentado de 1000m (crawling paralelo)

    # ADICIONAR: Limitar uso de ephemeral storage
    ephemeral-storage: "5Gi"
```

### Justificativa
- Chromium headless consome ~300-600MB por instância
- Crawling paralelo pode executar múltiplas instâncias
- Processamento de documentos grandes precisa de memória
- Margem de segurança para evitar OOMKilled

---

## 3. Nginx Configuration e Permissions

### Status Atual
✅ Nginx já configurado para rodar como non-root (user `nginx`, UID 101)

**Dockerfile.k8s.production:**
```dockerfile
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx
```

### ⚠️ Melhorias Recomendadas

**Adicionar em `k8s-manifests-complete.yaml` - archon-frontend:**

```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101       # nginx user
        runAsGroup: 101
        fsGroup: 101
        # ADICIONAR:
        seccompProfile:
          type: RuntimeDefault

      containers:
      - name: frontend
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
              - ALL
            # Nginx não precisa de capabilities especiais na porta 3737
          readOnlyRootFilesystem: true  # MUDAR para true

        # ADICIONAR volumes para diretórios que nginx precisa escrever:
        volumeMounts:
        - name: nginx-cache
          mountPath: /var/cache/nginx
        - name: nginx-run
          mountPath: /var/run
        - name: nginx-logs
          mountPath: /var/log/nginx

      volumes:
      - name: nginx-cache
        emptyDir: {}
      - name: nginx-run
        emptyDir: {}
      - name: nginx-logs
        emptyDir: {}
```

---

## 4. Advanced Security Contexts

### Problema
Security contexts estão básicos. Podem ser fortalecidos para melhor segurança.

### Solução: Pod Security Standards

**Adicionar em TODOS os deployments:**

```yaml
spec:
  template:
    metadata:
      labels:
        app: archon-server  # ou mcp, frontend, etc
        # ADICIONAR:
        pod-security.kubernetes.io/enforce: baseline
        pod-security.kubernetes.io/audit: restricted
        pod-security.kubernetes.io/warn: restricted

    spec:
      # Security context do pod
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        # ADICIONAR:
        seccompProfile:
          type: RuntimeDefault
        supplementalGroups: []

      # Security context do container
      containers:
      - name: server
        securityContext:
          allowPrivilegeEscalation: false
          runAsNonRoot: true
          runAsUser: 1001
          capabilities:
            drop:
              - ALL
          # ADICIONAR (se possível - testar primeiro):
          readOnlyRootFilesystem: false  # true após configurar volumes
          seccompProfile:
            type: RuntimeDefault
```

### Arquivos que Precisam Escrever

**archon-server:**
- `/app/ms-playwright` - Playwright browser cache (já configurado com ownership correto)
- `/tmp` - Temporary files (já acessível para appuser)
- Nenhum volume persistente necessário (tudo vai para Supabase)

**archon-mcp e archon-agents:**
- Nenhum arquivo local necessário
- Podem usar `readOnlyRootFilesystem: true`

---

## 5. Health Checks Otimizados

### Problema Atual
Health checks podem ser muito agressivos durante operações pesadas (crawling).

### Solução

**Atualizar em `k8s-manifests-complete.yaml` - archon-server:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8181
  initialDelaySeconds: 60      # Aumentado de 40 (tempo para Playwright inicializar)
  periodSeconds: 30            # OK
  timeoutSeconds: 15           # Aumentado de 10 (crawling pode deixar servidor lento)
  failureThreshold: 5          # Aumentado de 3 (mais tolerante)
  successThreshold: 1

readinessProbe:
  httpGet:
    path: /health
    port: 8181
  initialDelaySeconds: 15      # Aumentado de 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1

# ADICIONAR startup probe para não matar pod durante startup lento:
startupProbe:
  httpGet:
    path: /health
    port: 8181
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 12         # 12 x 10s = 2 minutos para startup
  successThreshold: 1
```

---

## 6. Init Container para Playwright Warm-up (Opcional mas Recomendado)

### Problema
Primeira requisição de crawling é lenta porque Playwright precisa inicializar.

### Solução

**Adicionar em `k8s-manifests-complete.yaml` - archon-server:**

```yaml
spec:
  template:
    spec:
      # ADICIONAR antes de containers:
      initContainers:
      - name: playwright-warmup
        image: git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest
        imagePullPolicy: Always
        command:
        - sh
        - -c
        - |
          echo "Verificando instalação do Playwright..."
          python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')" || exit 1
          echo "Playwright inicializado com sucesso"
        env:
        - name: PLAYWRIGHT_BROWSERS_PATH
          value: "/app/ms-playwright"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          allowPrivilegeEscalation: false
          capabilities:
            drop:
              - ALL
          readOnlyRootFilesystem: false

      containers:
      - name: server
        # ... resto da configuração ...
```

---

## 7. ConfigMap Updates

### Adicionar Playwright e outras configurações

**Atualizar em `k8s-manifests-complete.yaml` - ConfigMap:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: archon-config
  namespace: archon
data:
  # Existing configs...
  SERVICE_DISCOVERY_MODE: "kubernetes"
  LOG_LEVEL: "INFO"
  ARCHON_SERVER_PORT: "8181"
  ARCHON_MCP_PORT: "8051"
  ARCHON_UI_PORT: "3737"
  ARCHON_HOST: "localhost"
  TRANSPORT: "sse"
  AGENTS_ENABLED: "false"

  # ADICIONAR:
  PLAYWRIGHT_BROWSERS_PATH: "/app/ms-playwright"

  # MCP Public URL - IMPORTANTE: Configure com seu domínio!
  # Format: "domain.com:8051" or "localhost:8051"
  # Examples:
  #   - Development: localhost:8051
  #   - Production: archon.automatizase.com.br:8051
  #   - Custom: mcp.mycompany.com:8051
  # This is used to generate MCP client configuration JSON
  MCP_PUBLIC_URL: "archon.automatizase.com.br:8051"  # ← CHANGE THIS!

  # Chromium optimization flags (já configurados no código, mas podem ser sobrescritos):
  CHROMIUM_DISABLE_DEV_SHM: "true"
  CHROMIUM_HEADLESS: "true"
```

---

## 8. Network Policies (Segurança Adicional)

### Criar Network Policy para isolar pods

**Criar arquivo `k8s-network-policies.yaml`:**

```yaml
---
# Network Policy - Archon Server
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: archon-server-netpol
  namespace: archon
spec:
  podSelector:
    matchLabels:
      app: archon-server
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Permite tráfego do frontend
  - from:
    - podSelector:
        matchLabels:
          app: archon-frontend
    ports:
    - protocol: TCP
      port: 8181
  # Permite tráfego do MCP
  - from:
    - podSelector:
        matchLabels:
          app: archon-mcp
    ports:
    - protocol: TCP
      port: 8181
  egress:
  # Permite DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  # Permite Supabase (internet)
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
  # Permite comunicação com MCP
  - to:
    - podSelector:
        matchLabels:
          app: archon-mcp
    ports:
    - protocol: TCP
      port: 8051

---
# Network Policy - Archon MCP
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: archon-mcp-netpol
  namespace: archon
spec:
  podSelector:
    matchLabels:
      app: archon-mcp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Permite tráfego do server
  - from:
    - podSelector:
        matchLabels:
          app: archon-server
    ports:
    - protocol: TCP
      port: 8051
  egress:
  # Permite DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  # Permite Supabase
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
  # Permite comunicação com server
  - to:
    - podSelector:
        matchLabels:
          app: archon-server
    ports:
    - protocol: TCP
      port: 8181

---
# Network Policy - Archon Frontend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: archon-frontend-netpol
  namespace: archon
spec:
  podSelector:
    matchLabels:
      app: archon-frontend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Permite tráfego de qualquer lugar (public-facing)
  - {}
  egress:
  # Permite DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  # Permite comunicação com server (para API calls)
  - to:
    - podSelector:
        matchLabels:
          app: archon-server
    ports:
    - protocol: TCP
      port: 8181
```

---

## 9. Horizontal Pod Autoscaling (HPA)

### Configurar autoscaling para server

**Criar arquivo `k8s-hpa.yaml`:**

```yaml
---
# HPA - Archon Server (crawling pode ter spikes de carga)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: archon-server-hpa
  namespace: archon
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: archon-server
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Espera 5min antes de scale down
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 30   # Scale up rápido
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30

---
# HPA - Frontend (menos crítico, pode ser fixo em 2 réplicas)
# Opcional se houver muito tráfego
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: archon-frontend-hpa
  namespace: archon
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: archon-frontend
  minReplicas: 2
  maxReplicas: 4
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75
```

---

## 10. PodDisruptionBudget (Alta Disponibilidade)

### Garantir disponibilidade durante rolling updates

**Criar arquivo `k8s-pdb.yaml`:**

```yaml
---
# PDB - Archon Server
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: archon-server-pdb
  namespace: archon
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: archon-server
  unhealthyPodEvictionPolicy: AlwaysAllow

---
# PDB - Archon Frontend
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: archon-frontend-pdb
  namespace: archon
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: archon-frontend
  unhealthyPodEvictionPolicy: AlwaysAllow
```

---

## 11. Persistent Volumes - NÃO NECESSÁRIO

### Análise de Necessidade

**✅ Arquon NÃO precisa de volumes persistentes porque:**

1. **Uploads de documentos**: Processados em memória e salvos no Supabase
2. **Crawling results**: Salvos diretamente no Supabase
3. **Playwright cache**: Reinstalado na inicialização do pod (stateless)
4. **Logs**: Enviados para stdout/stderr (capturados pelo K8s)
5. **Credenciais**: Armazenadas no Supabase (encrypted)
6. **Session data**: Gerenciado por Socket.IO em memória

**📊 Arquitetura Stateless:**
```
Pod → Processa dados → Salva no Supabase → Pod morre → Novo pod funciona igual
```

**⚠️ Exceção:** Se precisar de cache local para performance:
```yaml
# Opcional: Volume efêmero para cache de embeddings (não persiste entre restarts)
volumes:
- name: embedding-cache
  emptyDir:
    sizeLimit: 1Gi
```

---

## 12. Monitoring e Observability

### Prometheus Metrics (Recomendado)

**Adicionar annotations nos deployments:**

```yaml
spec:
  template:
    metadata:
      annotations:
        # ADICIONAR:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8181"    # ou 8051 para MCP
        prometheus.io/path: "/metrics"  # Se implementar endpoint
```

### Logfire Integration

**Verificar em `k8s-manifests-complete.yaml` - Secrets:**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: archon-secrets
  namespace: archon
type: Opaque
stringData:
  SUPABASE_URL: "https://seu-projeto.supabase.co"
  SUPABASE_SERVICE_KEY: "sua-service-role-key-aqui"
  OPENAI_API_KEY: "sua-openai-key-aqui"
  LOGFIRE_TOKEN: "seu-logfire-token-aqui"  # CONFIGURAR se usar Logfire
```

---

## Checklist de Implementação

### 🔴 PRIORIDADE CRÍTICA (Impede funcionamento)
- [x] ✅ Corrigir Playwright browser path nos Dockerfiles
- [x] ✅ Adicionar `PLAYWRIGHT_BROWSERS_PATH` env var no deployment K8s
- [x] ✅ Adicionar `MCP_PUBLIC_URL` no ConfigMap e deployment K8s
- [x] ✅ Aumentar resource limits (memory: 2Gi, cpu: 2000m)
- [ ] ⚠️ Configurar `MCP_PUBLIC_URL` com o domínio correto no ConfigMap
- [ ] ⚠️ Rebuild e push das imagens K8s

### 🟡 PRIORIDADE ALTA (Segurança e estabilidade)
- [x] ✅ Atualizar health checks (startup probe, failureThreshold)
- [ ] ⚠️ Adicionar security contexts avançados (seccompProfile, readOnlyRootFilesystem)
- [ ] ⚠️ Configurar volumes para nginx (cache, run, logs)
- [ ] ⚠️ Implementar Network Policies

### 🟢 PRIORIDADE MÉDIA (Performance e observabilidade)
- [ ] 🔄 Adicionar init container para Playwright warm-up
- [ ] 🔄 Configurar HPA para server
- [ ] 🔄 Configurar PodDisruptionBudget
- [ ] 🔄 Adicionar Prometheus annotations

### 🔵 PRIORIDADE BAIXA (Melhoria contínua)
- [ ] 📝 Implementar /metrics endpoint para Prometheus
- [ ] 📝 Configurar Logfire token
- [ ] 📝 Testar readOnlyRootFilesystem: true no server
- [ ] 📝 Considerar resource quotas por namespace

---

## Comandos para Deploy

### 1. Rebuild e Push das Imagens

```bash
# Server
cd /home/lperl/Archon
docker build -f python/Dockerfile.k8s.server -t git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest python/
docker push git.automatizase.com.br/luis.erlacher/archon/server:k8s-latest

# MCP (não mudou, mas rebuild para garantir)
docker build -f python/Dockerfile.k8s.mcp -t git.automatizase.com.br/luis.erlacher/archon/mcp:k8s-latest python/
docker push git.automatizase.com.br/luis.erlacher/archon/mcp:k8s-latest

# Frontend (não mudou, mas rebuild para garantir)
docker build -f archon-ui-main/Dockerfile.k8s.production -t git.automatizase.com.br/luis.erlacher/archon/frontend:k8s-latest archon-ui-main/
docker push git.automatizase.com.br/luis.erlacher/archon/frontend:k8s-latest

# Agents (se usado)
docker build -f python/Dockerfile.k8s.agents -t git.automatizase.com.br/luis.erlacher/archon/agents:k8s-latest python/
docker push git.automatizase.com.br/luis.erlacher/archon/agents:k8s-latest
```

### 2. Aplicar K8s Manifests

```bash
# Namespace e secrets (se ainda não existir)
kubectl apply -f k8s-manifests-complete.yaml

# Network policies (criar arquivo primeiro)
kubectl apply -f k8s-network-policies.yaml

# HPA (criar arquivo primeiro)
kubectl apply -f k8s-hpa.yaml

# PDB (criar arquivo primeiro)
kubectl apply -f k8s-pdb.yaml
```

### 3. Rolling Restart

```bash
# Restart server (vai pegar nova imagem)
kubectl rollout restart deployment/archon-server -n archon
kubectl rollout status deployment/archon-server -n archon

# Restart MCP
kubectl rollout restart deployment/archon-mcp -n archon
kubectl rollout status deployment/archon-mcp -n archon

# Restart frontend
kubectl rollout restart deployment/archon-frontend -n archon
kubectl rollout status deployment/archon-frontend -n archon
```

### 4. Verificar Status

```bash
# Ver pods
kubectl get pods -n archon -w

# Ver logs do server
kubectl logs -f deployment/archon-server -n archon

# Ver eventos
kubectl get events -n archon --sort-by='.lastTimestamp'

# Testar crawling
kubectl port-forward -n archon svc/archon-server-service 8181:8181
# Em outro terminal:
curl -X POST http://localhost:8181/api/knowledge/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## Troubleshooting

### Problema: Pod crashando com OOMKilled
**Solução:** Aumentar memory limits para 2Gi ou mais

### Problema: Playwright ainda não encontra browser
**Verificar:**
```bash
kubectl exec -it deployment/archon-server -n archon -- bash
echo $PLAYWRIGHT_BROWSERS_PATH
ls -la /app/ms-playwright
```

### Problema: Health check falhando
**Solução:** Aumentar `initialDelaySeconds` e `failureThreshold`

### Problema: Rolling update com downtime
**Solução:** Verificar PodDisruptionBudget e garantir minAvailable: 1

---

## Referências

- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Playwright in Docker](https://playwright.dev/docs/docker)
- [Nginx Non-Root](https://hub.docker.com/_/nginx)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/docker/)
