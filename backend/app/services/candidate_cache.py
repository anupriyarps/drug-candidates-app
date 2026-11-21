import json
import logging
from hashlib import sha256
from time import monotonic
from typing import Any, Literal

from app.core.config import get_settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)
CACHE_FAILURE_COOLDOWN_SECONDS = 60.0


class CandidateCache:
    def __init__(self) -> None:
        self._unavailable_until = 0.0

    def _is_unavailable(self) -> bool:
        return monotonic() < self._unavailable_until

    def _record_failure(self, operation: str, exc: Exception) -> None:
        cooldown = max(
            CACHE_FAILURE_COOLDOWN_SECONDS,
            float(get_settings().cache_ttl_seconds),
        )
        self._unavailable_until = monotonic() + cooldown
        logger.warning(
            "Redis candidate cache %s failed (%s); bypassing cache for %.0f seconds.",
            operation,
            type(exc).__name__,
            cooldown,
        )

    async def get(self, key: str) -> dict[str, Any] | None:
        if self._is_unavailable():
            return None

        try:
            value = await get_redis_client().get(key)
        except Exception as exc:
            self._record_failure("read", exc)
            return None

        if not value:
            return None

        try:
            payload = json.loads(value)
        except (TypeError, ValueError) as exc:
            logger.warning(
                "Redis candidate cache payload is invalid (%s).",
                type(exc).__name__,
            )
            return None
        return payload if isinstance(payload, dict) else None

    async def set(
        self,
        key: str,
        value: dict[str, Any],
        ttl_seconds: int | None = None,
    ) -> None:
        if self._is_unavailable():
            return

        try:
            serialized_value = json.dumps(value)
        except (TypeError, ValueError) as exc:
            logger.warning(
                "Redis candidate cache value could not be serialized (%s).",
                type(exc).__name__,
            )
            return

        try:
            ttl = (
                ttl_seconds
                if ttl_seconds is not None
                else get_settings().cache_ttl_seconds
            )
            await get_redis_client().set(
                key,
                serialized_value,
                ex=ttl,
            )
        except Exception as exc:
            self._record_failure("write", exc)

    async def delete(self, key: str) -> None:
        if self._is_unavailable():
            return

        try:
            await get_redis_client().delete(key)
        except Exception as exc:
            self._record_failure("delete", exc)

    async def delete_pattern(self, pattern: str) -> None:
        if self._is_unavailable():
            return

        try:
            redis = get_redis_client()
            keys = [key async for key in redis.scan_iter(match=pattern)]
            if keys:
                await redis.delete(*keys)
        except Exception as exc:
            self._record_failure("pattern invalidation", exc)


def build_candidate_list_cache_key(
    search: str | None,
    status: str | None,
    page: int,
    page_size: int,
    sort_by: Literal["name", "status"],
    sort_order: Literal["asc", "desc"],
) -> str:
    payload = {
        "search": (search or "").strip().lower(),
        "status": status,
        "page": page,
        "page_size": page_size,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }
    digest = sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return f"drug-candidates:list:{digest}"


def build_candidate_detail_cache_key(candidate_id: str) -> str:
    return f"drug-candidates:detail:{candidate_id}"
