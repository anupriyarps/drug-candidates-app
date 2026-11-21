# Development and Operations

This document covers local development setup, Docker Compose, PostgreSQL configuration, database migrations, seed-data imports, health checks, logging, and troubleshooting.

## 1. Architecture and Infrastructure

The application uses the following infrastructure:

| Service | Responsibility |
|---|---|
| Next.js | Frontend application |
| FastAPI | Backend REST API |
| PostgreSQL | Primary database and source of truth |
| Redis | Optional candidate-data cache |
| Alembic | Database schema migrations |
| Docker Compose | Local multi-container orchestration |

PostgreSQL is required for application data. Redis is optional; candidate operations continue using PostgreSQL when Redis is disabled or unavailable.

## 2. Local Development Setup

### Prerequisites

- Node.js and npm.
- Python 3.12.
- PostgreSQL.
- Git.

### Environment configuration

For standalone backend development, create the backend environment file:

```powershell
cd backend
Copy-Item .env.example .env
```

Configure the required database and authentication settings using the provided environment template.

The preferred database configuration uses separate settings:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`

The application uses SQLAlchemy's `URL.create()` to construct the database connection URL. This safely handles special characters in database credentials.

The legacy `DATABASE_URL` configuration remains supported. Credentials in a manually configured legacy URL must be percent-encoded.

**Security:** Do not commit actual database passwords, JWT secrets, access tokens, or environment files.

## 3. Database

### Database technology

- PostgreSQL is the source of truth.
- SQLAlchemy 2.x uses asynchronous sessions with `asyncpg`.
- Alembic manages database schema migrations.
- JSONB is used for candidate side-effect data.

### Database entities

| Entity | Purpose |
|---|---|
| `candidates` | Candidate records, status, description, mechanism, side effects, and timestamps |
| `users` | User identity, email, Argon2 password hash, active status, and timestamps |
| `roles` | Available authorization roles |
| `user_roles` | Many-to-many relationship between users and roles |
| `refresh_sessions` | Hashed refresh tokens, expiry, revocation, and user relationship |

Candidate and user records use UUID identifiers. Candidate names and user emails have uniqueness constraints.

### Database migrations

Migrations are maintained under:

```text
backend/migrations/
```

The current migration history includes:

- `20261118_001` – initial database schema.
- `20261118_002` – authentication-related schema and role seed data (`admin` and `viewer`).

Run migrations manually from `backend/`:

```powershell
cd backend

.\.venv\Scripts\alembic.exe upgrade head
```

To inspect the current migration revision:

```powershell
.\.venv\Scripts\alembic.exe current
```

Migrations should be applied before starting the API against a new database.

Docker Compose uses a separate one-off `migrate` service to apply migrations before the API starts. API replicas do not run migrations independently during application startup.

## 4. Initial Admin Provisioning

The application does not expose public Admin registration.

Public registration creates Viewer accounts. The initial Admin account is provisioned through the backend CLI:

```powershell
cd backend

.\.venv\Scripts\python.exe -m app.cli create-admin
```

The command interactively prompts for the email and password. It uses the existing password-hashing implementation and refuses to overwrite an existing account.

The database migrations must be applied before running this command because the required roles must exist.

## 5. Seed Data and Imports

The sample candidate dataset is maintained at:

```text
backend/data/candidates.json
```

Run the importer from the backend directory:

```powershell
cd backend

