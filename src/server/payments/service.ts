import { formatInr } from "@/domain/pricing";
import { getEnv } from "../config/env";
import { chooseProviders } from "../config/readiness";
import { getDb, jsonParam, type SqlExecutor } from "../db";
import { AppError, conflict, orderNotAccessible } from "../errors";
import { enqueueOutbox } from "../jobs/outbox";
import { log } from "../log";
import { alertOwner } from "../ops/alerts";
import { getOrder, recordFunnelEvent, type Order, type PaymentStatus } from "../orders/repository";
import { RATE_LIMITS, enforceRateLimit } from "../security/rate-limit";
import { CashfreeProvider } from "./cashfree";
import { DemoPaymentProvider } from "./demo";
import {
  getPaymentByProviderOrderId,
  insertPayment,
  listPaymentsForOrder,
  listPaymentsNeedingReconciliation,
  setPaymentSession,
  type Payment,
  type PaymentRowStatus,
} from "./repository";
import { PaymentProviderError, type CheckoutSession, type PaymentEvidence, type PaymentProvider } from "./types";

const CHECKOUT_TTL_MINUTES = 45;

let providerOverride: PaymentProvider | null = null;
/** Tests inject a fake provider (e.g. a Cashfree adapter with a stubbed fetch). */
export function setPaymentProviderForTests(provider: PaymentProvider | null): void {
  providerOverride = provider;
}

export function getPaymentProvider(): PaymentProvider {
  if (providerOverride) return providerOverride;
  const env = getEnv();
  if (chooseProviders(env).payments === "demo") {
    return new DemoPaymentProvider(async (providerOrderId) => {
      const payment = await getPaymentByProviderOrderId(await getDb(), providerOrderId);
      return payment ? { amountPaise: payment.amountPaise, providerStatus: payment.providerStatus } : null;
    });
  }
  if (!env.CASHFREE_CLIENT_ID || !env.CASHFREE_CLIENT_SECRET) throw new AppError("service_unavailable", "Payments are not configured.");
  return new CashfreeProvider({
    environment: env.CASHFREE_ENV,
    clientId: env.CASHFREE_CLIENT_ID,
    clientSecret: env.CASHFREE_CLIENT_SECRET,
    apiVersion: env.CASHFREE_API_VERSION,
  });
}

const RETRYABLE_ORDER_STATES: PaymentStatus[] = ["awaiting_payment", "failed", "cancelled", "expired", "pending"];

export interface CheckoutResponse {
  provider: "cashfree" | "demo";
  paymentSessionId: string | null;
  redirectUrl: string | null;
  environment: CheckoutSession["environment"];
  amountLabel: string;
}

/**
 * Opens (or re-opens) hosted checkout for an order. The amount always comes from the
 * order's stored price snapshot. A still-valid session is reused rather than creating
 * a second provider order, so a double click cannot produce two payable orders.
 */
export async function startCheckout(orderId: string, clientKey: string): Promise<CheckoutResponse> {
  const env = getEnv();
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.checkout, clientKey);
  const provider = getPaymentProvider();

  const prepared = await db.transaction(async (tx) => {
    const order = await getOrder(tx, orderId, { forUpdate: true });
    if (!order) throw orderNotAccessible();
    if (order.mode !== env.APP_MODE) throw conflict("This order was created in a different mode and cannot be paid here.");
    if (!RETRYABLE_ORDER_STATES.includes(order.paymentStatus)) {
      throw conflict(order.paymentStatus === "paid" ? "This order is already paid." : "This order needs attention from support before it can be paid.");
    }
    const payments = await listPaymentsForOrder(tx, orderId);
    const reusable = payments.find(
      (p) => p.provider === provider.id && (p.status === "created" || p.status === "pending") && p.expiresAt && p.expiresAt.getTime() > Date.now() + 5 * 60_000 && (p.paymentSessionId || p.provider === "demo"),
    );
    if (reusable) return { order, payment: reusable, reused: true };
    const attempt = (payments.at(-1)?.attempt ?? 0) + 1;
    if (attempt > 10) throw conflict("Too many payment attempts for this order. Please contact support.");
    const payment = await insertPayment(tx, {
      orderId,
      provider: provider.id,
      providerOrderId: `${order.reference}-${attempt}`,
      attempt,
      amountPaise: order.totalAmountPaise,
      currency: order.currency,
      expiresAt: new Date(Date.now() + CHECKOUT_TTL_MINUTES * 60_000),
    });
    return { order, payment, reused: false };
  });

  const { order, payment } = prepared;
  let session: CheckoutSession;
  if (prepared.reused && payment.paymentSessionId) {
    session = { paymentSessionId: payment.paymentSessionId, redirectUrl: null, environment: env.CASHFREE_ENV };
  } else {
    const site = env.PUBLIC_SITE_URL.replace(/\/$/, "");
    try {
      session = await provider.createCheckout({
        providerOrderId: payment.providerOrderId,
        amountPaise: payment.amountPaise,
        currency: "INR",
        customerId: order.reference.replace(/[^A-Za-z0-9]/g, ""),
        email: order.reportEmail,
        phone: order.payerPhone ?? "",
        returnUrl: `${site}/orders/${order.id}?payment=returned`,
        // Cashfree only accepts HTTPS notify URLs; locally we rely on reconciliation.
        notifyUrl: site.startsWith("https://") ? `${site}/api/webhooks/cashfree` : null,
        expiresAt: payment.expiresAt ?? new Date(Date.now() + CHECKOUT_TTL_MINUTES * 60_000),
        orderNote: `Rasi Astro report ${order.reference}`,
      });
    } catch (error) {
      await db.query(`update payments set status = 'failed', provider_status = 'CHECKOUT_CREATE_FAILED', updated_at = now() where id = $1::uuid and status = 'created'`, [payment.id]);
      log.error("checkout creation failed", { orderId, providerOrderId: payment.providerOrderId, error });
      if (error instanceof PaymentProviderError) throw new AppError("payment_provider_error", "We could not open the payment page. Please try again in a moment.");
      throw error;
    }
    if (session.paymentSessionId) await setPaymentSession(db, payment.id, session.paymentSessionId);
    await recordFunnelEvent(db, "checkout_started", order.mode, order.id);
  }
  log.info("checkout opened", { orderId, providerOrderId: payment.providerOrderId, provider: provider.id, reused: prepared.reused });
  return {
    provider: provider.id,
    paymentSessionId: session.paymentSessionId,
    redirectUrl: session.redirectUrl ?? (provider.id === "demo" ? `/demo/checkout/${encodeURIComponent(payment.providerOrderId)}` : null),
    environment: session.environment,
    amountLabel: formatInr(payment.amountPaise),
  };
}

