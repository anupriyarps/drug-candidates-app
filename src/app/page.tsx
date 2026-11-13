
import CandidateList from "@/components/CandidateList";
import { getCandidates } from "@/services/candidateDataService";

export default async function Home() {
  const candidates = await getCandidates();

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      {/* Application header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#163a5f] text-lg font-bold text-white">
              D
            </div>

            <div>
              <p className="text-base font-bold tracking-tight text-[#163a5f]">
                Drug Candidate Portal
              </p>
              <p className="text-xs text-slate-500">
                Pharmaceutical Research Platform
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-600">
              Research Workspace
            </span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <section className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3178b9]">
            Research & Development
          </p>

          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#102a43] sm:text-4xl">
                Drug Candidates
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Explore the research pipeline, development progress
                and scientific information for drug candidates.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Research portfolio
            </div>
          </div>
        </section>

        <CandidateList initialCandidates={candidates} />
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <p className="text-xs text-slate-500">
            Drug Candidate Portal · Illustrative demonstration data only
          </p>
        </div>
      </footer>
    </main>
  );
}
