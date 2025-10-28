# Code Review - Archon V2 Beta

**Date**: October 28, 2025
**Reviewer**: Claude (Archon Alpha Review)
**Scope**: Recent commits (MCP health endpoint + Kubernetes support)
**Commits Reviewed**:
- `462d126` - fix(mcp): Implement HTTP /health endpoint using FastMCP's custom_route API
- `c581c8a` - fix(mcp): Add HTTP /health endpoint for frontend health checks
- `4d1cee0` - feat(k8s): Add Kubernetes support to service discovery

**Overall Assessment**: ✅ **PASS** with minor suggestions

---

## Summary

The recent changes successfully implement critical infrastructure improvements:

1. **MCP Health Endpoint**: Fixed implementation using the correct FastMCP API (`@mcp.custom_route()` instead of the non-existent `mcp.create_app()`). This resolves 404 errors from the frontend and enables proper Kubernetes liveness/readiness probes.

2. **Kubernetes Support**: Added environment detection and service discovery for K8s deployments via ConfigMap-based service URLs.

The code quality is good overall with proper error handling and follows the beta development philosophy of "fail fast and loud" where appropriate.

---

## Issues Found

### 🟡 Important (Should Fix)

#### 1. Generic Exception Handling in Service Discovery (service_discovery.py:164)

**Location**: `python/src/server/config/service_discovery.py:164`

```python
except Exception:
    return False
```

**Issue**: Silent exception swallowing in `health_check()` method violates beta error handling principles. When a health check fails, we lose critical diagnostic information.

**Impact**: Makes debugging service connectivity issues extremely difficult.

**Recommendation**:
```python
except httpx.TimeoutError as e:
    logger.debug(f"Health check timeout for {service}: {e}")
    return False
except httpx.ConnectError as e:
    logger.debug(f"Health check connection failed for {service}: {e}")
    return False
except Exception as e:
    logger.warning(f"Unexpected health check error for {service}: {e}", exc_info=True)
    return False
```

#### 2. Missing Type Return Annotation in HTTP Health Endpoint

**Location**: `python/src/mcp_server/mcp_server.py:386`

```python
async def http_health_endpoint(request) -> dict:
```

**Issue**: The return type annotation `-> dict` is incorrect. The function returns `JSONResponse`, not `dict`. Also, the `request` parameter lacks type annotation.

**Recommendation**:
```python
from starlette.requests import Request
from starlette.responses import JSONResponse

async def http_health_endpoint(request: Request) -> JSONResponse:
```

#### 3. Global State Access Pattern

**Location**: `python/src/mcp_server/mcp_server.py:388`

```python
global _shared_context
```

**Issue**: While the global state pattern works, accessing it without thread safety guarantees could be problematic if FastMCP handles requests concurrently.

**Impact**: Potential race conditions when context is being initialized or cleared.

**Recommendation**: Document thread safety guarantees or add a lock:
```python
# Add at module level
_context_lock = threading.RLock()

# In function
with _context_lock:
    if _shared_context and hasattr(_shared_context, "health_status"):
        # ... access context safely
```

---

### 🟢 Suggestions (Consider)

#### 1. Kubernetes Service URL Validation

**Location**: `python/src/server/config/service_discovery.py:113-125`

The K8s implementation correctly raises `ValueError` when service URLs are missing, which follows the fail-fast principle. However, consider adding URL format validation:

```python
if self.environment == Environment.KUBERNETES:
    service_url_map = {
        "api": os.getenv("API_SERVICE_URL"),
        "mcp": os.getenv("MCP_SERVICE_URL"),
        "agents": os.getenv("AGENTS_SERVICE_URL"),
    }
    url = service_url_map.get(service)
    if not url:
        raise ValueError(
            f"Kubernetes mode enabled but {service.upper()}_SERVICE_URL not set. "
            f"Please ensure API_SERVICE_URL, MCP_SERVICE_URL, and AGENTS_SERVICE_URL are configured."
        )

    # Add validation
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(
            f"Invalid service URL for {service}: {url}. "
            f"Expected format: http://service-name:port"
        )
```

#### 2. Health Endpoint Documentation

Add docstring details about the status codes:

```python
@mcp.custom_route("/health", methods=["GET"])
async def http_health_endpoint(request: Request) -> JSONResponse:
    """
    HTTP health endpoint for Kubernetes liveness/readiness probes and frontend monitoring.

    Status Codes:
        200: Service is healthy and all dependencies are available
        503: Service is starting up or degraded (dependencies unavailable)

    Response Format:
        {
            "status": "healthy" | "degraded" | "starting",
            "api_service": bool,
            "agents_service": bool,
            "uptime_seconds": float,
            "timestamp": str (ISO 8601)
        }
    """
```

#### 3. Add Health Check Integration Test

Consider adding an integration test for the health endpoint:

