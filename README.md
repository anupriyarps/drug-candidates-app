# Drug Candidate Portal

A full-stack drug candidate management application built with **Next.js, React, TypeScript, Python, FastAPI, and PostgreSQL**.

The project uses a single Git repository with independently buildable frontend and backend applications, supported by Docker Compose infrastructure.

> **Disclaimer:** All candidate data is fictional and intended for demonstration purposes only. This application is not a medical tool and does not provide medical advice.

## Features

### Candidate Management
- Browse candidate records and view candidate details.
- Search candidates by name.
- Filter candidates by development status.
- Sort and paginate candidate results.
- Maintain list state through URL query parameters.
- View server-rendered candidate pages.

### Authentication and Authorization
- JWT-based authentication using HttpOnly cookies.
- Access-token and refresh-token lifecycle management.
- Refresh-token rotation and session revocation.
- Role-based access control (RBAC).
- Viewer and Admin roles.
- Admin-only candidate write operations.
- Secure initial Admin provisioning through a backend CLI command.

### Backend and Data
- Versioned FastAPI REST API.
- PostgreSQL persistence using SQLAlchemy.
- Alembic database migrations.
- Repository and service-layer separation.
- Optional Redis caching with graceful degradation.
- Candidate seed-data import and synthetic-data generation.

### Engineering and Quality
- TypeScript and Python.
- Frontend unit and component tests.
- Playwright browser smoke tests.
- Backend unit and integration tests.
- ESLint, Ruff, and MyPy.
- Docker and Docker Compose configuration.
- GitHub Actions CI workflows.

## Architecture

The application follows a **modular monolith** architecture with clearly separated frontend and backend responsibilities.

```text
                 Browser
                    |
                    v
             Next.js Frontend
                    |
                 REST API
                    |
                    v
              FastAPI Backend
                    |
          +---------+----------+
          |                    |
          v                    v
   Authentication       Candidate Services
   and Authorization           |
                               v
                       Repository Layer
                               |
                    +----------+----------+
                    |                     |
                    v                     v
                PostgreSQL           Redis Cache
               (Source of Truth)     (Optional)
```

**Frontend – Next.js**

Responsible for:
- User interface and presentation.
- Candidate listing and details.
- Search, filtering, sorting, and pagination.
- Authentication experience.
- API communication and frontend state management.

**Backend – FastAPI**

Responsible for:
- REST API endpoints and input validation.
- Authentication and authorization.
- Candidate business logic.
- Database operations.
- Cache integration.

**Data Layer**
- PostgreSQL is the primary source of truth.
- Redis is an optional caching layer.
- Candidate operations continue to use PostgreSQL when Redis is disabled or unavailable.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| UI | Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| Migrations | Alembic |
| Cache | Redis |
| Authentication | JWT, HttpOnly cookies, Argon2 |
| Frontend testing | Jest, React Testing Library, Playwright |
| Backend testing | Pytest |
| Code quality | ESLint, Ruff, MyPy |
| Infrastructure | Docker, Docker Compose |
| CI/CD | GitHub Actions |

## Repository Structure

```text
drug-candidates-app/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── tests/
│   │   └── e2e/
│   ├── package.json
│   ├── package-lock.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
│
├── backend/
│   ├── app/
│   ├── data/
│   ├── migrations/
│   ├── scripts/
│   ├── tests/
│   ├── pyproject.toml
│   ├── alembic.ini
│   └── Dockerfile
│
├── docs/
├── .github/
│   └── workflows/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

The frontend and backend maintain independent dependencies and build configurations while sharing root-level Docker Compose infrastructure.

## Getting Started

### Prerequisites

For local development:
- Node.js and npm.
- Python 3.12.
- PostgreSQL.
- Git.

For running the complete containerized stack:
- Docker.
- Docker Compose.

You do not need to install PostgreSQL separately when using the Docker Compose database service.

### 1. Clone the repository

```powershell
git clone https://github.com/anupriyarps/drug-candidates-app.git

cd drug-candidates-app
```

### 2. Configure environment variables

For Docker Compose, from the repository root:

```powershell
Copy-Item .env.example .env
```

Configure the required local values, including:
- `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY`

For standalone backend development:

```powershell
cd backend
Copy-Item .env.example .env
```

For frontend development:

```powershell
cd frontend
Copy-Item .env.example .env.local
```

Use the environment templates as the source of truth for available configuration options.

**Security:** Never commit real credentials, JWT secrets, access tokens, or environment files.

### 3. Run the backend locally

From the repository root:

```powershell
cd backend

py -3.12 -m venv .venv

.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Configure the backend environment and ensure PostgreSQL is running.

Apply database migrations:

```powershell
.\.venv\Scripts\alembic.exe upgrade head
```

Create the initial Admin account:

```powershell
.\.venv\Scripts\python.exe -m app.cli create-admin
```

The command securely prompts for the email and password. It uses the existing password-hashing implementation and refuses to overwrite an existing account.

Start FastAPI:

```powershell
.\.venv\Scripts\uvicorn.exe app.main:app --reload
```

