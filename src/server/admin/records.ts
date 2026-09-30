import type { SqlExecutor } from "../db";
import { FILTER_PARAM_COUNT, filterSql, type AdminFilters } from "./filters";

/** Read-only queries behind the owner dashboard. Callers must have checked requireAdmin(). */
export interface OrderRow {
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
  names: string | null;
  personal_data_deleted_at: Date | null;
  /** Latest payment attempt, if checkout was ever opened. */
  pay_provider: string | null;
  pay_environment: string | null;
  pay_provider_order_id: string | null;
  pay_provider_reference: string | null;
  pay_attempts: number;
}

export async function listOrders(db: SqlExecutor, filters: AdminFilters, page: number, pageSize: number): Promise<{ rows: OrderRow[]; total: number }> {
  const { where, params } = filterSql(filters);
  const [count] = await db.query<{ n: number }>(`select count(*)::int as n from orders o where ${where}`, params);
  const rows = await db.query<OrderRow>(
    `select o.id, o.reference, o.created_at, o.mode, o.product, o.compatibility_category, o.tradition, o.report_language, o.package_code,
            o.total_amount_paise, o.payment_status, o.paid_at, o.generation_status, o.report_ready_at, o.delivery_status, o.report_email,
            (select string_agg(b.subject_name, ' & ' order by b.participant) from birth_details b where b.order_id = o.id) as names,
            o.personal_data_deleted_at,
            lp.provider as pay_provider, lp.environment as pay_environment, lp.provider_order_id as pay_provider_order_id,
            lp.provider_reference as pay_provider_reference,
            (select count(*)::int from payments p where p.order_id = o.id) as pay_attempts
       from orders o
       left join lateral (select p.provider, p.environment, p.provider_order_id, p.provider_reference
                            from payments p where p.order_id = o.id order by p.attempt desc limit 1) lp on true
      where ${where}
      order by o.created_at desc
      limit $${FILTER_PARAM_COUNT + 1}::int offset $${FILTER_PARAM_COUNT + 2}::int`,
    [...params, pageSize, Math.max(0, (page - 1) * pageSize)],
  );
  return { rows, total: count?.n ?? 0 };
}

export async function orderSummary(db: SqlExecutor, filters: AdminFilters) {
  const { where, params } = filterSql(filters);
  const [s] = await db.query<{ orders: number; paid: number; unpaid: number; revenue_paise: number }>(
    `select count(*)::int as orders,
            count(*) filter (where o.payment_status = 'paid')::int as paid,
            count(*) filter (where o.payment_status in ('awaiting_payment', 'failed', 'cancelled', 'expired'))::int as unpaid,
            coalesce(sum(o.total_amount_paise) filter (where o.payment_status = 'paid'), 0)::int as revenue_paise
       from orders o where ${where}`,
    params,
  );
  return s ?? { orders: 0, paid: 0, unpaid: 0, revenue_paise: 0 };
}

export async function getOrderDetail(db: SqlExecutor, id: string) {
  const [order] = await db.query<Record<string, unknown> & { id: string; reference: string }>(
    `select o.id, o.reference, o.created_at, o.updated_at, o.mode, o.product, o.compatibility_category, o.tradition, o.report_language,
            o.package_code, o.pricing_version, o.base_amount_paise, o.addon_amount_paise, o.total_amount_paise, o.currency,
            o.payment_status, o.paid_at, o.generation_status, o.generation_failure_code, o.report_ready_at, o.delivery_status,
            o.report_email, o.payer_phone, o.consent_processing_at, o.consent_version, o.adult_confirmed_at, o.third_party_permission_at,
            o.delete_after, o.personal_data_deleted_at
       from orders o where o.id = $1::uuid`,
    [id],
  );
  if (!order) return null;
  const [participants, questions, shared, payments, job] = await Promise.all([
    db.query<Record<string, unknown>>(
      `select b.participant, b.participant_id, b.subject_name, b.birth_date::text as birth_date, b.time_certainty,
              to_char(b.birth_time_local, 'HH24:MI') as birth_time, b.time_window_minutes, b.place_name, b.place_region,
              b.place_country_name, b.latitude, b.longitude, b.timezone_id, b.utc_offset_seconds,
              c.known_moon_sign, c.known_nakshatra, c.known_pada, c.known_ascendant, c.other_known_details, c.additional_context
         from birth_details b left join order_context c on c.order_id = b.order_id and c.participant = b.participant
        where b.order_id = $1::uuid order by b.participant`,
      [id],
    ),
    db.query<{ position: number; question: string }>(`select position, question from order_questions where order_id = $1::uuid order by position`, [id]),
    db.query<Record<string, unknown>>(`select how_known, known_duration, hopes, shared_circumstances from compatibility_context where order_id = $1::uuid`, [id]),
    db.query<Record<string, unknown>>(
      `select provider, environment, provider_order_id, provider_reference, attempt, amount_paise, currency, status, provider_status,
              provider_payment_id, review_reason, created_at, verified_at, last_checked_at, check_count, last_check_error,
              id, submitted_reference, reference_submitted_at, confirmed_by
         from payments where order_id = $1::uuid order by attempt`,
      [id],
    ),
    db.query<Record<string, unknown>>(`select status, attempts, current_step, last_error_code, started_at, finished_at from report_jobs where order_id = $1::uuid`, [id]),
  ]);
  return { order, participants, questions, shared: shared[0] ?? null, payments, job: job[0] ?? null };
}

