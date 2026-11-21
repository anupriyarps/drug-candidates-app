from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class CSRFMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        allowed_origins: list[str],
        api_prefix: str,
    ) -> None:
        super().__init__(app)
        self.allowed_origins = frozenset(allowed_origins)
        self.api_prefix = api_prefix.rstrip("/")

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        path = request.url.path
        is_api_request = path == self.api_prefix or path.startswith(
            f"{self.api_prefix}/"
        )
        has_auth_cookie = bool(
            request.cookies.get("access_token") or request.cookies.get("refresh_token")
        )
        origin = request.headers.get("origin")

        if (
            is_api_request
            and request.method in UNSAFE_METHODS
            and (origin is not None or has_auth_cookie)
            and not self._is_trusted_origin(origin, request)
        ):
            return JSONResponse(
                status_code=403,
                content={"detail": "Origin not allowed."},
            )

        return await call_next(request)

    def _is_trusted_origin(
        self,
        origin: str | None,
        request: Request,
    ) -> bool:
        if origin is None or origin == "null":
            return False

        request_origin = f"{request.url.scheme}://{request.url.netloc}"
        return origin in self.allowed_origins or origin == request_origin
