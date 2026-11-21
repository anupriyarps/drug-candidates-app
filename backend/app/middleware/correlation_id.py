from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

correlation_id: ContextVar[str | None] = ContextVar(
    "correlation_id",
    default=None,
)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        incoming_id = request.headers.get("X-Correlation-ID")
        request_id = incoming_id.strip()[:128] if incoming_id else str(uuid4())
        if not request_id:
            request_id = str(uuid4())

        token = correlation_id.set(request_id)
        try:
            response: Response = await call_next(request)
            response.headers["X-Correlation-ID"] = request_id
            return response
        finally:
            correlation_id.reset(token)
