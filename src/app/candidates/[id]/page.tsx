
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCandidateById } from "@/services/candidateDataService";

interface CandidateDetailsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: CandidateDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const candidate = await getCandidateById(id);

  return {
    title: candidate?.name ?? "Candidate Not Found",
    description: candidate?.description,
  };
}

const statusStyles = {
  "In Development": "bg-blue-50 text-blue-800 ring-blue-200",
  "Clinical Trial": "bg-amber-50 text-amber-800 ring-amber-200",
  Approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export default async function CandidateDetailsPage({
  params,
}: CandidateDetailsPageProps) {
  const { id } = await params;
  const candidate = await getCandidateById(id);

  if (!candidate) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 sm:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#163a5f] text-lg font-bold text-white">
            D
          </div>

          <div>
            <p className="font-bold text-[#163a5f]">
              Drug Candidate Portal
            </p>
            <p className="text-xs text-slate-500">
              Pharmaceutical Research Platform
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563a6] hover:text-[#102a43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          <span aria-hidden="true">←</span>
          Back to candidates
        </Link>

        <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[#f8fafc] px-6 py-8 sm:px-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3178b9]">
              Research Candidate Profile
            </p>

            <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#102a43] sm:text-4xl">
                  {candidate.name}
                </h1>

                <p className="mt-3 text-sm text-slate-600">
                  {candidate.description}
                </p>
              </div>

              <span
                className={`inline-flex w-fit shrink-0 rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-inset ${statusStyles[candidate.status]}`}
              >
                {candidate.status}
              </span>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-2">
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563a6]">
                  <span aria-hidden="true">01</span>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Scientific information
                  </p>
                  <h2 className="text-lg font-bold text-[#163a5f]">
                    Mechanism of Action
                  </h2>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm leading-7 text-slate-600">
                  {candidate.mechanismOfAction}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <span aria-hidden="true">02</span>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Safety information
                  </p>
                  <h2 className="text-lg font-bold text-[#163a5f]">
                    Potential Side Effects
                  </h2>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <ul className="space-y-3">
                  {candidate.sideEffects.map((effect) => (
                    <li
                      key={effect}
                      className="flex items-start gap-3 text-sm text-slate-600"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500"
                      />
                      {effect}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 sm:px-9">
            <p className="text-xs leading-5 text-slate-500">
              Illustrative demonstration data only. Not intended
              for clinical or medical decision-making.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
