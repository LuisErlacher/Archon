# 11. Security Integration

## 11.1 Existing Security Measures

**Authentication:** Currently none - system operates local-only sem user accounts

**Authorization:** Supabase RLS enabled mas com policies públicas (`FOR ALL USING (true)`)

**Data Protection:**
- HTTPS em production (assumido, não forçado)
- SUPABASE_SERVICE_KEY em environment variables (não hardcoded)
- Passwords: N/A (sem users atualmente)

**Security Tools:**
- Dependabot para dependency updates (GitHub)
- Ruff security rules (backend linting)
- ESLint security plugin (frontend linting)

## 11.2 Enhancement Security Requirements

### Authentication Security

**Password Requirements:**
- Minimum 8 characters
- Must contain uppercase, lowercase, number, special char (enforced por Supabase Auth)
- Password hashing via bcrypt (gerenciado por Supabase)

**JWT Token Security:**
- Algorithm: RS256 (RSA with SHA-256) - Supabase default
- Expiration: 3600 seconds (1 hour) - auto-refresh antes de expirar
- Claims: `sub` (user_id), `email`, `role`, `exp` (expiration)
- Signature verification: Via Supabase public key (`https://<project>.supabase.co/.well-known/jwks.json`)

**Session Management:**
- Storage: localStorage (default), configurable para sessionStorage
- Refresh token: Stored separately, rotated on refresh
- Session timeout: 7 days inactivity (Supabase default)

### Authorization Security

**Integration Points:**

Backend middleware valida JWT e injeta `user_id`:
```python
# middleware/auth_middleware.py
async def auth_middleware(request: Request, call_next):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")

    if not token:
        # No token - allow if AUTH_ENABLED=false
        if not settings.AUTH_ENABLED:
            return await call_next(request)
        # Auth required but no token - check if endpoint is public
        if is_public_endpoint(request.url.path):
            return await call_next(request)
        raise HTTPException(status_code=401, detail="Authentication required")

    # Validate JWT
    try:
        payload = validate_jwt_token(token)
        request.state.user_id = payload["sub"]
        request.state.user_email = payload["email"]
    except JWTExpiredError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTInvalidError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    return await call_next(request)
```

**RLS Policy Security:**

Supabase RLS garante data isolation no database level:
```sql
-- Exemplo: archon_projects table
CREATE POLICY "users_own_projects" ON archon_projects
  FOR ALL USING (
    -- Fallback para legacy data
    auth.uid() IS NULL
    -- User ownership
    OR auth.uid() = user_id
    -- Service-key bypass
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );
```

**Compliance Requirements:**
- GDPR: User data deletion cascade (`ON DELETE CASCADE` em foreign keys)
- Data Export: API endpoint para user baixar todos seus dados
- Audit Log: Log de auth events (login, logout, token refresh)

## 11.3 Security Testing

**Existing Security Tests:** None specific to auth (não havia auth antes)

**New Security Test Requirements:**

```python
# tests/server/auth/test_security.py

async def test_jwt_expired_rejected():
    """Tokens expirados devem retornar 401"""
    expired_token = create_expired_jwt()
    response = await client.get("/api/projects", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401

async def test_rls_isolates_user_data():
    """User A não deve ver dados de User B"""
    user_a_token = await login("usera@example.com", "password")
    user_b_token = await login("userb@example.com", "password")

    # User A cria projeto
    project = await create_project(user_a_token, {"title": "User A Project"})

    # User B tenta acessar projeto de A
    response = await client.get(f"/api/projects/{project.id}", headers={"Authorization": f"Bearer {user_b_token}"})
    assert response.status_code == 404  # RLS policy bloqueia

async def test_service_key_bypasses_auth():
    """Service-key requests devem bypassar JWT validation"""
    response = await client.get(
        "/api/projects",
        headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"}
    )
    assert response.status_code == 200
    # Deve retornar TODOS os projects (sem filtro user_id)
```

**Penetration Testing Requirements:**

Manual testing scenarios:
- ✅ SQL Injection via email/password inputs
- ✅ XSS via user-generated content (project titles, task descriptions)
- ✅ CSRF attacks (mitigated por SameSite cookies se usarmos)
- ✅ Session fixation attacks
- ✅ Brute force login attempts (rate limiting needed?)

---
