from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from typing import Any
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(subject: UUID, roles: set[str]) -> str:
    settings = get_settings()
    if not settings.jwt_secret_key:
        raise RuntimeError("JWT_SECRET_KEY is not configured.")

    expires = datetime.now(UTC) + timedelta(
        seconds=settings.jwt_access_lifetime_seconds
    )
    return jwt.encode(
        {
            "sub": str(subject),
            "roles": sorted(roles),
            "exp": expires,
            "iat": datetime.now(UTC),
            "type": "access",
        },
        settings.jwt_secret_key,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.jwt_secret_key:
        raise RuntimeError("JWT_SECRET_KEY is not configured.")

    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=["HS256"],
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Invalid token type.")
    return payload


def create_refresh_token() -> tuple[str, str]:
    token = token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()
