# Testing and Validation

This document describes the testing strategy, performance validation approach, CI/CD workflow, recorded validation results, and outstanding engineering work for the Drug Candidate Portal.

## 1. Testing Strategy

The application uses automated tests and static analysis across the frontend and backend.

| Layer | Tools |
|---|---|
| Frontend unit/component tests | Jest, React Testing Library |
| Browser tests | Playwright |
| Backend tests | Pytest |
| Code quality | ESLint, Ruff |
| Type checking | TypeScript, MyPy |
| Dependency security | npm audit, pip-audit |
| Database migration validation | Alembic with PostgreSQL |
| Production build | Next.js build |

### Backend testing

Run commands from `backend/`.

Install development dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Run tests with coverage:

```powershell
.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing -q
```

Run Ruff linting and formatting checks:

```powershell
.\.venv\Scripts\ruff.exe check app migrations scripts tests

.\.venv\Scripts\ruff.exe format --check app migrations scripts tests
```

Run MyPy:

```powershell
.\.venv\Scripts\mypy.exe app scripts
```

The backend test suite covers:
- Health endpoints.
- Candidate APIs, services, and models.
- Importer path handling and repeatability.
- Password hashing.
- JWT behavior.
- Authorization.
- Cache behavior using test doubles.
- Request and response schemas.

These tests do not require live PostgreSQL or Redis services. CI separately validates Alembic migration execution against PostgreSQL.

### Frontend testing

Run commands from `frontend/`.

Install dependencies:

```powershell
npm ci
```

Run Jest:

```powershell
npm test -- --runInBand
```

Run ESLint:

```powershell
npm run lint
```

Run TypeScript validation:

```powershell
npx tsc --noEmit
```

Run Playwright:

```powershell
npm run test:e2e
```

Create a production build:

```powershell
npm run build
```

The current Playwright tests exercise login-page UI flows using a mocked FastAPI API. They do not provide authenticated candidate CRUD end-to-end coverage against a live backend.

Live API workflows require PostgreSQL, FastAPI, and a configured account. Redis is required only for testing live cache operations.

## 2. Performance and Caching

### Current data path

Candidate queries are served by FastAPI using PostgreSQL for persistence and Redis as an optional cache.

The API supports:
- Search.
- Status filtering.
- Sorting.
- Pagination.

Redis cache failures are handled without making PostgreSQL-backed candidate operations unavailable.

### Redis configuration

The backend uses:

```text
CACHE_ENABLED=false
```

by default for direct local runs. This allows the backend to operate against PostgreSQL without initializing Redis.

Docker Compose enables caching by default and connects the backend to the `redis` service.

Set `CACHE_ENABLED` explicitly when deploying outside Compose.

### Cache failure handling

Redis operations use bounded socket timeouts.

After a cache operation fails, the process bypasses Redis for at least the cache TTL, which defaults to 60 seconds, and serves candidate queries from PostgreSQL.

Readiness reports:
- `disabled` when caching is turned off.
- `unhealthy` when caching is enabled but Redis cannot be reached.

Redis degradation does not make PostgreSQL-backed candidate reads unavailable.

### Dataset generation

The default demonstration dataset contains four fictional candidates:

```text
backend/data/candidates.json
```

An optional script generates 100,000 fictional candidate records.

Run the generator and importer from `backend/`:

```powershell
node scripts\generate-candidates.mjs

.\.venv\Scripts\python.exe scripts\import_candidates.py data\candidates.large.json
```

The generated dataset is ignored by Git. Importing it requires a configured PostgreSQL database.

### Performance validation scenarios

Use the authenticated endpoint:

```text
GET /api/v1/candidates
```

Exercise the following scenarios:

1. First and subsequent pages.
2. Page sizes up to the configured API limit.
3. Search terms.
4. Each candidate status.
5. Name and status sorting in ascending and descending order.
6. Repeated identical requests to exercise Redis reads.
7. Candidate writes followed by reads to exercise cache invalidation.
8. Requests while Redis is unavailable to verify database fallback.

Candidate service and cache tests are maintained under `backend/tests/`.

### Benchmark methodology

The repository does not define a formal response-time target.

For comparative measurements:
- Use a fixed dataset and query.
- Exclude application startup and migration time.
- Run multiple iterations.
- Compare median cold-cache and warm-cache response times.
- Record filtered and paginated requests.
- Include Redis-unavailable scenarios.

Measure these separately when investigating bottlenecks:
- Database query latency.
- Redis latency.
- Process memory.
- API response time.

Functional tests are not a substitute for load testing.

## 3. Continuous Integration and Delivery

### Pull request validation

The GitHub Actions pull request workflow is configured to validate backend, frontend, and Docker artifacts.

