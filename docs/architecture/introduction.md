# 1. Introduction

Este documento define a arquitetura para adicionar **Sistema de Autenticação de Usuários** ao Archon V2 Beta, uma plataforma de gerenciamento de conhecimento com capacidades de IA. Esta melhoria transforma o Archon de um sistema local sem autenticação para uma aplicação multi-usuário segura, mantendo compatibilidade com o modelo de deployment local-first.

**Relationship to Existing Architecture:**
Este documento complementa a arquitetura atual do Archon (documentada em `PRPs/ai_docs/ARCHITECTURE.md`) definindo como os novos componentes de autenticação serão integrados. Em casos de conflito entre padrões novos e existentes, este documento fornece orientação para manter consistência durante a implementação.

## 1.1 Existing Project Analysis

### Current Project State

Baseado na análise profunda do código-fonte, documentação e configurações:

- **Primary Purpose:** Plataforma de gerenciamento de conhecimento com RAG (Retrieval-Augmented Generation), crawling web, e integração MCP para IDEs de IA
- **Current Tech Stack:**
  - **Frontend:** React 18.3, TypeScript 5.5, TanStack Query v5, Tailwind CSS, Vite 5.4
  - **Backend:** Python 3.12, FastAPI 0.115, Supabase Client (PostgreSQL + pgvector)
  - **Infrastructure:** Docker Compose (com suporte recente a Kubernetes via ArgoCD)
  - **AI/ML:** PydanticAI, OpenAI Embeddings, FastMCP (Model Context Protocol)
- **Architecture Style:**
  - Frontend: Vertical slice architecture com feature folders
  - Backend: Service-oriented architecture com thin API routes
  - Data Fetching: TanStack Query com smart polling (visibility-aware)
- **Deployment Method:**
  - Primary: Docker Compose (3 serviços: archon-server:8181, archon-mcp:8051, archon-ui:3737)
  - New: Kubernetes manifests em `k8s-argocd/` para deployment via ArgoCD

### Available Documentation

Documentos existentes consultados durante a análise:

- **`CLAUDE.md`** - Beta development guidelines (fail-fast philosophy, error handling, code quality standards)
- **`code-review.md`** - Code review recente (MCP health endpoint, Kubernetes support)
- **`PRPs/ai_docs/ARCHITECTURE.md`** - Visão geral da arquitetura atual (componentes, módulos, API structure)
- **`PRPs/ai_docs/DATA_FETCHING_ARCHITECTURE.md`** - TanStack Query patterns, query key factories, smart polling
- **`PRPs/ai_docs/QUERY_PATTERNS.md`** - Padrões de query hooks, stale times, optimistic updates
- **`PRPs/ai_docs/ETAG_IMPLEMENTATION.md`** - ETag caching (~70% bandwidth reduction)
- **`PRPs/ai_docs/API_NAMING_CONVENTIONS.md`** - RESTful patterns, service methods, type naming
- **`docs/prd/epic-1-frontend-authentication.md`** - Epic de autenticação com stories e acceptance criteria
- **`docker-compose.yml`** - Service configuration e environment variables
- **`.env.example`** - Required environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY)

### Identified Constraints

Limitações e requisitos críticos identificados na análise:

- **Beta Development Constraint:** Sistema segue princípio "fail fast and loud" - erros devem ser detalhados, não silenciosos
- **Local-First Model:** Deployment local deve permanecer funcional (auth deve ser opcional via feature flag)
- **Backward Compatibility:** Schema changes devem ser backward compatible (user_id nullable, service-key bypass)
- **Zero Breaking Changes:** APIs existentes não podem ser quebradas - apenas adicionar camada de auth
- **Performance Budget:** JWT validation deve adicionar <50ms de latency
- **RLS Already Enabled:** Row Level Security já habilitada no Supabase, precisa apenas de policies atualizadas
- **CORS Configuration:** Atualmente `allow_origins=["*"]` - precisa ser ajustado com auth
- **Service Discovery:** Sistema já suporta múltiplos ambientes (Docker Compose, Kubernetes) via `SERVICE_DISCOVERY_MODE`
- **Kubernetes Readiness:** Recentemente adicionado suporte K8s, health checks via HTTP `/health` endpoint

---
