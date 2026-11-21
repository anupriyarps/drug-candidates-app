import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi import HTTPException, Response
from fastapi.testclient import TestClient

import app.main as main
from app.api.v1.auth import (
    get_auth_service,
    set_auth_cookies,
)
from app.api.v1.auth import (
    logout as logout_endpoint,
)
from app.core.config import Settings, get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.dependencies.authorization import require_admin, require_viewer
from app.models.refresh_session import RefreshSession
from app.models.role import Role
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.services.auth_service import AuthenticationError, AuthService


def build_user(role_name: str = "viewer") -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        email=f"{role_name}@example.com",
        password_hash="unused",
        is_active=True,
        roles=[Role(id=uuid4(), name=role_name)],
        created_at=now,
        updated_at=now,
    )


class InMemoryRefreshRepository:
    def __init__(
        self,
        user: User,
        refresh_session: RefreshSession,
    ) -> None:
        self.user = user
        self.sessions = {refresh_session.token_hash: refresh_session}

    async def get_refresh_session(self, token_hash: str) -> RefreshSession | None:
        session = self.sessions.get(token_hash)
        if session is None or session.revoked_at is not None:
            return None
        return session

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        return self.user if self.user.id == user_id else None

    async def revoke_refresh_session(self, session: RefreshSession) -> bool:
        if session.revoked_at is not None:
            return False
        session.revoked_at = datetime.now(UTC)
        return True

    async def create_refresh_session(
        self,
        session: RefreshSession,
    ) -> RefreshSession:
        self.sessions[session.token_hash] = session
        return session

    async def get_user_by_email(self, email: str) -> User | None:
        del email
        return None

    async def get_role(self, name: str) -> Role | None:
        del name
        return None

    async def create_user(self, user: User) -> User:
        return user

    async def revoke_user_sessions(self, user_id: UUID) -> None:
        del user_id
        return None


class ConcurrentRefreshRepository(InMemoryRefreshRepository):
    def __init__(
        self,
        user: User,
        refresh_session: RefreshSession,
    ) -> None:
        super().__init__(user, refresh_session)
        self.read_count = 0
        self.both_read = asyncio.Event()
        self.revoke_lock = asyncio.Lock()

    async def get_refresh_session(self, token_hash: str) -> RefreshSession | None:
        session = self.sessions.get(token_hash)
        was_active = session is not None and session.revoked_at is None
        self.read_count += 1
        if self.read_count == 2:
            self.both_read.set()
        await self.both_read.wait()
        if not was_active:
            return None
        return session

    async def revoke_refresh_session(self, session: RefreshSession) -> bool:
        async with self.revoke_lock:
            if session.revoked_at is not None:
                return False
            session.revoked_at = datetime.now(UTC)
            return True


def test_password_hash_is_verified() -> None:
    password_hash = hash_password("a-long-secure-password")

    assert verify_password("a-long-secure-password", password_hash)
    assert not verify_password("incorrect-password", password_hash)


def test_default_cors_origins_match_local_frontend_hosts() -> None:
    settings = Settings.model_validate({"environment": "test"})

    assert "http://localhost:3000" in settings.cors_origins
    assert "http://127.0.0.1:3000" in settings.cors_origins


def test_cors_preflight_allows_loopback_frontend(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        main,
        "settings",
        main.settings.model_copy(
            update={
                "cors_origins": [
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                ]
            }
        ),
    )

    with TestClient(main.create_app()) as client:
        response = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://127.0.0.1:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_auth_cookies_use_http_only_and_configured_security() -> None:
    settings = get_settings()
    previous_secure = settings.auth_cookie_secure
    settings.auth_cookie_secure = True
    try:
        response = Response()
        set_auth_cookies(
            response,
            access_token="access-token",
            refresh_token="refresh-token",
        )
    finally:
        settings.auth_cookie_secure = previous_secure

    cookies = response.headers.getlist("set-cookie")
    assert any(
        "access_token=access-token" in cookie
        and "HttpOnly" in cookie
        and "Secure" in cookie
        and "samesite=lax" in cookie.lower()
        and "Path=/;" in cookie
        for cookie in cookies
    )
    assert any(
        "refresh_token=refresh-token" in cookie
        and "HttpOnly" in cookie
        and "Secure" in cookie
        and "samesite=lax" in cookie.lower()
        and "Path=/api/v1/auth;" in cookie
        for cookie in cookies
    )