/** UroRelay attempts that need the owner: held for review, or waiting on a bank SMS for a while. */
export interface RelayReviewRow {
  payment_id: string;
  order_id: string;
  reference: string;
  amount_paise: number;
  status: string;
  provider_status: string | null;
  review_reason: string | null;
  submitted_reference: string | null;
  reference_submitted_at: Date | null;
  created_at: Date;
}

export async function listRelayReviews(db: SqlExecutor, limit = 50): Promise<RelayReviewRow[]> {
  return db.query<RelayReviewRow>(
    `select p.id as payment_id, o.id as order_id, o.reference, p.amount_paise, p.status, p.provider_status, p.review_reason,
            p.submitted_reference, p.reference_submitted_at, p.created_at
       from payments p join orders o on o.id = p.order_id
      where p.provider = 'urorelay' and o.payment_status <> 'paid'
        and (p.status = 'needs_review'
             or (p.status = 'pending' and (p.provider_status like '%REVIEW_REQUIRED%' or p.reference_submitted_at < now() - interval '30 minutes')))
      order by coalesce(p.reference_submitted_at, p.created_at)
      limit $1::int`,
    [limit],
  );
}

/** Bank credits the Companion app reported that are not attached to a paid order. */
export interface UnmatchedCreditRow {
  id: string;
  environment: string;
  reference_number: string | null;
  amount_paise: number | null;
  uropay_order_id: string | null;
  merchant_order_id: string | null;
  received_at: Date;
  claimed_by_reference: string | null;
  claimed_order_id: string | null;
}

export async function listUnmatchedCredits(db: SqlExecutor, limit = 50): Promise<UnmatchedCreditRow[]> {
  return db.query<UnmatchedCreditRow>(
    `select c.id, c.environment, c.reference_number, c.amount_paise, c.uropay_order_id, c.merchant_order_id, c.received_at,
            o.reference as claimed_by_reference, o.id as claimed_order_id
       from relay_bank_credits c
       left join payments lp on lp.id = c.payment_id
       -- An order whose customer typed this bank reference, if any (helps the owner match it).
       left join payments cp on cp.provider = 'urorelay' and cp.submitted_reference = c.reference_number
       left join orders o on o.id = coalesce(lp.order_id, cp.order_id)
      where lp.id is null or lp.status <> 'paid'
      order by c.received_at desc
      limit $1::int`,
    [limit],
  );
}

export async function getRelayCreditsForOrder(db: SqlExecutor, orderId: string) {
  return db.query<{ reference_number: string | null; amount_paise: number | null; uropay_order_id: string | null; environment: string; received_at: Date }>(
    `select c.reference_number, c.amount_paise, c.uropay_order_id, c.environment, c.received_at
       from relay_bank_credits c
      where c.uropay_order_id in (select provider_reference from payments where order_id = $1::uuid and provider = 'urorelay' and provider_reference is not null)
         or c.reference_number in (select submitted_reference from payments where order_id = $1::uuid and provider = 'urorelay' and submitted_reference is not null)
      order by c.received_at`,
    [orderId],
  );
}
