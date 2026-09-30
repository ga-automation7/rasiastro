import crypto from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as cashfreeWebhook } from "@/app/api/webhooks/cashfree/route";
import { getDb } from "@/server/db";
import { CashfreeProvider, parseCashfreeWebhook, verifyCashfreeSignature } from "@/server/payments/cashfree";
import { applyPaymentEvidence, reconcileOrderPayments, reconcileRecentPayments, setPaymentProviderForTests, startCheckout } from "@/server/payments/service";
import { createOrder } from "@/server/orders/service";
import { resetEnvCacheForTests } from "@/server/config/env";
import { CapturingEmailProvider, orderInput, resetOverrides, setTestEnv, setupTestDb, stubPdf } from "./helpers";
import { setEmailProviderForTests } from "@/server/delivery/email";

const SECRET = "test-cashfree-secret";

/**
 * MOCK: a fake Cashfree API (no network). It remembers orders we create, refuses a
 * duplicate order id with 409 like the real API, and answers status lookups.
 * These tests prove our logic, not a live Cashfree integration.
 */
function fakeCashfree() {
  const orders = new Map<string, { amount: number; status: string; payments: { cf_payment_id: number; payment_status: string; payment_amount: number; payment_time: string }[] }>();
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (init?.method === "POST" && u.pathname.endsWith("/orders")) {
      const body = JSON.parse(String(init.body)) as { order_id: string; order_amount: number; order_currency: string };
      creates += 1;
      if (orders.has(body.order_id)) return json({ code: "order_already_exists", message: "order already exists" }, 409);
      orders.set(body.order_id, { amount: body.order_amount, status: "ACTIVE", payments: [] });
      if (dropNextCreateResponse) {
        // The order was created, but the response never reached us.
        dropNextCreateResponse = false;
        throw new DOMException("timed out", "TimeoutError");
      }
      return json({ order_id: body.order_id, cf_order_id: 900 + orders.size, order_amount: body.order_amount, order_currency: body.order_currency, order_status: "ACTIVE", payment_session_id: `session_${body.order_id}` });
    }
    const match = /\/orders\/([^/]+)(\/payments)?$/.exec(u.pathname);
    const order = match ? orders.get(decodeURIComponent(match[1]!)) : undefined;
    if (!order) return json({ code: "order_not_found" }, 404);
    if (match![2]) return json(order.payments);
    const id = decodeURIComponent(match![1]!);
    return json({ order_id: id, order_amount: order.amount, order_currency: "INR", order_status: order.status, payment_session_id: `session_${id}` });
  }) as typeof fetch;
  let creates = 0;
  let dropNextCreateResponse = false;
  const provider = new CashfreeProvider({ environment: "test", clientId: "id", clientSecret: SECRET, apiVersion: "2026-01-01", fetchImpl });
  const markPaid = (id: string, amount?: number) => {
    const o = orders.get(id)!;
    o.status = "PAID";
    o.payments.push({ cf_payment_id: 1000 + o.payments.length, payment_status: "SUCCESS", payment_amount: amount ?? o.amount, payment_time: new Date().toISOString() });
  };
  const markFailed = (id: string) => {
    const o = orders.get(id)!;
    o.payments.push({ cf_payment_id: 2000 + o.payments.length, payment_status: "FAILED", payment_amount: o.amount, payment_time: new Date().toISOString() });
  };
  return {
    provider,
    orders,
    markPaid,
    markFailed,
    creates: () => creates,
    dropNextCreateResponse: () => {
      dropNextCreateResponse = true;
    },
  };
}

function webhookBody(orderId: string, status: string, amount: number, paymentId = 555) {
  return JSON.stringify({
    data: {
      order: { order_id: orderId, order_amount: amount, order_currency: "INR" },
      payment: { cf_payment_id: paymentId, payment_status: status, payment_amount: amount, payment_currency: "INR", payment_group: "upi" },
      customer_details: { customer_email: "customer@example.com", customer_phone: "9876543210" },
    },
    event_time: new Date().toISOString(),
    type: status === "SUCCESS" ? "PAYMENT_SUCCESS_WEBHOOK" : status === "FAILED" ? "PAYMENT_FAILED_WEBHOOK" : "PAYMENT_USER_DROPPED_WEBHOOK",
  });
}

function signedRequest(raw: string, opts: { secret?: string; idempotencyKey?: string } = {}) {
  const ts = String(Date.now());
  const signature = crypto.createHmac("sha256", opts.secret ?? SECRET).update(ts + raw).digest("base64");
  return new Request("http://localhost:3000/api/webhooks/cashfree", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-timestamp": ts, "x-webhook-signature": signature, ...(opts.idempotencyKey ? { "x-idempotency-key": opts.idempotencyKey } : {}) },
    body: raw,
  });
}

