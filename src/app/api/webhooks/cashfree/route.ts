import { NextResponse } from "next/server";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { parseCashfreeWebhook, verifyCashfreeSignature } from "@/server/payments/cashfree";
import { applyPaymentEvidence, getPaymentProvider, markPaymentEventProcessed, recordPaymentEvent } from "@/server/payments/service";

export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, string>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Cashfree payment webhooks.
 * 1. Verify the signature over the exact raw body (never a re-serialised JSON).
 * 2. Record the event once (duplicates are acknowledged without reprocessing).
 * 3. Apply it through the same atomic, idempotent payment state machine used by
 *    reconciliation. Paid orders can never move backwards.
 * A 5xx response makes Cashfree retry; unprocessed events are then re-applied.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  let providerId: string | null = null;
  try {
    providerId = getPaymentProvider().id;
  } catch {
    providerId = null;
  }
  if (providerId !== "cashfree" || !env.CASHFREE_CLIENT_SECRET) {
    return reply(503, { status: "payments_not_configured" });
  }
  const raw = await request.text();
  if (raw.length > 64_000) return reply(413, { status: "too_large" });
  const valid = verifyCashfreeSignature(raw, request.headers.get("x-webhook-timestamp"), request.headers.get("x-webhook-signature"), env.CASHFREE_CLIENT_SECRET);
  if (!valid) {
    log.warn("cashfree webhook rejected: bad signature");
    return reply(401, { status: "invalid_signature" });
  }

  let parsed;
  try {
    parsed = parseCashfreeWebhook(raw, request.headers.get("x-idempotency-key"));
  } catch {
    return reply(400, { status: "invalid_payload" });
  }

  try {
    const db = await getDb();
    const isNew = await recordPaymentEvent(db, {
      provider: "cashfree",
      dedupeKey: parsed.dedupeKey,
      eventType: parsed.type,
      signatureVerified: true,
      evidence: parsed.evidence,
      payload: parsed.auditPayload,
    });
    if (!isNew) {
      const rows = await db.query<{ processed: boolean }>(`select processed_at is not null as processed from payment_events where dedupe_key = $1`, [parsed.dedupeKey]);
      if (rows[0]?.processed) return reply(200, { status: "duplicate" });
    }
    if (!parsed.evidence) {
      await markPaymentEventProcessed(db, parsed.dedupeKey, "ignored_event_type");
      return reply(200, { status: "ignored" });
    }
    const { outcome } = await applyPaymentEvidence(parsed.evidence);
    await markPaymentEventProcessed(db, parsed.dedupeKey, outcome);
    return reply(200, { status: "ok" });
  } catch (error) {
    log.error("cashfree webhook processing failed", { error, event: parsed.type });
    return reply(500, { status: "retry" });
  }
}
