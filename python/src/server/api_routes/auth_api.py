"""
Authentication API endpoints.

Provides endpoints for token verification and user information.
Note: Login/signup/logout are handled client-side by Supabase Auth SDK.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class TokenVerifyRequest(BaseModel):
    """Request model for token verification."""

    token: str


class TokenVerifyResponse(BaseModel):
    """Response model for token verification."""

    valid: bool
    user: dict | None = None


class UserResponse(BaseModel):
    """Response model for user information."""

    id: str
    email: str
    user_metadata: dict
    app_metadata: dict


@router.post("/verify", response_model=TokenVerifyResponse)
async def verify_token(request: TokenVerifyRequest):
    """
    Verify a JWT token and return user information.

    This endpoint is public and does not require authentication.
    It's used to validate tokens from the frontend.
    """
    try:
        user = await auth_service.verify_token(request.token)
        return TokenVerifyResponse(valid=True, user=user)
    except HTTPException:
        return TokenVerifyResponse(valid=False, user=None)


@router.get("/user", response_model=UserResponse)
async def get_current_user(request: Request):
    """
    Get information about the currently authenticated user.

    Requires valid JWT token in Authorization header.
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = request.state.user
    return UserResponse(
        id=user["id"],
        email=user["email"],
        user_metadata=user.get("user_metadata", {}),
        app_metadata=user.get("app_metadata", {}),
    )


@router.get("/health")
async def auth_health():
    """Health check endpoint for authentication service."""
    return {"status": "healthy", "service": "auth"}