async function orderState(orderId: string) {
  const db = await getDb();
  const [order] = await db.query<{ payment_status: string; generation_status: string }>("select payment_status, generation_status from orders where id = $1::uuid", [orderId]);
  const jobs = await db.query("select * from report_jobs where order_id = $1::uuid", [orderId]);
  const outbox = await db.query("select * from outbox where order_id = $1::uuid and topic = 'report.generate'", [orderId]);
  return { ...order!, jobs: jobs.length, outbox: outbox.length };
}

describe("Cashfree webhook signature", () => {
  it("accepts only an HMAC of timestamp + exact raw body with the secret", () => {
    const raw = webhookBody("RA-AAAAAAAA-1", "SUCCESS", 49);
    const ts = "1700000000000";
    const good = crypto.createHmac("sha256", SECRET).update(ts + raw).digest("base64");
    expect(verifyCashfreeSignature(raw, ts, good, SECRET)).toBe(true);
    expect(verifyCashfreeSignature(raw, ts, good, "wrong-secret")).toBe(false);
    expect(verifyCashfreeSignature(raw + " ", ts, good, SECRET)).toBe(false); // body re-serialised/modified
    expect(verifyCashfreeSignature(raw, "1700000000001", good, SECRET)).toBe(false);
    expect(verifyCashfreeSignature(raw, null, good, SECRET)).toBe(false);
    expect(verifyCashfreeSignature(raw, ts, null, SECRET)).toBe(false);
  });

  it("parses amounts exactly and flags payment/order amount disagreement", () => {
    const ok = parseCashfreeWebhook(webhookBody("RA-AAAAAAAA-1", "SUCCESS", 69), "key-1", "test");
    expect(ok.evidence).toMatchObject({ status: "paid", amountPaise: 6900, currency: "INR", providerOrderId: "RA-AAAAAAAA-1" });
    expect(ok.dedupeKey).toBe("cashfree:key-1");
    expect(JSON.stringify(ok.auditPayload)).not.toContain("customer@example.com");
    const raw = JSON.parse(webhookBody("RA-AAAAAAAA-1", "SUCCESS", 69)) as { data: { payment: { payment_amount: number } } };
    raw.data.payment.payment_amount = 1;
    expect(parseCashfreeWebhook(JSON.stringify(raw), null, "test").evidence?.amountPaise).toBe(-1);
  });
});

