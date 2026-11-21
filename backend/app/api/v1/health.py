import logging

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import check_database_connection
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def liveness() -> dict[str, str]:
    return {"status": "healthy", "service": "api"}


@router.get("/ready")
async def readiness() -> JSONResponse:
    database_ready = await check_database_connection()
    redis_status = "disabled"
    if get_settings().cache_enabled:
        try:
            await get_redis_client().ping()
            redis_status = "healthy"
        except Exception as exc:
            logger.warning(
                "Redis readiness check failed (%s).",
                type(exc).__name__,
            )
            redis_status = "unhealthy"

    if database_ready:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "ready",
                "database": "healthy",
                "redis": redis_status,
            },
        )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "not_ready",
            "database": "healthy" if database_ready else "unhealthy",
            "redis": redis_status,
        },
    )
