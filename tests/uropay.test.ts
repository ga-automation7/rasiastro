import crypto from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as cashfreeWebhook } from "@/app/api/webhooks/cashfree/route";
import { POST as uroPayWebhook } from "@/app/api/webhooks/uropay/route";
import { listOrders } from "@/server/admin/records";
import { parseFilters } from "@/server/admin/filters";
import { getDb } from "@/server/db";
import { setEmailProviderForTests } from "@/server/delivery/email";
import { buildOwnerCsv } from "@/server/exports/csv";
import { createCompatibilityOrder, createOrder } from "@/server/orders/service";
import { CashfreeProvider } from "@/server/payments/cashfree";
import {
  reconcileOrderPayments,
  reconcileRecentPayments,
  setActivePaymentProviderForTests,
  setPaymentProvidersForTests,
  startCheckout,
} from "@/server/payments/service";
import { UroPayMerchantProvider, uroPayCanonicalString, uroPaySignature, verifyUroPayWebhook } from "@/server/payments/uropay";
import { CapturingEmailProvider, orderInput, resetOverrides, setTestEnv, setupTestDb, stubPdf, THREE_QUESTIONS } from "./helpers";

/**
 * Everything in this file runs against MOCKED provider APIs (no network, no real
 * UroPay or Cashfree account). The mock UroPay API below enforces the documented
 * request signing (https://api.uropai.in/documentation), so our signing is checked
 * against the specification, but a real UroPay TEST-key run is still required.
 */
const API_KEY = "uropay-test-key";
const API_SECRET = "uropay-test-secret";
const CF_SECRET = "cashfree-test-secret";

interface MockOrder {
  id: string;
  tenantOrderRef: string;
  status: string;
  amount: number;
  currency: string;
  payload: string;
}

function mockUroPay() {
  const orders = new Map<string, MockOrder>();
  const nonces = new Set<string>();
  const bodies: Record<string, unknown>[] = [];
  let dropNextCreateResponse = false;
  let offline = false;
  let creates = 0;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    if (offline) throw new TypeError("fetch failed");
    const u = new URL(String(url));
    const headers = new Headers(init?.headers);
    const method = init?.method ?? "GET";
    const rawBody = typeof init?.body === "string" ? init.body : "";
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    // The documented checks, implemented independently of the adapter.
    const ts = headers.get("x-timestamp") ?? "";
    const nonce = headers.get("x-nonce") ?? "";
    const canonical = [method, u.pathname, ts, nonce, u.search.replace(/^\?/, ""), rawBody].join("\n");
    const expected = crypto.createHmac("sha256", API_SECRET).update(canonical).digest("hex");
    const now = Math.floor(Date.now() / 1000);
    if (headers.get("x-api-key") !== API_KEY || headers.get("x-signature") !== expected || now - Number(ts) > 300 || Number(ts) - now > 30 || nonces.has(nonce)) {
      return json({ code: 401, status: "error", message: "Signature verification failed" }, 401);
    }
    nonces.add(nonce);
    if (method === "POST" && u.pathname === "/v1/orders") {
      creates += 1;
      const body = JSON.parse(rawBody) as { tenantOrderRef: string; amount: number; currency: string };
      bodies.push(body);
      const existing = [...orders.values()].find((o) => o.tenantOrderRef === body.tenantOrderRef);
      if (existing && existing.payload !== rawBody) return json({ code: 409, status: "error", message: "tenantOrderRef exists with a different payload" }, 409);
      const order = existing ?? { id: `URPY-TEST-${orders.size + 1}`, tenantOrderRef: body.tenantOrderRef, status: "PENDING", amount: body.amount, currency: body.currency ?? "INR", payload: rawBody };
      orders.set(order.id, order);
      if (dropNextCreateResponse) {
        dropNextCreateResponse = false;
        throw new DOMException("timed out", "TimeoutError");
      }
      const data = { id: order.id, tenantOrderRef: order.tenantOrderRef, status: order.status, amount: order.amount, currency: order.currency, checkoutType: "redirect", ...(order.status === "PENDING" ? { openUrl: `https://api.uropai.in/checkout/${order.id}` } : {}) };
      return json({ code: existing ? 200 : 201, status: "success", message: "Order created", data }, existing ? 200 : 201);
    }
    const match = /^\/v1\/orders\/([^/]+)$/.exec(u.pathname);
    if (method === "GET" && match) {
      const order = orders.get(decodeURIComponent(match[1]!));
      if (!order) return json({ code: 404, status: "error", message: "Order not found" }, 404);
      return json({ code: 200, status: "success", message: "Order found", data: { id: order.id, tenantOrderRef: order.tenantOrderRef, status: order.status, amount: order.amount, currency: order.currency, checkoutType: "redirect" } });
    }
    return json({ code: 404, status: "error", message: "Not found" }, 404);
  }) as typeof fetch;
  const provider = new UroPayMerchantProvider({ environment: "test", apiKey: API_KEY, apiSecret: API_SECRET, fetchImpl });
  const byRef = (ref: string) => [...orders.values()].find((o) => o.tenantOrderRef === ref)!;
  return {
    provider,
    orders,
    bodies,
    byRef,
    creates: () => creates,
    setStatus: (ref: string, status: string) => {
      byRef(ref).status = status;
    },
    dropNextCreateResponse: () => {
      dropNextCreateResponse = true;
    },
    setOffline: (value: boolean) => {
      offline = value;
    },
  };
}