```python
# tests/test_mcp_health.py
async def test_health_endpoint_returns_503_during_startup():
    """Health endpoint should return 503 when server is initializing."""
    # Test before context is ready

async def test_health_endpoint_returns_200_when_healthy():
    """Health endpoint should return 200 when all services are up."""
    # Test with mocked healthy services

async def test_health_endpoint_returns_503_when_degraded():
    """Health endpoint should return 503 when dependencies are down."""
    # Test with mocked unhealthy api_service
```

#### 4. Service Discovery Caching Clarification

**Location**: `python/src/server/config/service_discovery.py:101-103`

The URL caching is good for performance, but add a comment explaining when cache is invalidated:

```python
# Cache service URLs by protocol+service key
# Cache persists for the lifetime of the ServiceDiscovery instance
# (typically one instance per application lifecycle)
cache_key = f"{protocol}://{service}"
if cache_key in self._cache:
    return self._cache[cache_key]
```

---

## What Works Well

### ✅ Excellent Error Messages

The Kubernetes service discovery error message is exemplary:

```python
raise ValueError(
    f"Kubernetes mode enabled but {service.upper()}_SERVICE_URL not set. "
    f"Please ensure API_SERVICE_URL, MCP_SERVICE_URL, and AGENTS_SERVICE_URL are configured."
)
```

This follows the beta principle of **detailed errors over graceful failures**. A developer will immediately know:
- What went wrong
- Which environment variable is missing
- What they need to do to fix it

### ✅ Proper Use of Status Codes

The health endpoint correctly uses HTTP status codes:
- `200` for healthy (K8s will route traffic)
- `503` for starting/degraded (K8s will not route traffic)

This is the correct pattern for liveness/readiness probes.

### ✅ Clean Refactoring