- API: http://127.0.0.1:8000
- Interactive API documentation: http://127.0.0.1:8000/docs

### 4. Import sample candidate data

The sample dataset is maintained in:

```text
backend/data/candidates.json
```

Run the importer from the backend directory:

```powershell
.\.venv\Scripts\python.exe scripts\import_candidates.py
```

The importer resolves its default seed-data path relative to its own location.

### 5. Run the frontend locally

From the repository root:

```powershell
cd frontend

npm ci

npm run dev
```

Open http://localhost:3000.

The frontend requires the FastAPI backend and its database to be running for authenticated candidate operations.

## Run the Complete Stack with Docker

From the repository root, configure `.env` and run:

```powershell
docker compose up --build
```

Docker Compose manages the application services and their dependencies.

After the backend and database are available, provision the initial Admin account:

```powershell
docker compose exec backend python -m app.cli create-admin
```

See [Development and Operations](docs/DEVELOPMENT_AND_OPERATIONS.md) for database setup, Docker configuration, migrations, and operational procedures.

## Synthetic Dataset Generation

The project includes an optional synthetic-data generator for creating larger candidate datasets.

To generate 100,000 fictional candidate records:

```powershell
cd backend

node scripts\generate-candidates.mjs
```

The generated file is written under:

```text
backend/data/
```

Import the generated dataset:

```powershell
.\.venv\Scripts\python.exe scripts\import_candidates.py data\candidates.large.json
```

Generated datasets are excluded from Git and are not part of the committed sample seed data.

## Testing and Code Quality

### Frontend

Run commands from `frontend/`:

```powershell
npm ci

npm run lint

npx tsc --noEmit

npm test -- --runInBand

npm run test:e2e

npm run build
```

The frontend test suite includes unit/component tests and Playwright browser smoke tests. The current Playwright login tests use a mocked API; they do not represent authenticated candidate CRUD against a live backend.

### Backend

Run commands from `backend/`:

```powershell
.\.venv\Scripts\ruff.exe check app migrations scripts tests

.\.venv\Scripts\ruff.exe format --check app migrations scripts tests

.\.venv\Scripts\mypy.exe app scripts

.\.venv\Scripts\python.exe -m pytest -q
```

Live database migration, seed import, and Redis integration checks require the corresponding services to be available.

See [Testing and Validation](docs/TESTING_AND_VALIDATION.md) for the test strategy, CI workflow, recorded validation results, and outstanding limitations.

## Authentication and Security

The application implements:
- Argon2 password hashing.
- JWT-based access authentication.
- HttpOnly authentication cookies.
- Refresh-token rotation and persisted refresh-session hashes.
- Viewer/Admin role-based authorization.
- Origin validation for cookie-authenticated state-changing requests.
- Environment-based configuration for secrets.
- Admin provisioning through a backend CLI rather than public registration.

Public registration creates Viewer accounts. Candidate write operations require Admin authorization enforced by the backend.

See [Authentication and Security](docs/AUTHENTICATION_AND_SECURITY.md) for authentication flows, cookie behavior, authorization rules, security controls, and deployment considerations.

## Performance and Caching

Redis is an optional caching layer intended to reduce repeated database reads.

The application is designed to degrade gracefully:
- When Redis is disabled, candidate operations use PostgreSQL directly.
- When Redis becomes unavailable, cache failures do not prevent candidate operations.
- PostgreSQL remains the source of truth.

See [Development and Operations](docs/DEVELOPMENT_AND_OPERATIONS.md) for cache configuration and operational guidance.

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Application structure and component responsibilities |
| [API](docs/API.md) | REST API endpoints and contracts |
| [Authentication and Security](docs/AUTHENTICATION_AND_SECURITY.md) | Login, JWT, cookies, refresh, authorization, and security |
| [Development and Operations](docs/DEVELOPMENT_AND_OPERATIONS.md) | Local setup, Docker, database, migrations, and operations |
| [Testing and Validation](docs/TESTING_AND_VALIDATION.md) | Test strategy, CI/CD, validation results, and limitations |

## Validation Status

The project has undergone frontend and backend automated testing, static analysis, dependency checks, and production frontend build validation.

Some integration and deployment scenarios still require a provisioned Docker environment.

Outstanding validation includes:
- Docker Compose startup, image builds, and persistent-volume behavior.
- Authenticated candidate CRUD browser testing against the real backend.
- Production deployment, TLS, external secret management, backups, monitoring, and alerting.

See [Testing and Validation](docs/TESTING_AND_VALIDATION.md) for the dated validation snapshot and remaining work. Do not interpret configured CI workflows as proof that they have completed successfully in a remote GitHub Actions run.

## Project Scope

This is a demonstration application designed to showcase:
- Full-stack application development.
- Frontend/backend separation.
- REST API design.
- Authentication and authorization.
- Relational database persistence.
- Optional caching and graceful degradation.
- Automated testing and code quality.
- Containerization and CI/CD foundations.

It is structured as a **modular monolith rather than a microservices architecture**, keeping the system understandable and maintainable while preserving clear application boundaries.