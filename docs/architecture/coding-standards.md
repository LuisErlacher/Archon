# 9. Coding Standards

## 9.1 Existing Standards Compliance

**Code Style:**
- **Frontend:** ESLint + Biome (120 char lines, double quotes, trailing commas)
- **Backend:** Ruff + Black style (120 char lines, snake_case)

**Linting Rules:**
- **Frontend:** ESLint para legacy code, Biome para `/features` (auth vai para features/auth, usa Biome)
- **Backend:** Ruff check + Ruff format, MyPy para type checking

**Testing Patterns:**
- **Frontend:** Vitest + React Testing Library (auth tests em `features/auth/tests/`)
- **Backend:** pytest com async support (auth tests em `tests/server/auth/`)

**Documentation Style:**
- **Frontend:** JSDoc para funções públicas, inline comments para lógica complexa
- **Backend:** Python docstrings (Google style), type hints obrigatórias

## 9.2 Enhancement-Specific Standards

**Auth Code Security Standards:**

- **Never log sensitive data:** Passwords, tokens, secrets nunca devem aparecer em logs
  ```python
  # ❌ WRONG
  logger.info(f"User logged in with token: {token}")

  # ✅ CORRECT
  logger.info(f"User {user_id} logged in successfully")
  ```

- **Always use HTTPS in production:** JWT tokens devem ser transmitidos apenas via HTTPS
  ```typescript
  // Frontend apiClient deve verificar protocol em production
  if (import.meta.env.PROD && !window.location.protocol.startsWith('https')) {
    throw new Error('Auth requires HTTPS in production');
  }
  ```

- **Validate all inputs:** Email, password devem ser validados antes de enviar ao backend
  ```typescript
  // Use Zod schemas para validation
  const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters')
  });
  ```

## 9.3 Critical Integration Rules

**Existing API Compatibility:**
- Todos endpoints devem manter mesma signature
- `Authorization` header é **opcional** - backend deve funcionar sem ele
- Nunca retornar erro se auth desabilitado via feature flag

**Database Integration:**
- `user_id` columns devem ser **nullable**
- Queries devem funcionar com `user_id = NULL` (dados legacy)
- Service-key requests devem bypassar RLS completamente

**Error Handling:**
- Seguir CLAUDE.md "fail fast and loud" philosophy
- JWT validation errors devem retornar 401 com mensagem clara
- Supabase Auth errors devem ser propagados ao frontend com contexto

**Logging Consistency:**
- Auth events devem usar mesmo logger que resto da aplicação
- Format: `[AUTH] {event} - user_id={id}, success={bool}`
- Exemplos:
  ```python
  logger.info(f"[AUTH] Login attempt - email={email}, success=True")
  logger.warning(f"[AUTH] Invalid token - user_id={user_id}, reason=expired")
  logger.error(f"[AUTH] JWT validation failed - error={str(e)}", exc_info=True)
  ```

---
