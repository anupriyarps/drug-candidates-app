
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CandidateSearchParams,
  CandidateStatus,
  PaginatedCandidates,
} from "@/types/candidate";
import { searchCandidates } from "@/services/candidateApiClient";
import {
  getCandidateDetailsHref,
  getCandidateListHref,
} from "@/lib/candidateSearchParams";
import CandidateCard from "./CandidateCard";
import { AuthenticationRequiredError } from "@/services/authService";

interface CandidateListProps {
  initialResult: PaginatedCandidates;
  initialParams: CandidateSearchParams;
}

const STATUS_OPTIONS: {
  label: string;
  value: CandidateStatus | "";
}[] = [
  { label: "All statuses", value: "" },
  { label: "In Development", value: "In Development" },
  { label: "Clinical Trial", value: "Clinical Trial" },
  { label: "Approved", value: "Approved" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function CandidateList({
  initialResult,
  initialParams,
}: CandidateListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialParams.search ?? "");
  const [status, setStatus] = useState<CandidateStatus | "">(
    initialParams.status ?? "",
  );
  const [page, setPage] = useState(initialParams.page ?? 1);
  const [pageSize, setPageSize] = useState(initialParams.pageSize ?? 20);
  const [sortBy, setSortBy] = useState<"name" | "status">(
    initialParams.sortBy ?? "name",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    initialParams.sortOrder ?? "asc",
  );

  const [result, setResult] = useState(initialResult);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const searchParams: CandidateSearchParams = {
      search,
      status: status || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder,
    };
    const initialRequestMatches =
      search.trim() === (initialParams.search ?? "") &&
      status === (initialParams.status ?? "") &&
      page === (initialParams.page ?? 1) &&
      pageSize === (initialParams.pageSize ?? 20) &&
      sortBy === (initialParams.sortBy ?? "name") &&
      sortOrder === (initialParams.sortOrder ?? "asc");

    window.history.replaceState(
      null,
      "",
      getCandidateListHref(searchParams),
    );

    const timer = setTimeout(async () => {
      if (initialRequestMatches) {
        setResult(initialResult);
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await searchCandidates(
          searchParams,
          controller.signal,
        );

        setResult(response);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (err instanceof AuthenticationRequiredError) {
          const destination =
            window.location.pathname + window.location.search;
          router.replace(
            `/api/v1/auth/refresh?next=${encodeURIComponent(destination)}`,
          );
          return;
        }

        setError("Unable to load candidates. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    search,
    status,
    page,
    pageSize,
    sortBy,
    sortOrder,
    initialResult,
    initialParams,
    router,
  ]);

  const pagination = result.pagination;

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatus(value as CandidateStatus | "");
    setPage(1);
  }

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  function handleSortChange(value: string) {
    const [field, order] = value.split(":");

    setSortBy(field as "name" | "status");
    setSortOrder(order as "asc" | "desc");
    setPage(1);
  }

  return (
    <section aria-label="Drug candidates">
      <div className="mb-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <label
            htmlFor="candidate-search"
            className="mb-2 block text-sm font-semibold text-[#163a5f]"
          >
            Search candidates
          </label>

          <input
            id="candidate-search"
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search by candidate name..."
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="candidate-status"
            className="mb-2 block text-sm font-semibold text-[#163a5f]"
          >
            Development status
          </label>

          <select
            id="candidate-status"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-[#163a5f]">
            Drug candidates
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Browse and explore the research pipeline
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="candidate-sort" className="sr-only">
            Sort candidates
          </label>
          <select
            id="candidate-sort"
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => handleSortChange(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="name:asc">Name: A–Z</option>
            <option value="name:desc">Name: Z–A</option>
            <option value="status:asc">Status: A–Z</option>
            <option value="status:desc">Status: Z–A</option>
          </select>

          <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
            {pagination.totalRecords} results
          </span>
        </div>
      </div>

      {isLoading && (
        <p role="status" className="mb-4 text-sm text-slate-500">
          Loading candidates...
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {!error && !isLoading && result.data.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No candidates found. Try changing your search or status filter.
        </p>
      )}

      <div
        className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:gap-7"
        aria-busy={isLoading}
      >
        {result.data.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            detailsHref={getCandidateDetailsHref(
              candidate.id,
              {
                search,
                status: status || undefined,
                page,
                pageSize,
                sortBy,
                sortOrder,
              },
            )}
          />
        ))}
      </div>

      {!error && pagination.totalRecords > 0 && (
        <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <label htmlFor="page-size">Rows per page</label>

            <select
              id="page-size"
              value={pageSize}
              onChange={(event) => handlePageSizeChange(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <span>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                page <= 1 ||
                !pagination.hasPreviousPage ||
                isLoading
              }
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={!pagination.hasNextPage || isLoading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