def test_login_returns_user_and_sets_both_http_only_cookies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "auth_cookie_secure", False)
    user = build_user()

    class SuccessfulLoginService:
        async def login(self, email: str, password: str) -> tuple[User, str, str]:
            assert email == user.email
            assert password == "correct-password"
            return user, "access-token-value", "refresh-token-value"

    test_app = main.create_app()
    test_app.dependency_overrides[get_auth_service] = lambda: SuccessfulLoginService()
    with TestClient(test_app) as client:
        response = client.post(
            "/api/v1/auth/login",
            headers={"Origin": "http://testserver"},
            json={"email": user.email, "password": "correct-password"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "authenticated"
    assert body["user"]["id"] == str(user.id)
    assert body["user"]["email"] == user.email
    assert body["user"]["roles"] == ["viewer"]
    assert "access-token-value" not in response.text
    assert "refresh-token-value" not in response.text

    cookies = response.headers.get_list("set-cookie")
    access_cookie = next(
        cookie for cookie in cookies if cookie.startswith("access_token=")
    )
    refresh_cookie = next(
        cookie for cookie in cookies if cookie.startswith("refresh_token=")
    )
    access_cookie = access_cookie.lower()
    refresh_cookie = refresh_cookie.lower()
    assert "httponly" in access_cookie and "secure" in access_cookie
    assert "samesite=lax" in access_cookie
    assert "path=/;" in access_cookie
    assert "max-age=900" in access_cookie
    assert "httponly" in refresh_cookie and "secure" in refresh_cookie
    assert "samesite=lax" in refresh_cookie
    assert "path=/api/v1/auth;" in refresh_cookie
    assert "max-age=604800" in refresh_cookie


def test_invalid_login_does_not_set_auth_cookies() -> None:
    class InvalidLoginService:
        async def login(self, email: str, password: str) -> tuple[User, str, str]:
            raise AuthenticationError("Invalid email or password.")

    test_app = main.create_app()
    test_app.dependency_overrides[get_auth_service] = lambda: InvalidLoginService()
    with TestClient(test_app) as client:
        response = client.post(
            "/api/v1/auth/login",
            headers={"Origin": "http://testserver"},
            json={"email": "viewer@example.com", "password": "wrong-password"},
        )

    assert response.status_code == 401
    assert response.headers.get_list("set-cookie") == []
    assert "wrong-password" not in response.text


def test_login_validation_error_does_not_echo_password() -> None:
    password_marker = "SYNTHETIC_SECRET_MARKER_" * 8
    with TestClient(main.create_app()) as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "viewer@example.com", "password": password_marker},
        )

    assert response.status_code == 422
    assert password_marker not in response.text
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_refresh_endpoint_rotates_both_auth_cookies() -> None:
    class RefreshService:
        async def refresh(self, refresh_token: str) -> tuple[User, str, str]:
            assert refresh_token == "old-refresh-token"
            return build_user(), "new-access-token", "new-refresh-token"

    test_app = main.create_app()
    test_app.dependency_overrides[get_auth_service] = lambda: RefreshService()
    with TestClient(test_app) as client:
        client.cookies.set(
            "refresh_token",
            "old-refresh-token",
            path="/api/v1/auth",
        )
        response = client.post(
            "/api/v1/auth/refresh",
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "refreshed"}
    cookies = [cookie.lower() for cookie in response.headers.get_list("set-cookie")]
    assert any("access_token=new-access-token" in cookie for cookie in cookies)
    assert any("refresh_token=new-refresh-token" in cookie for cookie in cookies)
    assert all("httponly" in cookie for cookie in cookies)
    assert "new-access-token" not in response.text
    assert "new-refresh-token" not in response.text


