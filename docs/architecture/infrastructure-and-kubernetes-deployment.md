# 8. Infrastructure and Kubernetes Deployment

## 8.1 Existing Infrastructure

**Current Deployment:** Docker Compose (local development e production local-first)

**Infrastructure Tools:**
- Docker 24.x
- Docker Compose 2.x
- Kubernetes 1.28+ (recentemente adicionado)
- ArgoCD Latest (GitOps para K8s)

**Environments:**
- Local Development (docker-compose.yml)
- Kubernetes Production (k8s-argocd/ manifests)

## 8.2 Enhancement Deployment Strategy

**Deployment Approach:** Gradual rollout com feature flag

**Phases:**
1. **Phase 1 - Development:** Deploy com `AUTH_ENABLED=false` (default, sem impacto)
2. **Phase 2 - Testing:** Habilitar auth em ambiente de test para validar integração
3. **Phase 3 - Production:** Gradualmente habilitar auth via feature flag

**Infrastructure Changes:**

### Docker Compose Changes

**File:** `docker-compose.yml`

```yaml
services:
  archon-server:
    environment:
      # Existing env vars (mantidos)
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}

      # NEW: Auth feature flag
      - AUTH_ENABLED=${AUTH_ENABLED:-false}  # Default false para backward compatibility

      # NEW: JWT configuration
      - JWT_SECRET=${JWT_SECRET}  # For HS256 tokens (optional, Supabase usa RS256)
      - JWT_ALGORITHM=${JWT_ALGORITHM:-RS256}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}  # Supabase project JWT secret

  archon-ui:
    environment:
      # NEW: Frontend feature flag
      - VITE_AUTH_ENABLED=${AUTH_ENABLED:-false}

      # Existing vars (mantidos)
      - VITE_API_URL=${VITE_API_URL:-http://localhost:8181}
```

### Kubernetes Manifests (NEW)

**File:** `k8s-argocd/base/auth-secret.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: archon-auth-secrets
  namespace: archon
type: Opaque
stringData:
  jwt-secret: ""  # Populated via Sealed Secrets ou External Secrets Operator
  supabase-jwt-secret: ""  # Supabase project JWT secret
```

**File:** `k8s-argocd/overlays/production/configmap.yaml` (MODIFIED)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: archon-config
  namespace: archon
data:
  # Existing config (mantido)
  SERVICE_DISCOVERY_MODE: "kubernetes"
  API_SERVICE_URL: "http://archon-server.archon.svc:8181"
  MCP_SERVICE_URL: "http://archon-mcp.archon.svc:8051"

  # NEW: Auth configuration
  AUTH_ENABLED: "true"  # Production tem auth habilitado
  JWT_ALGORITHM: "RS256"
```

**File:** `k8s-argocd/base/deployment.yaml` (MODIFIED)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: archon-server
spec:
  template:
    spec:
      containers:
      - name: archon-server
        env:
        # Existing env vars (mantidos)
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: supabase-secret
              key: url

        # NEW: Auth env vars
        - name: AUTH_ENABLED
          valueFrom:
            configMapKeyRef:
              name: archon-config
              key: AUTH_ENABLED

        - name: SUPABASE_JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: archon-auth-secrets
              key: supabase-jwt-secret
```

**Pipeline Integration:**

ArgoCD Application manifest permanece o mesmo. ArgoCD automaticamente detecta changes em `k8s-argocd/` e aplica.

**File:** `k8s-argocd/application.yaml` (EXISTING - sem mudanças necessárias)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: archon
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/archon
    targetRevision: main
    path: k8s-argocd/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: archon
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## 8.3 Rollback Strategy

**Rollback Method:**

1. **Instant Rollback (sem deploy):**
   ```bash
   # Disable auth via ConfigMap (ArgoCD aplica em segundos)
   kubectl patch configmap archon-config -n archon -p '{"data":{"AUTH_ENABLED":"false"}}'

   # Restart pods para aplicar change
   kubectl rollout restart deployment/archon-server -n archon
   ```

2. **Git Rollback (via ArgoCD):**
   ```bash
   # Revert commit que habilitou auth
   git revert <commit-hash>
   git push origin main

   # ArgoCD automaticamente faz rollback
   ```

**Risk Mitigation:**

- Feature flag permite disable instantâneo sem rollback de código
- Database schema changes são backward compatible (user_id nullable)
- RLS policies permitem acesso sem auth (`auth.uid() IS NULL`)
- Service-key requests bypassam auth completamente

**Monitoring:**

```yaml
# Prometheus metrics para monitorar auth
# File: k8s-argocd/base/servicemonitor.yaml (NEW)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: archon-auth-metrics
spec:
  selector:
    matchLabels:
      app: archon-server
  endpoints:
  - port: metrics
    path: /metrics
```

**Metrics to track:**
- `archon_auth_requests_total{status="success|failure"}` - Auth attempts
- `archon_jwt_validation_duration_seconds` - JWT validation latency
- `archon_auth_enabled` - Feature flag state (0 ou 1)

---
