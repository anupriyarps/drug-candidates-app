
export default function Loading() {
  return (
    <main
      className="mx-auto max-w-6xl px-6 py-10"
      aria-label="Loading candidates"
    >
      <div className="mb-8 h-10 w-64 animate-pulse rounded bg-slate-200" />

      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-5 h-5 w-40 rounded bg-slate-200" />
            <div className="mb-3 h-3 w-full rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </main>
  );
}
