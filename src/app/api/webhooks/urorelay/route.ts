import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { rupeeAmountToPaise } from "@/domain/pricing";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { alertOwner } from "@/server/ops/alerts";
import { deploymentProvider } from "@/server/payments/registry";
import { getPaymentByProviderOrderId, getPaymentByProviderReference, recordRelayCredit, type Payment } from "@/server/payments/repository";
import { isPaymentEventProcessed, markPaymentEventProcessed, reconcilePaymentAttempt, recordPaymentEvent } from "@/server/payments/service";
import { UroRelayProvider, describePayloadShape, relayEnvironment } from "@/server/payments/urorelay";

export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, string>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);

/**
 * UroRelay webhooks (set in the UroRelay dashboard: https://rasiastro.com/api/webhooks/urorelay).
 * Three events, possibly several per order:
 *  - companion.sms.data: the Companion app read a UPI credit SMS on the owner's phone.
 *    We keep the bank reference and amount (unmatched credits stay visible to the owner).
 *  - order.status.utrsubmitted: a customer's UTR reached UroPay. Unverified.
 *  - order.status.changed: REVIEW_REQUIRED or COMPLETED.
 * None of them marks anything paid directly: each one only makes us ask UroPay for the
 * order's status (server-side) and apply the rules in urorelay.ts. UroPay marks a
 * delivery FAILED unless we answer 200, so errors after verification are logged and
 * left to the scheduled sweeper.
 */
export async function POST(request: Request): Promise<Response> {
  const provider = deploymentProvider("urorelay");
  if (!(provider instanceof UroRelayProvider)) return reply(503, { status: "payments_not_configured" });
  const raw = await request.text();
  if (raw.length > 64_000) return reply(413, { status: "too_large" });
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { status: "invalid_payload" });
    payload = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { status: "invalid_payload" });
  }
  // The signature covers a documented rebuild of the JSON (see urorelay.ts), so it is
  // checked after parsing. Anything unsigned or altered is refused.
  if (!provider.verifyWebhook(payload, request.headers.get("x-uropay-signature"), raw)) {
    // Shape only (field names and types), so a format change can be diagnosed without logging data.
    log.warn("urorelay webhook rejected: bad signature", {
      shape: describePayloadShape(payload),
      hasSignature: Boolean(request.headers.get("x-uropay-signature")),
      environmentHeader: request.headers.get("x-uropay-environment"),
    });
    return reply(401, { status: "invalid_signature" });
  }

  const event = str(payload.event) ?? "companion.sms.data";
  const environment = relayEnvironment(payload.environment) ?? relayEnvironment(request.headers.get("x-uropay-environment"));
  const webhookId = request.headers.get("x-uropay-webhook-id") ?? crypto.createHash("sha256").update(raw).digest("hex");
  const dedupeKey = `urorelay:${webhookId.slice(0, 200)}`;
  const uroPayOrderId = str(payload.uroPayOrderId);
  const merchantOrderId = str(payload.merchantOrderId);

  try {
    const db = await getDb();
    const isNew = await recordPaymentEvent(db, {
      provider: "urorelay",
      environment: provider.environment,
      dedupeKey,
      eventType: event,
      signatureVerified: true,
      providerOrderId: merchantOrderId,
      evidence: null,
      // Audit copy without payer name, payer UPI ID or customer email.
      payload: {
        event,
        uroPayOrderId,
        merchantOrderId,
        orderStatus: str(payload.orderStatus),
        amount: str(payload.amount),
        referenceNumber: str(payload.referenceNumber) ?? str(payload.submittedUTR),
        environment: str(payload.environment),
        detectedAt: str(payload.detectedAt),
      },
    });
    if (!isNew && (await isPaymentEventProcessed(db, dedupeKey))) return reply(200, { status: "duplicate" });
    const finish = async (outcome: string) => {
      await markPaymentEventProcessed(db, dedupeKey, outcome);
      return reply(200, { status: "ok" });
    };

    if (environment !== provider.environment) {
      // For example the phone is set to TEST in the UroRelay dashboard while the site is live.
      log.warn("urorelay webhook for another environment ignored", { environment: str(payload.environment) });
      await alertOwner(
        "UroRelay environment mismatch",
        `A UroRelay notification said ${str(payload.environment) ?? "no environment"} but this site expects ${provider.environment === "production" ? "LIVE" : "TEST"}. Check the environment of your phone in the UroRelay dashboard. Nothing was changed.`,
      );
      return finish("environment_mismatch");
    }

    // Which of our attempts is this about? Our own reference (merchantOrderId) is unique;
    // when UroPay sends both identifiers they must belong to the same attempt.
    let payment: Payment | null = merchantOrderId
      ? await getPaymentByProviderOrderId(db, merchantOrderId)
      : uroPayOrderId
        ? await getPaymentByProviderReference(db, "urorelay", uroPayOrderId)
        : null;
    if (payment && (payment.provider !== "urorelay" || (uroPayOrderId && payment.providerReference !== uroPayOrderId))) payment = null;

    if (event === "companion.sms.data") {
      const referenceNumber = str(payload.referenceNumber);
      const amountPaise = rupeeAmountToPaise(payload.amount);
      const detected = str(payload.detectedAt);
      const { isNew: newCredit, row } = await recordRelayCredit(db, {
        environment,
        referenceNumber,
        amountPaise,
        uroPayOrderId,
        merchantOrderId,
        detectedAt: detected && !Number.isNaN(Date.parse(detected)) ? new Date(detected) : null,
        paymentId: payment?.id ?? null,
      });
      if (!payment) {
        // A real UPI credit we cannot tie to an order: never guess. The owner sees it in /admin.
        if (newCredit) await alertOwner("Unmatched UPI credit", `A UPI credit of ${amountPaise === null ? "an unknown amount" : `Rs ${(amountPaise / 100).toFixed(2)}`} was reported but matched no order. Check it in the admin dashboard.`);
        return finish("unmatched_credit");
      }
      if (!newCredit && row.payment_id && row.payment_id !== payment.id) {
        await alertOwner("UPI reference reported twice", `Bank reference ${referenceNumber ?? "?"} was reported for two different orders. Nothing was changed; check the admin dashboard.`);
        return finish("reference_conflict");
      }
    }

    if (!payment) return finish("unknown_payment");
    if (event === "order.status.changed" && str(payload.orderStatus) === "REVIEW_REQUIRED") {
      await alertOwner(
        "UPI payment needs your check",
        `Payment ${payment.providerOrderId}: the customer gave a UPI reference but no bank SMS confirmed it within 2 minutes. Check your bank account, then confirm or reject it in the admin dashboard.`,
      );
    }
    // The only thing a notification does: make us ask UroPay ourselves.
    const checked = await reconcilePaymentAttempt(payment.providerOrderId);
    return finish(checked ? "checked" : "check_pending");
  } catch (error) {
    // Answer 200 anyway (UroPay does not retry); the sweeper re-checks open attempts.
    log.error("urorelay webhook processing failed", { error, event });
    return reply(200, { status: "logged" });
  }
}
