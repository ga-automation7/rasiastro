"use client";

import Link from "next/link";

/** Generic error page: never shows internal details to customers. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-3xl font-semibold text-night-900">Something went wrong</h1>
      <p className="mt-4 text-muted">Please try again. If you were paying, do not pay twice - check your order page or email first.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-dark" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn btn-ghost text-night-800">
          Home
        </Link>
      </div>
    </div>
  );
}
