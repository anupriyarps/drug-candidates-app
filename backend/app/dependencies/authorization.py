from fastapi import Depends, HTTPException, status

from app.dependencies.authentication import get_current_user
from app.models.user import User


async def require_viewer(
    user: User = Depends(get_current_user),
) -> User:
    if not {"viewer", "admin"} & {role.name for role in user.roles}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions.",
        )
    return user


async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    if "admin" not in {role.name for role in user.roles}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required.",
        )
    return user