def test_logout_endpoint_revokes_refresh_and_expires_both_cookies() -> None:
    class LogoutService:
        async def logout(self, refresh_token: str) -> None:
            assert refresh_token == "active-refresh-token"

    test_app = main.create_app()
    test_app.dependency_overrides[get_auth_service] = lambda: LogoutService()
    with TestClient(test_app) as client:
        client.cookies.set("access_token", "active-access-token", path="/")
        client.cookies.set(
            "refresh_token",
            "active-refresh-token",
            path="/api/v1/auth",
        )
        response = client.post(
            "/api/v1/auth/logout",
            headers={"Origin": "http://testserver"},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "logged_out"}
    cookies = [cookie.lower() for cookie in response.headers.get_list("set-cookie")]
    assert any(
        "access_token=" in cookie and "max-age=0" in cookie for cookie in cookies
    )
    assert any(
        "refresh_token=" in cookie and "max-age=0" in cookie for cookie in cookies
    )
    assert any("path=/;" in cookie for cookie in cookies)
    assert any("path=/api/v1/auth;" in cookie for cookie in cookies)


def test_openapi_declares_access_token_cookie_security() -> None:
    with TestClient(main.create_app()) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    document = response.json()
    assert document["components"]["securitySchemes"]["AccessTokenCookie"] == {
        "type": "apiKey",
        "in": "cookie",
        "name": "access_token",
    }
    assert document["paths"]["/api/v1/users/me"]["get"]["security"] == [
        {"AccessTokenCookie": []}
    ]


def test_cookie_authenticated_user_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "jwt_secret_key",
        "test-only-signing-secret-with-32-bytes",
    )
    user = build_user()

    async def get_user_by_id(
        _repository: AuthRepository,
        user_id: UUID,
    ) -> User | None:
        return user if user_id == user.id else None

    monkeypatch.setattr(AuthRepository, "get_user_by_id", get_user_by_id)
    token = create_access_token(user.id, {"viewer"})
    with TestClient(main.create_app()) as client:
        client.cookies.set("access_token", token)
        response = client.get("/api/v1/users/me")

    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert response.json()["roles"] == ["viewer"]


def test_expired_access_token_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "jwt_secret_key",
        "test-only-signing-secret-with-32-bytes",
    )
    monkeypatch.setattr(settings, "jwt_access_lifetime_seconds", -1)
    expired_token = create_access_token(uuid4(), {"viewer"})

    with TestClient(main.create_app()) as client:
        client.cookies.set("access_token", expired_token)
        response = client.get("/api/v1/users/me")

    assert response.status_code == 401