describe("payment state machine (Cashfree adapter against a MOCKED Cashfree API)", () => {
  let cf: ReturnType<typeof fakeCashfree>;
  let email: CapturingEmailProvider;

  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });

  beforeEach(() => {
    cf = fakeCashfree();
    setPaymentProviderForTests(cf.provider);
    email = new CapturingEmailProvider();
    setEmailProviderForTests(email);
    stubPdf();
  });
  afterEach(() => resetOverrides());

  async function newCheckout(includeQuestions = false) {
    const created = await createOrder(
      orderInput(includeQuestions ? { includeQuestions: true, questions: ["What themes may shape my career soon?", "How can I be more patient with family?", "What should I focus on this year?"] } : {}),
      `ip-${crypto.randomUUID()}`,
    );
    const checkout = await startCheckout(created.orderId, `ip-${crypto.randomUUID()}`);
    const [payment] = await (await getDb()).query<{ provider_order_id: string }>("select provider_order_id from payments where order_id = $1::uuid", [created.orderId]);
    return { orderId: created.orderId, providerOrderId: payment!.provider_order_id, checkout };
  }

  it("creates the provider order with the server price and returns a session id", async () => {
    const { providerOrderId, checkout } = await newCheckout(true);
    expect(checkout.provider).toBe("cashfree");
    expect(checkout.paymentSessionId).toBe(`session_${providerOrderId}`);
    expect(cf.orders.get(providerOrderId)!.amount).toBe(69);
  });

  it("reuses an open checkout instead of creating a second payable order", async () => {
    const { orderId } = await newCheckout();
    await startCheckout(orderId, "ip-again");
    const payments = await (await getDb()).query("select id from payments where order_id = $1::uuid", [orderId]);
    expect(payments).toHaveLength(1);
  });

  it("a valid webhook marks the order paid and creates exactly one job + outbox entry, atomically", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    const raw = webhookBody(providerOrderId, "SUCCESS", 49);
    const res = await cashfreeWebhook(signedRequest(raw, { idempotencyKey: `idem-${providerOrderId}` }));
    expect(res.status).toBe(200);
    const state = await orderState(orderId);
    expect(state.payment_status).toBe("paid");
    expect(state.jobs).toBe(1);
    expect(state.outbox).toBe(1);
  });

  it("duplicate webhooks are acknowledged but never processed twice", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    const raw = webhookBody(providerOrderId, "SUCCESS", 49);
    for (let i = 0; i < 3; i += 1) expect((await cashfreeWebhook(signedRequest(raw, { idempotencyKey: `dup-${providerOrderId}` }))).status).toBe(200);
    // A different delivery of the same success (new idempotency key) is also harmless.
    await cashfreeWebhook(signedRequest(raw, { idempotencyKey: `dup2-${providerOrderId}` }));
    const state = await orderState(orderId);
    expect(state).toMatchObject({ payment_status: "paid", jobs: 1, outbox: 1 });
    const emails = email.sent.filter((e) => e.tags.kind === "report_ready");
    expect(emails).toHaveLength(1);
  });

  it("rejects a webhook with an invalid signature and changes nothing", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    const res = await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "SUCCESS", 49), { secret: "attacker" }));
    expect(res.status).toBe(401);
    expect((await orderState(orderId)).payment_status).toBe("awaiting_payment");
  });

  it("a mismatched amount is held for review and no report is generated", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    const res = await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "SUCCESS", 1)));
    expect(res.status).toBe(200);
    const state = await orderState(orderId);
    expect(state).toMatchObject({ payment_status: "needs_review", jobs: 0, outbox: 0 });
  });

  it("out-of-order notifications cannot move a paid order backwards", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "SUCCESS", 49, 1)));
    await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "FAILED", 49, 2)));
    await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "USER_DROPPED", 49, 3)));
    expect((await orderState(orderId)).payment_status).toBe("paid");
  });

  it("a failure before success leaves the order retryable, then success still completes it", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "FAILED", 49, 11)));
    expect((await orderState(orderId)).payment_status).toBe("failed");
    await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "SUCCESS", 49, 12)));
    expect((await orderState(orderId)).payment_status).toBe("paid");
  });

  it("reconciles a missed webhook from the provider's API (return page / sweeper)", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    cf.markPaid(providerOrderId); // customer paid; webhook never arrived
    expect((await orderState(orderId)).payment_status).toBe("awaiting_payment");
    await reconcileOrderPayments(orderId);
    const state = await orderState(orderId);
    expect(state).toMatchObject({ payment_status: "paid", jobs: 1, outbox: 1 });
  });

  it("the scheduled sweeper also recovers missed webhooks", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    await (await getDb()).query("update payments set created_at = now() - interval '10 minutes' where provider_order_id = $1", [providerOrderId]);
    cf.markPaid(providerOrderId);
    await reconcileRecentPayments();
    expect((await orderState(orderId)).payment_status).toBe("paid");
  });

  it("a second successful payment on an already-paid order is flagged for refund, not double-fulfilled", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    await applyPaymentEvidence({ source: "api", provider: "cashfree", environment: "test", providerReference: null, providerOrderId, providerPaymentId: "1", status: "paid", amountPaise: 4900, currency: "INR", providerStatus: "t" });
    // Simulate a second attempt that also got paid (e.g. two tabs).
    const db = await getDb();
    await db.query(
      `insert into payments (order_id, provider, environment, provider_order_id, attempt, amount_paise, currency, status) values ($1::uuid, 'cashfree', 'test', $2, 2, 4900, 'INR', 'created')`,
      [orderId, `${providerOrderId}-b`],
    );
    const second = await applyPaymentEvidence({ source: "api", provider: "cashfree", environment: "test", providerReference: null, providerOrderId: `${providerOrderId}-b`, providerPaymentId: "2", status: "paid", amountPaise: 4900, currency: "INR", providerStatus: "t" });
    expect(second.outcome).toBe("duplicate_payment");
    const flagged = await db.query<{ status: string; review_reason: string }>("select status, review_reason from payments where provider_order_id = $1", [`${providerOrderId}-b`]);
    expect(flagged[0]).toMatchObject({ status: "needs_review", review_reason: "duplicate_payment" });
    expect((await orderState(orderId)).jobs).toBe(1);
  });

  it("an unconfigured webhook endpoint refuses (so Cashfree retries later)", async () => {
    setPaymentProviderForTests(null);
    const res = await cashfreeWebhook(signedRequest(webhookBody("RA-X-1", "SUCCESS", 49)));
    expect(res.status).toBe(503);
    resetEnvCacheForTests();
  });

  it("double clicks and repeated checkout requests never create a second payable order", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    const again = await Promise.all([startCheckout(orderId, "ip-a"), startCheckout(orderId, "ip-b"), startCheckout(orderId, "ip-c")]);
    for (const c of again) expect(c.paymentSessionId).toBe(`session_${providerOrderId}`);
    expect(await (await getDb()).query("select id from payments where order_id = $1::uuid", [orderId])).toHaveLength(1);
    expect(cf.creates()).toBe(1);
  });

  it("a create request that timed out is repeated for the same attempt, never replaced by a second order", async () => {
    const created = await createOrder(orderInput(), `ip-${crypto.randomUUID()}`);
    cf.dropNextCreateResponse();
    await expect(startCheckout(created.orderId, "ip-1")).rejects.toMatchObject({ code: "payment_provider_error" });
    const db = await getDb();
    const [unconfirmed] = await db.query<{ provider_order_id: string; status: string; provider_status: string }>(
      "select provider_order_id, status, provider_status from payments where order_id = $1::uuid",
      [created.orderId],
    );
    expect(unconfirmed).toMatchObject({ status: "created", provider_status: "CREATE_UNCONFIRMED" });
    // Cashfree did create it: the retry gets 409, looks the order up and uses its session.
    const retry = await startCheckout(created.orderId, "ip-2");
    expect(retry.paymentSessionId).toBe(`session_${unconfirmed!.provider_order_id}`);
    expect(await db.query("select attempt from payments where order_id = $1::uuid", [created.orderId])).toHaveLength(1);
  });

  it("a failed payment reopens the same Cashfree order instead of creating a second one", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    cf.markFailed(providerOrderId);
    await reconcileOrderPayments(orderId);
    expect((await orderState(orderId)).payment_status).toBe("failed");
    const retry = await startCheckout(orderId, "ip-retry");
    expect(retry.paymentSessionId).toBe(`session_${providerOrderId}`);
    expect(await (await getDb()).query("select id from payments where order_id = $1::uuid", [orderId])).toHaveLength(1);
  });

  it("closing the checkout or losing connection does not mark the payment failed", async () => {
    const { orderId } = await newCheckout();
    // The customer never came back and no webhook arrived: Cashfree still says ACTIVE, nothing attempted.
    await reconcileOrderPayments(orderId);
    expect((await orderState(orderId)).payment_status).toBe("awaiting_payment");
  });

  it("while the provider cannot be reached, nothing new is opened and nothing is guessed", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    const db = await getDb();
    // Make the existing checkout unusable so a new one would otherwise be opened.
    await db.query("update payments set expires_at = now() - interval '1 minute' where provider_order_id = $1", [providerOrderId]);
    const offline = new CashfreeProvider({
      environment: "test",
      clientId: "id",
      clientSecret: SECRET,
      apiVersion: "2026-01-01",
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });
    setPaymentProviderForTests(offline);
    await expect(startCheckout(orderId, "ip-offline")).rejects.toMatchObject({ code: "conflict" });
    expect(await db.query("select id from payments where order_id = $1::uuid", [orderId])).toHaveLength(1);
    const [row] = await db.query<{ status: string; last_check_error: string; check_count: number }>(
      "select status, last_check_error, check_count from payments where provider_order_id = $1",
      [providerOrderId],
    );
    expect(row).toMatchObject({ status: "created", last_check_error: "unreachable", check_count: 1 });
    expect((await orderState(orderId)).payment_status).toBe("awaiting_payment");
  });

  it("a success followed by a failed retry keeps the verified payment", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "SUCCESS", 49, 31), { idempotencyKey: `s-${providerOrderId}` }));
    // A second tab retries and fails afterwards.
    await cashfreeWebhook(signedRequest(webhookBody(providerOrderId, "FAILED", 49, 32), { idempotencyKey: `f-${providerOrderId}` }));
    await applyPaymentEvidence({ source: "api", provider: "cashfree", environment: "test", providerReference: null, providerOrderId, providerPaymentId: "32", status: "failed", amountPaise: 4900, currency: "INR", providerStatus: "t" });
    const [payment] = await (await getDb()).query<{ status: string }>("select status from payments where provider_order_id = $1", [providerOrderId]);
    expect(payment!.status).toBe("paid");
    expect(await orderState(orderId)).toMatchObject({ payment_status: "paid", jobs: 1, outbox: 1 });
    await expect(startCheckout(orderId, "ip-after")).rejects.toMatchObject({ code: "conflict" });
  });

  it("evidence from the other environment can never mark an order paid", async () => {
    const { orderId, providerOrderId } = await newCheckout();
    const outcome = await applyPaymentEvidence({ source: "api", provider: "cashfree", environment: "production", providerReference: null, providerOrderId, providerPaymentId: "9", status: "paid", amountPaise: 4900, currency: "INR", providerStatus: "t" });
    expect(outcome.outcome).toBe("environment_mismatch");
    expect(await orderState(orderId)).toMatchObject({ payment_status: "needs_review", jobs: 0 });
  });

  it("a notification for an order we never created changes nothing", async () => {
    const res = await cashfreeWebhook(signedRequest(webhookBody("RA-NOTOURS-1", "SUCCESS", 49), { idempotencyKey: "unknown-1" }));
    expect(res.status).toBe(200);
    const [event] = await (await getDb()).query<{ outcome: string }>("select outcome from payment_events where dedupe_key = 'cashfree:unknown-1'");
    expect(event!.outcome).toBe("unknown_payment");
  });

});
