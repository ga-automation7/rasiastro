"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { goToCheckout, type CheckoutStart } from "@/components/order/checkout";
import type { OrderStatusView, StageState } from "@/domain/order-status";
import { UpiPayment } from "./UpiPayment.client";

/**
 * Live order status. Shows only states recorded on the server (no fake progress).
 * Polls while something is still happening; stops once the order settles.
 */
/** Friendlier wording for each real server stage (the server label stays the fallback). */
const STAGE_COPY: Record<string, { title?: string; pairTitle?: string; body: string }> = {
  payment: { body: "Verified with our payment partner." },
  chart: { title: "Calculating your chart", pairTitle: "Calculating both charts", body: "Planetary positions for the date, time and place of birth." },
  interpretation: { title: "Writing your interpretation", body: "Reading the chart in your chosen tradition and language." },
  pdf: { title: "Creating your report and PDF", body: "Laying out your web report and your PDF." },
  ready: { body: "Open it here, and look out for our email." },
};

function StageIcon({ state }: { state: StageState }) {
  if (state === "done")
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-ivory-50">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      </span>
    );
  if (state === "active")
    return (
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-gold-400 bg-ivory-50">
        <span className="stage-orbit absolute inset-[-3px] rounded-full">
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold-500" />
        </span>
        <span className="h-2 w-2 rounded-full bg-gold-500" />
      </span>
    );
  if (state === "failed") return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger font-bold text-white">!</span>;
  return <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ivory-300 bg-white"><span className="h-1.5 w-1.5 rounded-full bg-ivory-300" /></span>;
}

/** A small orbiting chart while the report is prepared (CSS only; still under reduced motion). */
function Preparing({ typicalMinutes }: { typicalMinutes: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-(--color-midnight) p-6 text-ivory-100 sm:p-7">
      <div className="flex items-center gap-5">
        <svg aria-hidden="true" viewBox="0 0 80 80" className="h-16 w-16 shrink-0 text-gold-300" fill="none" stroke="currentColor">
          <circle cx="40" cy="40" r="36" strokeOpacity="0.35" strokeWidth="0.8" />
          <circle cx="40" cy="40" r="24" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="1.5 3" />
          <rect x="30" y="30" width="20" height="20" strokeOpacity="0.7" strokeWidth="0.8" />
          <path d="M30 36.7h20M30 43.3h20M36.7 30v20M43.3 30v20" strokeOpacity="0.45" strokeWidth="0.6" />
          <g className="stage-orbit" style={{ transformOrigin: "40px 40px" }}>
            <circle cx="40" cy="4" r="2.4" fill="currentColor" stroke="none" />
          </g>
          <g className="stage-orbit-slow" style={{ transformOrigin: "40px 40px" }}>
            <circle cx="64" cy="40" r="1.6" fill="currentColor" stroke="none" />
          </g>
        </svg>
        <div>
          <p className="font-display text-xl text-ivory-50">Your report is being prepared.</p>
          <p className="mt-1 text-sm leading-relaxed text-ivory-300">
            Most reports are ready in about {typicalMinutes} minutes. You can close this page: we will email your private link when it is ready.
          </p>
        </div>
      </div>
    </div>
  );
}

function settled(v: OrderStatusView): boolean {
  // A UPI payment being confirmed by hand can still turn into a paid order: keep watching.
  if (v.paymentStage === "manual_review" && v.paymentStatus !== "paid") return false;
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
    const body = (await res.json().catch(() => ({}))) as Partial<CheckoutStart> & { error?: { message: string } };
    if (!res.ok || !body.provider) {
      setBusy(false);
      setMessage(body.error?.message ?? "Could not open the payment page. Please try again.");
      // The server may have found the payment while checking; show the latest state.
      void refresh(false);
      return;
    }
    const started = await goToCheckout(body as CheckoutStart, (href) => {
      if (href.startsWith(`/orders/${view.orderId}`)) {
        setBusy(false);
        void refresh(true);
      } else router.push(href);
    });
    if (!started) {
      setBusy(false);
      setMessage("Could not open the payment page. Please try again.");
    }
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

      {view.paymentStatus === "paid" && !view.reportReady && view.generationStatus !== "failed" ? <Preparing typicalMinutes={typicalMinutes} /> : null}

      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="font-display text-2xl text-ink-900">
          Progress
        </h2>
        <ol className="relative mt-5" aria-live="polite">
          {view.stages.map((s, i) => {
            const c = STAGE_COPY[s.key];
            const title = (view.product === "compatibility" ? c?.pairTitle : undefined) ?? c?.title ?? s.label;
            const last = i === view.stages.length - 1;
            return (
              <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                {!last ? <span aria-hidden="true" className={`absolute left-4 top-9 h-[calc(100%-2.5rem)] w-px -translate-x-1/2 ${s.state === "done" ? "bg-teal-700/50" : "bg-ivory-300"}`} /> : null}
                <span aria-hidden="true" className="relative z-10 shrink-0">
                  <StageIcon state={s.state} />
                </span>
                <div className="pt-1">
                  <p className={s.state === "pending" ? "text-muted" : "font-semibold text-ink-900"}>
                    {title}
                    <span className="sr-only">: {s.state}</span>
                  </p>
                  {c && s.state !== "pending" ? <p className="mt-0.5 text-sm text-muted">{c.body}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {view.upi && view.paymentStage !== "manual_review" ? <UpiPayment view={view} onUpdate={setView} /> : null}

      {!view.upi && (p === "awaiting_payment" || p === "failed" || p === "cancelled" || p === "expired") ? (
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

      {view.paymentStage === "manual_review" ? (
        <div className="card p-5 text-sm">
          <p className="font-semibold text-ink-900">We are confirming your UPI payment by hand.</p>
          <p className="mt-1 text-muted">
            Our bank has not confirmed it automatically yet, so we are checking it ourselves. Please do not pay again. This page updates by itself once it is confirmed, and you can also
            close it: we will email you when your report is ready. Questions? Write to{" "}
            <a className="underline" href={`mailto:${view.supportEmail}?subject=Order ${view.reference}`}>
              {view.supportEmail}
            </a>{" "}
            with reference {view.reference}.
          </p>
        </div>
      ) : null}

      {p === "pending" && !view.upi && view.paymentStage !== "manual_review" ? (
        <div className="card p-5 text-sm">
          <p className="font-semibold text-ink-900">Your bank is still confirming the payment.</p>
          <p className="mt-1 text-muted">This page checks automatically. You can also close it; we will email you when your report is ready.</p>
        </div>
      ) : null}

      {p === "needs_review" && view.paymentStage !== "manual_review" ? (
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

    </div>
  );
}
