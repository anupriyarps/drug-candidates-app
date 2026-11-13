
import CandidateList from "@/components/CandidateList";
import { parseCandidateSearchParams } from "@/lib/candidateSearchParams";
import { getCandidates } from "@/services/candidateDataService";

interface HomePageProps {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}

export default async function HomePage({
  searchParams,
}: HomePageProps) {
  const initialParams = parseCandidateSearchParams(
    await searchParams,
  );
  const initialResult = await getCandidates(initialParams);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-6 py-12 md:px-10">
      <section className="mb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
          Research & Development
        </p>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#163a5f]">
              Drug Candidates
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Explore the research pipeline, development progress and
              scientific information for drug candidates.
            </p>
          </div>

          <p className="text-sm text-slate-500">Research portfolio</p>
        </div>
      </section>

      <CandidateList
        initialResult={initialResult}
        initialParams={initialParams}
      />

      <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Illustrative demonstration data only. Not intended for medical use.
      </footer>
    </main>
  );
}
