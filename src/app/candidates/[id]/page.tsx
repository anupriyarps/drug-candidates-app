
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

  if (!candidate) {
    return {
      title: "Candidate Not Found",
    };
  }

  return {
    title: candidate.name,
    description: candidate.description,
  };
}

export default async function CandidateDetailsPage({
  params,
}: CandidateDetailsPageProps) {
  const { id } = await params;

  const candidate = await getCandidateById(id);

  if (!candidate) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Link
            href="/"
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            ← Back to candidates
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              {candidate.status}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            {candidate.name}
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            {candidate.description}
          </p>

          <section className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Mechanism of Action
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              {candidate.mechanismOfAction}
            </p>
          </section>

          <section className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Potential Side Effects
            </h2>

            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
              {candidate.sideEffects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </section>

          <p className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
            Illustrative demonstration data only.
          </p>
        </article>
      </div>
    </main>
  );
}