export type EvidenceOutcome =
  | "confirmed"
  | "already_paid"
  | "duplicate_payment"
  | "amount_mismatch"
  | "status_updated"
  | "ignored_terminal"
  | "ignored_not_attempted"
  | "unknown_payment";

/**
 * The single place where payment state changes. Atomically:
 *  - verifies order identity, amount and currency against our stored snapshot;
 *  - marks the payment and order paid (idempotent: repeats are no-ops);
 *  - creates the report job and its outbox message in the same transaction.
 * Late or out-of-order notifications can never move a paid order backwards.
 */
export async function applyPaymentEvidence(evidence: PaymentEvidence): Promise<{ outcome: EvidenceOutcome; orderId: string | null }> {
  const db = await getDb();
  const env = getEnv();
  const result = await db.transaction(async (tx) => {
    const payment = await getPaymentByProviderOrderId(tx, evidence.providerOrderId, true);
    if (!payment || payment.provider !== evidence.provider) return { outcome: "unknown_payment" as const, orderId: null, order: null };
    const order = (await getOrder(tx, payment.orderId, { forUpdate: true }))!;

    if (evidence.status === "paid") {
      if (payment.status === "paid") return { outcome: "already_paid" as const, orderId: order.id, order };
      if (evidence.amountPaise !== payment.amountPaise || evidence.amountPaise !== order.totalAmountPaise || evidence.currency !== order.currency) {
        await markPaymentForReview(tx, payment, "amount_mismatch", evidence);
        if (order.paymentStatus !== "paid") await setOrderPaymentStatus(tx, order.id, "needs_review");
        return { outcome: "amount_mismatch" as const, orderId: order.id, order };
      }
      if (order.paymentStatus === "paid") {
        // A second successful payment for an already-paid order: flag for refund.
        await markPaymentForReview(tx, payment, "duplicate_payment", evidence);
        return { outcome: "duplicate_payment" as const, orderId: order.id, order };
      }
      await tx.query(
        `update payments set status = 'paid', provider_payment_id = $2, provider_status = $3, verified_at = now(), updated_at = now() where id = $1::uuid`,
        [payment.id, evidence.providerPaymentId, evidence.providerStatus],
      );
      await tx.query(
        `update orders set payment_status = 'paid', paid_at = now(), generation_status = 'queued', updated_at = now(),
                delete_after = now() + ($2::int * interval '1 day')
          where id = $1::uuid`,
        [order.id, env.RETENTION_REPORT_DAYS],
      );
      await tx.query(`insert into report_jobs (order_id) values ($1::uuid) on conflict (order_id) do nothing`, [order.id]);
      await enqueueOutbox(tx, "report.generate", order.id, `report.generate:${order.id}`);
      await recordFunnelEvent(tx, "payment_verified", order.mode, order.id);
      return { outcome: "confirmed" as const, orderId: order.id, order };
    }

    if (payment.status === "paid" || payment.status === "needs_review") return { outcome: "ignored_terminal" as const, orderId: order.id, order };
    if (evidence.status === "not_attempted") return { outcome: "ignored_not_attempted" as const, orderId: order.id, order };
    const next: PaymentRowStatus = evidence.status;
    await tx.query(`update payments set status = $2, provider_status = $3, updated_at = now() where id = $1::uuid`, [payment.id, next, evidence.providerStatus]);
    // Only the latest attempt drives the order's visible payment status.
    const latest = await tx.query<{ id: string }>(`select id from payments where order_id = $1::uuid order by attempt desc limit 1`, [order.id]);
    if (order.paymentStatus !== "paid" && order.paymentStatus !== "needs_review" && latest[0]?.id === payment.id) {
      await setOrderPaymentStatus(tx, order.id, next);
    }
    return { outcome: "status_updated" as const, orderId: order.id, order };
  });

  log.info("payment evidence applied", { orderId: result.orderId, providerOrderId: evidence.providerOrderId, outcome: result.outcome, status: evidence.status, provider: evidence.provider });
  if (result.outcome === "amount_mismatch" || result.outcome === "duplicate_payment") {
    await alertOwner(`Payment needs review (${result.outcome})`, `Order ${result.order?.reference ?? "?"} / provider order ${evidence.providerOrderId}. Check the payment provider dashboard; a refund may be needed.`);
  }
  if (result.outcome === "confirmed" && result.orderId) {
    const { dispatchForOrder } = await import("../jobs/dispatch");
    await dispatchForOrder(result.orderId);
  }
  return { outcome: result.outcome, orderId: result.orderId };
}