/** MOCK Cashfree API (just enough for the provider-switch tests). */
function mockCashfree() {
  const orders = new Map<string, { amount: number; status: string }>();
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { order_id: string; order_amount: number; order_currency: string };
      orders.set(body.order_id, { amount: body.order_amount, status: "ACTIVE" });
      return json({ order_id: body.order_id, cf_order_id: 77, order_amount: body.order_amount, order_currency: "INR", order_status: "ACTIVE", payment_session_id: `cf_session_${body.order_id}` });
    }
    const match = /\/orders\/([^/]+)(\/payments)?$/.exec(u.pathname);
    const order = match ? orders.get(decodeURIComponent(match[1]!)) : undefined;
    if (!order) return json({ code: "order_not_found" }, 404);
    if (match![2]) return json([]);
    return json({ order_id: decodeURIComponent(match![1]!), order_amount: order.amount, order_currency: "INR", order_status: order.status });
  }) as typeof fetch;
  return { provider: new CashfreeProvider({ environment: "test", clientId: "cf-id", clientSecret: CF_SECRET, apiVersion: "2026-01-01", fetchImpl }), orders };
}

function signedWebhook(payload: Record<string, unknown>, opts: { secret?: string; apiKey?: string; timestamp?: number; nonce?: string } = {}) {
  const raw = JSON.stringify(payload);
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const nonce = opts.nonce ?? crypto.randomUUID();
  const signature = crypto.createHmac("sha256", opts.secret ?? API_SECRET).update(["POST", "/tenant-webhook", timestamp, nonce, "", raw].join("\n")).digest("hex");
  return new Request("http://localhost:3000/api/webhooks/uropay", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": opts.apiKey ?? API_KEY, "x-timestamp": timestamp, "x-nonce": nonce, "x-signature": signature },
    body: raw,
  });
}

function webhookPayload(order: MockOrder, status: string, overrides: Record<string, unknown> = {}) {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    orderId: order.id,
    tenantOrderRef: order.tenantOrderRef,
    status,
    amount_captured: status === "PAID" ? order.amount : 0,
    currency: "INR",
    commission: 0,
    transaction_fee: 0,
    tax: 0,
    net_amount: 0,
    environment: "TEST",
    ...overrides,
  };
}