.\.venv\Scripts\python.exe scripts\import_candidates.py
```

The importer resolves its default seed-data path relative to the script, rather than relying on the current working directory.

Repeated imports use deterministic IDs and skip records that already exist.

### Synthetic datasets

The project also includes an optional synthetic-data generator.

It writes a larger dataset to:

```text
backend/data/candidates.large.json
```

Generated datasets are excluded from Git. They can be imported using the same importer:

```powershell
.\.venv\Scripts\python.exe scripts\import_candidates.py data\candidates.large.json
```

## 6. Docker Compose

### Configuration

From the repository root, create the environment file:

```powershell
Copy-Item .env.example .env
```

Replace the secret placeholders with local values. Do not commit the resulting `.env` file.

Compose maps PostgreSQL settings to the backend's separate database configuration fields. It uses the database service name for internal service-to-service connectivity.

Do not manually assemble a database URL in the Compose environment.

### Start the application

```powershell
docker compose up --build
```

### Services and local endpoints

| Service | Endpoint |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

Compose builds the frontend from `frontend/` and the backend from `backend/`.

### Startup dependencies

The Compose startup sequence is designed as follows:

1. PostgreSQL starts and passes its health check.
2. The one-off `migrate` service applies database migrations.
3. The API waits for migration completion.
4. The API starts Uvicorn as a non-root user.
5. The frontend starts as a separate service.

The API does not depend on Redis startup. Redis is optional, and cache failures fall back to PostgreSQL.

### Create the initial Admin

After the backend is available:

```powershell
docker compose exec backend python -m app.cli create-admin
```

### Import sample data

After the services start:

```powershell
docker compose exec backend python scripts/import_candidates.py
```

## 7. Health Checks and Observability

The backend exposes the following endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health/live` | Confirms that the API process is alive |
| `GET /api/v1/health/ready` | Reports database readiness and Redis cache status |
| `GET /metrics` | Exposes Prometheus-compatible application metrics |
| `/docs` | Interactive Swagger API documentation |

### Liveness

The liveness endpoint confirms that the API process is running. Docker Compose uses it for the API container health check.

### Readiness

Readiness checks PostgreSQL and reports Redis status.

| Condition | Expected behavior |
|---|---|
| PostgreSQL healthy, Redis enabled and reachable | Ready |
| PostgreSQL healthy, Redis disabled | Ready; Redis reports `disabled` |
| PostgreSQL healthy, Redis unavailable | Ready; Redis reports `unhealthy` |
| PostgreSQL unavailable | Not ready; returns HTTP 503 |

Redis is an optional candidate-cache dependency. Redis degradation does not fail readiness while PostgreSQL is healthy.

## 8. Application Logging

Application logs are JSON-structured.

The logs include:
- Request correlation IDs.
- Request duration.
- HTTP method.
- Request path.
- HTTP status.

Sensitive information is excluded from application logs, including:
- Passwords.
- Access tokens.
- Refresh tokens.
- Authorization headers.

Use request correlation IDs to trace requests across application logs.

## 9. Troubleshooting

| Symptom or status | What to check |
|---|---|
| Readiness returns `503` | Verify PostgreSQL connectivity and database configuration |
| Redis reports `unhealthy` | Check Redis connectivity; candidate reads should continue through PostgreSQL |
| `401 Unauthorized` | Verify the access cookie and `JWT_SECRET_KEY` |
| `403 Forbidden` | Verify that the authenticated user has the required role |
| `409 Conflict` | Check for an existing unique candidate name or user email |
| Migration failure | Verify database configuration and inspect `alembic current` |
| Cache failure | Inspect Redis connectivity and application logs; PostgreSQL remains authoritative |

### Migration troubleshooting

From `backend/`:

```powershell
.\.venv\Scripts\alembic.exe current

.\.venv\Scripts\alembic.exe upgrade head
```

Confirm that the configured database is reachable and that the migration revision is correct before retrying.

### Docker troubleshooting

Useful commands:

```powershell
docker compose ps

docker compose logs backend

docker compose logs frontend

docker compose logs postgres

docker compose logs redis
```

To inspect the migration service:

```powershell
docker compose logs migrate
```

Do not remove named volumes as a routine troubleshooting step. PostgreSQL volumes may contain application data.

## 10. Operational Considerations

- PostgreSQL remains the authoritative data store.
- Redis is an optimization and must not be treated as the primary data store.
- Database migrations should be applied before application startup.
- Admin provisioning is an explicit operational step.
- Environment files must contain local secrets and remain outside Git.
- Production deployment requires deployment-specific configuration for secrets, HTTPS, backups, monitoring, and alerting.

For recorded environment limitations and verification results, see [Testing and Validation](TESTING_AND_VALIDATION.md).