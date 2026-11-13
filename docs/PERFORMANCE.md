# Performance and Scalability Testing

## 1. Objective

Evaluate the Drug Candidate Portal's behaviour with a larger dataset and demonstrate:

- Server-side pagination.
- Search and status filtering.
- Sorting.
- Redis caching.
- Cache hit and miss behaviour.
- Graceful fallback when Redis is unavailable.

The application includes a synthetic dataset of 100,000 fictional drug candidates for local scalability testing.

## 2. Test Environment

| Component | Configuration |
|---|---|
| Framework | Next.js 16 |
| Runtime | Node.js |
| Data source | JSON dataset |
| Dataset size | 100,000 records |
| Cache | Upstash Redis |
| Default page size | 20 |
| Maximum page size | 100 |
| Cache TTL | 60 seconds |

Actual response times depend on the local machine, network, Redis region and runtime environment.

## 3. Dataset Configuration

The application supports two datasets:

| Dataset | Records | Purpose |
|---|---:|---|
| Small | 4 | Standard application demonstration |
| Large | 100,000 | Scalability testing |

Select the large dataset in `.env.local`:

```env
CANDIDATE_DATASET=large
```

Restart the application after changing the environment variable.

Generate the dataset locally using:

```bash
node scripts/generate-candidates.mjs
```

## 4. Pagination Validation

Test endpoint:

```http
GET /api/candidates?page=1&pageSize=20
```

Expected response characteristics:

| Metric | Expected |
|---|---:|
| Total records | 100,000 |
| Page size | 20 |
| Total pages | 5,000 |
| Returned records | 20 |
| Has next page | true |
| Has previous page | false |

**Validation result:** Successfully verified with the 100,000-record dataset. The API returned 20 records with the expected pagination metadata.

Pagination limits the response sent to the client, reducing the amount of data transferred and rendered at once.

## 5. Redis Cache Validation

The application uses Redis to cache candidate list and detail responses.

### Cache Miss

1. Request a URL with a new combination of query parameters.
2. Redis does not contain the corresponding cache key.
3. The application retrieves the data from the repository.
4. The result is stored in Redis with a 60-second TTL.

Expected log:

```text
[Redis] CACHE MISS
```

### Cache Hit

1. Repeat the same request before the cache expires.
2. Redis returns the previously stored response.
3. The repository lookup is skipped.

Expected log:

```text
[Redis] CACHE HIT
```

**Validation result:** Cache miss and cache hit behaviour were successfully verified.

### Cache Key Design

Cache keys incorporate the dataset and relevant query parameters.

This prevents results from different datasets, filters or pages from sharing the same cache entry.

## 6. Redis Failure and Fallback Validation

The application should continue serving candidate data when Redis is unavailable.

Test procedure:

1. Temporarily configure an invalid Redis authentication token.
2. Restart the application.
3. Request the candidates endpoint.
4. Verify that candidate data is still returned.
5. Restore the valid Redis credentials.

Expected behaviour:

- Redis read failure is logged.
- The repository provides the candidate data.
- Redis write failure is handled without failing the API request.
- The candidates endpoint remains available.

**Validation result:** Successfully verified. The candidates API continued returning data despite Redis authentication failures.

The application treats Redis as an optional performance layer rather than the primary data source.

## 7. Performance Benchmark Methodology

For a meaningful comparison, use the same dataset, query parameters and environment.

Compare:

| Scenario | Description |
|---|---|
| Cold request | First request for a cache key |
| Warm request | Repeated request using the same cache key |
| Filtered request | Search and status filtering |
| Pagination request | Request a different page |
| Redis unavailable | Request data while Redis authentication or connectivity fails |

Use the browser Network tab or server request logs to record response times.

For more reliable measurements:

- Run multiple iterations.
- Exclude initial compilation and application startup.
- Use the same page size and filters.
- Compare median response times rather than a single request.
- Keep the Redis region and local network consistent.

## 8. Benchmark Results

Controlled timing benchmarks have not yet been completed.

| Scenario | Response time |
|---|---|
| Cold request – 100,000 records | Not measured |
| Warm request – 100,000 records | Not measured |
| Filtered request – 100,000 records | Not measured |
| Redis unavailable – 100,000 records | Not measured |

Functional cache validation confirms that caching works, but it should not be interpreted as a measured performance improvement.

## 9. Current Implementation: Trade-offs

The current implementation uses an in-memory JSON repository.

Although the API returns only one page, the repository currently loads the full JSON dataset into server memory and performs filtering and sorting in application memory.

Consequently:

- Pagination reduces response payload size and browser rendering work.
- Redis avoids repeating repository processing for identical cached requests.
- Cache misses still require application-level filtering and sorting.
- A large JSON dataset consumes server memory.

For a production implementation with significantly larger datasets, the repository could be replaced with a database-backed implementation.

Recommended improvements include:

- Database indexes for searchable and sortable fields.
- Database-level pagination and filtering.
- Query-plan analysis.
- Cache invalidation on data changes.
- Load testing with concurrent requests.
- Monitoring of API latency, memory and cache hit ratio.

## 10. Conclusion

The implementation demonstrates pagination, Redis caching, cache fallback and application behaviour with 100,000 synthetic records.

The functional scalability tests validate the application's data retrieval and caching behaviour. They do not constitute a production load or stress test.

The JSON repository is a demonstration data source. A database-backed implementation would be the next step for production-scale data management.