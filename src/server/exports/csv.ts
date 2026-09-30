import { filterSql, type AdminFilters } from "../admin/filters";
import type { SqlExecutor } from "../db";
import { safeText } from "./xlsx";

/**
 * Owner CSV export: one row per order, with Person A and Person B side by side
 * (Person B is empty for personal reports). UTF-8 with a byte-order mark so Excel shows
 * Tamil, Hindi and other scripts correctly; every text cell is protected against
 * spreadsheet formula injection. Times are India Standard Time.
 */
const IST_MS = 5.5 * 3_600_000;

function istText(value: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getTime() + IST_MS).toISOString().replace("T", " ").slice(0, 16);
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : (safeText(value) ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

interface Row {
  id: string;
  reference: string;
  created_at: Date;
  mode: string;
  product: string;
  compatibility_category: string | null;
  tradition: string;
  report_language: string;
  package_code: string;
  total_amount_paise: number;
  payment_status: string;
  paid_at: Date | null;
  generation_status: string;
  report_ready_at: Date | null;
  delivery_status: string;
  report_email: string;
  payer_phone: string | null;
  pay_provider: string | null;
  pay_environment: string | null;
  pay_reference: string | null;
  pay_provider_order: string | null;
  pay_payment_id: string | null;
  pay_status: string | null;
  pay_verified_at: Date | null;
  pay_last_checked_at: Date | null;
  pay_last_check_error: string | null;
  pay_review_reason: string | null;
  pay_submitted_reference: string | null;
  pay_confirmed_by: string | null;
  pay_attempts: number;
  people: { n: number; name: string; birth_date: string; time_certainty: string; birth_time: string | null; place: string; timezone_id: string; notes: string | null }[] | null;
  questions: string[] | null;
  how_known: string | null;
  known_duration: string | null;
  hopes: string | null;
  shared_circumstances: string | null;
}

const HEADERS = [
  "Order ID", "Reference", "Created (IST)", "Mode", "Report type", "Connection category", "Tradition", "Language", "Package",
  "Amount (₹)", "Paid?", "Payment status", "Paid (IST)",
  "Payment provider", "Payment environment", "Our payment reference", "Provider order ID", "Provider payment ID", "Attempt status",
  "Payment verified (IST)", "Payment attempts", "Last checked with provider (IST)", "Last check problem", "Review reason", "UPI reference given by customer", "Confirmed or rejected by",
  "Report status", "Report ready (IST)", "Email status", "Email", "Mobile",
  "Person A name", "Person A birth date", "Person A time certainty", "Person A birth time", "Person A birthplace", "Person A time zone", "Person A notes",
  "Person B name", "Person B birth date", "Person B time certainty", "Person B birth time", "Person B birthplace", "Person B time zone", "Person B notes",
  "Question 1", "Question 2", "Question 3",
  "How they know each other", "How long", "Hopes to understand", "Shared circumstances",
];

export async function buildOwnerCsv(db: SqlExecutor, filters: AdminFilters): Promise<{ csv: string; count: number }> {
  const { where, params } = filterSql(filters);
  const rows = await db.query<Row>(
    `select o.id, o.reference, o.created_at, o.mode, o.product, o.compatibility_category, o.tradition, o.report_language, o.package_code,
            o.total_amount_paise, o.payment_status, o.paid_at, o.generation_status, o.report_ready_at, o.delivery_status,
            o.report_email, o.payer_phone,
            lp.provider as pay_provider, lp.environment as pay_environment, lp.provider_order_id as pay_reference,
            lp.provider_reference as pay_provider_order, lp.provider_payment_id as pay_payment_id, lp.status as pay_status,
            lp.verified_at as pay_verified_at, lp.last_checked_at as pay_last_checked_at, lp.last_check_error as pay_last_check_error,
            lp.review_reason as pay_review_reason, lp.submitted_reference as pay_submitted_reference, lp.confirmed_by as pay_confirmed_by,
            (select count(*)::int from payments p where p.order_id = o.id) as pay_attempts,
            (select json_agg(json_build_object(
                      'n', b.participant, 'name', b.subject_name, 'birth_date', b.birth_date::text, 'time_certainty', b.time_certainty,
                      'birth_time', to_char(b.birth_time_local, 'HH24:MI'),
                      'place', concat_ws(', ', b.place_name, b.place_region, b.place_country_name),
                      'timezone_id', b.timezone_id, 'notes', c.additional_context) order by b.participant)
               from birth_details b left join order_context c on c.order_id = b.order_id and c.participant = b.participant
              where b.order_id = o.id) as people,
            (select json_agg(q.question order by q.position) from order_questions q where q.order_id = o.id) as questions,
            s.how_known, s.known_duration, s.hopes, s.shared_circumstances
       from orders o
       left join compatibility_context s on s.order_id = o.id
       -- The attempt that paid, otherwise the latest attempt.
       left join lateral (select p.* from payments p where p.order_id = o.id order by (p.status = 'paid') desc, p.attempt desc limit 1) lp on true
      where ${where}
      order by o.created_at`,
    params,
  );
  const lines = [HEADERS.map(cell).join(",")];
  for (const r of rows) {
    const people = typeof r.people === "string" ? (JSON.parse(r.people) as Row["people"]) : r.people;
    const questions = typeof r.questions === "string" ? (JSON.parse(r.questions) as string[]) : (r.questions ?? []);
    const person = (n: number) => {
      const p = people?.find((x) => x.n === n);
      return p ? [p.name, p.birth_date, p.time_certainty, p.birth_time ?? "", p.place, p.timezone_id, p.notes ?? ""] : ["", "", "", "", "", "", ""];
    };
    const paid = r.payment_status === "paid" ? "PAID" : r.payment_status === "pending" || r.payment_status === "needs_review" ? "CHECK" : "UNPAID";
    const values: unknown[] = [
      r.id, r.reference, istText(r.created_at), r.mode, r.product, r.compatibility_category ?? "", r.tradition, r.report_language, r.package_code,
      Number(r.total_amount_paise) / 100, paid, r.payment_status, istText(r.paid_at),
      r.pay_provider ?? "", r.pay_environment ?? "", r.pay_reference ?? "", r.pay_provider_order ?? "", r.pay_payment_id ?? "", r.pay_status ?? "",
      istText(r.pay_verified_at), Number(r.pay_attempts ?? 0), istText(r.pay_last_checked_at), r.pay_last_check_error ?? "", r.pay_review_reason ?? "", r.pay_submitted_reference ?? "", r.pay_confirmed_by ?? "",
      r.generation_status, istText(r.report_ready_at), r.delivery_status,
      r.report_email, r.payer_phone ?? "",
      ...person(1), ...person(2),
      questions[0] ?? "", questions[1] ?? "", questions[2] ?? "",
      r.how_known ?? "", r.known_duration ?? "", r.hopes ?? "", r.shared_circumstances ?? "",
    ];
    lines.push(values.map(cell).join(","));
  }
  // The BOM tells Excel the file is UTF-8, so Indian scripts display correctly.
  return { csv: `﻿${lines.join("\r\n")}\r\n`, count: rows.length };
}
