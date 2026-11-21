from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.middleware.correlation_id import correlation_id
from app.services.auth_service import AuthenticationError, ConflictError
from app.services.candidate_service import (
    CandidateConflictError,
    CandidateNotFoundError,
)


def error_payload(
    code: str,
    message: str,
    details: Any = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "correlation_id": correlation_id.get(),
        }
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AuthenticationError)
    async def authentication_error_handler(
        _request: Request,
        _exc: AuthenticationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content=error_payload("UNAUTHENTICATED", "Invalid credentials."),
        )

    @app.exception_handler(ConflictError)
    async def auth_conflict_handler(
        _request: Request,
        exc: ConflictError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=error_payload("CONFLICT", str(exc)),
        )

    @app.exception_handler(CandidateNotFoundError)
    async def candidate_not_found_handler(
        _request: Request,
        _exc: CandidateNotFoundError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Candidate not found."),
        )

    @app.exception_handler(CandidateConflictError)
    async def candidate_conflict_handler(
        _request: Request,
        exc: CandidateConflictError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=error_payload("CONFLICT", str(exc)),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        details = [
            {
                "loc": error.get("loc"),
                "message": "Invalid value.",
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=error_payload(
                "VALIDATION_ERROR",
                "Request validation failed.",
                details,
            ),
        )

    @app.exception_handler(Exception)
    async def unexpected_exception_handler(
        _request: Request,
        _exc: Exception,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=error_payload(
                "INTERNAL_SERVER_ERROR",
                "An unexpected error occurred.",
            ),
        )
