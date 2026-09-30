import type { SqlParam } from "../db";

/**
 * Filters shared by the admin dashboard and its exports, so an export always contains
 * exactly the records the filters match (every page, not just the visible one).
 */
export type PaymentFilter = "all" | "paid" | "unpaid" | "pending" | "review";
export type ProductFilter = "all" | "personal" | "compatibility";
/** Orders with at least one payment attempt through that provider; "none" = checkout never opened. */
export type ProviderFilter = "all" | "uropay" | "cashfree" | "demo" | "none";
export type ReportFilter = "all" | "not_started" | "in_progress" | "ready" | "failed";

export interface AdminFilters {
  /** YYYY-MM-DD, order creation date in India time, inclusive. */
  from: string | null;
  to: string | null;
  payment: PaymentFilter;
  product: ProductFilter;
  provider: ProviderFilter;
  report: ReportFilter;
  /** Order reference, email or name fragment. */
  q: string | null;
}

/** "Unpaid" = the customer never completed payment. */
export const PAYMENT_GROUPS: Record<Exclude<PaymentFilter, "all">, string[]> = {
  paid: ["paid"],
  unpaid: ["awaiting_payment", "failed", "cancelled", "expired"],
  pending: ["pending"],
  review: ["needs_review"],
};

export const REPORT_GROUPS: Record<Exclude<ReportFilter, "all">, string[]> = {
  not_started: ["not_started"],
  in_progress: ["queued", "calculating", "interpreting", "rendering"],
  ready: ["ready"],
  failed: ["failed"],
};

const PAYMENTS: PaymentFilter[] = ["all", "paid", "unpaid", "pending", "review"];
const PRODUCTS: ProductFilter[] = ["all", "personal", "compatibility"];
const PROVIDERS: ProviderFilter[] = ["all", "uropay", "cashfree", "demo", "none"];
const REPORTS: ReportFilter[] = ["all", "not_started", "in_progress", "ready", "failed"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(params: Record<string, string | string[] | undefined> | URLSearchParams): AdminFilters {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return typeof v === "string" ? v.trim() : null;
  };
  const pick = <T extends string>(value: string | null, allowed: T[]): T => (value && allowed.includes(value as T) ? (value as T) : ("all" as T));
  const from = get("from");
  const to = get("to");
  const q = get("q");
  return {
    from: from && DATE.test(from) ? from : null,
    to: to && DATE.test(to) ? to : null,
    payment: pick(get("payment"), PAYMENTS),
    product: pick(get("product"), PRODUCTS),
    provider: pick(get("provider"), PROVIDERS),
    report: pick(get("report"), REPORTS),
    q: q ? q.slice(0, 100) : null,
  };
}

export function filtersToQuery(f: AdminFilters): string {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.payment !== "all") p.set("payment", f.payment);
  if (f.product !== "all") p.set("product", f.product);
  if (f.provider !== "all") p.set("provider", f.provider);
  if (f.report !== "all") p.set("report", f.report);
  if (f.q) p.set("q", f.q);
  return p.toString();
}

/** How many parameters filterSql uses; callers append their own after these. */
export const FILTER_PARAM_COUNT = 7;

/**
 * SQL condition over `orders o` using parameters $1..$7 (always all seven, nullable),
 * so callers can append their own parameters from $8.
 */
export function filterSql(f: AdminFilters): { where: string; params: SqlParam[] } {
  const statuses = f.payment === "all" ? null : PAYMENT_GROUPS[f.payment].join(",");
  const reports = f.report === "all" ? null : REPORT_GROUPS[f.report].join(",");
  const where = `($1::date is null or (o.created_at at time zone 'Asia/Kolkata')::date >= $1::date)
      and ($2::date is null or (o.created_at at time zone 'Asia/Kolkata')::date <= $2::date)
      and ($3::text is null or o.payment_status = any(string_to_array($3::text, ',')))
      and ($4::text is null or o.product = $4::text)
      and ($5::text is null
           or o.reference = upper($5::text)
           or lower(o.report_email) like '%' || lower($5::text) || '%'
           or exists (select 1 from birth_details b where b.order_id = o.id and lower(b.subject_name) like '%' || lower($5::text) || '%'))
      and ($6::text is null
           or ($6::text = 'none' and not exists (select 1 from payments p where p.order_id = o.id))
           or exists (select 1 from payments p where p.order_id = o.id and p.provider = $6::text))
      and ($7::text is null or o.generation_status = any(string_to_array($7::text, ',')))`;
  return { where, params: [f.from, f.to, statuses, f.product === "all" ? null : f.product, f.q, f.provider === "all" ? null : f.provider, reports] };
}
