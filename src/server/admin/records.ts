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
              provider_payment_id, review_reason, created_at, verified_at, last_checked_at, check_count, last_check_error
         from payments where order_id = $1::uuid order by attempt`,
      [id],
    ),
    db.query<Record<string, unknown>>(`select status, attempts, current_step, last_error_code, started_at, finished_at from report_jobs where order_id = $1::uuid`, [id]),
  ]);
  return { order, participants, questions, shared: shared[0] ?? null, payments, job: job[0] ?? null };
}