async function orderState(orderId: string) {
  const db = await getDb();
  const [order] = await db.query<{ payment_status: string; generation_status: string }>("select payment_status, generation_status from orders where id = $1::uuid", [orderId]);
  const jobs = await db.query("select order_id from report_jobs where order_id = $1::uuid", [orderId]);
  const attempts = await db.query<{ provider: string; environment: string; provider_order_id: string; provider_reference: string | null; status: string }>(
    "select provider, environment, provider_order_id, provider_reference, status from payments where order_id = $1::uuid order by attempt",
    [orderId],
  );
  return { ...order!, jobs: jobs.length, attempts };
}

describe("UroPay Merchant API signing (documented algorithm)", () => {
  it("builds the canonical string exactly as documented and signs it with hex HMAC-SHA256", () => {
    const canonical = uroPayCanonicalString("POST", "/v1/orders", "1700000000", "nonce-1", "", '{"a":1}');
    expect(canonical).toBe('POST\n/v1/orders\n1700000000\nnonce-1\n\n{"a":1}');
    const expected = crypto.createHmac("sha256", "secret").update(canonical).digest("hex");
    expect(uroPaySignature(canonical, "secret")).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies webhooks with path /tenant-webhook and rejects bad signatures, wrong keys and replays", () => {
    const now = Math.floor(Date.now() / 1000);
    const raw = '{"eventId":"e1"}';
    const sign = (ts: number, secret = API_SECRET) => crypto.createHmac("sha256", secret).update(["POST", "/tenant-webhook", String(ts), "n1", "", raw].join("\n")).digest("hex");
    const creds = { apiKey: API_KEY, apiSecret: API_SECRET };
    const headers = (ts: number, secret?: string, apiKey = API_KEY) => ({ apiKey, timestamp: String(ts), nonce: "n1", signature: sign(ts, secret) });
    expect(verifyUroPayWebhook(headers(now), raw, creds, now)).toBe("ok");
    expect(verifyUroPayWebhook(headers(now, "attacker"), raw, creds, now)).toBe("bad_signature");
    expect(verifyUroPayWebhook(headers(now), raw.replace("e1", "e2"), creds, now)).toBe("bad_signature");
    expect(verifyUroPayWebhook(headers(now, undefined, "other-key"), raw, creds, now)).toBe("wrong_key");
    expect(verifyUroPayWebhook(headers(now - 301), raw, creds, now)).toBe("stale");
    expect(verifyUroPayWebhook(headers(now + 31), raw, creds, now)).toBe("stale");
    expect(verifyUroPayWebhook({ apiKey: API_KEY, timestamp: null, nonce: "n1", signature: "x" }, raw, creds, now)).toBe("missing_headers");
  });
});

