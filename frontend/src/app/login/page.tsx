"use client";

import { Suspense, FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  initializeSession,
  login,
} from "@/services/authService";

function getSafeDestination(value: string | null): string {
  if (
    value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value;
  }
  return "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await login(email, password);
      if (!response.ok) {
        const contentType = response.headers?.get("content-type");
        let message = "Unable to sign in. Check your email and password.";
        if (response.status === 422) {
          message = "Enter a valid email address and password.";
        } else if (response.status === 429) {
          message = "Too many sign-in attempts. Please try again later.";
        } else if (response.status === 0) {
          message = "Unable to reach the sign-in service. Please try again.";
        }
        if (!contentType) {
          message = "Unable to sign in. Please try again.";
        }
        setError(message);
        return;
      }

      await initializeSession();
      const destination = getSafeDestination(
        searchParams.get("next"),
      );
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-[#163a5f]">Sign in</h1>
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-[#163a5f]">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={isLoading}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-semibold text-[#163a5f]">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              maxLength={128}
              value={password}
              disabled={isLoading}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 w-full rounded-lg bg-[#163a5f] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
          <p className="text-sm text-slate-600">Loading...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