def test_invalid_access_token_is_rejected() -> None:
    with TestClient(main.create_app()) as client:
        client.cookies.set("access_token", "not-a-valid-jwt")
        response = client.get("/api/v1/users/me")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rotates_session_and_rejects_reuse(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "jwt_secret_key",
        "test-only-signing-secret-with-32-bytes",
    )
    user = build_user()
    old_token = "existing-random-refresh-token"
    old_session = RefreshSession(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(old_token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    repository = InMemoryRefreshRepository(user, old_session)
    service = AuthService(repository)

    refreshed_user, access_token, new_token = await service.refresh(old_token)

    assert refreshed_user is user
    assert decode_access_token(access_token)["sub"] == str(user.id)
    assert new_token != old_token
    assert old_session.revoked_at is not None
    assert await repository.get_refresh_session(hash_refresh_token(old_token)) is None
    assert (
        await repository.get_refresh_session(hash_refresh_token(new_token)) is not None
    )
    with pytest.raises(AuthenticationError):
        await service.refresh(old_token)


@pytest.mark.asyncio
async def test_concurrent_refresh_requests_rotate_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "jwt_secret_key",
        "test-only-signing-secret-with-32-bytes",
    )
    user = build_user()
    token = "concurrent-random-refresh-token"
    session = RefreshSession(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    service = AuthService(
        ConcurrentRefreshRepository(user, session)
    )

    results = await asyncio.gather(
        service.refresh(token),
        service.refresh(token),
        return_exceptions=True,
    )

    assert sum(isinstance(result, tuple) for result in results) == 1
    assert sum(isinstance(result, AuthenticationError) for result in results) == 1


@pytest.mark.asyncio
async def test_expired_refresh_session_is_revoked() -> None:
    user = build_user()
    token = "expired-random-refresh-token"
    session = RefreshSession(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(token),
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    service = AuthService(
        InMemoryRefreshRepository(user, session)
    )

    with pytest.raises(AuthenticationError, match="expired"):
        await service.refresh(token)
    assert session.revoked_at is not None


@pytest.mark.asyncio
async def test_deactivation_revokes_sessions_in_one_transaction() -> None:
    user = build_user()
    session = type(
        "FakeSession",
        (),
        {
            "flush": AsyncMock(),
            "execute": AsyncMock(),
            "commit": AsyncMock(),
            "refresh": AsyncMock(),
        },
    )()
    repository = AuthRepository(session)

    result = await repository.set_user_active(user, False)

    assert result is user
    assert user.is_active is False
    session.flush.assert_awaited_once()
    session.execute.assert_awaited_once()
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_deactivated_user_refresh_is_rejected_and_session_revoked() -> None:
    user = build_user()
    token = "deactivated-user-refresh-token"
    session = RefreshSession(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    repository = InMemoryRefreshRepository(user, session)
    service = AuthService(repository)

    user.is_active = False

    with pytest.raises(AuthenticationError, match="inactive"):
        await service.refresh(token)

    assert session.revoked_at is not None


@pytest.mark.asyncio
async def test_logout_revokes_refresh_session() -> None:
    user = build_user()
    token = "active-random-refresh-token"
    session = RefreshSession(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    repository = InMemoryRefreshRepository(user, session)
    service = AuthService(repository)

    await service.logout(token)
    await service.logout(token)

    assert session.revoked_at is not None


@pytest.mark.asyncio
async def test_logout_deletes_auth_cookies_with_matching_settings() -> None:
    user = build_user()
    token = "refresh-token"
    session = RefreshSession(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    repository = InMemoryRefreshRepository(user, session)
    service = AuthService(repository)

    response = Response()
    await logout_endpoint(
        response=response,
        refresh_token=token,
        service=service,
    )

    assert session.revoked_at is not None

    cookies = response.headers.getlist("set-cookie")
    assert any(
        'access_token="";' in cookie and "Path=/;" in cookie
        for cookie in cookies
    )
    assert any(
        'refresh_token="";' in cookie and "Path=/api/v1/auth;" in cookie
        for cookie in cookies
    )


def test_access_token_round_trip() -> None:
    settings = get_settings()
    settings.jwt_secret_key = "test-only-secret-key-32-bytes-minimum"
    subject = uuid4()

    token = create_access_token(subject, {"viewer"})
    payload = decode_access_token(token)

    assert payload["sub"] == str(subject)
    assert payload["roles"] == ["viewer"]


def test_access_token_rejects_wrong_secret() -> None:
    settings = get_settings()
    settings.jwt_secret_key = "test-only-secret-key-32-bytes-minimum"
    token = create_access_token(uuid4(), {"admin"})

    settings.jwt_secret_key = "different-test-secret-key-32-bytes"
    try:
        decode_access_token(token)
    except jwt.InvalidTokenError:
        assert True
    else:
        raise AssertionError("Token unexpectedly decoded with a wrong secret.")


def test_viewer_role_is_not_admin() -> None:
    viewer_role = Role(id=uuid4(), name="viewer")
    viewer = User(
        id=uuid4(),
        email="viewer@example.com",
        password_hash="unused",
        is_active=True,
        roles=[viewer_role],
    )

    assert "admin" not in {role.name for role in viewer.roles}


@pytest.mark.asyncio
async def test_viewer_cannot_pass_admin_dependency() -> None:
    viewer_role = Role(id=uuid4(), name="viewer")
    viewer = User(
        id=uuid4(),
        email="viewer@example.com",
        password_hash="unused",
        is_active=True,
        roles=[viewer_role],
    )

    with pytest.raises(HTTPException) as exc_info:
        await require_admin(viewer)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_viewer_passes_viewer_dependency() -> None:
    viewer_role = Role(id=uuid4(), name="viewer")
    viewer = User(
        id=uuid4(),
        email="viewer@example.com",
        password_hash="unused",
        is_active=True,
        roles=[viewer_role],
    )

    result = await require_viewer(viewer)

    assert result is viewer
