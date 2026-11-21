from redis.asyncio import Redis

from app.core.config import get_settings

redis_client: Redis | None = None


def get_redis_client() -> Redis:
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(
            get_settings().redis_url,
            decode_responses=True,
            socket_connect_timeout=get_settings().redis_socket_timeout_seconds,
            socket_timeout=get_settings().redis_socket_timeout_seconds,
        )
    return redis_client


async def close_redis() -> None:
    global redis_client
    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None
