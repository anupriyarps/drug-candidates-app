
import CandidateList from "@/components/CandidateList";
import { getCandidates } from "@/services/candidateDataService";

export default async function Home() {
  const candidates = await getCandidates();

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="text-sm font-medium text-blue-700">
            PHARMACEUTICAL RESEARCH
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Drug Candidate Portal
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Explore drug candidates and their development progress.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <CandidateList initialCandidates={candidates} />
      </div>
    </main>
  );
}
