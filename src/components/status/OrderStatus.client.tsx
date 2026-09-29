"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderStatusView, StageState } from "@/domain/order-status";

/**
 * Live order status. Shows only states recorded on the server (no fake progress).
 * Polls while something is still happening; stops once the order settles.
 */
const ICON: Record<StageState, string> = { done: "✓", active: "…", pending: "", failed: "!", skipped: "–" };

function settled(v: OrderStatusView): boolean {
  if (["failed", "cancelled", "expired", "needs_review"].includes(v.paymentStatus)) return true;
  if (v.generationStatus === "failed") return true;
  return v.generationStatus === "ready" && (v.deliveryStatus === "sent" || v.deliveryStatus === "failed");
}

export function OrderStatus({ initial, paymentReturned, startFailed, typicalMinutes }: { initial: OrderStatusView; paymentReturned: boolean; startFailed: boolean; typicalMinutes: number }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(startFailed ? "We could not open the payment page. Please try again." : null);
  const polls = useRef(0);

  const refresh = useCallback(async (askProvider: boolean) => {
    const res = await fetch(`/api/orders/${view.orderId}/${askProvider ? "refresh-payment" : "status"}`, {
      method: askProvider ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
    if (res.ok) setView((await res.json()) as OrderStatusView);
  }, [view.orderId]);

  useEffect(() => {
    // Coming back from checkout: ask the payment provider directly instead of trusting the redirect.
    const checkWithProvider = async () => {
      if (paymentReturned || initial.paymentStatus === "pending") await refresh(true);
    };
    void checkWithProvider();
  }, [paymentReturned, initial.paymentStatus, refresh]);

  useEffect(() => {
    if (settled(view) || view.paymentStatus === "awaiting_payment") return;
    const delay = polls.current < 30 ? 4000 : 12000;
    const timer = setTimeout(() => {
      polls.current += 1;
      // While payment is pending, periodically re-check with the provider as well.
      void refresh(view.paymentStatus === "pending" && polls.current % 3 === 0);
    }, delay);
    return () => clearTimeout(timer);
  }, [view, refresh]);

  const retryPayment = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/orders/${view.orderId}/checkout`, { method: "POST", headers: { "content-type": "application/json" } });
    const body = (await res.json().catch(() => ({}))) as { provider?: string; paymentSessionId?: string | null; redirectUrl?: string | null; environment?: string; error?: { message: string } };
    if (!res.ok) {
      setBusy(false);
      setMessage(body.error?.message ?? "Could not open the payment page. Please try again.");
      return;
    }
    if (body.provider === "cashfree" && body.paymentSessionId) {
      const { load } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await load({ mode: body.environment === "production" ? "production" : "sandbox" });
      await cashfree?.checkout({ paymentSessionId: body.paymentSessionId, redirectTarget: "_self" });
      return;
    }
    if (body.redirectUrl) router.push(body.redirectUrl);
  };

  const p = view.paymentStatus;
  return (
    <div className="space-y-8">
      <div className="card p-5">
        <dl className="grid gap-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Order reference</dt>
            <dd className="font-mono text-lg font-semibold text-ink-900">{view.reference}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Report</dt>
            <dd>
              {view.product === "compatibility" ? `Compatibility · ${view.categoryLabel ?? ""} · ` : "Personal report · "}
              {view.traditionTitle} · {view.languageName}
              {view.includesQuestions ? " · with three questions" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Total</dt>
            <dd>{view.totalLabel}</dd>
          </div>
        </dl>
      </div>

      {message ? (
        <p role="alert" className="rounded-xl border border-danger/30 bg-white p-4 text-sm">
          {message}
        </p>
      ) : null}

      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-2xl font-semibold text-ink-900">
          Progress
        </h2>
        <ol className="mt-4 space-y-3" aria-live="polite">
          {view.stages.map((s) => (
            <li key={s.key} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  s.state === "done" ? "bg-success text-white" : s.state === "failed" ? "bg-danger text-white" : s.state === "active" ? "animate-pulse bg-gold-300 text-ink-900" : "border border-ivory-300 bg-white"
                }`}
              >
                {ICON[s.state]}
              </span>
              <span className={s.state === "pending" ? "text-muted" : "font-semibold text-ink-900"}>
                {s.label}
                <span className="sr-only">: {s.state}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {p === "awaiting_payment" || p === "failed" || p === "cancelled" || p === "expired" ? (
        <div className="card space-y-3 p-5">
          <p className="font-semibold text-ink-900">
            {p === "awaiting_payment" ? "Payment not completed yet." : p === "failed" ? "The payment did not go through." : p === "cancelled" ? "The payment was cancelled." : "The payment session expired."}
          </p>
          <p className="text-sm text-muted">If money left your account, do not pay again: tap “Check payment status” first. Banks sometimes take a few minutes to confirm.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={() => void retryPayment()} disabled={busy}>
              {busy ? "Opening…" : `Pay ${view.totalLabel} securely`}
            </button>
            <button type="button" className="btn btn-ghost text-ink-800" onClick={() => void refresh(true)}>
              Check payment status
            </button>
            <Link href={`${view.product === "compatibility" ? "/compatibility" : "/start"}?from=${view.orderId}`} className="btn btn-ghost text-ink-800">
              Change details (new order)
            </Link>
          </div>
        </div>
      ) : null}

      {p === "pending" ? (
        <div className="card p-5 text-sm">
          <p className="font-semibold text-ink-900">Your bank is still confirming the payment.</p>
          <p className="mt-1 text-muted">This page checks automatically. You can also close it; we will email you when your report is ready.</p>
        </div>
      ) : null}

      {p === "needs_review" ? (
        <div className="card p-5 text-sm">
          <p className="font-semibold text-ink-900">We are checking this payment manually.</p>
          <p className="mt-1 text-muted">
            Something did not match our records, so we paused before preparing the report. Please do not pay again. Write to{" "}
            <a className="underline" href={`mailto:${view.supportEmail}?subject=Order ${view.reference}`}>
              {view.supportEmail}
            </a>{" "}
            with reference {view.reference} and we will resolve it (report or refund).
          </p>
        </div>
      ) : null}

      {view.generationStatus === "failed" ? (
        <div className="card border-danger/40 p-5 text-sm">
          <p className="font-semibold text-ink-900">We could not finish your report automatically.</p>
          <p className="mt-1 text-muted">
            Your payment is safe and a retry never costs anything extra. We have been alerted and will either complete your report or refund you. You can also write to{" "}
            <a className="underline" href={`mailto:${view.supportEmail}?subject=Order ${view.reference}`}>
              {view.supportEmail}
            </a>{" "}
            quoting reference <strong>{view.reference}</strong>.
          </p>
        </div>
      ) : null}

      {view.reportReady ? (
        <div className="rounded-2xl bg-ink-900 p-6 text-ivory-100">
          <p className="font-display text-2xl font-semibold text-ivory-50">Your report is ready.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/orders/${view.orderId}/report`} className="btn btn-primary">
              Read my report
            </Link>
            {view.pdfReady ? (
              <a href={`/api/orders/${view.orderId}/pdf`} className="btn btn-ghost text-ivory-50">
                Download PDF
              </a>
            ) : null}
          </div>
          {view.deliveryStatus === "sending" || view.deliveryStatus === "not_sent" ? <p className="mt-4 text-sm text-ivory-300">Sending your private link by email…</p> : null}
          {view.deliveryStatus === "failed" ? (
            <p className="mt-4 text-sm text-gold-200">We could not email your link, but your report is available here. Bookmark this page or use “Find my report” later.</p>
          ) : null}
          {view.deliveryStatus === "sent" ? <p className="mt-4 text-sm text-ivory-300">We have also emailed you a private link. Please keep it to yourself; anyone with it can open the report.</p> : null}
        </div>
      ) : null}

      {view.paymentStatus === "paid" && !view.reportReady && view.generationStatus !== "failed" ? (
        <p className="text-sm text-muted">Reports usually take up to about {typicalMinutes} minutes. You can close this page; your email link will bring you back.</p>
      ) : null}
    </div>
  );
}
