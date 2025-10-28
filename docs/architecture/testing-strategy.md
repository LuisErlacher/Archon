# 10. Testing Strategy

## 10.1 Integration with Existing Tests

**Existing Test Framework:**
- **Frontend:** Vitest 1.6+ com React Testing Library
- **Backend:** pytest 8.x com pytest-asyncio

**Test Organization:**
- **Frontend:** `src/features/{feature}/tests/` (co-located com código)
- **Backend:** `tests/server/{module}/` (espelhando src structure)

**Coverage Requirements:**
- **Frontend:** 80% coverage mínimo para features/auth/
- **Backend:** 90% coverage mínimo para services/auth/ e middleware/

## 10.2 New Testing Requirements

### Unit Tests for New Components

**Framework:** Vitest + React Testing Library

**Location:** `archon-ui-main/src/features/auth/tests/`

**Coverage Target:** 85% minimum

**Integration with Existing:** Auth tests seguem mesmo padrão que tests existentes em features/projects/

**Example Test Files:**
```
features/auth/tests/
├── LoginPage.test.tsx          # UI tests
├── SignupPage.test.tsx         # Form validation tests
├── ProtectedRoute.test.tsx     # Route protection tests
├── useAuth.test.ts             # Hook tests
├── authService.test.ts         # Service layer tests
└── AuthProvider.test.tsx       # Context provider tests
```

**Key Test Scenarios:**
- ✅ Login com credenciais válidas
- ✅ Login com credenciais inválidas (401)
- ✅ Signup com dados válidos
- ✅ Signup com email duplicado (conflict)
- ✅ Protected route redireciona quando não autenticado
- ✅ Protected route permite acesso quando autenticado
- ✅ Token refresh automático antes de expirar
- ✅ Logout limpa session e redireciona

### Backend Unit Tests

**Framework:** pytest + pytest-asyncio

**Location:** `python/tests/server/auth/`

**Coverage Target:** 90% minimum

**Integration with Existing:** Auth tests usam fixtures existentes para database e async client

**Example Test Files:**
```
tests/server/auth/
├── test_jwt_service.py         # JWT validation tests
├── test_auth_middleware.py     # Middleware integration tests
├── test_auth_api.py            # API endpoint tests
└── test_user_service.py        # User CRUD tests
```

**Key Test Scenarios:**
- ✅ JWT validation com token válido
- ✅ JWT validation com token expirado (401)
- ✅ JWT validation com token inválido (401)
- ✅ Middleware injeta user_id em request.state
- ✅ Middleware bypassa auth quando AUTH_ENABLED=false
- ✅ Service-key requests bypassam JWT validation
- ✅ RLS policies isolam dados por user_id

## 10.3 Integration Tests

**Scope:** End-to-end auth flow - Frontend → Backend → Database

**Existing System Verification:**
- ✅ Existing endpoints continuam funcionando sem auth header
- ✅ Existing data acessível quando user_id=NULL
- ✅ MCP server mantém acesso via service-key

**New Feature Testing:**
- ✅ User signup → email confirmation → login flow
- ✅ Protected route redirect → login → access granted
- ✅ Multi-user isolation (user A não vê dados de user B)

**Test Environment:**
```yaml
# docker-compose.test.yml
services:
  archon-server-test:
    environment:
      AUTH_ENABLED: "true"
      SUPABASE_URL: "http://supabase-test:8000"

  supabase-test:
    image: supabase/supabase:latest
    # Isolated test database
```

## 10.4 Regression Testing

**Existing Feature Verification:**

Run full test suite existente com `AUTH_ENABLED=false` e `AUTH_ENABLED=true` para garantir zero breaking changes.

**Automated Regression Suite:**
```bash
# Frontend regression
npm run test -- --coverage --run
npm run test:auth-disabled  # Custom script com AUTH_ENABLED=false
npm run test:auth-enabled   # Custom script com AUTH_ENABLED=true

# Backend regression
pytest tests/ --cov=src/server --cov-report=html
pytest tests/ --auth-disabled  # Custom marker
pytest tests/ --auth-enabled   # Custom marker
```

**Manual Testing Requirements:**
- ✅ Login flow completo (signup → login → dashboard)
- ✅ Protected routes funcionando
- ✅ Multi-user data isolation
- ✅ MCP server funcionando sem auth
- ✅ Existing features funcionando com auth disabled
- ✅ Rollback via feature flag funciona

---
