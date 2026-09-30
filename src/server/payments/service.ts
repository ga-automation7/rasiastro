import { formatInr } from "@/domain/pricing";
import { getEnv, type Env } from "../config/env";
import { getDb, jsonParam, type SqlExecutor } from "../db";
import { AppError, conflict, orderNotAccessible } from "../errors";
import { enqueueOutbox } from "../jobs/outbox";
import { log } from "../log";
import { alertOwner } from "../ops/alerts";
import { getOrder, recordFunnelEvent, type Order, type PaymentStatus } from "../orders/repository";
import { RATE_LIMITS, enforceRateLimit } from "../security/rate-limit";
import { activeProvider, providerFor } from "./registry";
import {
  getPaymentByProviderOrderId,
  insertPayment,
  listPaymentsForOrder,
  listPaymentsNeedingReconciliation,
  listPendingPastWindow,
  recordPaymentCheck,
  saveCheckoutSession,
  wasOpened,
  type Payment,
  type PaymentRowStatus,
} from "./repository";
import { PaymentProviderError, safeProviderErrorCode, type CheckoutSession, type PaymentEnvironment, type PaymentEvidence, type PaymentProvider, type ProviderId } from "./types";

export { setActivePaymentProviderForTests, setPaymentProviderForTests, setPaymentProvidersForTests } from "./registry";

/** Don't hand out a checkout that is about to expire. */
const REUSE_MARGIN_MS = 5 * 60_000;
const MAX_ATTEMPTS = 10;
const RETRYABLE_ORDER_STATES: PaymentStatus[] = ["awaiting_payment", "failed", "cancelled", "expired", "pending"];

/** Browser-safe checkout details. Never contains credentials. */
export interface CheckoutResponse {
  provider: ProviderId;
  /** Cashfree: handed to the Cashfree browser SDK. */
  paymentSessionId: string | null;
  /** UroPay: the hosted checkout page. Demo: our simulated page. Otherwise our own order page. */
  redirectUrl: string | null;
  environment: PaymentEnvironment;
  amountLabel: string;
}

function assertPayable(order: Order, env: Env): void {
  if (order.mode !== env.APP_MODE) throw conflict("This order was created in a different mode and cannot be paid here.");
  if (order.paymentStatus === "paid") throw conflict("This order is already paid.");
  if (!RETRYABLE_ORDER_STATES.includes(order.paymentStatus)) throw conflict("This order needs attention from support before it can be paid.");
}

/** An attempt whose checkout the customer can simply be sent back to. */
function isReusable(p: Payment, provider: PaymentProvider): boolean {
  if (p.provider !== provider.id || p.environment !== provider.environment || !wasOpened(p)) return false;
  const open = p.status === "created" || p.status === "pending" || (provider.retryOnSameOrder && (p.status === "failed" || p.status === "cancelled"));
  // No local expiry means the provider decides; we reconciled just before, so it is still open there.
  return open && (!p.expiresAt || p.expiresAt.getTime() > Date.now() + REUSE_MARGIN_MS);
}

/** A create request that timed out: the provider may or may not have the order. */
function isUnconfirmedCreate(p: Payment, provider: PaymentProvider): boolean {
  return p.provider === provider.id && p.environment === provider.environment && p.status === "created" && !wasOpened(p);
}

/**
 * Opens (or re-opens) hosted checkout for an order. The amount always comes from the
 * order's stored price snapshot. Rules that prevent charging a customer twice:
 *  1. Every earlier attempt is first checked with the provider that created it.
 *  2. An order keeps the provider of its first attempt (PAYMENT_PROVIDER only affects
 *     orders that never opened checkout).
 *  3. A still-open checkout is reused rather than opening a second payable one.
 *  4. A create that timed out is repeated for the SAME attempt (providers treat it as
 *     the same order), never replaced by a new one.
 *  5. If any earlier attempt could not be checked, nothing new is opened.
 */
