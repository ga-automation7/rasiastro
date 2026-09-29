import Link from "next/link";

/** Shown instead of any order detail when this browser has no valid access link. */
export function NoAccess() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-3xl font-semibold text-night-900">This link has expired or is not valid here</h1>
      <p className="mt-4 text-muted">
        For your privacy, reports open only from the secure link we email you, on a browser that has used it. You can ask for a fresh link at any time - no account needed.
      </p>
      <Link href="/recover" className="btn btn-dark mt-8">
        Email me a fresh link
      </Link>
    </div>
  );
}
