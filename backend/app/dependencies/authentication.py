from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyCookie
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.auth_repository import AuthRepository

access_token_cookie = APIKeyCookie(
    name="access_token",
    scheme_name="AccessTokenCookie",
    auto_error=False,
)


async def get_current_user(
    access_token: str | None = Security(access_token_cookie),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    try:
        payload = decode_access_token(access_token)
        user_id = UUID(str(payload["sub"]))
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from None

    user = await AuthRepository(session).get_user_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is unavailable.",
        )
    return user