describe("UroPay Merchant API checkout and verification (MOCKED UroPay API)", () => {
  let uro: ReturnType<typeof mockUroPay>;
  let cf: ReturnType<typeof mockCashfree>;
  let email: CapturingEmailProvider;

  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });
  beforeEach(() => {
    uro = mockUroPay();
    cf = mockCashfree();
    setPaymentProvidersForTests([uro.provider, cf.provider], "uropay");
    email = new CapturingEmailProvider();
    setEmailProviderForTests(email);
    stubPdf();
  });
  afterEach(() => resetOverrides());

  async function uroCheckout(questions = false) {
    const created = await createOrder(orderInput(questions ? { includeQuestions: true, questions: THREE_QUESTIONS } : {}), `ip-${crypto.randomUUID()}`);
    const checkout = await startCheckout(created.orderId, `ip-${crypto.randomUUID()}`);
    const [attempt] = (await orderState(created.orderId)).attempts;
    return { orderId: created.orderId, checkout, ref: attempt!.provider_order_id };
  }

  it("creates the UroPay order server-side with the server price in rupees and returns only browser-safe data", async () => {
    const personal = await uroCheckout();
    expect(personal.checkout).toMatchObject({ provider: "uropay", environment: "test", paymentSessionId: null });
    expect(personal.checkout.redirectUrl).toMatch(/^https:\/\/api\.uropai\.in\/checkout\//);
    expect(JSON.stringify(personal.checkout)).not.toContain(API_SECRET);
    expect(JSON.stringify(personal.checkout)).not.toContain(API_KEY);
    await uroCheckout(true);
    const pair = await createCompatibilityOrder(
      {
        category: "friendship",
        tradition: "indian",
        language: "en",
        shared: { howKnown: null, knownDuration: null, hopes: null, sharedCircumstances: null },
        email: "pair@example.com",
        phone: "9876543210",
        consentProcessing: true,
        adultConfirmed: true,
        thirdPartyPermission: true,
        participants: [
          { birth: { subjectName: "Asha", birthDate: "1990-01-01", timeCertainty: "unknown", birthTime: null, timeWindowMinutes: null, dstChoice: null, placeId: "demo:chennai" }, known: { moonSign: null, nakshatra: null, pada: null, ascendant: null, otherDetails: null }, additionalInfo: null },
          { birth: { subjectName: "Ravi", birthDate: "1991-02-02", timeCertainty: "unknown", birthTime: null, timeWindowMinutes: null, dstChoice: null, placeId: "demo:mumbai" }, known: { moonSign: null, nakshatra: null, pada: null, ascendant: null, otherDetails: null }, additionalInfo: null },
        ],
      },
      `ip-${crypto.randomUUID()}`,
    );
    await startCheckout(pair.orderId, `ip-${crypto.randomUUID()}`);
    expect(uro.bodies.map((b) => b.amount)).toEqual([49, 69, 39]);
    expect(uro.bodies.every((b) => b.currency === "INR")).toBe(true);
    const state = await orderState(personal.orderId);
    expect(state.attempts[0]).toMatchObject({ provider: "uropay", environment: "test", provider_reference: "URPY-TEST-1" });
    // Our references and UroPay's are stored separately from the internal order id.
    expect(state.attempts[0]!.provider_order_id).toMatch(/^RA-[0-9A-Z]{8}-1$/);
  });

  it("a verified PAID webhook is confirmed with UroPay's API before the order is marked paid (exactly one job)", async () => {
    const { orderId, ref } = await uroCheckout();
    uro.setStatus(ref, "PAID");
    const res = await uroPayWebhook(signedWebhook(webhookPayload(uro.byRef(ref), "PAID")));
    expect(res.status).toBe(200);
    expect(await orderState(orderId)).toMatchObject({ payment_status: "paid", jobs: 1 });
  });

  it("a PAID webhook is not trusted on its own: if UroPay's API still says PENDING nothing changes", async () => {
    const { orderId, ref } = await uroCheckout();
    const res = await uroPayWebhook(signedWebhook(webhookPayload(uro.byRef(ref), "PAID")));
    expect(res.status).toBe(200);
    expect(await orderState(orderId)).toMatchObject({ payment_status: "awaiting_payment", jobs: 0 });
  });

  it("invalid signatures, wrong keys and old timestamps are rejected and change nothing", async () => {
    const { orderId, ref } = await uroCheckout();
    uro.setStatus(ref, "PAID");
    const order = uro.byRef(ref);
    expect((await uroPayWebhook(signedWebhook(webhookPayload(order, "PAID"), { secret: "attacker" }))).status).toBe(401);
    expect((await uroPayWebhook(signedWebhook(webhookPayload(order, "PAID"), { apiKey: "someone-else" }))).status).toBe(401);
    expect((await uroPayWebhook(signedWebhook(webhookPayload(order, "PAID"), { timestamp: Math.floor(Date.now() / 1000) - 600 }))).status).toBe(401);
    expect((await orderState(orderId)).payment_status).toBe("awaiting_payment");
  });

  it("duplicate webhooks (same eventId) are processed once", async () => {
    const { orderId, ref } = await uroCheckout();
    uro.setStatus(ref, "PAID");
    const payload = webhookPayload(uro.byRef(ref), "PAID");
    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push(((await (await uroPayWebhook(signedWebhook(payload))).json()) as { status: string }).status);
    expect(statuses).toEqual(["ok", "duplicate", "duplicate"]);
    expect(await orderState(orderId)).toMatchObject({ payment_status: "paid", jobs: 1 });
    expect(email.sent.filter((e) => e.tags.kind === "report_ready")).toHaveLength(1);
  });

  it("amount and order mismatches are held for review, never fulfilled", async () => {
    const first = await uroCheckout();
    uro.setStatus(first.ref, "PAID");
    // UroPay reports a different captured amount than the order amount.
    await uroPayWebhook(signedWebhook(webhookPayload(uro.byRef(first.ref), "PAID", { amount_captured: 1 })));
    expect(await orderState(first.orderId)).toMatchObject({ payment_status: "needs_review", jobs: 0 });

    const second = await uroCheckout();
    uro.byRef(second.ref).amount = 1; // UroPay's own order shows the wrong amount
    uro.setStatus(second.ref, "PAID");
    await reconcileOrderPayments(second.orderId);
    expect(await orderState(second.orderId)).toMatchObject({ payment_status: "needs_review", jobs: 0 });

    // A notification naming a different UroPay order for our reference changes nothing.
    const third = await uroCheckout();
    uro.setStatus(third.ref, "PAID");
    await uroPayWebhook(signedWebhook(webhookPayload(uro.byRef(third.ref), "PAID", { orderId: "URPY-SOMEONE-ELSE" })));
    expect((await orderState(third.orderId)).payment_status).toBe("awaiting_payment");

    // A notification labelled for PRODUCTION on this TEST deployment is ignored.
    await uroPayWebhook(signedWebhook(webhookPayload(uro.byRef(third.ref), "PAID", { environment: "PRODUCTION" })));
    expect((await orderState(third.orderId)).payment_status).toBe("awaiting_payment");
  });

  it("repeated clicks reuse the open UroPay checkout; a failed order gets a fresh attempt", async () => {
    const { orderId, ref, checkout } = await uroCheckout();
    const again = await Promise.all([startCheckout(orderId, "a"), startCheckout(orderId, "b")]);
    for (const c of again) expect(c.redirectUrl).toBe(checkout.redirectUrl);
    expect(uro.creates()).toBe(1);

    uro.setStatus(ref, "FAILED");
    const retry = await startCheckout(orderId, "c");
    expect(retry.redirectUrl).not.toBe(checkout.redirectUrl);
    const state = await orderState(orderId);
    expect(state.attempts.map((a) => a.status)).toEqual(["failed", "created"]);
    expect(state.payment_status).toBe("failed");
  });

  it("a timed-out create is repeated with the identical payload, so UroPay returns the same order", async () => {
    const created = await createOrder(orderInput(), `ip-${crypto.randomUUID()}`);
    uro.dropNextCreateResponse();
    await expect(startCheckout(created.orderId, "t1")).rejects.toMatchObject({ code: "payment_provider_error" });
    const retry = await startCheckout(created.orderId, "t2");
    expect(retry.redirectUrl).toMatch(/URPY-TEST-1$/);
    expect(uro.orders.size).toBe(1);
    expect((await orderState(created.orderId)).attempts).toHaveLength(1);
  });

  it("a lost webhook is recovered by the sweeper; while UroPay is unreachable nothing is guessed", async () => {
    const { orderId, ref } = await uroCheckout();
    const db = await getDb();
    await db.query("update payments set created_at = now() - interval '10 minutes' where provider_order_id = $1", [ref]);
    uro.setStatus(ref, "PAID");
    uro.setOffline(true);
    await reconcileRecentPayments();
    expect((await orderState(orderId)).payment_status).toBe("awaiting_payment");
    // A webhook that arrives while UroPay's API is down is answered 500 and kept for later.
    const res = await uroPayWebhook(signedWebhook(webhookPayload(uro.byRef(ref), "PAID")));
    expect(res.status).toBe(500);
    uro.setOffline(false);
    await db.query("update payments set last_checked_at = null where provider_order_id = $1", [ref]);
    await reconcileRecentPayments();
    expect(await orderState(orderId)).toMatchObject({ payment_status: "paid", jobs: 1 });
  });

  it("switching to Cashfree affects new checkouts only; old UroPay orders keep working through UroPay", async () => {
    const old = await uroCheckout();
    const lost = await uroCheckout();
    setActivePaymentProviderForTests("cashfree");

    // The old, still-open order is sent back to its UroPay checkout: no Cashfree order is opened for it.
    const reopened = await startCheckout(old.orderId, "switch-1");
    expect(reopened).toMatchObject({ provider: "uropay", redirectUrl: old.checkout.redirectUrl });
    expect(cf.orders.size).toBe(0);

    // A new order goes to Cashfree.
    const fresh = await createOrder(orderInput(), `ip-${crypto.randomUUID()}`);
    const cfCheckout = await startCheckout(fresh.orderId, "switch-2");
    expect(cfCheckout).toMatchObject({ provider: "cashfree", environment: "test" });
    expect((await orderState(fresh.orderId)).attempts[0]).toMatchObject({ provider: "cashfree", environment: "test" });

    // A late UroPay webhook for the old order is still verified and confirmed through UroPay.
    uro.setStatus(old.ref, "PAID");
    expect((await uroPayWebhook(signedWebhook(webhookPayload(uro.byRef(old.ref), "PAID")))).status).toBe(200);
    expect(await orderState(old.orderId)).toMatchObject({ payment_status: "paid", jobs: 1 });

    // And a UroPay payment whose webhook was lost is recovered by the sweeper after the switch.
    uro.setStatus(lost.ref, "PAID");
    await (await getDb()).query("update payments set created_at = now() - interval '10 minutes' where provider_order_id = $1", [lost.ref]);
    await reconcileRecentPayments();
    expect((await orderState(lost.orderId)).payment_status).toBe("paid");
    // Historical UroPay attempts are never rewritten as Cashfree ones.
    expect((await orderState(old.orderId)).attempts.every((a) => a.provider === "uropay")).toBe(true);

    // The Cashfree webhook route works side by side.
    const raw = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: { order: { order_id: (await orderState(fresh.orderId)).attempts[0]!.provider_order_id, order_amount: 49, order_currency: "INR" }, payment: { cf_payment_id: 1, payment_status: "SUCCESS", payment_amount: 49, payment_currency: "INR" } },
    });
    const ts = String(Date.now());
    const sig = crypto.createHmac("sha256", CF_SECRET).update(ts + raw).digest("base64");
    const cfRes = await cashfreeWebhook(new Request("http://localhost/api/webhooks/cashfree", { method: "POST", headers: { "x-webhook-timestamp": ts, "x-webhook-signature": sig, "x-idempotency-key": `cf-${fresh.orderId}` }, body: raw }));
    expect(cfRes.status).toBe(200);
    expect((await orderState(fresh.orderId)).payment_status).toBe("paid");

    // The owner's exports list both providers with their own references.
    const db = await getDb();
    expect((await listOrders(db, parseFilters({ provider: "uropay" }), 1, 200)).rows.map((r) => r.id)).toEqual(expect.arrayContaining([old.orderId, lost.orderId]));
    expect((await listOrders(db, parseFilters({ provider: "cashfree" }), 1, 200)).rows.map((r) => r.id)).toContain(fresh.orderId);
    const { csv } = await buildOwnerCsv(db, parseFilters({ payment: "paid" }));
    expect(csv).toContain(old.ref);
    expect(csv).toContain(",uropay,test,");
    expect(csv).toContain(",cashfree,test,");
    expect(csv).not.toContain(API_SECRET);
    expect(csv).not.toContain(CF_SECRET);
  });
});
