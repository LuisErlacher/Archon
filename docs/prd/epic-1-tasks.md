# Epic #1: Frontend Authentication System - Task Breakdown

## Project Overview
- **Epic:** Frontend Authentication System
- **Epic ID:** epic-1
- **Status:** Planning
- **Priority:** High
- **Start Date:** 2025-10-28

---

## Story 1: Frontend Authentication Foundation

### Task 1.1: Setup Supabase Auth Client
**Status:** todo
**Assignee:** User
**Estimated Time:** 2 hours
**Priority:** 90

**Description:**
Install and configure `@supabase/supabase-js` package in the frontend application. Create a Supabase client instance configured for authentication.

**Acceptance Criteria:**
- [ ] Package installed: `npm install @supabase/supabase-js`
- [ ] Environment variables added: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Supabase client initialized in `archon-ui-main/src/lib/supabase.ts`
- [ ] Client exports authentication methods
- [ ] Type definitions for Supabase auth responses

**Files to Create/Modify:**
- Create: `archon-ui-main/src/lib/supabase.ts`
- Modify: `archon-ui-main/.env.example`
- Modify: `archon-ui-main/package.json`

---

### Task 1.2: Create Auth Context and Provider
**Status:** todo
**Assignee:** User
**Estimated Time:** 3 hours
**Priority:** 85

**Description:**
Implement React Context for authentication state management. Create AuthProvider component to wrap the application and provide auth state globally.

**Acceptance Criteria:**
- [ ] AuthContext created with user, session, loading states
- [ ] AuthProvider component implements session lifecycle
- [ ] Context handles Supabase auth state changes
- [ ] Session persistence on page reload
- [ ] TypeScript types for auth context value

**Files to Create/Modify:**
- Create: `archon-ui-main/src/features/auth/context/AuthContext.tsx`
- Create: `archon-ui-main/src/features/auth/context/AuthProvider.tsx`
- Create: `archon-ui-main/src/features/auth/types/index.ts`

---

### Task 1.3: Implement Custom Auth Hooks
**Status:** todo
**Assignee:** User
**Estimated Time:** 2 hours
**Priority:** 80

**Description:**
Create custom React hooks for accessing authentication state and performing auth operations throughout the application.

**Acceptance Criteria:**
- [ ] `useAuth()` hook returns auth context
- [ ] `useSession()` hook returns current session
- [ ] `useUser()` hook returns current user
- [ ] Hooks throw error if used outside AuthProvider
- [ ] TypeScript types for hook return values

**Files to Create/Modify:**
- Create: `archon-ui-main/src/features/auth/hooks/useAuth.ts`
- Create: `archon-ui-main/src/features/auth/hooks/useSession.ts`
- Create: `archon-ui-main/src/features/auth/hooks/useUser.ts`

---

### Task 1.4: Integrate Auth Tokens with API Client
**Status:** todo
**Assignee:** User
**Estimated Time:** 2 hours
**Priority:** 85

**Description:**
Modify the existing API client to automatically inject authentication tokens in request headers. Implement token refresh logic.

**Acceptance Criteria:**
- [ ] API client reads session token from auth context
- [ ] Authorization header added to all authenticated requests
- [ ] 401 responses trigger session refresh attempt
- [ ] Token refresh happens automatically before expiration
- [ ] Unauthenticated requests don't break (optional auth)

**Files to Create/Modify:**
- Modify: `archon-ui-main/src/features/shared/api/apiClient.ts`
- Create: `archon-ui-main/src/features/auth/utils/tokenRefresh.ts`

---

### Task 1.5: Create Auth Service Layer
**Status:** todo
**Assignee:** User
**Estimated Time:** 3 hours
**Priority:** 75

**Description:**
Implement service layer for authentication operations (login, signup, logout, password reset) following the project's service pattern.

**Acceptance Criteria:**
- [ ] `authService.signUp()` method implemented
- [ ] `authService.signIn()` method implemented
- [ ] `authService.signOut()` method implemented
- [ ] `authService.resetPassword()` method implemented
- [ ] `authService.updatePassword()` method implemented
- [ ] All methods return typed responses
- [ ] Error handling with user-friendly messages

**Files to Create/Modify:**
- Create: `archon-ui-main/src/features/auth/services/authService.ts`

---

## Story 2: Login/Signup UI Components

### Task 2.1: Create Login Page Component
**Status:** todo
**Assignee:** User
**Estimated Time:** 4 hours
**Priority:** 80

**Description:**
Build the login page with email/password form following Tron glassmorphism design system. Include form validation and error handling.

**Acceptance Criteria:**
- [ ] Login form with email and password fields
- [ ] Form validation (email format, password length)
- [ ] Submit button with loading state
- [ ] Error messages display below fields
- [ ] "Forgot password?" link
- [ ] "Sign up" link to registration page
- [ ] Follows Tron glassmorphism design system
- [ ] Mobile responsive layout

