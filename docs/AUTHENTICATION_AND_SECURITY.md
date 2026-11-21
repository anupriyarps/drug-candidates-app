# Authentication and Security

## Authentication

FastAPI is the authentication authority. Passwords are hashed with Argon2.
Successful login issues short-lived JWT access tokens and persistent refresh
tokens as HttpOnly cookies. Refresh tokens are stored in PostgreSQL only as
SHA-256 hashes. Refresh rotates the refresh session and revokes the previous
session.

On login:

- `access_token` is scoped to `/`.
- `refresh_token` is scoped to `/api/v1/auth`.
- Both cookies use `HttpOnly` and `SameSite=Lax`.
- `Secure` is enabled by `AUTH_COOKIE_SECURE=true` or in non-development/test
  environments.
- Access and refresh lifetimes use the configured JWT settings.

The JSON login response contains authentication status and user profile only.
Raw access or refresh tokens are never returned in the response body.

## Authentication endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create a Viewer account |
| `POST` | `/api/v1/auth/login` | Issue access and refresh cookies |
| `POST` | `/api/v1/auth/refresh` | Rotate the refresh session |
| `POST` | `/api/v1/auth/logout` | Revoke the refresh session and clear cookies |
| `GET` | `/api/v1/users/me` | Return the authenticated user |

Invalid or expired refresh sessions result in reauthentication. Temporary
backend 5xx responses and network failures must not clear potentially valid
cookies.

## Authorization

Public registration always assigns the Viewer role. Candidate reads require
Viewer or Admin. Candidate writes require Admin. User listing and role or active
status changes require Admin.

FastAPI dependencies enforce authorization independently of frontend visibility.

The initial Admin is provisioned only through:

```powershell
python -m app.cli create-admin
```

Run it after migrations. The command never echo passwords and never overwrites
an existing account.

## Origin, CORS and CSRF

Unsafe API requests with authentication cookies are origin-checked. The
configured CORS origins and request origin must match. Next.js validates refresh
hand-offs and forwards a same-origin value to FastAPI.

Deployment must configure only trusted frontend origins and HTTPS.

## Secret and startup configuration

Non-test application startup requires:

- `JWT_SECRET_KEY` with at least 32 characters.
- A database password or percent-encoded `DATABASE_URL`.

Separate database fields are preferred:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`

SQLAlchemy `URL.create()` is used so reserved password characters are encoded
as password components. Secrets must not be logged or exposed in error
responses.

Test environments may use explicitly test settings. Test-only configuration
must not be used as a production default.

## Implemented controls

- Argon2 password hashing
- HttpOnly JWT cookies
- Refresh tokens stored only as hashes
- Refresh-token rotation and revocation
- Deactivation revokes active refresh sessions
- Origin validation for unsafe cookie-authenticated API requests
- OpenAPI cookie authentication scheme
- Validation errors redact submitted values
- Backend RBAC for candidate writes and user management
- Pydantic input validation
- CORS allow-list
- Correlation IDs
- Secret-free source configuration examples
- Non-root container users
- Python and runtime npm dependency audits in CI

## Remaining deployment work

- Generate and rotate a strong `JWT_SECRET_KEY`
- Use `AUTH_COOKIE_SECURE=true` behind HTTPS
- Restrict CORS to deployed origins
- Configure an external secret manager
- Add rate limiting for login and registration
- Configure a TLS-capable reverse proxy
- Add error tracking and alerting
