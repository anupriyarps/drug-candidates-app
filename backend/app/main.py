from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import make_asgi_app

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import close_database
from app.core.logging import configure_logging
from app.core.redis import close_redis
from app.middleware.correlation_id import CorrelationIdMiddleware
from app.middleware.csrf import CSRFMiddleware
from app.middleware.request_observability import RequestObservabilityMiddleware
from app.utils.exceptions import register_exception_handlers

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await close_database()
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(RequestObservabilityMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
    )
    app.add_middleware(
        CSRFMiddleware,
        allowed_origins=settings.cors_origins,
        api_prefix=settings.api_v1_prefix,
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    app.mount("/metrics", make_asgi_app())
    FastAPIInstrumentor.instrument_app(app)
    return app


app = create_app()
