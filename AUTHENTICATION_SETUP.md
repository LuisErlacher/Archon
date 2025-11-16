# Authentication Setup Guide

This guide explains how to set up and use Supabase authentication in Archon.

## Overview

Archon now supports user authentication using Supabase Auth. This allows you to:
- Create user accounts
- Secure your data with user-specific access
- Protect routes and API endpoints
- Manage sessions and tokens

## Prerequisites

1. A Supabase project (create one at [supabase.com](https://supabase.com))
2. Node.js and Python environment set up

## Step 1: Verify Environment Variables

The authentication system uses the Supabase configuration already present in your root `.env` file:

```bash
# Supabase Configuration (Backend)
SUPABASE_URL=https://supabase.automatizase.com.br
SUPABASE_SERVICE_KEY=eyJhbGc...  # Your service role key
SUPABASE_ANON_KEY=eyJhbGc...     # Your anon/public key

# Frontend Supabase Configuration (automatically configured)
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
```

**Important Notes:**
- The frontend uses `VITE_SUPABASE_ANON_KEY` (safe for client-side)
- The backend uses `SUPABASE_SERVICE_KEY` (server-side only)
- These variables are automatically loaded from the root `.env` file
- The Vite config has been updated to read from the root directory

## Step 2: Install Frontend Dependencies

```bash
cd archon-ui-main
npm install
```

This will install the `@supabase/supabase-js` package required for authentication.

## Step 3: Enable Email Authentication in Supabase

1. Go to **Authentication** > **Providers** in your Supabase Dashboard
2. Enable **Email** provider
3. Configure email templates if desired
4. Add allowed redirect URLs:
   - Development: `http://localhost:3737/*`
   - Production: Your production URL

## Step 4: Enable Authentication Middleware (Optional)

By default, the authentication middleware is **disabled** to avoid breaking existing installations. To enable it:

1. Open `python/src/server/main.py`
2. Find the section labeled "Authentication Middleware (OPTIONAL)"
3. Uncomment the two lines:
   ```python
   from .middleware.auth_middleware import AuthMiddleware
   app.add_middleware(AuthMiddleware)
   ```

When enabled, all API routes will require authentication except:
- `/health` - Health check
- `/docs`, `/redoc`, `/openapi.json` - API documentation
- `/api/auth/*` - Authentication endpoints

## Step 5: Start the Application

```bash
# Frontend
cd archon-ui-main
npm run dev

# Backend
cd python
uv run python -m src.server.main
```

## Step 6: Create Your First User

1. Navigate to `http://localhost:3737/signup`
2. Enter your email and password
3. You'll be automatically logged in and redirected to the dashboard

## Features

### Frontend Features

- **Login Page** (`/login`) - Sign in with email/password
- **Sign Up Page** (`/signup`) - Create a new account
- **Protected Routes** - All main routes require authentication
- **AuthContext** - Global authentication state management
- **Persistent Sessions** - Sessions saved in localStorage

### Backend Features

- **JWT Token Validation** - Verify Supabase JWT tokens
- **Auth Middleware** - Protect API routes automatically
- **User Context** - Access current user in request handlers
- **Auth Service** - Reusable authentication utilities

## Usage in Components

### Using Auth Context

```typescript
import { useAuth } from '@/features/auth/context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not logged in</div>;

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Using TanStack Query Hooks

```typescript
import { useLoginMutation, useLogoutMutation } from '@/features/auth/hooks/useAuthQueries';

function LoginForm() {
  const loginMutation = useLoginMutation();

  const handleLogin = async (email: string, password: string) => {
    try {
      await loginMutation.mutateAsync({ email, password });
      // Redirect or show success
    } catch (error) {
      // Handle error
    }
  };

  // ...
}
```

## Backend API Usage

### Access Current User in Routes

```python
from fastapi import Request

@router.get("/api/my-endpoint")
async def my_endpoint(request: Request):
    # User is automatically available if authenticated
    user = request.state.user
    user_id = user["id"]
    user_email = user["email"]

    # Your logic here
    return {"user_id": user_id}
```

### Validate Token Manually

```python
from src.server.services.auth_service import auth_service

async def my_function(token: str):
    user = await auth_service.verify_token(token)
    return user
```

## Row Level Security (RLS)

To secure your database tables, enable RLS policies in Supabase:

### Example: Secure `sources` table

```sql
-- Enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sources
CREATE POLICY "Users can view own sources"
ON sources FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own sources
CREATE POLICY "Users can insert own sources"
ON sources FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sources
CREATE POLICY "Users can update own sources"
ON sources FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own sources
CREATE POLICY "Users can delete own sources"
ON sources FOR DELETE
USING (auth.uid() = user_id);
```

Apply similar policies to:
- `documents`
- `archon_projects`
- `archon_tasks`
- Other user-specific tables

## Troubleshooting

### "Missing Supabase environment variables"

- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in your `.env` file
- Restart the frontend dev server after adding variables

### "Authentication failed" errors

- Check that you're using the correct keys (ANON for frontend, SERVICE_ROLE for backend)
- Verify your Supabase project is active
- Check Supabase logs in the dashboard

### Users getting 401 on API calls

- Ensure auth middleware is enabled if you want to protect routes
- Check that the frontend is sending the Authorization header
- Verify the token is valid in Supabase dashboard

### "Invalid authorization header format"

- Ensure the header format is: `Authorization: Bearer <token>`
- Check that the token is being passed correctly from the frontend

## Security Best Practices

1. **Never commit `.env` files** - They contain sensitive keys
2. **Use HTTPS in production** - Required for secure authentication
3. **Enable RLS** - Protect your database with Row Level Security
4. **Rotate keys regularly** - Update Supabase keys periodically
5. **Monitor authentication logs** - Check Supabase dashboard for suspicious activity
6. **Set strong password requirements** - Configure in Supabase auth settings

## Architecture

```
Frontend (React)
├── AuthProvider (Context)
├── AuthService (Supabase SDK)
├── ProtectedRoute (Route Guard)
└── Login/Signup Pages

Backend (FastAPI)
├── AuthMiddleware (JWT Validation)
├── AuthService (Token Verification)
└── Auth API Routes
    ├── POST /api/auth/verify
    ├── GET /api/auth/user
    └── GET /api/auth/health

Supabase
├── Auth (User Management)
├── Database (PostgreSQL + RLS)
└── JWT Tokens
```

## Next Steps

- Configure email templates in Supabase
- Set up OAuth providers (Google, GitHub, etc.)
- Implement password reset flow
- Add user profile management
- Configure multi-factor authentication (MFA)

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs/guides/auth
- Review Archon's GitHub issues
- Check the CLAUDE.md file for development guidelines
