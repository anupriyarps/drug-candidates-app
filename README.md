# Drug Candidate Portal

A full-stack web application developed as part of the **Senior Frontend Engineer Coding Challenge – Merck KGaA, Healthcare Digital, Data & IT R&D**.

The application provides a searchable, filterable, and paginated interface for exploring fictional drug candidates. It demonstrates modern frontend engineering practices, API integration, reusable components, data access abstraction, caching, error handling, automated testing, and scalability considerations.

## Features

### Candidate Management
- Browse drug candidates with their name, development status, and description.
- View detailed candidate information, including mechanism of action and side effects.
- Search candidates by name.
- Filter candidates by development status.
- Sort candidates by name or status.
- Navigate through paginated results.

### Frontend Experience
- Responsive UI built with Tailwind CSS.
- Reusable React components.
- Server-rendered initial candidate data.
- Client-side search and filtering.
- Search, status, pagination, and sorting state preserved in URL query parameters.
- Debounced search requests.
- Request cancellation using `AbortController`.
- Loading, error, and empty states.
- Accessible form labels and keyboard focus indicators.

### Backend and API
- Next.js API Route Handlers.
- TypeScript-based API contracts.
- JSON-backed mock data repository.
- Input validation and structured API responses.
- Candidate detail endpoint.
- Server-side filtering, sorting, and pagination.

### Performance and Scalability
- Server-side pagination to limit response payloads.
- Upstash Redis caching.
- Cache keys based on dataset and query parameters.
- Configurable cache expiration (60 seconds).
- Graceful fallback to the JSON repository when Redis is unavailable.
- Optional synthetic dataset containing 100,000 records for scalability testing.

### Testing
- Jest.
- React Testing Library.
- API route tests.
- Component tests.
- Service-layer tests.

## Technology Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| API | Next.js Route Handlers |
| Data source | JSON |
| Caching | Upstash Redis |
| Testing | Jest, React Testing Library |
| Code quality | ESLint |

## Architecture

The application follows a layered architecture that separates presentation, API handling, application services, data access, and caching.

```text
src/
├── app/
│   ├── api/
│   │   ├── candidates/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── health/
│   │       └── redis/route.ts
│   ├── candidates/
│   │   └── [id]/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── CandidateCard.tsx
│   └── CandidateList.tsx
│
├── data/
│   └── candidates.json
│
├── lib/
│   ├── candidateSearchParams.ts
│   ├── cache/
│   │   └── candidateCache.ts
│   └── redis.ts
│
├── repositories/
│   ├── interfaces/
│   │   └── ICandidateRepository.ts
│   ├── implementations/
│   │   └── JsonCandidateRepository.ts
│   └── candidateRepositoryFactory.ts
│
├── services/
│   ├── candidateDataService.ts
│   └── candidateApiClient.ts
│
└── types/
    └── candidate.ts

tests/
├── api/
├── components/
├── lib/
├── repositories/
└── services/

scripts/
└── generate-candidates.mjs

docs/
└── PERFORMANCE.md
```

### Request Flow

```text
Browser
   |
   v
Next.js Pages / React Components
   |
   v
Next.js API Routes
   |
   v
Candidate Data Service
   |
   +------> Redis Cache
   |           |
   |       Cache Hit
   |           |
   |       Return Result
   |
   +------> Candidate Repository
                  |
                  v
             JSON Dataset
```

On a cache miss, the service retrieves the data through the repository and attempts to store the result in Redis. If Redis is unavailable, the repository remains the source of data.

## Architecture Decisions

### 1. Repository Pattern

The `ICandidateRepository` interface separates data access from application services.

The current implementation uses `JsonCandidateRepository` to retrieve candidate information from JSON files.

This abstraction allows the underlying data source to be replaced with a database-backed repository without coupling the application services or UI to a specific storage implementation.

### 2. Service Layer

`candidateDataService` coordinates candidate retrieval and caching.

