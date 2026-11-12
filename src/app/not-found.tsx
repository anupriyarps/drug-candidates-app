
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-blue-700">
          ERROR 404
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Candidate not found
        </h1>

        <p className="mt-3 text-slate-600">
          The requested drug candidate doesn't exist or is no longer available.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Back to candidates
        </Link>
      </section>
    </main>
  );
}
