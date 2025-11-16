"""
Authentication middleware for protecting API routes.
"""

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..services.auth_service import auth_service


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate JWT tokens on protected routes.

    Public routes that do NOT require authentication:
    - /api/auth/* (authentication endpoints)
    - /health (health check)
    - /docs, /redoc, /openapi.json (API documentation)
    """

    PUBLIC_PATHS = {
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    PUBLIC_PREFIXES = [
        "/api/auth/",
    ]

    async def dispatch(self, request: Request, call_next):
        """Process request and validate authentication if required."""
        path = request.url.path

        if path in self.PUBLIC_PATHS or any(path.startswith(prefix) for prefix in self.PUBLIC_PREFIXES):
            return await call_next(request)

        try:
            user = await auth_service.require_auth(request)
            request.state.user = user
        except HTTPException as e:
            return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
        except Exception as e:
            return JSONResponse(status_code=500, content={"detail": f"Authentication error: {str(e)}"})

        return await call_next(request)
