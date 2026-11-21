from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any, Literal
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

import app.dependencies.candidates as candidate_dependencies
from app.core.config import Settings, get_settings
from app.models.candidate import Candidate, CandidateStatus
from app.repositories.interfaces import PaginatedCandidates
from app.services.candidate_cache import (
    CandidateCache,
    build_candidate_detail_cache_key,
    build_candidate_list_cache_key,
)
from app.services.candidate_service import CandidateService


class InMemoryCache:
    def __init__(self) -> None:
        self.values: dict[str, dict[str, Any]] = {}

    async def get(self, key: str) -> dict[str, Any] | None:
        return self.values.get(key)

    async def set(
        self,
        key: str,
        value: dict[str, Any],
        ttl_seconds: int | None = None,
    ) -> None:
        del ttl_seconds
        self.values[key] = value

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)

    async def delete_pattern(self, pattern: str) -> None:
        prefix = pattern.removesuffix("*")
        for key in [key for key in self.values if key.startswith(prefix)]:
            del self.values[key]


class CacheCandidateRepository:
    def __init__(self, candidate: Candidate) -> None:
        self.candidate = candidate
        self.read_count = 0

    async def get_candidate_by_id(
        self,
        candidate_id: UUID,
    ) -> Candidate | None:
        self.read_count += 1
        return self.candidate if self.candidate.id == candidate_id else None

    async def get_candidate_by_name(self, name: str) -> Candidate | None:
        del name
        return None

    async def get_candidates(
        self,
        search: str | None = None,
        status: CandidateStatus | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: Literal["name", "status"] = "name",
        sort_order: Literal["asc", "desc"] = "asc",
    ) -> PaginatedCandidates:
        del search, status, page, page_size, sort_by, sort_order
        raise AssertionError("Cache test should not query repository.")

    async def create_candidate(self, candidate: Candidate) -> Candidate:
        return candidate

    async def update_candidate(self, candidate: Candidate) -> Candidate:
        return candidate

    async def delete_candidate(self, candidate: Candidate) -> None:
        return None


def test_list_cache_key_is_deterministic() -> None:
    first = build_candidate_list_cache_key(
        "nova",
        "Approved",
        1,
        20,
        "name",
        "asc",
    )
    second = build_candidate_list_cache_key(
        " NOVA ",
        "Approved",
        1,
        20,
        "name",
        "asc",
    )

    assert first == second


def test_cache_is_disabled_by_default_for_local_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CACHE_ENABLED", raising=False)
    monkeypatch.delenv("REDIS_SOCKET_TIMEOUT_SECONDS", raising=False)
    settings = Settings.model_validate({"environment": "test"})

    assert settings.cache_enabled is False
    assert settings.redis_socket_timeout_seconds == 0.2
    with pytest.raises(ValidationError):
        Settings.model_validate({
            "environment": "test",
            "redis_socket_timeout_seconds": 1.1,
        })


@pytest.mark.asyncio
async def test_candidate_service_does_not_create_cache_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "cache_enabled", False)
    monkeypatch.setattr(candidate_dependencies, "_candidate_cache", None)

    def unexpected_cache_creation() -> CandidateCache:
        pytest.fail("Cache must not be created when caching is disabled.")

    monkeypatch.setattr(
        candidate_dependencies,
        "_get_candidate_cache",
        unexpected_cache_creation,
    )

    service = await candidate_dependencies.get_candidate_service(
        session=AsyncMock(spec=AsyncSession),
    )

    assert service.cache is None


@pytest.mark.asyncio
async def test_candidate_cache_reads_and_writes_healthy_redis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class HealthyRedis:
        def __init__(self) -> None:
            self.values: dict[str, str] = {}
            self.expirations: dict[str, int] = {}

        async def get(self, key: str) -> str | None:
            return self.values.get(key)

        async def set(self, key: str, value: str, ex: int) -> None:
            self.values[key] = value
            self.expirations[key] = ex

    redis = HealthyRedis()
    monkeypatch.setattr(
        "app.services.candidate_cache.get_redis_client",
        lambda: redis,
    )
    cache = CandidateCache()
    payload = {"data": [], "total_records": 0}

    await cache.set("healthy-key", payload, ttl_seconds=25)

    assert await cache.get("healthy-key") == payload
    assert redis.expirations["healthy-key"] == 25


