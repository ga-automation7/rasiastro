"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { postJson } from "../order/checkout";

/**
 * Owner actions for a UPI (UroRelay) payment the bank has not confirmed automatically.
 * Confirm only after seeing the credit in your bank account.
 */
export function RelayReviewActions({ paymentId, amountLabel, submittedReference }: { paymentId: string; amountLabel: string; submittedReference: string | null }) {
  const router = useRouter();
  const inputId = useId();
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (action: "confirm" | "reject") => {
    if (action === "reject" && !window.confirm("Mark this payment as NOT received? The customer will be able to pay again.")) return;
    setBusy(true);
    setMessage(null);
    const res = await postJson<{ ok: true }>(`/api/admin/payments/${paymentId}/${action}`, action === "confirm" ? { reference } : undefined);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error.message);
      return;
    }
    setMessage(action === "confirm" ? "Confirmed. The report is being prepared." : "Marked as not received.");
    router.refresh();
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-gold-300 bg-ivory-50 p-3 text-sm">
      <p className="text-ink-900">
        Check your bank account for a UPI credit of <strong>{amountLabel}</strong>
        {submittedReference ? (
          <>
            {" "}
            with reference <span className="font-mono">{submittedReference}</span>
          </>
        ) : null}
        . Confirm only if it is there.
      </p>
      <label htmlFor={inputId} className="field-label">
        Type the UPI reference from your bank to confirm
      </label>
      <div className="flex flex-wrap gap-2">
        <input id={inputId} className="input max-w-56 font-mono" inputMode="numeric" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="12 digits" />
        <button type="button" className="btn btn-dark min-h-10 px-4 py-2" disabled={busy || reference.replace(/\D/g, "").length !== 12} onClick={() => void act("confirm")}>
          Payment received
        </button>
        <button type="button" className="btn btn-ghost min-h-10 px-4 py-2 text-ink-800" disabled={busy} onClick={() => void act("reject")}>
          Not received
        </button>
      </div>
      {message ? (
        <p role="status" className="text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
