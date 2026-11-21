# Architecture

The repository is a single Git monorepo with independently buildable frontend
and backend applications.

```text
frontend/
  src/                 Next.js App Router UI and API clients
  tests/               Jest and tests/e2e/ Playwright tests
  package.json         Frontend-only dependencies and scripts
backend/
  app/                 FastAPI endpoints, services, models, repositories
  data/                Candidate import seed
  migrations/          Alembic schema history
  scripts/             Import and synthetic-data generation
  tests/
  pyproject.toml       Backend-only Python project configuration
docker-compose.yml     Shared local infrastructure and service orchestration
```

```text
Browser
  -> Next.js frontend (server rendering and interactive UI)
  -> FastAPI /api/v1
      -> Authentication/authorization dependencies
      -> Candidate service and repository
          -> PostgreSQL (source of truth)
          -> Redis (optional cache)
```

Next.js owns presentation and server-side rendering. FastAPI owns validation,
authentication, authorization, persistence, and candidate business rules.
Candidate queries use the versioned FastAPI API; there is no Next.js candidate
API backend or JSON runtime repository.

Compose builds the frontend and backend from their own directories. PostgreSQL
must pass its health check before the one-off `migrate` service applies Alembic
migrations. The API starts only after migration succeeds. Redis is started by
Compose but is not an API startup dependency; cache failures fall back to the
database.