The move from `mcp.create_app()` (which doesn't exist) to `@mcp.custom_route()` shows:
- Proper understanding of the FastMCP API
- Clean removal of unnecessary code (40 lines removed)
- Maintained functionality with better implementation

### ✅ Environment Detection Logic

The environment detection in `_detect_environment()` follows a clear priority:
1. Explicit K8s mode (via env var)
2. Docker detection (file-based)
3. Local fallback

This makes behavior predictable and debuggable.

---

## Security Review

### ✅ No Security Concerns Identified

- No hardcoded credentials or secrets
- No SQL injection vectors (using Supabase client properly)
- No unsafe input handling
- Environment variables used correctly for configuration
- CORS not affected by these changes

### Note on Health Endpoint Exposure

The `/health` endpoint returns service status information, which is appropriate for:
- Kubernetes liveness/readiness probes
- Frontend monitoring
- DevOps dashboards

The information exposed is not sensitive:
- Status indicators (boolean)
- Uptime (public metric)
- Timestamp (public)

No authentication is required for health endpoints, which is standard practice.

---

## Performance Considerations

### ✅ Efficient Caching

Service URL caching in `ServiceDiscovery` prevents repeated environment variable lookups and string formatting on every service call. Good optimization.

### ✅ Minimal Health Check Overhead

The HTTP health endpoint:
- Reads from in-memory `_shared_context` (O(1))
- No database queries
- No network calls
- Returns immediately

This is appropriate for K8s probes that may run every 5-10 seconds.

### Note: Health Check Method Duplication

There are now TWO health check mechanisms:
1. MCP tool: `health_check(ctx: Context) -> str` (JSON string)
2. HTTP endpoint: `http_health_endpoint(request) -> JSONResponse`

**Consideration**: Both serve different purposes and that's fine:
- MCP tool: For AI IDE clients via MCP protocol
- HTTP endpoint: For K8s probes and frontend polling

But consider extracting shared health status logic to avoid duplication:

```python
def _get_health_status_data() -> dict:
    """Get current health status as a dictionary."""
    if _shared_context and hasattr(_shared_context, "health_status"):
        return {
            "status": _shared_context.health_status.get("status", "unknown"),
            "api_service": _shared_context.health_status.get("api_service", False),
            "agents_service": _shared_context.health_status.get("agents_service", False),
            "uptime_seconds": time.time() - _shared_context.startup_time,
            "timestamp": datetime.now().isoformat(),
        }
    return {
        "status": "starting",
        "message": "MCP server is initializing...",
        "timestamp": datetime.now().isoformat(),
    }

# Then both endpoints use it
@mcp.tool()
async def health_check(ctx: Context) -> str:
    return json.dumps(_get_health_status_data(), indent=2)

@mcp.custom_route("/health", methods=["GET"])
async def http_health_endpoint(request: Request) -> JSONResponse:
    data = _get_health_status_data()
    status_code = 200 if data.get("status") == "healthy" else 503
    return JSONResponse(content=data, status_code=status_code)
```

---

## Test Coverage

### Current State

No tests found for the changes in this review. Given that these are infrastructure components, testing is important.

### Recommended Tests

#### For MCP Health Endpoint

```python
# tests/mcp_server/test_health_endpoint.py

import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_endpoint_during_startup():
    """Health endpoint returns 503 when server is initializing."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "starting"

@pytest.mark.asyncio
async def test_health_endpoint_when_healthy(healthy_context):
    """Health endpoint returns 200 when all dependencies are up."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["api_service"] is True
        assert "uptime_seconds" in data
```

#### For Service Discovery

```python
# tests/server/config/test_service_discovery_k8s.py

import os
import pytest
from src.server.config.service_discovery import ServiceDiscovery, Environment

def test_kubernetes_mode_detection(monkeypatch):
    """ServiceDiscovery detects Kubernetes mode from env var."""
    monkeypatch.setenv("SERVICE_DISCOVERY_MODE", "kubernetes")
    discovery = ServiceDiscovery()
    assert discovery.environment == Environment.KUBERNETES
    assert discovery.is_kubernetes is True

def test_kubernetes_missing_service_url_fails_fast(monkeypatch):
    """ServiceDiscovery raises detailed error when K8s URLs are missing."""
    monkeypatch.setenv("SERVICE_DISCOVERY_MODE", "kubernetes")
    monkeypatch.delenv("API_SERVICE_URL", raising=False)

    discovery = ServiceDiscovery()
    with pytest.raises(ValueError, match="API_SERVICE_URL not set"):
        discovery.get_service_url("api")

def test_kubernetes_uses_configmap_urls(monkeypatch):
    """ServiceDiscovery uses ConfigMap URLs in K8s mode."""
    monkeypatch.setenv("SERVICE_DISCOVERY_MODE", "kubernetes")
    monkeypatch.setenv("API_SERVICE_URL", "http://archon-api.archon.svc:8181")

    discovery = ServiceDiscovery()
    url = discovery.get_service_url("api")
    assert url == "http://archon-api.archon.svc:8181"
```

---

## Adherence to Beta Principles

### ✅ Following CLAUDE.md Guidelines

The changes demonstrate good adherence to beta development principles:

#### Fail Fast and Loud ✅

```python
# Good example from service_discovery.py:122-125
if not url:
    raise ValueError(
        f"Kubernetes mode enabled but {service.upper()}_SERVICE_URL not set. "
        f"Please ensure API_SERVICE_URL, MCP_SERVICE_URL, and AGENTS_SERVICE_URL are configured."
    )
```

**Why this is good**: When K8s mode is enabled but URLs are missing, the service CRASHES immediately with a clear error message. This is exactly what we want - no silent degradation.

#### No Backward Compatibility ✅

The refactoring removed the incorrect `mcp.create_app()` implementation entirely without maintaining any backward compatibility layer. Clean fix-forward approach.

#### Detailed Logging ✅

```python
logger.info(f"✓ HTTP /health endpoint will be registered via @mcp.custom_route")
```

Clear, informative logging that helps understand system behavior.

### ⚠️ One Violation: Silent Health Check Failure

**Location**: `service_discovery.py:164`

```python
except Exception:
    return False
```

This violates the "fail fast and loud" principle. In beta, we want to know WHY health checks are failing, not just that they failed.

**Should be**:
```python
except Exception as e:
    logger.error(f"Health check failed for {service}: {e}", exc_info=True)
    return False
```

---

## Recommendations

### Priority 1 (Do First)

1. **Fix generic exception handling in `service_discovery.py:164`**
   - Add specific exception types (TimeoutError, ConnectError)
   - Log the actual error with `exc_info=True`
   - Keep the `return False` behavior but make failures visible

2. **Add type annotations to `http_health_endpoint`**
   - Import `Request` and `JSONResponse` from starlette
   - Update function signature for proper type checking

3. **Extract health status logic to avoid duplication**
   - Create `_get_health_status_data()` helper function
   - Use in both MCP tool and HTTP endpoint

### Priority 2 (Nice to Have)

4. **Add integration tests for health endpoints**
   - Test startup state (503)
   - Test healthy state (200)
   - Test degraded state (503)

5. **Add K8s service discovery tests**
   - Test environment detection
   - Test ConfigMap URL usage
   - Test error messages for missing URLs

6. **Document thread safety guarantees**
   - Add comment about `_shared_context` access pattern
   - Consider adding a lock if concurrent access is possible

---

## Code Quality Metrics

- **Lines Changed**: ~120 lines (net: -8 lines)
- **Files Modified**: 2 files
- **Test Coverage**: No tests added (recommendation: add tests)
- **Documentation**: Adequate inline comments, could improve docstrings
- **Type Safety**: Mostly good, needs improvement in HTTP endpoint
- **Error Handling**: Good overall, one issue in service discovery

---

## Conclusion

The recent changes represent solid infrastructure improvements that are critical for production Kubernetes deployments. The implementation is clean, follows most beta principles, and resolves actual bugs (404 errors on health checks).

**Action Items**:
1. Fix the silent exception swallowing in `health_check()` method
2. Add proper type annotations to `http_health_endpoint`
3. Add integration tests for the new functionality

After addressing the "Important" issues, this code will be production-ready for Kubernetes deployments.

---

**Signed off**: Claude (Archon Alpha Review)
**Next Review**: Before merging to production branch
