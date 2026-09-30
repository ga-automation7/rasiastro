import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { alertOwner } from "@/server/ops/alerts";
import { deploymentProvider } from "@/server/payments/registry";
import { getPaymentByProviderOrderId } from "@/server/payments/repository";
import { applyPaymentEvidence, isPaymentEventProcessed, markPaymentEventProcessed, recordPaymentEvent } from "@/server/payments/service";
import { UroPayMerchantProvider, parseUroPayWebhook, uroPayEnvironmentLabel } from "@/server/payments/uropay";

export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, string>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * UroPay Merchant API order-status webhook. Stays active whichever provider is chosen
 * for new checkouts, as long as this environment's UroPay keys are configured.
 *
 * UroPay documents this webhook as ADVISORY: best effort, possibly duplicated, never
 * the source of truth. So after verifying it we ask UroPay for the order ourselves
 * (signed GET /v1/orders/{id}) and only that answer can mark an order paid. Lost
 * webhooks are recovered by the scheduled sweeper.
 */
export async function POST(request: Request): Promise<Response> {
  const provider = deploymentProvider("uropay");
  if (!(provider instanceof UroPayMerchantProvider)) return reply(503, { status: "payments_not_configured" });
  const raw = await request.text();
  if (raw.length > 64_000) return reply(413, { status: "too_large" });
  const check = provider.verifyWebhook(
    {
      apiKey: request.headers.get("x-api-key"),
      timestamp: request.headers.get("x-timestamp"),
      nonce: request.headers.get("x-nonce"),
      signature: request.headers.get("x-signature"),
    },
    raw,
  );
  if (check !== "ok") {
    log.warn("uropay webhook rejected", { code: check });
    return reply(401, { status: "invalid_signature" });
  }

  let event;
  try {
    event = parseUroPayWebhook(raw);
  } catch {
    event = null;
  }
  if (!event) return reply(400, { status: "invalid_payload" });

  const dedupeKey = `uropay:${event.eventId}`;
  try {
    const db = await getDb();
    const isNew = await recordPaymentEvent(db, {
      provider: "uropay",
      environment: provider.environment,
      dedupeKey,
      eventType: `order.${event.status}`,
      signatureVerified: true,
      providerOrderId: event.tenantOrderRef,
      evidence: null,
      payload: event.auditPayload,
    });
    if (!isNew && (await isPaymentEventProcessed(db, dedupeKey))) return reply(200, { status: "duplicate" });

    const ignore = async (outcome: string) => {
      await markPaymentEventProcessed(db, dedupeKey, outcome);
      return reply(200, { status: "ignored" });
    };
    // Signed with this environment's key, yet labelled for the other one: never act on it.
    if (event.environment !== uroPayEnvironmentLabel(provider.environment)) {
      log.warn("uropay webhook for another environment ignored", { environment: event.environment });
      return ignore("environment_mismatch");
    }
    const payment = await getPaymentByProviderOrderId(db, event.tenantOrderRef);
    if (!payment || payment.provider !== "uropay" || payment.environment !== provider.environment) return ignore("unknown_payment");
    if (payment.providerReference && payment.providerReference !== event.orderId) {
      await alertOwner("UroPay webhook reference mismatch", `Attempt ${payment.providerOrderId} is linked to a different UroPay order than the notification. Nothing was changed.`);
      return ignore("reference_mismatch");
    }

    // The authoritative answer. If UroPay cannot be reached we answer 500: the event
    // stays unprocessed and the sweeper checks the order again later.
    const evidence = await provider.fetchEvidence({ providerOrderId: payment.providerOrderId, providerReference: event.orderId });
    if (evidence.status === "paid" && event.status === "PAID" && event.capturedPaise !== null && event.capturedPaise !== evidence.amountPaise) {
      // The order amount matches but UroPay reported a different captured amount: hold it for a person.
      evidence.amountPaise = -1;
    }
    const { outcome } = await applyPaymentEvidence(evidence);
    await markPaymentEventProcessed(db, dedupeKey, outcome);
    return reply(200, { status: "ok" });
  } catch (error) {
    log.error("uropay webhook processing failed", { error, status: event.status });
    return reply(500, { status: "retry" });
  }
}