Its responsibilities include:
- Normalizing search and pagination parameters.
- Checking Redis for cached results.
- Retrieving data through the repository on a cache miss.
- Storing retrieved results in Redis.
- Falling back to the repository when Redis operations fail.

### 3. Redis Caching

Upstash Redis is used to cache candidate lists and candidate details.

Cache keys include relevant parameters:
- Dataset.
- Search term.
- Development status.
- Page and page size.
- Sort field and sort order.

The default cache expiration is 60 seconds.

Redis is treated as a performance optimization rather than a dependency for data availability. If Redis becomes unavailable, the application continues retrieving data from the JSON repository.

### 4. Server-Side Pagination

Pagination is performed on the server.

The API returns only the requested page instead of sending the complete dataset to the browser.

The response includes:
- Current page.
- Page size.
- Total records.
- Total pages.
- Next-page availability.
- Previous-page availability.

## API Endpoints

### Get Candidates

`GET /api/candidates`

Supported query parameters:

| Parameter | Description | Default |
|---|---|---|
| `search` | Search by candidate name | None |
| `status` | Filter by candidate status | None |
| `page` | Page number | 1 |
| `pageSize` | Records per page | 20 |
| `sortBy` | `name` or `status` | `name` |
| `sortOrder` | `asc` or `desc` | `asc` |

Maximum supported page size: 100.

Example:

```http
GET /api/candidates?page=1&pageSize=20&sortBy=name&sortOrder=asc
```

### Get Candidate by ID

`GET /api/candidates/{id}`

Returns the details of a candidate matching the supplied ID.

### Redis Health Check

`GET /api/health/redis`

Checks connectivity to the configured Redis instance.

## Getting Started

### Prerequisites

- Node.js
- npm
- Upstash Redis account (optional; the application supports repository fallback when Redis is unavailable).

### Installation

Clone the repository:

```bash
git clone https://github.com/anupriyarps/drug-candidates-app.git

cd drug-candidates-app
```

Install dependencies:

```bash
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root:

```env
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token

# Use small for the default demonstration dataset.
CANDIDATE_DATASET=small
```

Do not commit `.env.local` or actual credentials to source control.

### Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Large Dataset Testing

The application supports an optional synthetic dataset containing 100,000 fictional records.

Generate the dataset locally:

```bash
node scripts/generate-candidates.mjs
```

Select the large dataset in `.env.local`:

```env
CANDIDATE_DATASET=large
```

Restart the application and access:

```http
GET /api/candidates?page=1&pageSize=20
```

Expected pagination metadata:

| Metric | Expected value |
|---|---:|
| Total records | 100,000 |
| Page size | 20 |
| Total pages | 5,000 |
| Returned records | 20 |

To return to the standard demonstration dataset:

```env
CANDIDATE_DATASET=small
```

Restart the application after changing the environment variable.

The generated large dataset is intended for local scalability testing and does not need to be committed to the repository.

## Testing and Code Quality

Run the automated test suite:

```bash
npm test -- --runInBand
```

Run ESLint:

```bash
npm run lint
```

Run TypeScript validation:

```bash
npx tsc --noEmit
```

Create a production build:

```bash
npm run build
```

## Performance Considerations and Trade-offs

The application demonstrates pagination, caching, and graceful degradation using a synthetic dataset.

The current JSON repository loads the selected dataset into server memory. Filtering and sorting are performed in application memory before the requested page is returned.

Redis reduces repeated processing for identical cached requests.

For a production system with larger or frequently changing datasets, a database-backed repository would be preferable, with:
- Database-level filtering and sorting.
- Appropriate indexes.
- Database-level pagination.
- Query optimization.
- Cache invalidation when data changes.

The current implementation demonstrates the architectural separation needed to introduce these capabilities without coupling the UI to the data source.

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for the scalability testing approach, cache validation, and performance benchmark methodology.

## Data Disclaimer

All candidate names, mechanisms of action, descriptions, and side effects in this project are fictional and intended solely for demonstration purposes. They do not represent real medicines or medical advice.

## Author

Developed as part of the Merck KGaA Senior Frontend Engineer coding challenge.
