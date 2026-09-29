"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** DEMO ONLY: stands in for the payment provider's hosted checkout page. */
export function DemoCheckout({ providerOrderId, amountLabel, orderId }: { providerOrderId: string; amountLabel: string; orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const simulate = async (outcome: "success" | "failure" | "cancel") => {
    setBusy(outcome);
    const res = await fetch(`/api/demo/payments/${encodeURIComponent(providerOrderId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    if (!res.ok) {
      setBusy(null);
      setError("The demo payment could not be recorded.");
      return;
    }
    router.push(`/orders/${orderId}?payment=returned`);
  };
  return (
    <div className="space-y-4">
      <p className="text-4xl font-semibold text-night-900">{amountLabel}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void simulate("success")}>
          {busy === "success" ? "Processing…" : "Simulate successful payment"}
        </button>
        <button type="button" className="btn btn-ghost text-night-800" disabled={busy !== null} onClick={() => void simulate("failure")}>
          Simulate failed payment
        </button>
        <button type="button" className="btn btn-ghost text-night-800" disabled={busy !== null} onClick={() => void simulate("cancel")}>
          Cancel
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
