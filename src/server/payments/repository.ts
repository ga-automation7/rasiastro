import type { SqlExecutor } from "../db";
import type { PaymentEnvironment, ProviderId } from "./types";

export type PaymentRowStatus = "created" | "pending" | "paid" | "failed" | "cancelled" | "expired" | "needs_review";

/** One payment attempt. The provider and environment that created it never change. */
export interface Payment {
  id: string;
  orderId: string;
  provider: ProviderId;
  environment: PaymentEnvironment;
  /** Our reference, sent to the provider (RA-XXXXXXXX-1). */
  providerOrderId: string;
  /** The provider's own order id, once known. */
  providerReference: string | null;
  attempt: number;
  amountPaise: number;
  currency: string;
  status: PaymentRowStatus;
  paymentSessionId: string | null;
  checkoutUrl: string | null;
  providerPaymentId: string | null;
  providerStatus: string | null;
  reviewReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  verifiedAt: Date | null;
  lastCheckedAt: Date | null;
  checkCount: number;
  lastCheckError: string | null;
}

interface PaymentRow {
  id: string;
  order_id: string;
  provider: ProviderId;
  environment: PaymentEnvironment;
  provider_order_id: string;
  provider_reference: string | null;
  attempt: number;
  amount_paise: number;
  currency: string;
  status: PaymentRowStatus;
  payment_session_id: string | null;
  checkout_url: string | null;
  provider_payment_id: string | null;
  provider_status: string | null;
  review_reason: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
  verified_at: Date | null;
  last_checked_at: Date | null;
  check_count: number;
  last_check_error: string | null;
}

const COLUMNS = `id, order_id, provider, environment, provider_order_id, provider_reference, attempt, amount_paise, currency, status,
  payment_session_id, checkout_url, provider_payment_id, provider_status, review_reason, created_at, updated_at, expires_at,
  verified_at, last_checked_at, check_count, last_check_error`;

const map = (r: PaymentRow): Payment => ({
  id: r.id,
  orderId: r.order_id,
  provider: r.provider,
  environment: r.environment,
  providerOrderId: r.provider_order_id,
  providerReference: r.provider_reference,
  attempt: r.attempt,
  amountPaise: r.amount_paise,
  currency: r.currency,
  status: r.status,
  paymentSessionId: r.payment_session_id,
  checkoutUrl: r.checkout_url,
  providerPaymentId: r.provider_payment_id,
  providerStatus: r.provider_status,
  reviewReason: r.review_reason,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  expiresAt: r.expires_at,
  verifiedAt: r.verified_at,
  lastCheckedAt: r.last_checked_at,
  checkCount: r.check_count,
  lastCheckError: r.last_check_error,
});

/** True when the customer was given something they could pay with for this attempt. */
export function wasOpened(p: Payment): boolean {
  return p.provider === "demo" || Boolean(p.paymentSessionId || p.checkoutUrl);
}

export async function getPaymentByProviderOrderId(db: SqlExecutor, providerOrderId: string, forUpdate = false): Promise<Payment | null> {
  const rows = await db.query<PaymentRow>(`select ${COLUMNS} from payments where provider_order_id = $1 ${forUpdate ? "for update" : ""}`, [providerOrderId]);
  return rows[0] ? map(rows[0]) : null;
}

export async function listPaymentsForOrder(db: SqlExecutor, orderId: string): Promise<Payment[]> {
  const rows = await db.query<PaymentRow>(`select ${COLUMNS} from payments where order_id = $1::uuid order by attempt`, [orderId]);
  return rows.map(map);
}

export async function insertPayment(
  db: SqlExecutor,
  p: { orderId: string; provider: ProviderId; environment: PaymentEnvironment; providerOrderId: string; attempt: number; amountPaise: number; currency: string; expiresAt: Date | null },
): Promise<Payment> {
  const rows = await db.query<PaymentRow>(
    `insert into payments (order_id, provider, environment, provider_order_id, attempt, amount_paise, currency, expires_at)
     values ($1::uuid, $2, $3, $4, $5::int, $6::int, $7, $8::timestamptz)
     returning ${COLUMNS}`,
    [p.orderId, p.provider, p.environment, p.providerOrderId, p.attempt, p.amountPaise, p.currency, p.expiresAt ? p.expiresAt.toISOString() : null],
  );
  return map(rows[0]!);
}

/** Saves what the provider returned when the checkout was created (or re-created idempotently). */
export async function saveCheckoutSession(
  db: SqlExecutor,
  paymentId: string,
  s: { paymentSessionId: string | null; checkoutUrl: string | null; providerReference: string | null },
): Promise<void> {
  await db.query(
    `update payments set payment_session_id = coalesce($2, payment_session_id), checkout_url = coalesce($3, checkout_url),
            provider_reference = coalesce(provider_reference, $4), provider_status = case when provider_status = 'CREATE_UNCONFIRMED' then null else provider_status end,
            last_check_error = null, updated_at = now()
      where id = $1::uuid`,
    [paymentId, s.paymentSessionId, s.checkoutUrl, s.providerReference],
  );
}

/** Records the outcome of an authoritative status check (null error = the provider answered). */
export async function recordPaymentCheck(db: SqlExecutor, paymentId: string, errorCode: string | null): Promise<void> {
  await db.query(
    `update payments set last_checked_at = now(), check_count = check_count + 1, last_check_error = $2 where id = $1::uuid`,
    [paymentId, errorCode],
  );
}

/**
 * Attempts the scheduled sweeper should check: opened by the customer, not final, and
 * recent. Checks back off (10, 20 ... 60 minutes apart) so a long outage cannot turn
 * into a flood of requests; the window itself bounds how long we keep trying.
 */
export async function listPaymentsNeedingReconciliation(db: SqlExecutor, limit: number): Promise<Payment[]> {
  const rows = await db.query<PaymentRow>(
    `select ${COLUMNS} from payments
      where ((status in ('created', 'pending') and created_at > now() - interval '3 days')
             -- A failed/cancelled attempt can still be completed on the same hosted checkout (Cashfree).
             or (status in ('failed', 'cancelled') and updated_at > now() - interval '2 hours'))
        and (provider = 'demo' or payment_session_id is not null or checkout_url is not null)
        and created_at < now() - interval '2 minutes'
        and (last_checked_at is null or last_checked_at < now() - (least(check_count, 6) * 10) * interval '1 minute')
      order by coalesce(last_checked_at, created_at)
      limit $1::int`,
    [limit],
  );
  return rows.map(map);
}

/** Attempts still "pending" after the reconciliation window: nothing more to guess, a person must look. */
export async function listPendingPastWindow(db: SqlExecutor, limit: number): Promise<Payment[]> {
  const rows = await db.query<PaymentRow>(
    `select ${COLUMNS} from payments where status = 'pending' and created_at <= now() - interval '3 days' order by created_at limit $1::int`,
    [limit],
  );
  return rows.map(map);
}
