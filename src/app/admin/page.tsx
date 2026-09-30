import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminSignOut } from "@/components/admin/AdminLogin.client";
import { PaymentBadge } from "@/components/admin/PaymentBadge";
import { getCategory, isCompatibilityCategory } from "@/config/compatibility";
import { getLanguage, type LanguageCode } from "@/config/languages";
import { formatInr } from "@/domain/pricing";
import { currentAdmin, isAdminEnabled } from "@/server/admin/auth";
import { filtersToQuery, parseFilters } from "@/server/admin/filters";
import { listOrders, orderSummary } from "@/server/admin/records";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { PROVIDER_NAMES, activeProviderId, deploymentPaymentEnvironment } from "@/server/payments/config";

export const metadata: Metadata = { title: "Orders dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isAdminEnabled()) notFound();
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const filters = parseFilters(params);
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const db = await getDb();
  const [{ rows, total }, summary] = await Promise.all([listOrders(db, filters, page, PAGE_SIZE), orderSummary(db, filters)]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = filtersToQuery(filters);
  const withPage = (p: number) => `/admin?${[query, `page=${p}`].filter(Boolean).join("&")}`;
  const exportHref = (format: "xlsx" | "csv") => `/api/admin/export?${[query, `format=${format}`].filter(Boolean).join("&")}`;

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">
            Owner dashboard · {getEnv().APP_MODE} · new checkouts: {(() => {
              const id = activeProviderId(getEnv());
              return id ? `${PROVIDER_NAMES[id]} (${deploymentPaymentEnvironment(getEnv()) ?? "PAYMENT_ENV not set"})` : "no provider set";
            })()}
          </p>
          <h1 className="h-section mt-1 text-ink-950">Orders</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>Signed in as {admin}</span>
          <AdminSignOut />
        </div>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Matching orders", String(summary.orders)],
          ["Paid", String(summary.paid)],
          ["Unpaid", String(summary.unpaid)],
          ["Paid revenue", formatInr(summary.revenue_paise)],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>

      <form method="get" action="/admin" className="card mt-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 xl:items-end">
        <label className="text-sm">
          <span className="field-label">From</span>
          <input className="input" type="date" name="from" defaultValue={filters.from ?? ""} />
        </label>
        <label className="text-sm">
          <span className="field-label">To</span>
          <input className="input" type="date" name="to" defaultValue={filters.to ?? ""} />
        </label>
        <label className="text-sm">
          <span className="field-label">Payment</span>
          <select className="input" name="payment" defaultValue={filters.payment}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
            <option value="review">Needs review</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="field-label">Report type</span>
          <select className="input" name="product" defaultValue={filters.product}>
            <option value="all">All</option>
            <option value="personal">Personal</option>
            <option value="compatibility">Compatibility</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="field-label">Provider</span>
          <select className="input" name="provider" defaultValue={filters.provider}>
            <option value="all">All</option>
            <option value="uropay">UroPay</option>
            <option value="cashfree">Cashfree</option>
            <option value="demo">Demo</option>
            <option value="none">Checkout never opened</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="field-label">Report status</span>
          <select className="input" name="report" defaultValue={filters.report}>
            <option value="all">All</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="ready">Ready</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="field-label">Search</span>
          <input className="input" type="search" name="q" placeholder="RA-…, email or name" defaultValue={filters.q ?? ""} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-dark flex-1">
            Apply
          </button>
          <Link href="/admin" className="btn btn-ghost text-ink-800">
            Reset
          </Link>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total} matching order{total === 1 ? "" : "s"}. Downloads include every matching record, not just this page. Unpaid orders are deleted automatically after{" "}
          {getEnv().RETENTION_UNPAID_DAYS} days.
        </p>
        <div className="flex gap-2">
          <a href={exportHref("xlsx")} className="btn btn-primary min-h-10 px-4 py-2 text-sm">
            Download Excel
          </a>
          <a href={exportHref("csv")} className="btn btn-outline min-h-10 px-4 py-2 text-sm">
            Download CSV
          </a>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-ivory-300 bg-ivory-50">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ivory-300 text-left text-xs uppercase tracking-wide text-muted">
              {["Created (IST)", "Reference", "Report", "Names", "Language", "Amount", "Payment", "Provider", "Report status", "Email status", "Email"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted">
                  No orders match these filters.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ivory-200 align-top hover:bg-ivory-100">
                <td className="whitespace-nowrap px-3 py-2.5">{IST.format(r.created_at)}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/admin/orders/${r.id}`} className="font-mono font-semibold text-ink-800 underline underline-offset-2">
                    {r.reference}
                  </Link>
                  {r.mode !== "live" ? <span className="ml-1 text-xs text-muted">({r.mode})</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  {r.product === "compatibility" ? `Compatibility · ${isCompatibilityCategory(r.compatibility_category) ? getCategory(r.compatibility_category).label : ""}` : "Personal"}
                  <span className="block text-xs text-muted">{r.tradition === "indian" ? "Indian" : "Western"}{r.package_code === "report_with_questions" ? " · 3 questions" : ""}</span>
                </td>
                <td className="px-3 py-2.5">{r.personal_data_deleted_at ? <span className="text-muted">(erased)</span> : r.names}</td>
                <td className="px-3 py-2.5">{getLanguage(r.report_language as LanguageCode).englishName}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{formatInr(r.total_amount_paise)}</td>
                <td className="px-3 py-2.5">
                  <PaymentBadge status={r.payment_status} />
                </td>
                <td className="px-3 py-2.5">
                  {r.pay_provider ? (
                    <>
                      {PROVIDER_NAMES[r.pay_provider as keyof typeof PROVIDER_NAMES] ?? r.pay_provider}
                      <span className="block text-xs text-muted">
                        {r.pay_environment}
                        {r.pay_attempts > 1 ? ` · ${r.pay_attempts} attempts` : ""}
                      </span>
                      <span className="block font-mono text-xs text-muted">{r.pay_provider_reference ?? r.pay_provider_order_id}</span>
                    </>
                  ) : (
                    <span className="text-muted">Not opened</span>
                  )}
                </td>
                <td className="px-3 py-2.5">{r.generation_status.replace("_", " ")}</td>
                <td className="px-3 py-2.5">{r.delivery_status.replace("_", " ")}</td>
                <td className="px-3 py-2.5 break-all">{r.report_email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="font-semibold text-ink-700 underline" href={withPage(page - 1)}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link className="font-semibold text-ink-700 underline" href={withPage(page + 1)}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