**Backend checks**
- Python 3.12 installation.
- Ruff linting and formatting.
- MyPy.
- Alembic migration against PostgreSQL.
- Pytest and coverage.
- Python dependency audit.

**Frontend checks**
- `npm ci`.
- ESLint.
- TypeScript.
- Jest.
- Playwright E2E.
- Next.js production build.
- Runtime npm dependency audit.

**Container checks**
- Backend Docker image build.
- Frontend Docker image build.

### Workflow configuration

- Backend commands use `backend/` as the working directory.
- Frontend commands use `frontend/` as the working directory.
- npm dependency caching uses `frontend/package-lock.json`.
- The frontend Docker build context is `frontend/`.
- Compose remains rooted at `docker-compose.yml`.
- The workflow installs Chromium before Playwright.
- Backend CI applies Alembic migrations against its PostgreSQL service before running tests.
- CI uses test-only database credentials.

Python dependency and production npm dependency audits run as part of validation.

### Branch protection recommendations

For the `main` branch, recommended repository settings include:

- Require a pull request before merging.
- Require at least one review.
- Require the `backend`, `frontend`, and `docker` jobs to pass.
- Require conversation resolution.
- Prevent force pushes.
- Prevent direct pushes.

These are recommendations; they should not be considered enabled until configured in repository settings.

### Deployment

Deployment is intentionally not automatic.

The deployment placeholder workflow is manual-only and performs no cloud access.

Provider-specific deployment should be added only after credentials, environment configuration, rollback procedures, and release approvals are documented.

## 4. Recorded Validation Results

<text>**Validation snapshot: 21 November 2026**</text>

The following results are taken from the recorded acceptance validation. They are not a claim that the checks were rerun while preparing this document.

**Newly executed verification, 21 November 2026:** focused refresh and
configuration regressions passed; backend Pytest passed 84 tests after the
remediation; frontend Jest passed 54 tests after the remediation. The earlier
verified baseline was 77 backend tests and 51 frontend tests. Backend statement
coverage was 83%. Frontend statement,
branch, function, and line coverage was 86.28%, 80.16%, 94.52%, and 86.43%
respectively.

### Frontend

| Check | Recorded result |
|---|---|
| `npm ci` | Passed |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Jest | 8 suites, 51 tests passed |
| Playwright | 4 tests passed |
| Next.js production build | Passed with Next.js 16.4.6 |
| Production npm audit | No production vulnerabilities reported |

The full npm dependency installation reported 24 moderate dependency-tree advisories. The production-only audit reported no vulnerabilities at the configured high severity threshold.

Playwright tests mock FastAPI. They are not authenticated backend integration tests.

### Backend

| Check | Recorded result |
|---|---|
| `pip check` | No broken requirements |
| `pip-audit -r requirements.txt` | No known vulnerabilities |
| Ruff lint and format | Passed |
| MyPy (`app scripts`) | Passed |
| Pytest | 77 tests passed |

The Pytest run emitted one existing Starlette/httpx deprecation warning from the test client dependency stack.

### Repository hygiene

The recorded checks confirmed that:
- Generated build and test outputs are ignored.
- Python caches and virtual environments are ignored.
- The generated large dataset is ignored.
- Local environment files are ignored and not tracked.
- Environment templates contain placeholders only.

## 5. Not Yet Validated

The following scenarios were explicitly not validated in the recorded environment:

| Area | Limitation |
|---|---|
| Docker | Docker CLI/Engine unavailable; Compose parsing, builds, startup, service health, and persistent volumes were not runtime-tested |
| GitHub Actions | Workflow was not run remotely |
| Browser integration | Authenticated candidate CRUD is not covered by browser E2E tests |
| Production deployment | Not validated |
| TLS and secret management | Not validated in a production environment |
| Backups and alerting | Not validated |
| Load/performance testing | Not performed |

The Compose backend configuration uses the `redis` service hostname for Redis connectivity, but this was not verified through a live Compose run in the recorded environment.

## 6. Follow-up Engineering Work

Recommended next steps:

1. Add login and registration rate limiting.
2. Configure external secret management.
3. Configure HTTPS termination.
4. Add error tracking and production alerting.
5. Run Docker startup and image-build checks in a provisioned environment.
6. Validate PostgreSQL migrations and Redis integration using live services.
7. Add authenticated browser-level candidate CRUD tests.
8. Perform load and performance testing.
9. Enable repository branch protection and required CI checks.

## 7. Acceptance Perspective

The recorded validation demonstrates successful frontend and backend automated checks, static analysis, dependency checks, and a production frontend build.

It does not establish production deployment readiness.

Docker runtime behavior, authenticated full-stack browser workflows, production infrastructure, operational monitoring, and load testing still require verification in an appropriate integration or deployment environment.