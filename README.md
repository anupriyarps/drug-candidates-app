# Drug Candidate Portal

A responsive web application built as part of the **Senior Frontend Engineer coding challenge for Merck KGaA – Healthcare Digital, Data & IT R&D**.

The application provides a simple interface to explore pharmaceutical research candidates, view their development status, search by candidate name, filter by status, and access detailed scientific information.

## Overview

The Drug Candidate Portal demonstrates frontend engineering practices using Next.js, React, TypeScript, and Tailwind CSS. It includes a mock REST API, reusable UI components, server-side data access, automated tests, and responsive layouts.

The application uses illustrative fictional data and is intended only for demonstration purposes.

## Features

- **Candidate Listing:** Displays drug candidates with their name, development status, and description.
- **Search:** Search candidates by name.
- **Status Filtering:** Filter candidates by In Development, Clinical Trial, or Approved status.
- **Combined Filtering:** Apply name search and status filtering together.
- **Candidate Details:** View detailed candidate information, including mechanism of action and potential side effects.
- **Mock REST API:** Uses JSON-based data with Next.js API routes.
- **Debounced Search:** Uses a 300 ms debounce to avoid unnecessary API requests while typing.
- **Request Cancellation:** Uses AbortController to cancel outdated search requests.
- **Loading and Error States:** Provides feedback during requests and when errors occur.
- **Responsive UI:** Supports desktop, tablet, and mobile layouts.
- **Accessibility:** Includes semantic HTML, labelled form controls, and visible keyboard focus indicators.

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | React framework and application routing |
| React 19 | Component-based UI development |
| TypeScript | Static typing and maintainability |
| Tailwind CSS 4 | Responsive styling |
| Jest | Unit and integration testing |
| React Testing Library | Component testing |
| ESLint | Code quality and linting |

## Project Structure

```text
drug-candidates-app/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── candidates/
│   │   │       ├── [id]/
│   │   │       │   └── route.ts
│   │   │       └── route.ts
│   │   │
│   │   ├── candidates/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── error.tsx
│   │   ├── loading.tsx
│   │   ├── not-found.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── CandidateCard.tsx
│   │   └── CandidateList.tsx
│   │
│   ├── data/
│   │   └── candidates.json
│   │
│   ├── services/
│   │   ├── candidateApiClient.ts
│   │   └── candidateDataService.ts
│   │
│   └── types/
│       └── candidate.ts
│
├── tests/
│   ├── api/
│   │   ├── candidates.test.ts
│   │   └── candidateById.test.ts
│   │
│   ├── components/
│   │   ├── CandidateCard.test.tsx
│   │   └── CandidateList.test.tsx
│   │
│   └── services/
│       └── candidateDataService.test.ts
│
├── jest.config.ts
├── jest.setup.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Application Architecture

The application separates UI components, API routes, data access, and type definitions.

### 1. Presentation Layer

- `CandidateList.tsx`: Manages search, status filtering, loading, error, and empty states.
- `CandidateCard.tsx`: Displays an individual candidate and links to its details page.
- App pages: Render the candidate listing and candidate details.

### 2. API Layer

Next.js Route Handlers expose REST-style endpoints.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/candidates` | Retrieve candidates, with optional search and status filters |
| GET | `/api/candidates/[id]` | Retrieve a candidate by ID |

### 3. Service Layer

- `candidateApiClient.ts`: Handles client-side API communication and request cancellation.
- `candidateDataService.ts`: Provides server-side data access and filtering from the JSON dataset.

### 4. Data Layer

`candidates.json` contains four fictional drug candidate records used by the application.

### Request Flow

```text
User Interaction
      |
      v
CandidateList Component
      |
      v
Debounce (300 ms)
      |
      v
Candidate API Client
      |
      v
Next.js API Route
      |
      v
Candidate Data Service
      |
      v
JSON Data Source
      |
      v
Filtered Candidate Response
      |
      v
Updated UI
```

## Performance Considerations

The implementation includes the following performance considerations:

- Debounced search reduces unnecessary API calls while users type.
- AbortController cancels outdated requests when search criteria change.
- Search and status filtering are performed through the API rather than directly against the UI list.
- Server-side data access is separated from client-side API communication.
- Reusable components help maintain a consistent UI and reduce duplication.
- The candidate listing uses a responsive grid layout.

**Scalability consideration:** The current implementation uses a small in-memory JSON dataset. For production-scale datasets, the data service can be extended to use a database-backed repository with server-side pagination, indexed filtering, and sorting without changing the overall UI/API separation.

## Error Handling

The application handles common scenarios:

- Invalid status filter values return a `400` response.
- Missing candidate records return a `404` response.
- Unexpected API errors return a safe `500` response.
- Client-side request failures display an error message.
- Loading and empty states provide feedback during candidate searches.
- Next.js error and not-found boundaries handle application-level errors and missing pages.

## Testing

The application uses Jest and React Testing Library.

The test suite covers:

- Candidate card rendering and navigation.
- Candidate listing, search, and status filtering.
- Combined search and status filtering.
- Loading, empty, and error states.
- Candidate data service filtering and lookup.
- Candidate collection API behavior.
- Candidate-by-ID API behavior.

### Test Results

**Latest verified test run: 29 tests passing across 5 test suites.**

| Coverage Metric | Result |
|---|---:|
| Statements | 98.79% |
| Branches | 97.22% |
| Functions | 100% |
| Lines | 100% |

## Getting Started

### Prerequisites

- Node.js
- npm

### 1. Clone the repository

```bash
git clone https://github.com/anupriyarps/drug-candidates-app.git
```

### 2. Navigate to the project

```bash
cd drug-candidates-app
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create an optimized production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test -- --runInBand` | Run all tests |
| `npm run test:coverage` | Run tests and generate coverage report |

## Production Verification

The following checks have been successfully completed:

- ESLint validation.
- TypeScript validation during production build.
- Optimized Next.js production build.
- Automated test suite: 29 passing tests.
- Responsive UI checks on desktop, tablet, and mobile.
- Keyboard accessibility checks.

## Future Enhancements

Potential extensions for a production implementation include:

- Database-backed candidate storage.
- Server-side pagination and sorting.
- Advanced scientific search.
- Authentication and role-based access control.
- Integration with real pharmaceutical research data sources.

These enhancements are outside the scope of the current coding challenge.

## Disclaimer

All candidate names, descriptions, mechanisms of action, and side-effect information in this application are fictional and provided solely for demonstration purposes. They do not represent actual medicines, clinical research, or medical advice.

---

**Developed as part of the Merck KGaA Senior Frontend Engineer Coding Challenge.**