export async function startCheckout(orderId: string, clientKey: string): Promise<CheckoutResponse> {
  const env = getEnv();
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.checkout, clientKey);
  const current = await getOrder(db, orderId);
  if (!current) throw orderNotAccessible();
  assertPayable(current, env);

  const { uncertain } = await reconcileAttempts(db, orderId);

  const plan = await db.transaction(async (tx) => {
    const order = await getOrder(tx, orderId, { forUpdate: true });
    if (!order) throw orderNotAccessible();
    assertPayable(order, env);
    const attempts = await listPaymentsForOrder(tx, orderId);
    const first = attempts[0];
    const provider = first ? providerFor(first.provider, first.environment) : activeProvider();
    if (!provider) {
      throw conflict("This order was started with a payment option that is no longer available. Please place a new order, or contact support if money left your account.");
    }
    const latestFirst = [...attempts].reverse();
    const reusable = latestFirst.find((p) => isReusable(p, provider));
    if (reusable) return { order, payment: reusable, provider, kind: "reuse" as const };
    const unconfirmed = latestFirst.find((p) => isUnconfirmedCreate(p, provider));
    if (unconfirmed) return { order, payment: unconfirmed, provider, kind: "resume" as const };
    if (uncertain > 0) {
      throw conflict("We are still confirming an earlier payment attempt. Please wait a minute and tap “Check payment status” before paying again.");
    }
    const attempt = (attempts.at(-1)?.attempt ?? 0) + 1;
    if (attempt > MAX_ATTEMPTS) throw conflict("Too many payment attempts for this order. Please contact support.");
    const payment = await insertPayment(tx, {
      orderId,
      provider: provider.id,
      environment: provider.environment,
      providerOrderId: `${order.reference}-${attempt}`,
      attempt,
      amountPaise: order.totalAmountPaise,
      currency: order.currency,
      expiresAt: provider.checkoutLifetimeMinutes === null ? null : new Date(Date.now() + provider.checkoutLifetimeMinutes * 60_000),
    });
    return { order, payment, provider, kind: "new" as const };
  });

  const { order, payment, provider } = plan;
  const response = (paymentSessionId: string | null, redirectUrl: string | null): CheckoutResponse => ({
    provider: provider.id,
    paymentSessionId,
    redirectUrl,
    environment: provider.environment,
    amountLabel: formatInr(payment.amountPaise),
  });
  if (plan.kind === "reuse") {
    log.info("checkout reused", { orderId, providerOrderId: payment.providerOrderId, provider: provider.id });
    return response(payment.paymentSessionId, payment.checkoutUrl ?? (provider.id === "demo" ? demoCheckoutUrl(payment.providerOrderId) : null));
  }

  const site = env.PUBLIC_SITE_URL.replace(/\/$/, "");
  let session: CheckoutSession;
  try {
    session = await provider.createCheckout({
      providerOrderId: payment.providerOrderId,
      orderReference: order.reference,
      amountPaise: payment.amountPaise,
      currency: "INR",
      customerId: order.reference.replace(/[^A-Za-z0-9]/g, ""),
      email: order.reportEmail,
      phone: order.payerPhone ?? "",
      returnUrl: `${site}/orders/${order.id}?payment=returned`,
      // Providers only accept HTTPS notification URLs; locally we rely on reconciliation.
      notifyUrl: site.startsWith("https://") ? `${site}/api/webhooks/${provider.id}` : null,
      expiresAt: payment.expiresAt,
      orderNote: `Rasi Astro report ${order.reference}`,
    });
  } catch (error) {
    const code = safeProviderErrorCode(error);
    if (error instanceof PaymentProviderError && error.retriable) {
      // Outcome unknown: keep this attempt so the next try repeats the same create.
      await db.query(`update payments set provider_status = 'CREATE_UNCONFIRMED', last_check_error = $2, updated_at = now() where id = $1::uuid and status = 'created'`, [payment.id, code]);
    } else {
      await db.query(`update payments set status = 'failed', provider_status = 'CHECKOUT_CREATE_FAILED', last_check_error = $2, updated_at = now() where id = $1::uuid and status = 'created'`, [payment.id, code]);
    }
    log.error("checkout creation failed", { orderId, providerOrderId: payment.providerOrderId, provider: provider.id, code, error });
    if (error instanceof PaymentProviderError) throw new AppError("payment_provider_error", "We could not open the payment page. Please try again in a moment.");
    throw error;
  }
  await saveCheckoutSession(db, payment.id, { paymentSessionId: session.paymentSessionId, checkoutUrl: session.redirectUrl, providerReference: session.providerReference });
  if (!session.paymentSessionId && !session.redirectUrl) {
    // The provider says this order can no longer be paid (for example it is already paid): check it now.
    await reconcileAttempts(db, orderId);
    return response(null, `/orders/${order.id}?payment=returned`);
  }
  if (plan.kind === "new") await recordFunnelEvent(db, "checkout_started", order.mode, order.id);
  log.info("checkout opened", { orderId, providerOrderId: payment.providerOrderId, provider: provider.id, resumed: plan.kind === "resume" });
  return response(session.paymentSessionId, session.redirectUrl);
}

function demoCheckoutUrl(providerOrderId: string): string {
  return `/demo/checkout/${encodeURIComponent(providerOrderId)}`;
}

