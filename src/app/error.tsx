
"use client";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({
  reset,
}: ErrorPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">
        Something went wrong
      </h1>

      <p className="mt-3 text-slate-600">
        We couldn&apos;t load this page. Please try again.
      </p>

      <button
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        Try again
      </button>
    </main>
  );
}
