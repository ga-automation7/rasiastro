import ExcelJS from "exceljs";
import { filterSql, type AdminFilters } from "../admin/filters";
import type { SqlExecutor } from "../db";

/**
 * Owner export to .xlsx. PostgreSQL stays the source of truth; this is a read-only
 * snapshot for the owner's records. Sheets are joined by "Order ID".
 *
 * - Timestamps are shown in Indian Standard Time and labelled (IST).
 * - Money is shown in rupees (number cells) with the exact paise alongside.
 * - Text that a spreadsheet could treat as a formula is neutralised.
 * - Full report prose is NOT exported (it lives in report storage).
 */
const IST_OFFSET_MS = 5.5 * 3_600_000;

/** Spreadsheet formula-injection guard (OWASP): prefix risky leading characters. */
export function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return /^[=+\-@\t\r|%]/.test(text) ? `'${text}` : text;
}

function ist(value: Date | null): Date | null {
  return value ? new Date(value.getTime() + IST_OFFSET_MS) : null;
}

function calendarDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

interface Column {
  header: string;
  key: string;
  width: number;
  kind: "text" | "number" | "datetime" | "date" | "money";
}

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, unknown>[]) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const c of columns) {
      const v = row[c.key];
      if (c.kind === "text") values[c.key] = safeText(v);
      else values[c.key] = v ?? null;
    }
    sheet.addRow(values);
  }
  columns.forEach((c, i) => {
    const col = sheet.getColumn(i + 1);
    if (c.kind === "datetime") col.numFmt = "yyyy-mm-dd hh:mm";
    if (c.kind === "date") col.numFmt = "yyyy-mm-dd";
    if (c.kind === "money") col.numFmt = "#,##0.00";
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

/** Date range (YYYY-MM-DD, India time, inclusive) plus the dashboard's optional filters. */
export type ExportOptions = Pick<AdminFilters, "from" | "to"> & Partial<Omit<AdminFilters, "from" | "to">>;

export async function buildOwnerWorkbook(db: SqlExecutor, options: ExportOptions): Promise<{ buffer: Buffer; counts: Record<string, number> }> {
  // The same filter as the dashboard, so an export contains every matching record.
  const { where, params } = filterSql({ payment: "all", product: "all", provider: "all", report: "all", q: null, ...options });

  const orders = await db.query<
    Record<string, unknown> & { created_at: Date; paid_at: Date | null; report_ready_at: Date | null; consent_processing_at: Date; delete_after: Date; personal_data_deleted_at: Date | null; adult_confirmed_at: Date | null; third_party_permission_at: Date | null }
  >(
    `select o.id as order_id, o.reference, o.created_at, o.mode, o.product, o.compatibility_category, o.tradition, o.report_language, o.package_code, o.pricing_version,
            o.base_amount_paise, o.addon_amount_paise, o.total_amount_paise, o.currency, o.payment_status, o.paid_at,
            o.generation_status, o.report_ready_at, o.delivery_status, o.report_email, o.payer_phone,
            o.consent_processing_at, o.consent_version, o.adult_confirmed_at, o.third_party_permission_at, o.delete_after, o.personal_data_deleted_at,
            lp.provider as pay_provider, lp.environment as pay_environment, lp.provider_order_id as pay_reference, lp.provider_reference as pay_provider_order,
            (select count(*)::int from payments p where p.order_id = o.id) as pay_attempts
       from orders o
       left join lateral (select p.provider, p.environment, p.provider_order_id, p.provider_reference
                            from payments p where p.order_id = o.id order by (p.status = 'paid') desc, p.attempt desc limit 1) lp on true
      where ${where} order by o.created_at`,
    params,
  );
  const birth = await db.query<Record<string, unknown> & { birth_date: string; birth_utc: Date | null }>(
    `select o.id as order_id, o.reference, o.product, b.participant, b.participant_id, b.subject_name, b.birth_date::text as birth_date, b.time_certainty,
            to_char(b.birth_time_local, 'HH24:MI') as birth_time_local, b.time_window_minutes, b.place_name, b.place_region,
            b.place_country_name, b.latitude, b.longitude, b.timezone_id, b.utc_offset_seconds, b.birth_utc, b.offset_resolution,
            c.known_moon_sign, c.known_nakshatra, c.known_pada, c.known_ascendant, c.other_known_details, c.additional_context
       from orders o join birth_details b on b.order_id = o.id left join order_context c on c.order_id = o.id and c.participant = b.participant
      where ${where} order by o.created_at, b.participant`,
    params,
  );
  const questions = await db.query<Record<string, unknown>>(
    `select o.id as order_id, o.reference, q.position, q.question
       from orders o join order_questions q on q.order_id = o.id where ${where} order by o.created_at, q.position`,
    params,
  );
  const status = await db.query<Record<string, unknown> & { pdf_rendered_at: Date | null; sent_at: Date | null; job_started_at: Date | null }>(
    `select o.id as order_id, o.reference, o.product, o.generation_status, o.generation_failure_code, j.status as job_status, j.started_at as job_started_at, j.attempts, j.current_step,
            j.last_error_code, ch.provider as chart_provider, ch.calculation_version, r.prompt_version, r.schema_version,
            (select string_agg(distinct p.model, ', ') from report_parts p where p.order_id = o.id) as ai_model,
            (select coalesce(sum(u.input_tokens), 0)::int from ai_usage u where u.order_id = o.id) as input_tokens,
            (select coalesce(sum(u.output_tokens), 0)::int from ai_usage u where u.order_id = o.id) as output_tokens,
            (select coalesce(sum(u.estimated_cost_micro_usd), 0)::int from ai_usage u where u.order_id = o.id) as cost_micro_usd,
            r.pdf_size_bytes, r.pdf_rendered_at, o.delivery_status,
            (select max(d.sent_at) from deliveries d where d.order_id = o.id and d.kind = 'report_ready') as sent_at
       from orders o left join report_jobs j on j.order_id = o.id left join charts ch on ch.order_id = o.id and ch.participant = 1 left join reports r on r.order_id = o.id
      where ${where} order by o.created_at`,
    params,
  );
  const shared = await db.query<Record<string, unknown>>(
    `select o.id as order_id, o.reference, o.compatibility_category, s.how_known, s.known_duration, s.hopes, s.shared_circumstances
       from orders o join compatibility_context s on s.order_id = o.id where ${where} order by o.created_at`,
    params,
  );
  const payments = await db.query<Record<string, unknown> & { created_at: Date; verified_at: Date | null }>(
    `select o.id as order_id, o.reference, p.provider, p.environment, p.provider_order_id, p.provider_reference, p.attempt, p.amount_paise,
            p.currency, p.status, p.provider_status, p.provider_payment_id, p.review_reason, p.created_at, p.verified_at,
            p.last_checked_at, p.check_count, p.last_check_error
       from orders o join payments p on p.order_id = o.id where ${where} order by o.created_at, p.attempt`,
    params,
  );

  // Cost and turnaround per product (no personal data).
  const byProduct = await db.query<Record<string, unknown>>(
    `select o.product, count(*)::int as orders,
            count(*) filter (where o.payment_status = 'paid')::int as paid_orders,
            count(*) filter (where o.generation_status = 'ready')::int as reports_ready,
            coalesce(sum((select coalesce(sum(u.input_tokens + u.output_tokens), 0) from ai_usage u where u.order_id = o.id)), 0)::bigint as ai_tokens,
            coalesce(sum((select coalesce(sum(u.estimated_cost_micro_usd), 0) from ai_usage u where u.order_id = o.id)), 0)::bigint as cost_micro_usd,
            round(avg(extract(epoch from (o.report_ready_at - o.paid_at)) / 60) filter (where o.report_ready_at is not null and o.paid_at is not null)::numeric, 1)::float as avg_minutes_to_ready
       from orders o where ${where} group by o.product order by o.product`,
    params,
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rasi Astro export";
  workbook.created = new Date();

  const readme = workbook.addWorksheet("About");
  readme.getColumn(1).width = 110;
  [
    "Rasi Astro owner export",
    `Generated: ${new Date().toISOString()} (UTC). Period: ${options.from ?? "beginning"} to ${options.to ?? "now"} (order creation date, IST).`,
    "All sheets are linked by the 'Order ID' column. Times are Indian Standard Time (IST) unless the header says otherwise.",
    "Products: 'personal' (one person) and 'compatibility' (two people, one category). Participants has one row per person; compatibility orders have participants 1 and 2.",
    "Money: rupee columns are numbers; 'Total (paise)' is the exact stored integer.",
    "Report text and PDFs are not included - they stay in private report storage.",
    "This file contains personal data. Store it securely, do not email it, and delete it when no longer needed.",
    "Cells starting with ' were prefixed to stop spreadsheet programs from treating customer text as formulas.",
  ].forEach((line, i) => {
    readme.getCell(i + 1, 1).value = line;
  });
  readme.getCell(1, 1).font = { bold: true, size: 14 };

  addSheet(
    workbook,
    "Orders",
    [
      { header: "Order ID", key: "order_id", width: 38, kind: "text" },
      { header: "Reference", key: "reference", width: 14, kind: "text" },
      { header: "Created (IST)", key: "created_at", width: 18, kind: "datetime" },
      { header: "Mode", key: "mode", width: 8, kind: "text" },
      { header: "Product", key: "product", width: 14, kind: "text" },
      { header: "Connection category", key: "compatibility_category", width: 20, kind: "text" },
      { header: "Paid?", key: "paid_flag", width: 8, kind: "text" },
      { header: "Tradition", key: "tradition", width: 10, kind: "text" },
      { header: "Language", key: "report_language", width: 9, kind: "text" },
      { header: "Package", key: "package_code", width: 22, kind: "text" },
      { header: "Pricing version", key: "pricing_version", width: 14, kind: "text" },
      { header: "Report (₹)", key: "base_inr", width: 11, kind: "money" },
      { header: "Questions add-on (₹)", key: "addon_inr", width: 18, kind: "money" },
      { header: "Total (₹)", key: "total_inr", width: 10, kind: "money" },
      { header: "Total (paise)", key: "total_amount_paise", width: 12, kind: "number" },
      { header: "Payment status", key: "payment_status", width: 16, kind: "text" },
      { header: "Paid (IST)", key: "paid_at", width: 18, kind: "datetime" },
      { header: "Payment provider", key: "pay_provider", width: 12, kind: "text" },
      { header: "Payment environment", key: "pay_environment", width: 12, kind: "text" },
      { header: "Our payment reference", key: "pay_reference", width: 18, kind: "text" },
      { header: "Provider order ID", key: "pay_provider_order", width: 22, kind: "text" },
      { header: "Payment attempts", key: "pay_attempts", width: 10, kind: "number" },
      { header: "Generation status", key: "generation_status", width: 17, kind: "text" },
      { header: "Report ready (IST)", key: "report_ready_at", width: 18, kind: "datetime" },
      { header: "Delivery status", key: "delivery_status", width: 14, kind: "text" },
      { header: "Report email", key: "report_email", width: 30, kind: "text" },
      { header: "Payer mobile", key: "payer_phone", width: 15, kind: "text" },
      { header: "Consent given (IST)", key: "consent_processing_at", width: 18, kind: "datetime" },
      { header: "Consent version", key: "consent_version", width: 14, kind: "text" },
      { header: "18+ confirmed (IST)", key: "adult_confirmed_at", width: 18, kind: "datetime" },
      { header: "Other person's permission confirmed (IST)", key: "third_party_permission_at", width: 22, kind: "datetime" },
      { header: "Delete personal data after (IST)", key: "delete_after", width: 22, kind: "datetime" },
      { header: "Personal data erased (IST)", key: "personal_data_deleted_at", width: 22, kind: "datetime" },
    ],
    orders.map((o) => ({
      ...o,
      created_at: ist(o.created_at),
      paid_at: ist(o.paid_at),
      report_ready_at: ist(o.report_ready_at),
      consent_processing_at: ist(o.consent_processing_at),
      adult_confirmed_at: ist(o.adult_confirmed_at),
      third_party_permission_at: ist(o.third_party_permission_at),
      delete_after: ist(o.delete_after),
      personal_data_deleted_at: ist(o.personal_data_deleted_at),
      paid_flag: o.payment_status === "paid" ? "PAID" : o.payment_status === "pending" || o.payment_status === "needs_review" ? "CHECK" : "UNPAID",
      base_inr: Number(o.base_amount_paise) / 100,
      addon_inr: Number(o.addon_amount_paise) / 100,
      total_inr: Number(o.total_amount_paise) / 100,
    })),
  );

  addSheet(
    workbook,
    "Participants",
    [
      { header: "Order ID", key: "order_id", width: 38, kind: "text" },
      { header: "Reference", key: "reference", width: 14, kind: "text" },
      { header: "Product", key: "product", width: 14, kind: "text" },
      { header: "Participant #", key: "participant", width: 12, kind: "number" },
      { header: "Participant ID", key: "participant_id", width: 38, kind: "text" },
      { header: "Name", key: "subject_name", width: 26, kind: "text" },
      { header: "Birth date", key: "birth_date", width: 12, kind: "date" },
      { header: "Time certainty", key: "time_certainty", width: 13, kind: "text" },
      { header: "Birth time (local, 24h)", key: "birth_time_local", width: 12, kind: "text" },
      { header: "± minutes", key: "time_window_minutes", width: 10, kind: "number" },
      { header: "Place", key: "place_name", width: 20, kind: "text" },
      { header: "State/region", key: "place_region", width: 18, kind: "text" },
      { header: "Country", key: "place_country_name", width: 16, kind: "text" },
      { header: "Latitude", key: "latitude", width: 10, kind: "number" },
      { header: "Longitude", key: "longitude", width: 10, kind: "number" },
      { header: "Time zone", key: "timezone_id", width: 18, kind: "text" },
      { header: "UTC offset (minutes)", key: "utc_offset_minutes", width: 12, kind: "number" },
      { header: "Birth moment (UTC)", key: "birth_utc", width: 18, kind: "datetime" },
      { header: "Offset resolution", key: "offset_resolution", width: 18, kind: "text" },
      { header: "Known Moon sign", key: "known_moon_sign", width: 14, kind: "text" },
      { header: "Known nakshatra", key: "known_nakshatra", width: 16, kind: "text" },
      { header: "Known pada", key: "known_pada", width: 10, kind: "number" },
      { header: "Known ascendant", key: "known_ascendant", width: 14, kind: "text" },
      { header: "Other known details", key: "other_known_details", width: 40, kind: "text" },
      { header: "Notes about this person", key: "additional_context", width: 50, kind: "text" },
    ],
    birth.map((b) => ({ ...b, birth_date: calendarDate(b.birth_date), birth_utc: b.birth_utc, utc_offset_minutes: Number(b.utc_offset_seconds) / 60 })),
  );

  addSheet(
    workbook,
    "Questions",
    [
      { header: "Order ID", key: "order_id", width: 38, kind: "text" },
      { header: "Reference", key: "reference", width: 14, kind: "text" },
      { header: "Question #", key: "position", width: 10, kind: "number" },
      { header: "Question", key: "question", width: 90, kind: "text" },
    ],
    questions,
  );

  addSheet(
    workbook,
    "Shared context",
    [
      { header: "Order ID", key: "order_id", width: 38, kind: "text" },
      { header: "Reference", key: "reference", width: 14, kind: "text" },
      { header: "Connection category", key: "compatibility_category", width: 20, kind: "text" },
      { header: "How they know each other", key: "how_known", width: 40, kind: "text" },
      { header: "How long", key: "known_duration", width: 18, kind: "text" },
      { header: "Hopes to understand", key: "hopes", width: 50, kind: "text" },
      { header: "Shared circumstances", key: "shared_circumstances", width: 50, kind: "text" },
    ],
    shared,
  );

  addSheet(
    workbook,
    "Report status",
    [
      { header: "Order ID", key: "order_id", width: 38, kind: "text" },
      { header: "Reference", key: "reference", width: 14, kind: "text" },
      { header: "Product", key: "product", width: 14, kind: "text" },
      { header: "Generation status", key: "generation_status", width: 17, kind: "text" },
      { header: "Failure code", key: "generation_failure_code", width: 16, kind: "text" },
      { header: "Job status", key: "job_status", width: 11, kind: "text" },
      { header: "Generation started (IST)", key: "job_started_at", width: 20, kind: "datetime" },
      { header: "Attempts", key: "attempts", width: 9, kind: "number" },
      { header: "Current step", key: "current_step", width: 18, kind: "text" },
      { header: "Last error code", key: "last_error_code", width: 18, kind: "text" },
      { header: "Chart provider", key: "chart_provider", width: 18, kind: "text" },
      { header: "Calculation version", key: "calculation_version", width: 16, kind: "text" },
      { header: "Prompt version", key: "prompt_version", width: 14, kind: "text" },
      { header: "Report schema", key: "schema_version", width: 16, kind: "text" },
      { header: "AI model", key: "ai_model", width: 18, kind: "text" },
      { header: "AI input tokens", key: "input_tokens", width: 14, kind: "number" },
      { header: "AI output tokens", key: "output_tokens", width: 14, kind: "number" },
      { header: "Est. AI cost (USD)", key: "cost_usd", width: 14, kind: "number" },
      { header: "PDF size (KB)", key: "pdf_kb", width: 12, kind: "number" },
      { header: "PDF rendered (IST)", key: "pdf_rendered_at", width: 18, kind: "datetime" },
      { header: "Delivery status", key: "delivery_status", width: 14, kind: "text" },
      { header: "Email sent (IST)", key: "sent_at", width: 18, kind: "datetime" },
    ],
    status.map((s) => ({
      ...s,
      cost_usd: Number(s.cost_micro_usd ?? 0) / 1_000_000,
      pdf_kb: s.pdf_size_bytes ? Math.round(Number(s.pdf_size_bytes) / 1024) : null,
      job_started_at: ist(s.job_started_at),
      pdf_rendered_at: ist(s.pdf_rendered_at),
      sent_at: ist(s.sent_at),
    })),
  );

  addSheet(
    workbook,
    "Payments",
    [
      { header: "Order ID", key: "order_id", width: 38, kind: "text" },
      { header: "Reference", key: "reference", width: 14, kind: "text" },
      { header: "Provider", key: "provider", width: 10, kind: "text" },
      { header: "Environment", key: "environment", width: 11, kind: "text" },
      { header: "Our payment reference", key: "provider_order_id", width: 18, kind: "text" },
      { header: "Provider order ID", key: "provider_reference", width: 22, kind: "text" },
      { header: "Attempt", key: "attempt", width: 8, kind: "number" },
      { header: "Amount (₹)", key: "amount_inr", width: 11, kind: "money" },
      { header: "Currency", key: "currency", width: 9, kind: "text" },
      { header: "Status", key: "status", width: 13, kind: "text" },
      { header: "Provider status", key: "provider_status", width: 22, kind: "text" },
      { header: "Provider payment ID", key: "provider_payment_id", width: 20, kind: "text" },
      { header: "Review reason", key: "review_reason", width: 18, kind: "text" },
      { header: "Created (IST)", key: "created_at", width: 18, kind: "datetime" },
      { header: "Verified (IST)", key: "verified_at", width: 18, kind: "datetime" },
      { header: "Last checked with provider (IST)", key: "last_checked_at", width: 22, kind: "datetime" },
      { header: "Checks", key: "check_count", width: 8, kind: "number" },
      { header: "Last check problem", key: "last_check_error", width: 20, kind: "text" },
    ],
    payments.map((p) => ({
      ...p,
      amount_inr: Number(p.amount_paise) / 100,
      created_at: ist(p.created_at),
      verified_at: ist(p.verified_at),
      last_checked_at: ist(p.last_checked_at as Date | null),
    })),
  );

  addSheet(
    workbook,
    "By product",
    [
      { header: "Product", key: "product", width: 14, kind: "text" },
      { header: "Orders", key: "orders", width: 9, kind: "number" },
      { header: "Paid", key: "paid_orders", width: 9, kind: "number" },
      { header: "Reports ready", key: "reports_ready", width: 13, kind: "number" },
      { header: "AI tokens", key: "ai_tokens", width: 12, kind: "number" },
      { header: "Est. AI cost (USD)", key: "cost_usd", width: 16, kind: "number" },
      { header: "Avg. minutes payment to report", key: "avg_minutes_to_ready", width: 26, kind: "number" },
    ],
    byProduct.map((r) => ({ ...r, ai_tokens: Number(r.ai_tokens), cost_usd: Number(r.cost_micro_usd) / 1_000_000 })),
  );

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, counts: { orders: orders.length, participants: birth.length, sharedContext: shared.length, questions: questions.length, payments: payments.length } };
}
