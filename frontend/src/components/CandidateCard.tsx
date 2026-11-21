
import Link from "next/link";
import type { DrugCandidate } from "@/types/candidate";

interface CandidateCardProps {
  candidate: DrugCandidate;
  detailsHref?: string;
}

const statusStyles = {
  "In Development": "bg-blue-50 text-blue-700",
  "Clinical Trial": "bg-amber-50 text-amber-700",
  Approved: "bg-green-50 text-green-700",
};

export default function CandidateCard({
  candidate,
  detailsHref,
}: CandidateCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {candidate.name}
        </h2>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[candidate.status]}`}
        >
          {candidate.status}
        </span>
      </div>

      <p className="mb-5 text-sm leading-6 text-slate-600">
        {candidate.description}
      </p>

      <Link
        href={detailsHref ?? `/candidates/${candidate.id}`}
        className="inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        View details
        <span aria-hidden="true" className="ml-2">→</span>
      </Link>
    </article>
  );
}