@pytest.mark.asyncio
async def test_cache_failure_suppresses_retries_during_cooldown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class UnavailableRedis:
        def __init__(self) -> None:
            self.get_calls = 0
            self.set_calls = 0
            self.delete_calls = 0
            self.scan_calls = 0

        async def get(self, _key: str) -> str:
            self.get_calls += 1
            raise ConnectionError("Redis unavailable")

        async def set(self, _key: str, _value: str, ex: int) -> None:
            self.set_calls += 1
            raise ConnectionError("Redis unavailable")

        async def delete(self, _key: str) -> None:
            self.delete_calls += 1
            raise ConnectionError("Redis unavailable")

        async def scan_iter(self, match: str) -> AsyncIterator[str]:
            self.scan_calls += 1
            yield match

    redis = UnavailableRedis()
    monkeypatch.setattr(
        "app.services.candidate_cache.get_redis_client",
        lambda: redis,
    )
    cache = CandidateCache()

    assert await cache.get("failure-key") is None
    await cache.set("failure-key", {"data": []})
    await cache.delete("failure-key")
    await cache.delete_pattern("drug-candidates:list:*")
    assert await cache.get("failure-key") is None

    assert redis.get_calls == 1
    assert redis.set_calls == 0
    assert redis.delete_calls == 0
    assert redis.scan_calls == 0


@pytest.mark.asyncio
async def test_candidate_detail_cache_hit_avoids_repository() -> None:
    now = datetime.now(UTC)
    candidate = Candidate(
        id=uuid4(),
        name="NovaCure",
        status=CandidateStatus.APPROVED,
        description="Description",
        mechanism_of_action="Mechanism",
        side_effects=["Headache"],
        created_at=now,
        updated_at=now,
    )
    repository = CacheCandidateRepository(candidate)
    cache = InMemoryCache()
    service = CandidateService(repository, cache)

    first = await service.get_candidate(candidate.id)
    second = await service.get_candidate(candidate.id)

    assert first.id == candidate.id
    assert second.id == candidate.id
    assert repository.read_count == 1
    assert build_candidate_detail_cache_key(str(candidate.id)) in cache.values


@pytest.mark.asyncio
async def test_malformed_detail_cache_payload_falls_back_to_repository() -> None:
    now = datetime.now(UTC)
    candidate = Candidate(
        id=uuid4(),
        name="NovaCure",
        status=CandidateStatus.APPROVED,
        description="Description",
        mechanism_of_action="Mechanism",
        side_effects=["Headache"],
        created_at=now,
        updated_at=now,
    )
    repository = CacheCandidateRepository(candidate)
    cache = InMemoryCache()
    cache.values[build_candidate_detail_cache_key(str(candidate.id))] = {
        "id": "invalid",
    }
    service = CandidateService(repository, cache)

    result = await service.get_candidate(candidate.id)

    assert result.id == candidate.id
    assert repository.read_count == 1


@pytest.mark.asyncio
async def test_cache_read_failure_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class UnavailableRedis:
        async def get(self, key: str) -> str:
            del key
            raise ConnectionError("Redis unavailable")

    monkeypatch.setattr(
        "app.services.candidate_cache.get_redis_client",
        lambda: UnavailableRedis(),
    )

    assert await CandidateCache().get("drug-candidates:test") is None


@pytest.mark.asyncio
async def test_cache_malformed_json_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class MalformedRedis:
        async def get(self, key: str) -> str:
            del key
            return "{malformed"

    monkeypatch.setattr(
        "app.services.candidate_cache.get_redis_client",
        lambda: MalformedRedis(),
    )

    assert await CandidateCache().get("drug-candidates:test") is None
