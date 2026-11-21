import type {
  CandidateSearchParams,
  CandidateStatus,
} from "@/types/candidate";

type SearchParamsRecord = Record<
  string,
  string | string[] | undefined
>;

const VALID_STATUSES: CandidateStatus[] = [
  "In Development",
  "Clinical Trial",
  "Approved",
];

function getFirstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

export function parseCandidateSearchParams(
  searchParams: SearchParamsRecord,
): CandidateSearchParams {
  const search = getFirstValue(searchParams.search)?.trim();
  const statusValue = getFirstValue(searchParams.status);
  const status = VALID_STATUSES.find(
    (candidateStatus) => candidateStatus === statusValue,
  );
  const sortByValue = getFirstValue(searchParams.sortBy);
  const sortOrderValue = getFirstValue(searchParams.sortOrder);

  return {
    search: search || undefined,
    status,
    page: parsePositiveInteger(
      getFirstValue(searchParams.page),
      1,
    ),
    pageSize: Math.min(
      100,
      parsePositiveInteger(getFirstValue(searchParams.pageSize), 20),
    ),
    sortBy: sortByValue === "status" ? "status" : "name",
    sortOrder: sortOrderValue === "desc" ? "desc" : "asc",
  };
}

export function serializeCandidateSearchParams(
  params: CandidateSearchParams,
): string {
  const searchParams = new URLSearchParams();
  const search = params.search?.trim();

  if (search) {
    searchParams.set("search", search);
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("pageSize", String(params.pageSize ?? 20));
  searchParams.set("sortBy", params.sortBy ?? "name");
  searchParams.set("sortOrder", params.sortOrder ?? "asc");

  return searchParams.toString();
}

export function serializeFastApiCandidateSearchParams(
  params: CandidateSearchParams,
): string {
  const searchParams = new URLSearchParams();
  const search = params.search?.trim();

  if (search) {
    searchParams.set("search", search);
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("page_size", String(params.pageSize ?? 20));
  searchParams.set("sort_by", params.sortBy ?? "name");
  searchParams.set("sort_order", params.sortOrder ?? "asc");

  return searchParams.toString();
}

export function getCandidateDetailsHref(
  id: string,
  params: CandidateSearchParams,
): string {
  const query = serializeCandidateSearchParams(params);
  return `/candidates/${encodeURIComponent(id)}?${query}`;
}

export function getCandidateListHref(
  params: CandidateSearchParams,
): string {
  return `/?${serializeCandidateSearchParams(params)}`;
}
