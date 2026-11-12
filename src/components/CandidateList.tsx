
"use client";

import { useEffect, useState } from "react";
import type { DrugCandidate } from "@/types/candidate";
import { searchCandidates } from "@/services/candidateApiClient";
import CandidateCard from "./CandidateCard";

interface CandidateListProps {
  initialCandidates: DrugCandidate[];
}

export default function CandidateList({
  initialCandidates,
}: CandidateListProps) {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] =
    useState(initialCandidates);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      if (!search.trim()) {
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
  }, [search, initialCandidates]);

  return (
    <section aria-label="Drug candidates">
      <div className="mb-8">
        <label
          htmlFor="candidate-search"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Search by candidate name
        </label>

        <input
          id="candidate-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search drug candidates..."
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">
          Drug candidates
        </h2>

        <span className="text-sm text-slate-500">
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
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No candidates found. Try another search.
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
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
