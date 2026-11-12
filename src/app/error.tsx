
"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({
  error,
  reset,
}: ErrorProps) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <section className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Something went wrong
        </h1>

        <p className="mt-3 text-slate-600">
          We couldn't load this page. Please try again.
        </p>

        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
