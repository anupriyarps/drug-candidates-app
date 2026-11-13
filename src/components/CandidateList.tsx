
"use client";

import { useEffect, useState } from "react";
import type {
  CandidateStatus,
  DrugCandidate,
} from "@/types/candidate";
import { searchCandidates } from "@/services/candidateApiClient";
import CandidateCard from "./CandidateCard";

interface CandidateListProps {
  initialCandidates: DrugCandidate[];
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

export default function CandidateList({
  initialCandidates,
}: CandidateListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CandidateStatus | "">("");
  const [candidates, setCandidates] = useState(initialCandidates);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      if (!search.trim() && !status) {
        setCandidates(initialCandidates);
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const results = await searchCandidates(
          search,
          status || undefined,
          controller.signal,
        );

        setCandidates(results);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
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
  }, [search, status, initialCandidates]);

  return (
    <section aria-label="Drug candidates">
      <div className="mb-8 grid gap-4 md:grid-cols-[1fr_260px]">
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
            onChange={(event) => setSearch(event.target.value)}
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
            onChange={(event) =>
              setStatus(event.target.value as CandidateStatus | "")
            }
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

      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#163a5f]">
            Drug candidates
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Browse and explore the research pipeline
          </p>
        </div>

        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
          {candidates.length} results
        </span>
      </div>

      {isLoading && (
        <p role="status" className="mb-4 text-sm text-slate-500">
          Searching candidates...
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {!error && !isLoading && candidates.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No candidates found. Try changing your search or status filter.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:gap-7">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
          />
        ))}
      </div>
    </section>
  );
}
