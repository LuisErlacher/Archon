# Epic #1: Frontend Authentication System - Brownfield Enhancement

## Epic Goal

Implement a complete user authentication system for the Archon frontend using Supabase Auth, enabling secure multi-user access control while maintaining the existing local-first deployment model and adding optional multi-tenant capabilities.

## Epic Description

### Existing System Context

**Current Relevant Functionality:**
- Archon currently operates as a local-only deployment with no authentication
- Backend uses `SUPABASE_SERVICE_KEY` for full database access
- Frontend has unrestricted access to all API endpoints
- CORS configured with `allow_origins=["*"]`
- RLS (Row Level Security) enabled in database but with public read policies
- Architecture follows vertical slice pattern with TanStack Query for data fetching

**Technology Stack:**
- **Frontend:** React 18, TypeScript 5, TanStack Query v5, Tailwind CSS, Vite
- **Backend:** Python 3.12, FastAPI, Supabase (PostgreSQL + pgvector)
- **Infrastructure:** Docker Compose, service-oriented architecture

**Integration Points:**
- Frontend API client: `archon-ui-main/src/features/shared/api/apiClient.ts`
- Backend main entry: `python/src/server/main.py`
- Database configuration: `migration/complete_setup.sql`
- React Router setup: `archon-ui-main/src/App.tsx`

### Enhancement Details

**What's Being Added/Changed:**

1. **Frontend Authentication Layer:**
   - Supabase Auth integration with `@supabase/supabase-js`
   - Authentication context and hooks for session management
   - Login/Signup UI components following Tron-inspired glassmorphism design
   - Protected route wrapper with automatic redirects
   - Token refresh mechanism

2. **Backend Authentication Middleware:**
   - JWT validation middleware for FastAPI
   - User session verification on protected endpoints
   - Integration with existing RLS policies

3. **Database Schema Updates:**
   - Update RLS policies to use `auth.uid()` for user-scoped data
   - Add `user_id` columns to relevant tables (projects, tasks, sources)
   - Migration scripts for backward compatibility

**How It Integrates:**
- Leverages existing Supabase infrastructure (already configured)
- Follows vertical slice architecture pattern (`features/auth/`)
- Integrates with TanStack Query for auth state management
- Uses existing API client with token injection
- Maintains backward compatibility with service-key access for system operations

**Success Criteria:**
- Users can sign up and log in with email/password
- Protected routes redirect unauthenticated users to login
- User data is isolated per user account (RLS enforced)
- Existing functionality works for authenticated users
- Session persists across page refreshes
- Token refresh happens automatically before expiration
- Local deployment mode remains functional (optional auth toggle)

## Stories

### Story 1: Frontend Authentication Foundation
**Goal:** Set up Supabase Auth client, create auth context, and implement session management hooks

**Key Deliverables:**
- Install and configure `@supabase/supabase-js`
- Create `AuthContext` and `AuthProvider` components
- Implement custom hooks: `useAuth()`, `useSession()`, `useUser()`
- Add token management to API client interceptors
- Create auth service layer in `features/auth/services/`

**Acceptance Criteria:**
- Supabase client initialized with correct project credentials
- Auth state accessible throughout app via context
- Session token automatically injected in API requests
- Token refresh handled automatically
- Auth state persists across page reloads

---

### Story 2: Login/Signup UI Components
**Goal:** Create authentication UI components with form validation and error handling

**Key Deliverables:**
- Login page component with email/password form
- Signup page component with validation
- Password reset flow UI
- Auth error handling and toast notifications
- Protected route wrapper component
- Auth-related routes in React Router

**Acceptance Criteria:**
- Users can create account with email/password
- Users can log in with existing credentials
- Form validation provides clear error messages
- Successful auth redirects to dashboard/home
- Logout functionality clears session
- UI follows existing Tron glassmorphism design system

---

### Story 3: Backend Authentication & RLS Integration
**Goal:** Implement JWT validation middleware and update database RLS policies for user-scoped data

**Key Deliverables:**
- FastAPI JWT authentication middleware
- Protected endpoint decorator for routes requiring auth
- Update RLS policies for user-scoped tables
- Database migration adding `user_id` columns
- Backward compatibility layer for service-key access

**Acceptance Criteria:**
- Backend validates Supabase JWT tokens
- Unauthorized requests return 401 status
- RLS policies enforce user data isolation
- Migration runs without breaking existing data
- Service-key requests bypass auth for system operations
- Health check and public endpoints remain unauthenticated

