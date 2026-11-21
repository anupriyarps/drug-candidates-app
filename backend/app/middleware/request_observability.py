import logging
import time
from collections.abc import Awaitable, Callable

from prometheus_client import Counter, Histogram
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.middleware.correlation_id import correlation_id

logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter(
    "drug_candidates_http_requests_total",
    "HTTP request count.",
    ["method", "path", "status"],
)
REQUEST_DURATION = Histogram(
    "drug_candidates_http_request_duration_seconds",
    "HTTP request duration.",
    ["method", "path"],
)


class RequestObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - started
        path = request.url.path

        REQUEST_COUNT.labels(
            method=request.method,
            path=path,
            status=str(response.status_code),
        ).inc()
        REQUEST_DURATION.labels(
            method=request.method,
            path=path,
        ).observe(duration)
        logger.info(
            "Request completed.",
            extra={
                "method": request.method,
                "path": path,
                "status_code": response.status_code,
                "duration_seconds": round(duration, 6),
                "correlation_id": correlation_id.get(),
            },
        )
        return response
