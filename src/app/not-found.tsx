import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="eyebrow">Page not found</p>
      <h1 className="mt-2 text-3xl font-semibold text-night-900">This page is not in our stars</h1>
      <p className="mt-4 text-muted">Looking for your report? Use the secure link from your email, or request a fresh one.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-dark">
          Home
        </Link>
        <Link href="/recover" className="btn btn-ghost text-night-800">
          Find my report
        </Link>
      </div>
    </div>
  );
}