## Compatibility Requirements

- [x] Existing APIs remain unchanged (add auth layer, don't break existing)
- [x] Database schema changes are backward compatible (nullable `user_id` columns)
- [x] UI changes follow existing Tron glassmorphism patterns
- [x] Performance impact is minimal (JWT validation is fast)
- [x] Local deployment mode can disable auth via environment variable

## Risk Mitigation

**Primary Risk:** Breaking existing local deployment workflow or data access patterns

**Mitigation:**
- Feature flag in settings to enable/disable authentication
- Backward compatible database migrations with nullable user columns
- Comprehensive testing of existing functionality with auth enabled
- Service-key bypass for system operations (MCP, agents)

**Rollback Plan:**
- Database migration includes down/rollback script
- Feature flag allows instant disable of auth layer
- Frontend auth components are isolated in `features/auth/` for easy removal
- Backend middleware is optional and can be toggled via config

**Secondary Risk:** User data isolation errors exposing data across users

**Mitigation:**
- Comprehensive RLS policy testing
- User ID validation in all data access paths
- Security audit checklist before production rollout
- Test suite covering multi-user scenarios

## Definition of Done

- [x] All stories completed with acceptance criteria met
- [x] Existing functionality verified through testing (auth disabled mode)
- [x] Integration points working correctly (API client, backend, database)
- [x] Documentation updated:
  - Setup guide for enabling authentication
  - Architecture docs updated with auth flow diagrams
  - API documentation includes auth headers
- [x] No regression in existing features (verified via test suite)
- [x] Security review completed for RLS policies and JWT handling
- [x] Performance testing shows <50ms overhead for auth checks

## Technical Implementation Notes

### Frontend Architecture
```
archon-ui-main/src/features/auth/
├── components/          # Login, Signup, ProtectedRoute
├── hooks/              # useAuth, useSession, useUser
├── services/           # authService.ts (Supabase client wrapper)
├── context/            # AuthContext, AuthProvider
└── types/              # Auth-related TypeScript types
```

### Backend Middleware Pattern
```python
# python/src/server/middleware/auth_middleware.py
async def verify_jwt_token(request: Request):
    token = request.headers.get("Authorization")
    # Validate Supabase JWT
    # Inject user_id into request.state
```

### Database Migration Pattern
```sql
-- Add user_id columns (nullable for backward compatibility)
ALTER TABLE archon_projects ADD COLUMN user_id UUID;
ALTER TABLE archon_tasks ADD COLUMN user_id UUID;
ALTER TABLE archon_sources ADD COLUMN user_id UUID;

-- Update RLS policies
CREATE POLICY "Users see own projects" ON archon_projects
    FOR ALL USING (auth.uid() = user_id);
```

## Dependencies & Blockers

**Dependencies:**
- Supabase project already configured (✅ Complete)
- Frontend vertical slice architecture in place (✅ Complete)
- Backend FastAPI structure established (✅ Complete)

**No Blockers Identified**

## Story Manager Handoff

**Story Manager Handoff:**

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running React 18/FastAPI/Supabase
- Integration points:
  - Frontend API client (`apiClient.ts`) for token injection
  - Backend main app (`main.py`) for middleware registration
  - Database RLS policies in `complete_setup.sql`
  - React Router in `App.tsx` for protected routes
- Existing patterns to follow:
  - Vertical slice architecture in `/features`
  - TanStack Query for data fetching and cache management
  - Service layer pattern (services → API routes → database)
  - Tron-inspired glassmorphism UI design system
- Critical compatibility requirements:
  - Feature flag to enable/disable auth (environment variable)
  - Nullable `user_id` columns for backward compatibility
  - Service-key bypass for system operations
  - No breaking changes to existing API contracts
- Each story must include verification that existing functionality remains intact

The epic should maintain system integrity while delivering secure multi-user authentication with user data isolation."

---

## Success Metrics

**User Experience:**
- Login flow completes in <2 seconds
- Zero authentication-related errors in first week post-launch
- 100% of existing features accessible to authenticated users

**Technical Health:**
- JWT validation adds <50ms latency to requests
- Zero RLS policy violations in production
- 100% test coverage on auth-critical paths

**Business Value:**
- Enables optional multi-tenant deployment model
- Maintains local-first deployment compatibility
- Foundation for future features requiring user identity (sharing, collaboration)