**Files to Create/Modify:**
- Create: `archon-ui-main/src/features/auth/components/LoginForm.tsx`
- Create: `archon-ui-main/src/pages/LoginPage.tsx`
- Create: `archon-ui-main/src/features/auth/components/AuthLayout.tsx`

---

### Task 2.2: Create Signup Page Component
**Status:** todo
**Assignee:** User
**Estimated Time:** 4 hours
**Priority:** 75

**Description:**
Build the signup page with registration form. Include email verification flow and password strength requirements.

**Acceptance Criteria:**
- [ ] Signup form with email, password, confirm password fields
- [ ] Password strength indicator
- [ ] Email format validation
- [ ] Password match validation
- [ ] Terms of service checkbox
- [ ] Submit button with loading state
- [ ] Success message after registration
- [ ] "Already have an account?" link to login

**Files to Create/Modify:**
- Create: `archon-ui-main/src/features/auth/components/SignupForm.tsx`
- Create: `archon-ui-main/src/pages/SignupPage.tsx`
- Create: `archon-ui-main/src/features/auth/components/PasswordStrength.tsx`

---

### Task 2.3: Implement Password Reset Flow
**Status:** todo
**Assignee:** User
**Estimated Time:** 3 hours
**Priority:** 60

**Description:**
Create password reset request and confirmation pages. Integrate with Supabase password reset email flow.

**Acceptance Criteria:**
- [ ] Forgot password page with email input
- [ ] Reset password page with new password form
- [ ] Email sent confirmation message
- [ ] Link expiration handling
- [ ] Success confirmation after password update
- [ ] Redirect to login after successful reset

**Files to Create/Modify:**
- Create: `archon-ui-main/src/pages/ForgotPasswordPage.tsx`
- Create: `archon-ui-main/src/pages/ResetPasswordPage.tsx`
- Create: `archon-ui-main/src/features/auth/components/ForgotPasswordForm.tsx`

---

### Task 2.4: Create Protected Route Wrapper
**Status:** todo
**Assignee:** User
**Estimated Time:** 2 hours
**Priority:** 90

**Description:**
Implement a ProtectedRoute component that wraps authenticated routes and redirects unauthenticated users to login.

**Acceptance Criteria:**
- [ ] ProtectedRoute component checks auth state
- [ ] Redirects to login if not authenticated
- [ ] Shows loading state during auth check
- [ ] Preserves intended destination (return URL)
- [ ] Works with React Router v6

**Files to Create/Modify:**
- Create: `archon-ui-main/src/features/auth/components/ProtectedRoute.tsx`
- Modify: `archon-ui-main/src/App.tsx`

---

### Task 2.5: Add Auth Routes to React Router
**Status:** todo
**Assignee:** User
**Estimated Time:** 1 hour
**Priority:** 85

**Description:**
Register authentication routes in the main App router configuration and protect existing routes.

**Acceptance Criteria:**
- [ ] `/login` route added
- [ ] `/signup` route added
- [ ] `/forgot-password` route added
- [ ] `/reset-password` route added
- [ ] Existing routes wrapped with ProtectedRoute
- [ ] Redirect authenticated users from login to home

**Files to Create/Modify:**
- Modify: `archon-ui-main/src/App.tsx`

---

### Task 2.6: Implement Logout Functionality
**Status:** todo
**Assignee:** User
**Estimated Time:** 1 hour
**Priority:** 70

**Description:**
Add logout button/menu item and implement logout logic with session cleanup.

**Acceptance Criteria:**
- [ ] Logout button added to navigation/settings
- [ ] Logout clears Supabase session
- [ ] Auth context state cleared
- [ ] Redirect to login page after logout
- [ ] Confirmation modal (optional)

**Files to Create/Modify:**
- Modify: `archon-ui-main/src/components/layout/MainLayout.tsx`
- Create: `archon-ui-main/src/features/auth/components/LogoutButton.tsx`

---

## Story 3: Backend Authentication & RLS Integration

### Task 3.1: Create JWT Authentication Middleware
**Status:** todo
**Assignee:** User
**Estimated Time:** 4 hours
**Priority:** 90

**Description:**
Implement FastAPI middleware to validate Supabase JWT tokens and extract user information.

**Acceptance Criteria:**
- [ ] Middleware validates JWT signature using Supabase public key
- [ ] User ID extracted from token and added to request state
- [ ] Invalid tokens return 401 Unauthorized
- [ ] Expired tokens trigger clear error message
- [ ] Public endpoints bypass authentication
- [ ] Service-key requests bypass JWT validation

**Files to Create/Modify:**
- Create: `python/src/server/middleware/auth_middleware.py`
- Modify: `python/src/server/main.py`

