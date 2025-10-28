# 3. Tech Stack

## 3.1 Existing Technology Stack

Todas as tecnologias abaixo serão **mantidas** e **não modificadas**. A feature de autenticação integra com o stack existente.

| Category | Current Technology | Version | Usage in Enhancement | Notes |
|----------|-------------------|---------|----------------------|-------|
| **Frontend Framework** | React | 18.3.1 | Auth UI components, context providers | Mantido - componentes auth seguem padrões React existentes |
| **Frontend Language** | TypeScript | 5.5.3 | Type-safe auth interfaces e hooks | Mantido - auth types adicionados sem modificar tipos existentes |
| **Frontend Build Tool** | Vite | 5.4.2 | Build auth components com resto da aplicação | Mantido - sem mudanças em vite.config.ts |
| **Frontend Styling** | Tailwind CSS | 3.4.10 | Estilização de Login/Signup UI | Mantido - auth UI usa classes existentes do design system |
| **State Management** | TanStack Query | v5.56.2 | Auth state management (session, user queries) | Mantido - auth usa mesmo padrão de query keys |
| **Frontend Router** | React Router | 6.26.1 | Protected routes, auth redirects | Mantido - adiciona rotas /login e /signup |
| **UI Components** | Radix UI | Various | Auth form primitives (Input, Button, Dialog) | Mantido - auth reutiliza componentes existentes |
| **Backend Framework** | FastAPI | 0.115.0 | JWT validation middleware, auth endpoints | Mantido - adiciona middleware sem modificar app core |
| **Backend Language** | Python | 3.12+ | Auth service layer, JWT utilities | Mantido - auth segue padrões Python existentes |
| **Database** | Supabase (PostgreSQL) | Latest | User auth storage, RLS policies | Mantido - adiciona tabelas auth via Supabase Auth |
| **Vector Database** | pgvector | Latest | Não afetado pela feature auth | Mantido - embeddings continuam funcionando igual |
| **AI/ML** | PydanticAI | Latest | Não afetado pela feature auth | Mantido - agents continuam funcionando igual |
| **MCP Server** | FastMCP | 1.12.2 | Service-key bypass de auth | Mantido - MCP tools não precisam de JWT |
| **Container Runtime** | Docker | Latest | Auth services rodando em containers | Mantido - mesmo docker-compose.yml com env vars adicionais |
| **Orchestration** | Kubernetes | 1.28+ | Auth secrets via ConfigMaps/Secrets | Mantido - manifestos K8s adicionados em k8s-argocd/ |
| **CD Tool** | ArgoCD | Latest | Deploy auth feature via GitOps | Mantido - ArgoCD aplica manifestos K8s |
| **Testing (Frontend)** | Vitest | Latest | Auth component tests | Mantido - testes auth seguem mesmo padrão |
| **Testing (Backend)** | pytest | Latest | Auth middleware e RLS policy tests | Mantido - testes auth usam fixtures existentes |
| **Linting (Frontend)** | ESLint + Biome | Latest | Auth code linting | Mantido - auth code segue mesmas rules |
| **Linting (Backend)** | Ruff + MyPy | Latest | Auth code type checking | Mantido - auth code 100% type-safe |

## 3.2 New Technology Additions

**Only 2 new dependencies** will be added to implement authentication:

| Technology | Version | Purpose | Rationale | Integration Method |
|-----------|---------|---------|-----------|-------------------|
| **@supabase/supabase-js** | ^2.45.4 | Supabase Auth SDK para frontend (login, signup, session management) | Supabase já é nosso database provider. Usar Supabase Auth evita adicionar Auth0, Firebase ou serviço third-party. Auth tables já existem no Supabase project. | `npm install @supabase/supabase-js` em archon-ui-main. Instanciar cliente auth em `features/auth/services/authService.ts` |
| **python-jose[cryptography]** | ^3.3.0 | JWT validation e decoding no backend Python | FastAPI não tem JWT built-in. `python-jose` é a biblioteca recomendada pela FastAPI docs para JWT RS256/HS256. Leve (<1MB), mature, bem mantida. | `uv add python-jose[cryptography]` em python/. Usado em `middleware/auth_middleware.py` |

---