export type EvidenceOutcome =
  | "confirmed"
  | "already_paid"
  | "duplicate_payment"
  | "amount_mismatch"
  | "environment_mismatch"
  | "reference_mismatch"
  | "status_updated"
  | "ignored_terminal"
  | "ignored_not_attempted"
  | "ignored_mismatch"
  | "unknown_payment";

const REVIEW_OUTCOMES: EvidenceOutcome[] = ["amount_mismatch", "duplicate_payment", "environment_mismatch", "reference_mismatch"];

/**
 * The single place where payment state changes. Atomically:
 *  - checks the evidence belongs to this attempt: same provider, same environment,
 *    same provider order, and the amount and currency of our stored snapshot;
 *  - marks the payment and order paid (idempotent: repeats are no-ops);
 *  - creates the report job and its outbox message in the same transaction.
 * Late or out-of-order notifications can never move a paid order backwards, and a
 * failed attempt never overwrites a verified success.
 */
export async function applyPaymentEvidence(evidence: PaymentEvidence): Promise<{ outcome: EvidenceOutcome; orderId: string | null }> {
  const db = await getDb();
  const env = getEnv();
  const result = await db.transaction(async (tx) => {
    const payment = await getPaymentByProviderOrderId(tx, evidence.providerOrderId, true);
    if (!payment || payment.provider !== evidence.provider) return { outcome: "unknown_payment" as const, orderId: null, order: null };
    const order = (await getOrder(tx, payment.orderId, { forUpdate: true }))!;

    // Evidence from another environment (test vs production) or about another provider
    // order can never confirm this attempt. A "paid" claim is held for a person to check.
    const mismatch: EvidenceOutcome | null =
      payment.environment !== evidence.environment
        ? "environment_mismatch"
        : evidence.providerReference && payment.providerReference && evidence.providerReference !== payment.providerReference
          ? "reference_mismatch"
          : null;
    if (mismatch) {
      if (evidence.status !== "paid" || payment.status === "paid") return { outcome: "ignored_mismatch" as const, orderId: order.id, order };
      await markPaymentForReview(tx, payment, mismatch, evidence);
      if (order.paymentStatus !== "paid") await setOrderPaymentStatus(tx, order.id, "needs_review");
      return { outcome: mismatch, orderId: order.id, order };
    }
    if (evidence.providerReference && !payment.providerReference) {
      await tx.query(`update payments set provider_reference = $2 where id = $1::uuid`, [payment.id, evidence.providerReference]);
    }

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
      // Exactly one job per order: report_jobs is unique on order_id, the outbox on its key.
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

  log.info("payment evidence applied", {
    orderId: result.orderId,
    providerOrderId: evidence.providerOrderId,
    outcome: result.outcome,
    status: evidence.status,
    provider: evidence.provider,
    environment: evidence.environment,
  });
  if (REVIEW_OUTCOMES.includes(result.outcome)) {
    await alertOwner(
      `Payment needs review (${result.outcome})`,
      `Order ${result.order?.reference ?? "?"} / ${evidence.provider} ${evidence.environment} order ${evidence.providerOrderId}. Check the payment provider dashboard; a refund may be needed.`,
    );
  }
  if (result.outcome === "confirmed" && result.orderId) {
    const { dispatchForOrder } = await import("../jobs/dispatch");
    await dispatchForOrder(result.orderId);
  }
  return { outcome: result.outcome, orderId: result.orderId };
}

async function markPaymentForReview(tx: SqlExecutor, payment: Payment, reason: string, evidence: PaymentEvidence | null): Promise<void> {
  await tx.query(
    `update payments set status = 'needs_review', review_reason = $2, provider_payment_id = coalesce($3, provider_payment_id),
            provider_status = coalesce($4, provider_status), updated_at = now()
      where id = $1::uuid`,
    [payment.id, reason, evidence?.providerPaymentId ?? null, evidence?.providerStatus ?? null],
  );
}

async function setOrderPaymentStatus(tx: SqlExecutor, orderId: string, status: PaymentStatus): Promise<void> {
  await tx.query(`update orders set payment_status = $2, updated_at = now() where id = $1::uuid`, [orderId, status]);
}

/** Attempts worth asking the provider about: the customer had a checkout, and it may not be final. */
function mayStillChange(p: Payment): boolean {
  if (!wasOpened(p)) return false;
  if (p.status === "created" || p.status === "pending") return true;
  // A failed/cancelled Cashfree payment can still be completed on the same checkout for a while.
  return (p.status === "failed" || p.status === "cancelled") && p.updatedAt.getTime() > Date.now() - 2 * 3_600_000;
}

/**
 * Asks the provider that created an attempt for its authoritative status and applies it.
 * Returns false when the answer is unknown (provider unreachable or not configured here);
 * the attempt then stays as it is. We never guess success or failure.
 */
async function checkAttempt(db: SqlExecutor, p: Payment): Promise<boolean> {
  const provider = providerFor(p.provider, p.environment);
  if (!provider) {
    await recordPaymentCheck(db, p.id, "provider_not_configured");
    return false;
  }
  try {
    const evidence = await provider.fetchEvidence({ providerOrderId: p.providerOrderId, providerReference: p.providerReference });
    await recordPaymentCheck(db, p.id, null);
    await applyPaymentEvidence(evidence);
    return true;
  } catch (error) {
    const code = safeProviderErrorCode(error);
    await recordPaymentCheck(db, p.id, code);
    log.warn("payment status check failed", { orderId: p.orderId, providerOrderId: p.providerOrderId, provider: p.provider, code });
    return false;
  }
}

async function reconcileAttempts(db: SqlExecutor, orderId: string): Promise<{ uncertain: number }> {
  let uncertain = 0;
  for (const p of await listPaymentsForOrder(db, orderId)) {
    if (mayStillChange(p) && !(await checkAttempt(db, p))) uncertain += 1;
  }
  return { uncertain };
}

/**
 * Checks every open attempt of an order with its own provider. Used when the customer
 * returns from checkout, while the status page polls, and by the owner's scripts.
 */
export async function reconcileOrderPayments(orderId: string): Promise<Order | null> {
  const db = await getDb();
  await reconcileAttempts(db, orderId);
  return getOrder(db, orderId);
}

export async function refreshPaymentForCustomer(orderId: string, clientKey: string): Promise<Order | null> {
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.paymentRefresh, clientKey);
  return reconcileOrderPayments(orderId);
}

/** Checks one attempt by our reference (used by the webhook routes after a notification). */
export async function reconcilePaymentAttempt(providerOrderId: string): Promise<boolean> {
  const db = await getDb();
  const payment = await getPaymentByProviderOrderId(db, providerOrderId);
  return payment ? checkAttempt(db, payment) : false;
}

/**
 * Scheduled sweep (every 10 minutes): recovers late or lost notifications for every
 * provider this deployment can reach, including a provider that is no longer active
 * for new checkouts. Attempts still pending after the 3-day window are handed to a
 * person instead of being guessed.
 */
export async function reconcileRecentPayments(limit = 50): Promise<number> {
  const db = await getDb();
  let checked = 0;
  for (const p of await listPaymentsNeedingReconciliation(db, limit)) {
    // Attempts from another environment belong to another deployment.
    if (!providerFor(p.provider, p.environment)) continue;
    if (await checkAttempt(db, p)) checked += 1;
  }
  for (const p of await listPendingPastWindow(db, 20)) {
    if (!providerFor(p.provider, p.environment)) continue;
    await db.transaction(async (tx) => {
      await markPaymentForReview(tx, p, "unresolved_after_window", null);
      await tx.query(`update orders set payment_status = 'needs_review', updated_at = now() where id = $1::uuid and payment_status = 'pending'`, [p.orderId]);
    });
    await alertOwner("Payment still pending after 3 days", `${p.provider} ${p.environment} order ${p.providerOrderId}: the provider never gave a final answer. Check its dashboard.`);
  }
  return checked;
}

/** Records a (signature-verified) provider notification exactly once. */
export async function recordPaymentEvent(
  db: SqlExecutor,
  e: {
    provider: ProviderId;
    environment: PaymentEnvironment;
    dedupeKey: string;
    eventType: string;
    signatureVerified: boolean;
    providerOrderId: string | null;
    evidence: PaymentEvidence | null;
    payload: Record<string, unknown>;
  },
): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `insert into payment_events (provider, environment, dedupe_key, event_type, provider_order_id, provider_payment_id, payment_status, amount_paise, currency, signature_verified, payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8::int, $9, $10, $11::jsonb)
     on conflict (dedupe_key) do nothing
     returning id`,
    [
      e.provider,
      e.environment,
      e.dedupeKey,
      e.eventType,
      e.providerOrderId ?? e.evidence?.providerOrderId ?? null,
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

export async function isPaymentEventProcessed(db: SqlExecutor, dedupeKey: string): Promise<boolean> {
  const rows = await db.query<{ processed: boolean }>(`select processed_at is not null as processed from payment_events where dedupe_key = $1`, [dedupeKey]);
  return rows[0]?.processed ?? false;
}

export async function markPaymentEventProcessed(db: SqlExecutor, dedupeKey: string, outcome: string): Promise<void> {
  await db.query(`update payment_events set processed_at = now(), outcome = $2 where dedupe_key = $1`, [dedupeKey, outcome]);
}
