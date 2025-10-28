# 6. API Design and Integration

## 6.1 API Integration Strategy

**API Integration Strategy:** Opt-in JWT validation via middleware decorator

**Authentication:** Supabase JWT tokens (RS256) validated via public key

**Versioning:** No API versioning needed - auth is additive, não quebra existing contracts

## 6.2 New API Endpoints

### Endpoint: POST /api/auth/session

**Method:** POST
**Endpoint:** `/api/auth/session`
**Purpose:** Valida JWT token e retorna user info (usado pelo frontend para verificar sessão)

**Integration:** Novo endpoint que não afeta rotas existentes

**Request:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": "2025-10-28T12:00:00Z"
  },
  "valid": true
}
```

---

### Endpoint: POST /api/auth/refresh

**Method:** POST
**Endpoint:** `/api/auth/refresh`
**Purpose:** Refresh JWT token antes de expirar (handled by Supabase client, endpoint para debug)

**Integration:** Opcional - Supabase client faz refresh automático

**Request:**
```json
{
  "refresh_token": "v1.MR5S0vJBYue..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1.NEW_REFRESH_TOKEN...",
  "expires_in": 3600
}
```

---

## 6.3 Modified Existing Endpoints (Backward Compatible)

Todos endpoints existentes **mantêm mesma signature** mas adicionam suporte opcional a `Authorization` header.

**Pattern Example:**

```python
# Before (existing behavior preserved)
@app.get("/api/projects")
async def list_projects():
    # Returns all projects
    return project_service.list_projects()

# After (auth-aware but backward compatible)
@app.get("/api/projects")
@optional_auth  # Decorator injeta user_id se token presente
async def list_projects(user_id: Optional[str] = None):
    # Returns user projects se user_id presente, senão all projects
    return project_service.list_projects(user_id=user_id)
```

**Affected Endpoints:**
- `GET /api/projects` - Filtra por user_id quando presente
- `POST /api/projects` - Seta user_id automaticamente quando auth ativo
- `GET /api/tasks` - Filtra tasks por user_id
- `GET /api/knowledge/sources` - Filtra sources por user_id
- `GET /api/progress/active` - Filtra operações por user_id

**Unchanged Endpoints (Always Public):**
- `GET /api/health` - Health check sempre público
- `GET /api/docs` - API documentation sempre pública
- `POST /mcp/*` - MCP tools usam service-key, não JWT

---
