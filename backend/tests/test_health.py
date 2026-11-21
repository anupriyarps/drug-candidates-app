import pytest
from fastapi.testclient import TestClient

import app.api.v1.health as health
from app.core.config import get_settings
from app.main import app

client = TestClient(app)


def test_liveness() -> None:
    response = client.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "api"}
    assert response.headers["X-Correlation-ID"]


def test_correlation_id_is_preserved() -> None:
    response = client.get(
        "/api/v1/health/live",
        headers={"X-Correlation-ID": "test-correlation-id"},
    )

    assert response.headers["X-Correlation-ID"] == "test-correlation-id"


def test_readiness_succeeds_when_database_is_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "cache_enabled", True)

    async def database_is_available() -> bool:
        return True

    monkeypatch.setattr(
        health,
        "check_database_connection",
        database_is_available,
    )

    class HealthyRedis:
        async def ping(self) -> bool:
            return True

    monkeypatch.setattr(
        health,
        "get_redis_client",
        lambda: HealthyRedis(),
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database": "healthy",
        "redis": "healthy",
    }


def test_readiness_reports_unavailable_database(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "cache_enabled", True)

    async def database_is_unavailable() -> bool:
        return False

    monkeypatch.setattr(
        health,
        "check_database_connection",
        database_is_unavailable,
    )

    class UnhealthyRedis:
        async def ping(self) -> bool:
            raise ConnectionError("Redis unavailable")

    monkeypatch.setattr(
        health,
        "get_redis_client",
        lambda: UnhealthyRedis(),
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "database": "unhealthy",
        "redis": "unhealthy",
    }


def test_readiness_ignores_optional_cache_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "cache_enabled", True)

    async def database_is_available() -> bool:
        return True

    monkeypatch.setattr(
        health,
        "check_database_connection",
        database_is_available,
    )

    class UnhealthyRedis:
        async def ping(self) -> bool:
            raise ConnectionError("Redis unavailable")

    monkeypatch.setattr(
        health,
        "get_redis_client",
        lambda: UnhealthyRedis(),
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database": "healthy",
        "redis": "unhealthy",
    }


def test_readiness_reports_disabled_cache_without_calling_redis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "cache_enabled", False)

    async def database_is_available() -> bool:
        return True

    def unexpected_redis_access() -> None:
        raise AssertionError("Redis must not be accessed when caching is disabled.")

    monkeypatch.setattr(
        health,
        "check_database_connection",
        database_is_available,
    )
    monkeypatch.setattr(
        health,
        "get_redis_client",
        unexpected_redis_access,
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database": "healthy",
        "redis": "disabled",
    }


def test_metrics_endpoint_is_exposed() -> None:
    response = client.get("/metrics")

    assert response.status_code == 200
