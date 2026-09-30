import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PaymentBadge } from "@/components/admin/PaymentBadge";
import { RelayReviewActions } from "@/components/admin/RelayReviewActions.client";
import { RetryReportButton } from "@/components/admin/RetryReportButton.client";
import { formatInr } from "@/domain/pricing";
import { currentAdmin, isAdminEnabled } from "@/server/admin/auth";
import { getOrderDetail, getRelayCreditsForOrder } from "@/server/admin/records";
import { getDb } from "@/server/db";
import { PROVIDER_NAMES } from "@/server/payments/config";
import { isUuid } from "@/server/orders/repository";

export const metadata: Metadata = { title: "Order detail", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return `${IST.format(value)} IST`;
  return String(value);
}

function Table({ rows }: { rows: [string, unknown][] }) {
  return (
    <dl className="divide-y divide-ivory-300">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr]">
          <dt className="text-sm font-semibold text-muted">{k}</dt>
          <dd className="whitespace-pre-wrap break-words text-ink-900">{show(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  if (!isAdminEnabled()) notFound();
  if (!(await currentAdmin())) redirect("/admin/login");
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();
  const db = await getDb();
  const detail = await getOrderDetail(db, orderId);
  if (!detail) notFound();
  const relayCredits = await getRelayCreditsForOrder(db, orderId);
  const { order: o, participants, questions, shared, payments, job } = detail;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="text-sm font-semibold text-ink-700 underline">
        ← All orders
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="h-section font-mono text-ink-950">{o.reference}</h1>
        <PaymentBadge status={String(o.payment_status)} />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold text-ink-900">Order</h2>
        <Table
          rows={[
            ["Report type", o.product === "compatibility" ? `Compatibility (${o.compatibility_category})` : "Personal"],
            ["Tradition / language", `${o.tradition} / ${o.report_language}`],
            ["Package", o.package_code],
            ["Amount", formatInr(Number(o.total_amount_paise))],
            ["Mode", o.mode],
            ["Created", o.created_at],
            ["Paid", o.paid_at],
            ["Report status", `${o.generation_status}${o.generation_failure_code ? ` (${o.generation_failure_code})` : ""}`],
            ["Generation started", job?.started_at],
            ["Report ready", o.report_ready_at],
            ["Email status", o.delivery_status],
            ["Email", o.report_email],
            ["Mobile", o.payer_phone],
            ["Consent given", o.consent_processing_at],
            ["18+ confirmed", o.adult_confirmed_at],
            ["Other person's permission", o.third_party_permission_at],
            ["Personal data erased", o.personal_data_deleted_at],
          ]}
        />
        {o.payment_status === "paid" && o.generation_status === "failed" ? <RetryReportButton orderId={String(o.id)} /> : null}
      </section>

      {participants.map((p) => (
        <section key={String(p.participant)} className="card mt-6 p-5">
          <h2 className="text-lg font-semibold text-ink-900">{o.product === "compatibility" ? `Person ${p.participant === 1 ? "A" : "B"}` : "Report subject"}</h2>
          <Table
            rows={[
              ["Name", p.subject_name],
              ["Birth date", p.birth_date],
              ["Birth time", p.time_certainty === "unknown" ? "Unknown" : `${show(p.birth_time)} (${p.time_certainty}${p.time_window_minutes ? `, ± ${p.time_window_minutes} min` : ""})`],
              ["Birthplace", [p.place_name, p.place_region, p.place_country_name].filter(Boolean).join(", ")],
              ["Time zone", `${show(p.timezone_id)} (UTC offset ${Number(p.utc_offset_seconds) / 3600} h)`],
              ["Known Moon sign / nakshatra / pada / ascendant", [p.known_moon_sign, p.known_nakshatra, p.known_pada, p.known_ascendant].map(show).join(" / ")],
              ["Other known details", p.other_known_details],
              ["Notes", p.additional_context],
            ]}
          />
        </section>
      ))}

      {shared ? (
        <section className="card mt-6 p-5">
          <h2 className="text-lg font-semibold text-ink-900">About the connection</h2>
          <Table
            rows={[
              ["How they know each other", shared.how_known],
              ["How long", shared.known_duration],
              ["Hopes to understand", shared.hopes],
              ["Shared circumstances", shared.shared_circumstances],
            ]}
          />
        </section>
      ) : null}

      {questions.length ? (
        <section className="card mt-6 p-5">
          <h2 className="text-lg font-semibold text-ink-900">Questions</h2>
          <Table rows={questions.map((q) => [`Question ${q.position}`, q.question] as [string, unknown])} />
        </section>
      ) : null}

      <section className="card mt-6 p-5">
        <h2 className="text-lg font-semibold text-ink-900">Payment attempts</h2>
        <p className="mt-1 text-sm text-muted">Each attempt is always checked with the provider and environment that created it, even after you switch providers.</p>
        {payments.length ? (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted">
                  {["#", "Provider", "Our reference", "Provider order", "Amount", "Status", "Provider payment", "Created", "Verified", "Last checked"].map((h) => (
                    <th key={h} className="py-1.5 pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={String(p.provider_order_id)} className="border-t border-ivory-300 align-top">
                    <td className="py-1.5 pr-3">{show(p.attempt)}</td>
                    <td className="py-1.5 pr-3">
                      {PROVIDER_NAMES[p.provider as keyof typeof PROVIDER_NAMES] ?? show(p.provider)}
                      <span className="block text-xs text-muted">{show(p.environment)}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{show(p.provider_order_id)}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(p.provider_reference)}</td>
                    <td className="py-1.5 pr-3">{formatInr(Number(p.amount_paise))} {show(p.currency)}</td>
                    <td className="py-1.5 pr-3">
                      {show(p.status)}
                      {p.review_reason ? ` (${p.review_reason})` : ""}
                      <span className="block text-xs text-muted">{show(p.provider_status)}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{show(p.provider_payment_id)}</td>
                    <td className="py-1.5 pr-3">{show(p.created_at)}</td>
                    <td className="py-1.5 pr-3">{show(p.verified_at)}</td>
                    <td className="py-1.5 pr-3">
                      {show(p.last_checked_at)}
                      <span className="block text-xs text-muted">
                        {Number(p.check_count) ? `${show(p.check_count)} checks` : "not checked"}
                        {p.last_check_error ? ` · ${show(p.last_check_error)}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No payment attempt yet: the customer did not reach the payment page.</p>
        )}
        {payments
          .filter((p) => p.provider === "urorelay")
          .map((p) => (
            <div key={`relay-${String(p.id)}`} className="mt-4 text-sm">
              <p className="font-semibold text-ink-900">UPI attempt {show(p.attempt)} (UroRelay)</p>
              <Table
                rows={[
                  ["UPI reference given by customer (unverified)", p.submitted_reference],
                  ["Given at", p.reference_submitted_at],
                  ["Confirmed or rejected by", p.confirmed_by],
                ]}
              />
              {o.payment_status !== "paid" && ["created", "pending", "needs_review"].includes(String(p.status)) ? (
                <RelayReviewActions paymentId={String(p.id)} amountLabel={formatInr(Number(p.amount_paise))} submittedReference={(p.submitted_reference as string | null) ?? null} />
              ) : null}
            </div>
          ))}
        {relayCredits.length ? (
          <div className="mt-4 text-sm">
            <p className="font-semibold text-ink-900">Bank credits reported by the Companion app</p>
            <ul className="mt-1 list-disc pl-5">
              {relayCredits.map((c, i) => (
                <li key={i}>
                  {c.amount_paise === null ? "?" : formatInr(c.amount_paise)} · reference <span className="font-mono">{c.reference_number ?? "?"}</span> · UroPay order{" "}
                  <span className="font-mono">{c.uropay_order_id ?? "not matched"}</span> · {c.environment} · {show(c.received_at)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
