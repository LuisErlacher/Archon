# 7. Source Tree

## 7.1 Existing Project Structure

```
archon-ui-main/src/
├── features/
│   ├── knowledge/          # Existing - Knowledge management
│   ├── projects/           # Existing - Project/task management
│   ├── mcp/                # Existing - MCP integration
│   ├── progress/           # Existing - Progress tracking
│   ├── shared/             # Existing - Shared utilities
│   └── ui/                 # Existing - UI components
├── pages/                  # Existing - Route pages
└── App.tsx                 # Existing - Main app entry

python/src/server/
├── api_routes/             # Existing - API endpoints
├── services/               # Existing - Business logic
├── middleware/             # Existing - CORS, logging
├── config/                 # Existing - Configuration
└── utils/                  # Existing - Utilities
```

## 7.2 New File Organization

```
archon-ui-main/src/
├── features/
│   ├── knowledge/          # Existing folder
│   ├── projects/           # Existing folder
│   ├── auth/               # ← NEW: Auth feature slice
│   │   ├── components/     # Login, Signup, ProtectedRoute
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SignupPage.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── PasswordResetForm.tsx
│   │   ├── hooks/          # Auth-specific hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useSession.ts
│   │   │   └── useAuthQueries.ts  # TanStack Query keys
│   │   ├── services/       # Auth service layer
│   │   │   ├── authService.ts     # Supabase Auth wrapper
│   │   │   └── authApi.ts         # Backend API calls
│   │   ├── context/        # Auth context provider
│   │   │   ├── AuthContext.tsx
│   │   │   └── AuthProvider.tsx
│   │   └── types/          # Auth TypeScript types
│   │       └── index.ts
│   ├── shared/             # Existing folder
│   │   ├── api/
│   │   │   └── apiClient.ts       # MODIFIED: Add token interceptor
│   │   └── hooks/          # Existing hooks
│   └── ui/                 # Existing folder
├── pages/
│   ├── KnowledgePage.tsx   # Existing page
│   ├── ProjectsPage.tsx    # Existing page
│   └── AuthPages.tsx       # ← NEW: Auth routes (/login, /signup)
└── App.tsx                 # MODIFIED: Wrap with AuthProvider

python/src/server/
├── api_routes/
│   ├── knowledge_api.py    # Existing file
│   ├── projects_api.py     # Existing file
│   └── auth_api.py         # ← NEW: Auth endpoints
├── services/
│   ├── knowledge/          # Existing folder
│   ├── projects/           # Existing folder
│   └── auth/               # ← NEW: Auth services
│       ├── jwt_service.py       # JWT validation
│       ├── auth_service.py      # Auth business logic
│       └── user_service.py      # User data operations
├── middleware/
│   ├── cors.py             # Existing file
│   ├── logging.py          # Existing file
│   └── auth_middleware.py  # ← NEW: JWT validation middleware
└── utils/
    └── jwt_utils.py        # ← NEW: JWT helper functions

k8s-argocd/                 # Existing folder
├── base/                   # Existing manifests
└── overlays/
    └── production/
        ├── secrets.yaml    # ← NEW: Auth secrets (JWT_SECRET)
        └── configmap.yaml  # MODIFIED: Add AUTH_ENABLED flag
```

## 7.3 Integration Guidelines

**File Naming:**
- Auth components: `{Purpose}Page.tsx` ou `{Purpose}Form.tsx` (segue padrão existente)
- Auth services: `{domain}Service.ts` (segue padrão service layer)
- Auth middleware: `auth_middleware.py` (segue snake_case Python)

**Folder Organization:**
- Auth feature em `features/auth/` (vertical slice como outras features)
- Auth services backend em `services/auth/` (separado por domínio)
- K8s manifests auth em `k8s-argocd/overlays/` (environment-specific)

**Import/Export Patterns:**
```typescript
// Frontend barrel exports (seguindo padrão existente)
// features/auth/index.ts
export { AuthProvider } from './context/AuthProvider';
export { useAuth } from './hooks/useAuth';
export { ProtectedRoute } from './components/ProtectedRoute';
export * from './types';

// Backend imports (seguindo padrão existente)
# python/src/server/services/auth/__init__.py
from .jwt_service import validate_jwt_token
from .auth_service import authenticate_user
from .user_service import get_user_by_id

__all__ = ['validate_jwt_token', 'authenticate_user', 'get_user_by_id']
```

---
