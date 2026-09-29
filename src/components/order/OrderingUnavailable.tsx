import Link from "next/link";

/** Shown instead of an order form when that product cannot be ordered here right now. */
export function OrderingUnavailable({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="eyebrow">Ordering</p>
      <h1 className="h-section mt-3 text-ink-950">Not available right now</h1>
      <p className="lede mt-5">{message}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className="btn btn-dark">
          Back to home
        </Link>
        <Link href="/recover" className="btn btn-outline">
          Find a report I bought
        </Link>
      </div>
    </div>
  );
}