async function markPaymentForReview(tx: SqlExecutor, payment: Payment, reason: string, evidence: PaymentEvidence): Promise<void> {
  await tx.query(
    `update payments set status = 'needs_review', review_reason = $2, provider_payment_id = coalesce($3, provider_payment_id), provider_status = $4, updated_at = now() where id = $1::uuid`,
    [payment.id, reason, evidence.providerPaymentId, evidence.providerStatus],
  );
}

async function setOrderPaymentStatus(tx: SqlExecutor, orderId: string, status: PaymentStatus): Promise<void> {
  await tx.query(`update orders set payment_status = $2, updated_at = now() where id = $1::uuid`, [orderId, status]);
}

/**
 * Asks the provider for the authoritative status of every open payment attempt of an
 * order. Used when the customer returns from checkout, while the status page polls,
 * and by the scheduled sweeper - so a delayed or missed webhook never loses a payment.
 */
export async function reconcileOrderPayments(orderId: string): Promise<Order | null> {
  const db = await getDb();
  const payments = await listPaymentsForOrder(db, orderId);
  const provider = getPaymentProvider();
  for (const payment of payments) {
    if (payment.provider !== provider.id || !["created", "pending", "failed", "cancelled"].includes(payment.status)) continue;
    try {
      const evidence = await provider.fetchEvidence(payment.providerOrderId);
      await applyPaymentEvidence(evidence);
    } catch (error) {
      log.warn("payment reconciliation failed", { orderId, providerOrderId: payment.providerOrderId, error });
    }
  }
  return getOrder(db, orderId);
}

export async function refreshPaymentForCustomer(orderId: string, clientKey: string): Promise<Order | null> {
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.paymentRefresh, clientKey);
  return reconcileOrderPayments(orderId);
}

/** Scheduled sweep over recent open attempts. */
export async function reconcileRecentPayments(limit = 50): Promise<number> {
  const db = await getDb();
  const open = await listPaymentsNeedingReconciliation(db, limit);
  const provider = getPaymentProvider();
  let checked = 0;
  for (const payment of open) {
    if (payment.provider !== provider.id) continue;
    try {
      await applyPaymentEvidence(await provider.fetchEvidence(payment.providerOrderId));
      checked += 1;
    } catch (error) {
      log.warn("sweeper reconciliation failed", { providerOrderId: payment.providerOrderId, error });
    }
  }
  return checked;
}

/** Records a (signature-verified or rejected) provider notification exactly once. */
export async function recordPaymentEvent(
  db: SqlExecutor,
  e: { provider: string; dedupeKey: string; eventType: string; signatureVerified: boolean; evidence: PaymentEvidence | null; payload: Record<string, unknown> },
): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `insert into payment_events (provider, dedupe_key, event_type, provider_order_id, provider_payment_id, payment_status, amount_paise, currency, signature_verified, payload)
     values ($1, $2, $3, $4, $5, $6, $7::int, $8, $9, $10::jsonb)
     on conflict (dedupe_key) do nothing
     returning id`,
    [
      e.provider,
      e.dedupeKey,
      e.eventType,
      e.evidence?.providerOrderId ?? null,
      e.evidence?.providerPaymentId ?? null,
      e.evidence?.status ?? null,
      e.evidence?.amountPaise ?? null,
      e.evidence?.currency ?? null,
      e.signatureVerified,
      jsonParam(e.payload),
    ],
  );
  return rows.length > 0;
}

export async function markPaymentEventProcessed(db: SqlExecutor, dedupeKey: string, outcome: string): Promise<void> {
  await db.query(`update payment_events set processed_at = now(), outcome = $2 where dedupe_key = $1`, [dedupeKey, outcome]);
}
