# Appendix B: Decision Log

| Decision | Rationale | Date | Author |
|----------|-----------|------|--------|
| Use Supabase Auth over Auth0 | Already using Supabase for database, auth tables exist, zero new dependencies | 2025-10-28 | Winston |
| Nullable user_id columns | Backward compatibility - preserves existing data, allows gradual migration | 2025-10-28 | Winston |
| Feature flag AUTH_ENABLED | Enables instant rollback, maintains local-first deployment option | 2025-10-28 | Winston |
| Service-key bypass | MCP server and agents require system-level access without user context | 2025-10-28 | Winston |
| RS256 JWT algorithm | Supabase default, more secure than HS256 (public/private key pair) | 2025-10-28 | Winston |
| Decorator pattern for auth | Non-invasive, low risk, preserves existing code without modifications | 2025-10-28 | Winston |
| RLS policies with fallback | `auth.uid() IS NULL OR ...` allows access to legacy data and auth-disabled mode | 2025-10-28 | Winston |
| ArgoCD for K8s deployment | Already in use, GitOps workflow, automatic sync from k8s-argocd/ manifests | 2025-10-28 | Winston |

---

**Document Status:** ✅ Complete - Ready for Story Manager and Developer handoff

**Last Updated:** October 28, 2025
**Next Review:** After Story 1 implementation (Frontend Foundation)
