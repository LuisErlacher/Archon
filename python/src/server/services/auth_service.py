"""
Authentication service for validating JWT tokens and managing user sessions.
"""

from typing import Optional

from fastapi import HTTPException, Request
from supabase import Client

from ..utils import get_supabase_client


class AuthService:
    """Service for handling authentication operations."""

    def __init__(self):
        self.supabase: Client = get_supabase_client()

    async def verify_token(self, token: str) -> dict:
        """
        Verify a JWT token and return the user information.

        Args:
            token: JWT token from Authorization header

        Returns:
            dict: User information from Supabase

        Raises:
            HTTPException: If token is invalid or expired
        """
        try:
            response = self.supabase.auth.get_user(token)

            if not response.user:
                raise HTTPException(status_code=401, detail="Invalid authentication token")

            return {
                "id": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata,
                "app_metadata": response.user.app_metadata,
            }
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """
        Get user information by user ID.

        Args:
            user_id: User ID from Supabase

        Returns:
            dict: User information or None if not found
        """
        try:
            response = self.supabase.auth.admin.get_user_by_id(user_id)
            if not response.user:
                return None

            return {
                "id": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata,
                "app_metadata": response.user.app_metadata,
            }
        except Exception:
            return None

    async def require_auth(self, request: Request) -> dict:
        """
        Extract and verify authentication from request.

        Args:
            request: FastAPI request object

        Returns:
            dict: User information

        Raises:
            HTTPException: If authentication fails
        """
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            raise HTTPException(status_code=401, detail="Missing authorization header")

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        token = parts[1]
        return await self.verify_token(token)


auth_service = AuthService()
