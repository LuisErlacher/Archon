# 2. Enhancement Scope and Integration Strategy

## 2.1 Enhancement Overview

**Enhancement Type:** Additive Feature Layer (Non-Breaking)

**Scope:** Adicionar sistema de autenticação de usuários como camada **opcional** sobre a arquitetura existente. O sistema continua funcionando exatamente como está quando autenticação está desabilitada. Quando habilitada, adiciona:
- Frontend: Login/Signup UI + Auth context + Protected routes
- Backend: JWT validation middleware (opcional por endpoint)
- Database: Colunas `user_id` nullable + RLS policies (opcionais quando service-key usado)

**Integration Impact:** **Minimal (Low Risk)**
- **Código Existente:** Zero modificações em funcionalidades atuais
- **APIs Existentes:** Mantidas 100% iguais, apenas adicionam suporte a header `Authorization` opcional
- **Database:** Schema changes são aditivos (ADD COLUMN nullable), não modificam dados existentes
- **Deployment:** Feature flag `AUTH_ENABLED` controla ativação (default: false para compatibilidade)

## 2.2 Integration Approach

### Code Integration Strategy

**Pattern:** Decorator/Wrapper Pattern (Non-Invasive)

**Frontend:**
```typescript
// Sistema EXISTENTE permanece intocado
<App>
  <Router>
    <KnowledgePage />  {/* Funciona como sempre funcionou */}
  </Router>
</App>

// Sistema COM AUTH adiciona wrapper opcional
<App>
  <AuthProvider>  {/* ← Nova camada OPCIONAL */}
    <Router>
      <ProtectedRoute>  {/* ← Wrapper condicional */}
        <KnowledgePage />  {/* Componente original INALTERADO */}
      </ProtectedRoute>
    </Router>
  </AuthProvider>
</App>
```

**Backend:**
```python
# Rota EXISTENTE permanece intocada
@app.get("/api/projects")
async def list_projects():
    return project_service.list_projects()

# Rota COM AUTH adiciona decorator opcional
@app.get("/api/projects")
@optional_auth  # ← Decorator NÃO quebra se auth desabilitado
async def list_projects(user_id: Optional[str] = None):
    return project_service.list_projects(user_id)
```

**Principle:** Auth é uma **camada interceptadora** que pode ser ligada/desligada sem afetar código core.

### Database Integration

**Strategy:** Additive Schema Changes (Backward Compatible)

**Approach:**
- `user_id UUID` columns são **nullable** (podem ser NULL para dados legacy)
- RLS policies usam `auth.uid() IS NULL OR auth.uid() = user_id` (permite acesso sem auth)
- Service-key requests bypassam RLS completamente (comportamento atual mantido)

**Migration Pattern:**
```sql
-- Adiciona colunas SEM quebrar dados existentes
ALTER TABLE archon_projects ADD COLUMN user_id UUID;
-- Dados existentes ficam com user_id = NULL (válido)

-- RLS policies permitem acesso legacy
CREATE POLICY "users_own_projects" ON archon_projects
  FOR ALL USING (
    auth.uid() IS NULL            -- ← Permite requests sem auth
    OR auth.uid() = user_id       -- ← Isola dados por user quando auth ativo
    OR current_setting('request.jwt.claim.role', true) = 'service_role'  -- ← Service-key bypass
  );
```

### API Integration

**Strategy:** Opt-in Authentication Headers

**Current Behavior (Maintained):**
```bash
# Request SEM auth (funciona como sempre funcionou)
GET /api/projects
# Response: todos os projects
```

**New Behavior (When auth enabled):**
```bash
# Request COM auth (adiciona header opcional)
GET /api/projects
Authorization: Bearer <jwt_token>
# Response: projects do user autenticado

# Request SEM auth (ainda funciona - fallback para comportamento legacy)
GET /api/projects
# Response: projects públicos ou erro 401 (configurável)
```

**API Compatibility Matrix:**

| Endpoint | Auth Disabled | Auth Enabled + Token | Auth Enabled + No Token |
|----------|---------------|----------------------|-------------------------|
| `/api/projects` | ✅ All data | ✅ User data | ⚠️ Configurable (401 ou public data) |
| `/api/health` | ✅ Public | ✅ Public | ✅ Public (sempre público) |
| `/mcp/*` | ✅ Service-key | ✅ Service-key | ✅ Service-key (bypass auth) |

### UI Integration

**Strategy:** Conditional Rendering (Feature Flag)

**Existing UI Flow (Maintained when AUTH_ENABLED=false):**
```
Browser → http://localhost:3737 → Dashboard (direto, sem login)
```

**New UI Flow (When AUTH_ENABLED=true):**
```
Browser → http://localhost:3737
  ↓
AuthProvider verifica sessão
  ├─ Sem sessão → Redirect /login
  └─ Com sessão → Dashboard (como sempre)
```

## 2.3 Compatibility Requirements

**Compatibility Guarantees:**

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Existing API contracts unchanged** | Todos endpoints mantêm mesma signature | ✅ Garantido |
| **Database schema backward compatible** | `user_id` nullable, RLS com fallback | ✅ Garantido |
| **UI/UX consistency** | Novos componentes seguem design system existente | ✅ Garantido |
| **Performance impact minimal** | JWT validation <50ms, ETag caching mantido | ✅ Target definido |
| **Local deployment mode functional** | `AUTH_ENABLED=false` mantém comportamento atual | ✅ Garantido |
| **Service-key access preserved** | MCP/Agents bypassam auth, mantêm acesso total | ✅ Garantido |
| **Zero breaking changes** | Feature flag permite rollback instantâneo | ✅ Garantido |

---
