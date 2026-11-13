
import "server-only";

import {
  buildCandidateCacheKey,
  buildCandidateDetailCacheKey,
  getCachedValue,
  setCachedValue,
} from "@/lib/cache/candidateCache";

import { getCandidateRepository } from "@/repositories/candidateRepositoryFactory";

import type {
  CandidateSearchParams,
  DrugCandidate,
  PaginatedCandidates,
} from "@/types/candidate";

const CACHE_TTL_SECONDS = 60;

function getDatasetName(): "small" | "large" {
  return process.env.CANDIDATE_DATASET === "large"
    ? "large"
    : "small";
}

export async function getCandidates(
  params: CandidateSearchParams = {},
): Promise<PaginatedCandidates> {
  const normalizedParams = {
    dataset: getDatasetName(),
    search: params.search?.trim().toLowerCase() ?? "",
    status: params.status,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    sortBy: params.sortBy ?? "name",
    sortOrder: params.sortOrder ?? "asc",
  };

  const cacheKey = buildCandidateCacheKey(normalizedParams);

  // Return cached results when available.
  const cachedResult =
    await getCachedValue<PaginatedCandidates>(cacheKey);

  if (cachedResult !== null) {
    return cachedResult;
  }

  // Fetch from the configured repository on a cache miss.
  const repository = getCandidateRepository();
  const result = await repository.getCandidates(params);

  // Store the result for subsequent requests.
  await setCachedValue(
    cacheKey,
    result,
    CACHE_TTL_SECONDS,
  );

  return result;
}

export async function getCandidateById(
  id: string,
): Promise<DrugCandidate | null> {
  const cacheKey = buildCandidateDetailCacheKey(
    `${getDatasetName()}:${id}`,
  );

  const cachedCandidate =
    await getCachedValue<DrugCandidate>(cacheKey);

  if (cachedCandidate !== null) {
    return cachedCandidate;
  }

  const repository = getCandidateRepository();
  const candidate = await repository.getCandidateById(id);

  if (candidate) {
    await setCachedValue(
      cacheKey,
      candidate,
      CACHE_TTL_SECONDS,
    );
  }

  return candidate;
}
