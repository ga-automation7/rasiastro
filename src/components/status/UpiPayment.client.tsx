"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { OrderStatusView } from "@/domain/order-status";

/**
 * UPI payment on our own page (UroRelay). The customer pays the exact amount with any
 * UPI app, then gives us the UPI reference number so the payment can be matched. The
 * number alone never completes the order: our bank's confirmation does.
 */
export function UpiPayment({ view, onUpdate }: { view: OrderStatusView; onUpdate: (next: OrderStatusView) => void }) {
  const inputId = useId();
  const hintId = useId();
  const upi = view.upi!;
  const [reference, setReference] = useState("");
  const [editing, setEditing] = useState(!upi.referenceSubmitted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch(`/api/orders/${view.orderId}/payment-reference`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference }),
      });
    } catch {
      setBusy(false);
      setError("We couldn't reach Rasi Astro. Please check your connection and try again.");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as OrderStatusView & { error?: { message: string } };
    setBusy(false);
    if (!res.ok) {
      setError(body.error?.message ?? "Something went wrong on our side. Please try again.");
      return;
    }
    setReference("");
    setEditing(false);
    onUpdate(body);
  };

  return (
    <div className="card space-y-5 p-5">
      <div>
        <p className="font-semibold text-ink-900">Pay {view.totalLabel} by UPI</p>
        <p className="mt-1 text-sm text-muted">Scan the code with any UPI app. The amount is already filled in, so please do not change it.</p>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <Image
          src={upi.qrCode}
          alt={`UPI QR code to pay ${view.totalLabel} for order ${view.reference}`}
          width={224}
          height={224}
          unoptimized
          className="h-56 w-56 shrink-0 rounded-xl border border-ivory-300 bg-white p-2"
        />
        <div className="space-y-3 text-sm">
          <a href={upi.upiString} className="btn btn-primary w-full sm:hidden">
            Open my UPI app
          </a>
          <p className="text-muted sm:hidden">On some phones this button does not open a UPI app. If nothing happens, scan the code from another device instead.</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-ink-800">
            <li>Pay exactly {view.totalLabel}.</li>
            <li>In your UPI app, open the payment and find its 12 digit UPI reference number. Apps call it UTR, UPI Ref No or UPI Transaction ID.</li>
            <li>Enter that number below so we can match your payment.</li>
          </ol>
        </div>
      </div>

      {editing ? (
        <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
          <label htmlFor={inputId} className="field-label">
            UPI reference number
          </label>
          <input
            id={inputId}
            className="input font-mono tracking-wider"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            placeholder="12 digits"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-describedby={hintId}
            aria-invalid={error ? true : undefined}
            required
          />
          <p id={hintId} className="text-xs text-muted">
            Entering a number does not complete the payment by itself. We start your report only after our bank confirms the money has arrived.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-dark" disabled={busy || reference.replace(/\D/g, "").length < 12}>
            {busy ? "Sending…" : "I have paid: check my payment"}
          </button>
        </form>
      ) : (
        <div className="rounded-xl bg-ivory-100 p-4 text-sm">
          <p className="font-semibold text-ink-900">We have your UPI reference {upi.referenceHint ?? ""}.</p>
          <p className="mt-1 text-muted">We are waiting for our bank to confirm the payment. This usually takes a minute or two, and this page updates by itself.</p>
          <button type="button" className="mt-2 text-sm font-semibold text-ink-700 underline" onClick={() => setEditing(true)}>
            Entered the wrong number? Correct it
          </button>
        </div>
      )}
    </div>
  );
}
