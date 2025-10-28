# 12. Next Steps

## 12.1 Story Manager Handoff

**Prompt for Story Manager:**

"Please develop detailed user stories for the Frontend Authentication System epic. Key considerations:

**Integration Context:**
- This is an enhancement to Archon V2 Beta (React 18/FastAPI/Supabase stack)
- Integration points verified:
  - Frontend: apiClient.ts (token injection), App.tsx (AuthProvider wrapper)
  - Backend: main.py (middleware registration), api_routes/ (decorator @optional_auth)
  - Database: RLS policies with backward compatibility fallback
  - K8s: ConfigMaps for AUTH_ENABLED flag, Secrets for JWT keys

**Existing Patterns to Follow:**
- Vertical slice architecture in `/features/auth/`
- TanStack Query for auth state (session, user queries)
- Service layer pattern (authService.ts → auth_api.py → Supabase)
- Tron glassmorphism UI design system
- Testing with Vitest (frontend) and pytest (backend)

**Critical Compatibility Requirements:**
- Feature flag `AUTH_ENABLED=false` (default) maintains current behavior
- Nullable `user_id` columns for backward compatibility
- Service-key bypass for MCP server and agents
- Zero breaking changes to existing API contracts
- RLS policies with `auth.uid() IS NULL` fallback

**Each Story Must Include:**
- Acceptance criteria validating existing functionality remains intact
- Test scenarios covering auth disabled and enabled states
- Integration verification with actual codebase files (not assumptions)
- Clear sequencing to minimize risk to existing system

**First Story to Implement:**
Story 1 - Frontend Authentication Foundation (AuthContext, Supabase client, hooks)

The epic maintains system integrity while delivering secure multi-user authentication with user data isolation."

---

## 12.2 Developer Handoff

**Prompt for Developers:**

"Implementation guide for Frontend Authentication System enhancement.

**Architecture Reference:**
- This document (`docs/architecture.md`)
- Existing architecture: `PRPs/ai_docs/ARCHITECTURE.md`
- Coding standards analyzed from actual project files
- Beta philosophy: CLAUDE.md (fail fast and loud)

**Integration Requirements:**

✅ **Do's:**
- Use decorator/wrapper pattern - NEVER modify existing components directly
- Add `@optional_auth` to endpoints - maintain backward compatibility
- Follow vertical slice in `features/auth/` - reuse patterns from features/projects/
- Test with `AUTH_ENABLED=false` first - ensure no regressions
- Use TanStack Query keys from `authKeys` factory - follow queryPatterns.ts

❌ **Don'ts:**
- Don't break existing APIs - only ADD auth support
- Don't modify database data - user_id nullable preserves legacy data
- Don't skip service-key bypass - MCP/agents need system-level access
- Don't log sensitive data (passwords, tokens)
- Don't hardcode secrets - use environment variables

**Key Technical Decisions:**
- **JWT Validation:** RS256 via python-jose + Supabase public key
- **RLS Policies:** Backward compatible with `auth.uid() IS NULL OR ...`
- **Frontend State:** TanStack Query context (not Redux/Zustand)
- **K8s Secrets:** ConfigMaps for feature flags, Secrets for JWT keys

**Implementation Sequencing:**

1. **Backend First (Low Risk):**
   - Add `user_id` columns (nullable)
   - Implement JWT middleware with feature flag check
   - Update RLS policies with fallback
   - Test with `AUTH_ENABLED=false` - verify zero impact

2. **Frontend Core:**
   - Install `@supabase/supabase-js`
   - Create AuthProvider context
   - Implement authService.ts
   - Add token interceptor to apiClient.ts

3. **Frontend UI:**
   - Build Login/Signup pages (Tron glassmorphism)
   - Add ProtectedRoute wrapper
   - Update App.tsx with conditional AuthProvider

4. **Integration Testing:**
   - Test existing features with auth disabled
   - Test new auth flow end-to-end
   - Verify multi-user data isolation
   - Confirm service-key bypass works

5. **K8s Deployment:**
   - Add ConfigMap entries (AUTH_ENABLED)
   - Create Secrets for JWT keys
   - Update deployment with env vars
   - Test ArgoCD sync

**Verification Steps:**
- [ ] All existing tests pass with AUTH_ENABLED=false
- [ ] All new auth tests pass with AUTH_ENABLED=true
- [ ] MCP server continues functioning (service-key access)
- [ ] Existing data accessible when user_id=NULL
- [ ] Rollback via feature flag works (< 30 seconds)
- [ ] JWT validation adds <50ms latency
- [ ] Code review passes (ruff, mypy, eslint, biome)

**Contacts:**
- Architecture Questions: Refer to this document
- Backend Integration: `python/src/server/api_routes/projects_api.py` (reference pattern)
- Frontend Patterns: `features/projects/hooks/useProjectQueries.ts` (TanStack Query example)
- K8s Deployment: `k8s-argocd/` manifests + ArgoCD docs

Good luck! Remember: additive pattern, feature flag for safety, test with auth disabled first. 🏗️"

---