---

### Task 3.2: Create Protected Endpoint Decorator
**Status:** todo
**Assignee:** User
**Estimated Time:** 2 hours
**Priority:** 85

**Description:**
Create a reusable decorator/dependency for FastAPI routes that require authentication.

**Acceptance Criteria:**
- [ ] `@requires_auth` decorator or dependency function
- [ ] Returns 401 if user not authenticated
- [ ] Injects current user into route handler
- [ ] Works with FastAPI dependency injection
- [ ] Clear error messages for auth failures

**Files to Create/Modify:**
- Create: `python/src/server/utils/auth_dependencies.py`

---

### Task 3.3: Add user_id Columns to Database Tables
**Status:** todo
**Assignee:** User
**Estimated Time:** 2 hours
**Priority:** 90

**Description:**
Create database migration to add user_id columns to relevant tables. Ensure backward compatibility with nullable columns.

**Acceptance Criteria:**
- [ ] `user_id UUID` column added to `archon_projects`
- [ ] `user_id UUID` column added to `archon_tasks`
- [ ] `user_id UUID` column added to `archon_sources`
- [ ] `user_id UUID` column added to `archon_code_examples`
- [ ] All columns are nullable (backward compatible)
- [ ] Migration includes rollback script
- [ ] No data loss on migration

**Files to Create/Modify:**
- Create: `migration/0.2.0/001_add_user_id_columns.sql`

---

### Task 3.4: Update RLS Policies for User Isolation
**Status:** todo
**Assignee:** User
**Estimated Time:** 3 hours
**Priority:** 90

**Description:**
Update Row Level Security policies to enforce user data isolation using auth.uid().

**Acceptance Criteria:**
- [ ] RLS policies check `auth.uid() = user_id`
- [ ] Users can only see their own projects
- [ ] Users can only see their own tasks
- [ ] Users can only see their own sources
- [ ] Service role can access all data (admin)
- [ ] Public access removed for authenticated endpoints
- [ ] Policies tested with multiple users

**Files to Create/Modify:**
- Create: `migration/0.2.0/002_update_rls_policies.sql`

---

### Task 3.5: Add Authentication to Existing Endpoints
**Status:** todo
**Assignee:** User
**Estimated Time:** 4 hours
**Priority:** 80

**Description:**
Update existing API endpoints to require authentication and set user_id on data creation.

**Acceptance Criteria:**
- [ ] Projects endpoints require auth
- [ ] Tasks endpoints require auth
- [ ] Knowledge endpoints require auth
- [ ] Settings endpoints require auth
- [ ] Health check remains public
- [ ] MCP endpoints use service-key bypass
- [ ] user_id automatically set on POST/PUT operations

**Files to Create/Modify:**
- Modify: `python/src/server/api_routes/projects_api.py`
- Modify: `python/src/server/api_routes/knowledge_api.py`
- Modify: `python/src/server/api_routes/settings_api.py`

---

### Task 3.6: Implement Feature Flag for Auth Toggle
**Status:** todo
**Assignee:** User
**Estimated Time:** 2 hours
**Priority:** 70

**Description:**
Add environment variable and configuration to enable/disable authentication for local development.

**Acceptance Criteria:**
- [ ] `AUTH_ENABLED` environment variable
- [ ] Defaults to `false` (backward compatible)
- [ ] Auth middleware checks flag before validating
- [ ] Settings page shows auth status
- [ ] Documentation updated with flag usage

**Files to Create/Modify:**
- Modify: `python/src/server/config/config.py`
- Modify: `.env.example`
- Modify: `python/src/server/middleware/auth_middleware.py`

---

## Summary Statistics

**Total Tasks:** 21
**Total Estimated Time:** 52 hours
**By Status:**
- Todo: 21
- In Progress: 0
- Review: 0
- Done: 0

**By Priority:**
- High (80-100): 14 tasks
- Medium (60-79): 6 tasks
- Low (0-59): 1 task

**By Story:**
- Story 1 (Foundation): 5 tasks, 12 hours
- Story 2 (UI Components): 6 tasks, 15 hours
- Story 3 (Backend & RLS): 6 tasks, 17 hours

---

## Import Instructions for Archon MCP

To import these tasks into the Archon project management system, use the following MCP commands:

```bash
# Create project
manage_project("create",
  title="Frontend Authentication System",
  description="Epic #1: Implement complete user authentication using Supabase Auth")

# Create tasks for Story 1
manage_task("create", project_id="<project-id>",
  title="Setup Supabase Auth Client",
  description="Install and configure @supabase/supabase-js...",
  status="todo",
  assignee="User",
  task_order=90,
  feature="Auth Foundation")

# ... repeat for all 21 tasks
```

Or use the Archon UI to manually create the project and import tasks from this document.
