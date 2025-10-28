# Appendix A: Reference Documentation

## Key Files Referenced

**Frontend:**
- `archon-ui-main/src/App.tsx` - Main application entry
- `archon-ui-main/src/features/shared/api/apiClient.ts` - API client with ETag support
- `archon-ui-main/src/features/shared/config/queryClient.ts` - TanStack Query configuration
- `archon-ui-main/src/features/projects/hooks/useProjectQueries.ts` - Query key factory example

**Backend:**
- `python/src/server/main.py` - FastAPI application initialization
- `python/src/server/api_routes/projects_api.py` - API endpoint pattern reference
- `python/src/server/services/project_service.py` - Service layer pattern example
- `python/src/server/config/service_discovery.py` - Multi-environment service discovery

**Infrastructure:**
- `docker-compose.yml` - Docker Compose service configuration
- `.env.example` - Required environment variables
- `k8s-argocd/` - Kubernetes manifests (new)

**Documentation:**
- `CLAUDE.md` - Beta development guidelines
- `PRPs/ai_docs/ARCHITECTURE.md` - Current architecture overview
- `PRPs/ai_docs/DATA_FETCHING_ARCHITECTURE.md` - TanStack Query patterns
- `docs/prd/epic-1-frontend-authentication.md` - Authentication epic PRD

---
