"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Email links look like /access#t=TOKEN. The part after "#" is never sent to any
 * server, so the token cannot appear in logs or Referer headers. We read it here,
 * exchange it once for an HttpOnly cookie, remove it from the address bar, and move on.
 */
export function AccessExchange() {
  const [state, setState] = useState<"working" | "failed">("working");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
    history.replaceState(null, "", window.location.pathname);
    const exchange = async () => {
      const res = token ? await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }) : null;
      if (!res || !res.ok) {
        setState("failed");
        return;
      }
      const { orderId } = (await res.json()) as { orderId: string };
      window.location.replace(`/orders/${orderId}`);
    };
    void exchange();
  }, []);

  if (state === "working") {
    return (
      <p role="status" className="text-muted">
        Opening your report securely…
      </p>
    );
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold text-night-900">This link has expired or is not valid</h1>
      <p className="mt-4 text-muted">Links expire for your privacy. You can get a fresh one in a minute - no account needed.</p>
      <Link href="/recover" className="btn btn-dark mt-6">
        Email me a fresh link
      </Link>
    </div>
  );
}
