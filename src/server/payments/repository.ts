import type { SqlExecutor } from "../db";

export type PaymentRowStatus = "created" | "pending" | "paid" | "failed" | "cancelled" | "expired" | "needs_review";

export interface Payment {
  id: string;
  orderId: string;
  provider: "cashfree" | "demo";
  providerOrderId: string;
  attempt: number;
  amountPaise: number;
  currency: string;
  status: PaymentRowStatus;
  paymentSessionId: string | null;
  providerPaymentId: string | null;
  providerStatus: string | null;
  reviewReason: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  verifiedAt: Date | null;
}

interface PaymentRow {
  id: string;
  order_id: string;
  provider: "cashfree" | "demo";
  provider_order_id: string;
  attempt: number;
  amount_paise: number;
  currency: string;
  status: PaymentRowStatus;
  payment_session_id: string | null;
  provider_payment_id: string | null;
  provider_status: string | null;
  review_reason: string | null;
  created_at: Date;
  expires_at: Date | null;
  verified_at: Date | null;
}

const COLUMNS = `id, order_id, provider, provider_order_id, attempt, amount_paise, currency, status, payment_session_id,
  provider_payment_id, provider_status, review_reason, created_at, expires_at, verified_at`;

const map = (r: PaymentRow): Payment => ({
  id: r.id,
  orderId: r.order_id,
  provider: r.provider,
  providerOrderId: r.provider_order_id,
  attempt: r.attempt,
  amountPaise: r.amount_paise,
  currency: r.currency,
  status: r.status,
  paymentSessionId: r.payment_session_id,
  providerPaymentId: r.provider_payment_id,
  providerStatus: r.provider_status,
  reviewReason: r.review_reason,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  verifiedAt: r.verified_at,
});

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
  p: { orderId: string; provider: "cashfree" | "demo"; providerOrderId: string; attempt: number; amountPaise: number; currency: string; expiresAt: Date },
): Promise<Payment> {
  const rows = await db.query<PaymentRow>(
    `insert into payments (order_id, provider, provider_order_id, attempt, amount_paise, currency, expires_at)
     values ($1::uuid, $2, $3, $4::int, $5::int, $6, $7::timestamptz)
     returning ${COLUMNS}`,
    [p.orderId, p.provider, p.providerOrderId, p.attempt, p.amountPaise, p.currency, p.expiresAt.toISOString()],
  );
  return map(rows[0]!);
}

export async function setPaymentSession(db: SqlExecutor, paymentId: string, sessionId: string | null): Promise<void> {
  await db.query(`update payments set payment_session_id = $2, updated_at = now() where id = $1::uuid`, [paymentId, sessionId]);
}

export async function listPaymentsNeedingReconciliation(db: SqlExecutor, limit: number): Promise<Payment[]> {
  const rows = await db.query<PaymentRow>(
    `select ${COLUMNS} from payments
      where ((status in ('created', 'pending') and created_at > now() - interval '3 days')
             -- A failed/cancelled attempt can still be completed on the same hosted checkout.
             or (status in ('failed', 'cancelled') and updated_at > now() - interval '2 hours'))
        and created_at < now() - interval '2 minutes'
      order by created_at
      limit $1::int`,
    [limit],
  );
  return rows.map(map);
}
