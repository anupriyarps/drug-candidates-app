# API Reference

## 1. Overview

The Drug Candidate Portal backend exposes a versioned REST API implemented using FastAPI.

| Property | Value |
|---|---|
| API framework | FastAPI |
| API version | v1 |
| Base path | `/api/v1` |
| API documentation | `/docs` |
| OpenAPI schema | `/openapi.json` |
| Authentication | JWT using HttpOnly cookies |
| Authorization | Role-based access control |

FastAPI owns the HTTP API, request validation, authentication, authorization, and backend business operations.

## 2. Candidate Endpoints

The candidate API supports the following operations.

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| GET | `/api/v1/candidates` | List candidates | Viewer, Admin |
| GET | `/api/v1/candidates/{candidate_id}` | Retrieve candidate details | Viewer, Admin |
| POST | `/api/v1/candidates` | Create a candidate | Admin |
| PUT | `/api/v1/candidates/{candidate_id}` | Replace a candidate | Admin |
| PATCH | `/api/v1/candidates/{candidate_id}` | Partially update a candidate | Admin |
| DELETE | `/api/v1/candidates/{candidate_id}` | Delete a candidate | Admin |

All candidate endpoints require authentication.

## 2A. Authentication and User Endpoints

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Register a Viewer account | Public |
| POST | `/api/v1/auth/login` | Issue access and refresh cookies | Public |
| POST | `/api/v1/auth/refresh` | Rotate a refresh session | Refresh cookie |
| POST | `/api/v1/auth/logout` | Revoke refresh session and clear cookies | Refresh cookie |
| GET | `/api/v1/users/me` | Return the authenticated user | Authenticated |
| GET | `/api/v1/users` | List users | Admin |
| PATCH | `/api/v1/users/{user_id}/role` | Change a user's role | Admin |
| PATCH | `/api/v1/users/{user_id}/active` | Activate or deactivate a user | Admin |

## 3. Candidate List API

### Endpoint

```http
GET /api/v1/candidates
```

### Query Parameters

| Parameter | Description | Supported values / default |
|---|---|---|
| `search` | Search candidates by name | Optional |
| `status` | Filter by development status | `In Development`, `Clinical Trial`, `Approved` |
| `page` | Page number | Default: `1` |
| `page_size` | Number of records per page | Default: `20`, maximum: `100` |
| `sort_by` | Sort field | `name`, `status`; default: `name` |
| `sort_order` | Sort direction | `asc`, `desc`; default: `asc` |

### Example request

```http
GET /api/v1/candidates?search=aspirin&status=Approved&page=1&page_size=20&sort_by=name&sort_order=asc
```

### Response structure

The list response uses a `data` and `pagination` envelope.

The response shape is:

```json
{
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "name": "Example Candidate",
      "status": "In Development",
      "description": "Example description",
      "mechanism_of_action": "Example mechanism",
      "side_effects": [],
      "created_at": "2026-11-21T00:00:00Z",
      "updated_at": "2026-11-21T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalRecords": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## 4. Candidate Detail API

### Endpoint

```http
GET /api/v1/candidates/{candidate_id}
```

Retrieves a candidate by its identifier.

### Response structure

Candidate detail responses use the following envelope:

```json
{
  "data": {
    "...": "Candidate response fields"
  }
}
```

The candidate detail fields match the list item fields shown above.

## 5. Candidate Write Operations

The following operations require the Admin role:

- Create a candidate.
- Replace an existing candidate.
- Partially update a candidate.
- Delete a candidate.

### Create

```http
POST /api/v1/candidates
```

### Replace

```http
PUT /api/v1/candidates/{candidate_id}
```

### Partial update

```http
PATCH /api/v1/candidates/{candidate_id}
```

### Delete

```http
DELETE /api/v1/candidates/{candidate_id}
```

Create and replace requests require `name`, `status`, `description`,
`mechanism_of_action`, and `side_effects`. `name`, `description`, and
`mechanism_of_action` must contain non-whitespace text. `side_effects` is a
string array and defaults to an empty array.

Patch requests accept the same fields as optional values. Create and replace
return HTTP `201` and `200` respectively. Patch and delete return HTTP `200`
and `204` respectively. Write responses use the candidate data envelope.

## 6. Response and Error Conventions

### Successful responses

Candidate detail responses use:

```json
{
  "data": {}
}
```

Candidate list responses include:
- `data`
- `pagination`

### Error responses

Validation and domain failures use a consistent error envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "correlation_id": "request-correlation-id",
    "details": {}
  }
}
```

The `details` property is optional.

The actual error codes and HTTP status mappings should be documented from the backend exception handlers and API implementation.

## 7. Authentication and Authorization

Candidate API requests require an authenticated user.

The application supports two roles:

| Role | Read candidates | Write candidates |
|---|---|---|
| Viewer | Yes | No |
| Admin | Yes | Yes |

Authentication uses JWT-based HttpOnly cookies.

Authorization is enforced by the backend rather than relying only on frontend visibility or route protection.

See [Authentication and Security](AUTHENTICATION_AND_SECURITY.md) for login, token lifecycle, cookies, refresh sessions, and authorization details.

## 8. API Exploration

FastAPI provides interactive API documentation.

**Swagger UI**

```text
http://localhost:8000/docs
```

**OpenAPI schema**

```text
http://localhost:8000/openapi.json
```

Use the OpenAPI schema as the authoritative reference for request models, response models, validation constraints, and documented status codes.

## 9. API Design Responsibilities

The backend owns:
- HTTP request and response contracts.
- Input validation.
- Authentication and authorization.
- Candidate business logic.
- Database persistence.
- Error handling.

The frontend communicates with the backend through REST APIs. Frontend URL query state and backend API query parameter names are separate concerns.