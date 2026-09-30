import crypto from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as relayWebhook } from "@/app/api/webhooks/urorelay/route";
import { listRelayReviews, listUnmatchedCredits } from "@/server/admin/records";
import { getDb } from "@/server/db";
import { setEmailProviderForTests } from "@/server/delivery/email";
import { buildOwnerCsv } from "@/server/exports/csv";
import { parseFilters } from "@/server/admin/filters";
import { createCompatibilityOrder, createOrder } from "@/server/orders/service";
import { getOrderStatusView } from "@/server/orders/status";
import { CashfreeProvider } from "@/server/payments/cashfree";
import { getRelayAttemptFacts } from "@/server/payments/repository";
import {
  confirmPaymentManually,
  reconcileOrderPayments,
  rejectPaymentManually,
  setActivePaymentProviderForTests,
  setPaymentProvidersForTests,
  startCheckout,
  submitPaymentReference,
} from "@/server/payments/service";
import { UroRelayProvider, normaliseUpiReference, uroRelaySignedJson, verifyUroRelaySignature } from "@/server/payments/urorelay";
import { CapturingEmailProvider, orderInput, resetOverrides, setTestEnv, setupTestDb, stubPdf, THREE_QUESTIONS } from "./helpers";

/**
 * Everything here runs against a MOCKED UroRelay API (no network, no UroPay account,
 * no phone). The mock checks the documented headers; webhooks are signed with an
 * independent copy of UroPay's documented Node.js example. A real run with the
 * Companion app and a real UPI payment is still required before going live.
 */
const KEY = "relay-test-key";
const SECRET = "relay-test-secret";
const sha512 = (v: string) => crypto.createHash("sha512").update(v).digest("hex");

function mockRelay() {
  const orders = new Map<string, { id: string; merchantOrderId: string; amount: number; status: string; utr: string | null }>();
  const generated: Record<string, unknown>[] = [];
  const updates: { uroPayOrderId: string; referenceNumber: string }[] = [];
  let upiAmountOverride: string | null = null;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const headers = new Headers(init?.headers);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (headers.get("x-api-key") !== KEY) return json({ code: 401, status: "error", message: "Unauthorized" }, 401);
    const method = init?.method ?? "GET";
    if (method !== "GET" && headers.get("authorization") !== `Bearer ${sha512(SECRET)}`) return json({ code: 401, status: "error", message: "Unauthorized" }, 401);
    if (method === "POST" && u.pathname === "/order/generate") {
      const body = JSON.parse(String(init!.body)) as { amount: number; merchantOrderId: string };
      generated.push(body);
      const id = `relay-order-${crypto.randomUUID().slice(0, 8)}`;
      orders.set(id, { id, merchantOrderId: body.merchantOrderId, amount: body.amount, status: "CREATED", utr: null });
      const rupees = (body.amount / 100).toFixed(2);
      return json({
        code: 200,
        status: "success",
        message: "Order created successfully",
        data: {
          uroPayOrderId: id,
          orderStatus: "CREATED",
          upiString: `upi://pay?pa=owner@icici&pn=Rasi%20Astro&am=${upiAmountOverride ?? String(body.amount / 100)}&cu=INR&tn=Rasi%20Astro&tr=${id}`,
          qrCode: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          amountInRupees: rupees,
        },
      });
    }
    if (method === "PATCH" && u.pathname === "/order/update") {
      const body = JSON.parse(String(init!.body)) as { uroPayOrderId: string; referenceNumber: string };
      const order = orders.get(body.uroPayOrderId);
      if (!order) return json({ code: 404, status: "error", message: "Not found" }, 404);
      if ([...orders.values()].some((o) => o.utr === body.referenceNumber && o.id !== order.id)) return json({ code: 400, status: "error", message: "referenceNumber already used" }, 400);
      updates.push(body);
      order.utr = body.referenceNumber;
      order.status = "UTR_SUBMITTED";
      return json({ code: 200, status: "success", message: "updated", data: { uroPayOrderId: order.id, orderStatus: "UTR_SUBMITTED" } });
    }
    const match = /^\/order\/status\/(.+)$/.exec(u.pathname);
    if (method === "GET" && match) {
      const order = orders.get(decodeURIComponent(match[1]!));
      if (!order) return json({ code: 404, status: "error", message: "Not found" }, 404);
      return json({ code: 200, status: "success", message: `Order status is ${order.status}`, data: { uroPayOrderId: order.id, orderStatus: order.status } });
    }
    return json({ code: 404, status: "error", message: "Not found" }, 404);
  }) as typeof fetch;
  const provider = new UroRelayProvider({ environment: "test", apiKey: KEY, apiSecret: SECRET, fetchImpl, lookup: async (id) => getRelayAttemptFacts(await getDb(), id) });
  return {
    provider,
    orders,
    generated,
    updates,
    setStatus: (id: string, status: string) => {
      orders.get(id)!.status = status;
    },
    breakUpiAmount: (value: string) => {
      upiAmountOverride = value;
    },
  };
}

/** Independent copy of UroPay's documented Node.js signing example. */
function docSignature(payload: Record<string, unknown>, secret = SECRET): string {
  let ordered: Record<string, unknown>;
  if (payload.event === "order.status.utrsubmitted") {
    ordered = {
      event: payload.event,
      uroPayOrderId: payload.uroPayOrderId,
      merchantOrderId: payload.merchantOrderId,
      orderStatus: payload.orderStatus,
      submittedUTR: payload.submittedUTR ?? null,
      amount: payload.amount,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerVPA: payload.customerVPA ?? null,
      environment: payload.environment,
      utrSubmittedAt: payload.utrSubmittedAt ?? null,
    };
  } else if ("orderStatus" in payload) {
    ordered = { event: payload.event, uroPayOrderId: payload.uroPayOrderId, merchantOrderId: payload.merchantOrderId, orderStatus: payload.orderStatus, submittedUTR: payload.submittedUTR ?? null, environment: payload.environment };
  } else {
    const tail = ["uroPayOrderId", "merchantOrderId", "detectedAt", "environment"];
    ordered = {};
    if ("event" in payload) ordered.event = payload.event;
    for (const k of Object.keys(payload).filter((k) => !new Set([...tail, "event"]).has(k)).sort((a, b) => a.localeCompare(b))) ordered[k] = payload[k];
    for (const k of tail) ordered[k] = payload[k] ?? null;
  }
  return crypto.createHmac("sha256", sha512(secret)).update(JSON.stringify(ordered)).digest("hex");
}

function webhook(payload: Record<string, unknown>, opts: { secret?: string; id?: string; environmentHeader?: string } = {}) {
  return new Request("http://localhost:3000/api/webhooks/urorelay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-uropay-signature": docSignature(payload, opts.secret),
      "x-uropay-webhook-id": opts.id ?? Buffer.from(crypto.randomUUID()).toString("base64"),
      "x-uropay-environment": opts.environmentHeader ?? "TEST",
    },
    body: JSON.stringify(payload),
  });
}

const smsEvent = (o: { uroPayOrderId: string | null; merchantOrderId: string | null; utr: string; rupees: string }) => ({
  event: "companion.sms.data",
  amount: o.rupees,
  referenceNumber: o.utr,
  from: "Payer Name",
  vpa: "payer@upi",
  uroPayOrderId: o.uroPayOrderId,
  merchantOrderId: o.merchantOrderId,
  detectedAt: new Date().toISOString(),
  environment: "TEST",
});
const statusEvent = (uroPayOrderId: string, merchantOrderId: string, orderStatus: string, utr: string | null) => ({
  event: "order.status.changed",
  uroPayOrderId,
  merchantOrderId,
  orderStatus,
  submittedUTR: utr,
  environment: "TEST",
});

async function state(orderId: string) {
  const db = await getDb();
  const [order] = await db.query<{ payment_status: string }>("select payment_status from orders where id = $1::uuid", [orderId]);
  const jobs = await db.query("select order_id from report_jobs where order_id = $1::uuid", [orderId]);
  const attempts = await db.query<{ id: string; status: string; provider_order_id: string; provider_reference: string; submitted_reference: string | null; review_reason: string | null; confirmed_by: string | null }>(
    "select id, status, provider_order_id, provider_reference, submitted_reference, review_reason, confirmed_by from payments where order_id = $1::uuid order by attempt",
    [orderId],
  );
  return { payment: order!.payment_status, jobs: jobs.length, attempts };
}

let utrCounter = 100_000_000_000;
const newUtr = () => String((utrCounter += 7));

describe("UroRelay webhook signature (documented algorithm)", () => {
  it("verifies all three documented payload shapes, whatever order the keys arrive in", () => {
    const sms = smsEvent({ uroPayOrderId: "o-1", merchantOrderId: "RA-1-1", utr: "430686551035", rupees: "49.00" });
    const utr = { event: "order.status.utrsubmitted", uroPayOrderId: "o-1", merchantOrderId: "RA-1-1", orderStatus: "UTR_SUBMITTED", submittedUTR: "430686551035", amount: 4900, customerName: "x", customerEmail: "y@z", customerVPA: null, environment: "TEST", utrSubmittedAt: "2026-09-30T10:00:00.000Z" };
    const changed = statusEvent("o-1", "RA-1-1", "COMPLETED", "430686551035");
    for (const payload of [sms, utr, changed] as Record<string, unknown>[]) {
      const signature = docSignature(payload);
      const reversed = Object.fromEntries(Object.entries(payload).reverse());
      expect(verifyUroRelaySignature(reversed, SECRET, signature)).toBe(true);
      expect(verifyUroRelaySignature({ ...payload, environment: "LIVE" }, SECRET, signature)).toBe(false);
      expect(verifyUroRelaySignature(payload, "wrong-secret", signature)).toBe(false);
      expect(verifyUroRelaySignature(payload, SECRET, null)).toBe(false);
    }
    expect(uroRelaySignedJson(sms)).toBe(
      '{"event":"companion.sms.data","amount":"49.00","from":"Payer Name","referenceNumber":"430686551035","vpa":"payer@upi","uroPayOrderId":"o-1","merchantOrderId":"RA-1-1","detectedAt":' +
        JSON.stringify(sms.detectedAt) +
        ',"environment":"TEST"}',
    );
  });

  it("accepts only 12 digit UPI references", () => {
    expect(normaliseUpiReference("4306 8655 1035")).toBe("430686551035");
    expect(normaliseUpiReference("43068655103")).toBeNull();
    expect(normaliseUpiReference("43068655103X")).toBeNull();
  });
});

describe("UroRelay payments (MOCKED UroRelay API)", () => {
  let relay: ReturnType<typeof mockRelay>;
  let email: CapturingEmailProvider;

  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });
  beforeEach(() => {
    relay = mockRelay();
    setPaymentProvidersForTests([relay.provider], "urorelay");
    email = new CapturingEmailProvider();
    setEmailProviderForTests(email);
    stubPdf();
  });
  afterEach(() => resetOverrides());

  async function relayCheckout(questions = false) {
    const created = await createOrder(orderInput(questions ? { includeQuestions: true, questions: THREE_QUESTIONS } : {}), `ip-${crypto.randomUUID()}`);
    const checkout = await startCheckout(created.orderId, `ip-${crypto.randomUUID()}`);
    const { attempts } = await state(created.orderId);
    return { orderId: created.orderId, checkout, attempt: attempts[0]! };
  }

  it("creates the UroRelay order server-side in paise and shows the QR on our own page", async () => {
    const { orderId, checkout, attempt } = await relayCheckout();
    expect(checkout).toMatchObject({ provider: "urorelay", paymentSessionId: null, redirectUrl: `/orders/${orderId}?payment=upi` });
    expect(JSON.stringify(checkout)).not.toContain(SECRET);
    await relayCheckout(true);
    const pair = await createCompatibilityOrder(
      {
        category: "marriage",
        tradition: "indian",
        language: "ta",
        shared: { howKnown: null, knownDuration: null, hopes: null, sharedCircumstances: null },
        email: "pair@example.com",
        phone: "9876543210",
        consentProcessing: true,
        adultConfirmed: true,
        thirdPartyPermission: true,
        participants: [
          { birth: { subjectName: "Meena", birthDate: "1992-03-03", timeCertainty: "unknown", birthTime: null, timeWindowMinutes: null, dstChoice: null, placeId: "demo:chennai" }, known: { moonSign: null, nakshatra: null, pada: null, ascendant: null, otherDetails: null }, additionalInfo: null },
          { birth: { subjectName: "Arun", birthDate: "1990-04-04", timeCertainty: "unknown", birthTime: null, timeWindowMinutes: null, dstChoice: null, placeId: "demo:mumbai" }, known: { moonSign: null, nakshatra: null, pada: null, ascendant: null, otherDetails: null }, additionalInfo: null },
        ],
      },
      `ip-${crypto.randomUUID()}`,
    );
    await startCheckout(pair.orderId, `ip-${crypto.randomUUID()}`);
    expect(relay.generated.map((g) => g.amount)).toEqual([4900, 6900, 3900]);
    expect(relay.generated[0]).toMatchObject({ merchantOrderId: attempt.provider_order_id, emailTrigger: "DISABLED" });
    // No person's name goes to UroPay.
    expect(String(relay.generated[0]!.customerName)).toMatch(/^Rasi Astro order RA-/);
    const view = (await getOrderStatusView(orderId))!;
    expect(view.upi).toMatchObject({ referenceSubmitted: false });
    expect(view.upi!.upiString).toMatch(/^upi:\/\/pay\?/);
    expect(view.upi!.qrCode).toMatch(/^data:image\/png;base64,/);
    // A repeat click shows the same QR (no second UroPay order).
    await startCheckout(orderId, "again");
    expect(relay.generated).toHaveLength(3);
  });

  it("the deployment credential check changes nothing and tells a good secret from a bad one", async () => {
    expect(await relay.provider.checkCredentials()).toBe("accepted");
    const wrong = new UroRelayProvider({ environment: "test", apiKey: KEY, apiSecret: "wrong", lookup: async () => null, fetchImpl: (relay.provider as unknown as { fetchImpl: typeof fetch }).fetchImpl });
    expect(await wrong.checkCredentials()).toBe("rejected");
    expect(relay.updates).toHaveLength(0);
  });

  it("never shows a UPI link for the wrong amount", async () => {
    relay.breakUpiAmount("1.00");
    const created = await createOrder(orderInput(), `ip-${crypto.randomUUID()}`);
    await expect(startCheckout(created.orderId, "x")).rejects.toMatchObject({ code: "payment_provider_error" });
    expect((await state(created.orderId)).attempts[0]!.status).toBe("failed");
  });

  it("a typed UTR is recorded but UTR_SUBMITTED and REVIEW_REQUIRED are never paid", async () => {
    const { orderId, attempt } = await relayCheckout();
    await expect(submitPaymentReference(orderId, "12345", `c-${crypto.randomUUID()}`)).rejects.toMatchObject({ code: "validation_failed" });
    const utr = newUtr();
    await submitPaymentReference(orderId, utr, `c-${crypto.randomUUID()}`);
    expect(relay.updates).toEqual([{ uroPayOrderId: attempt.provider_reference, referenceNumber: utr }]);
    expect(await state(orderId)).toMatchObject({ payment: "pending", jobs: 0 });
    expect((await getOrderStatusView(orderId))!).toMatchObject({ paymentStage: "checking", upi: { referenceSubmitted: true, referenceHint: `ending ${utr.slice(-4)}` } });

    await reconcileOrderPayments(orderId);
    expect(await state(orderId)).toMatchObject({ payment: "pending", jobs: 0 });

    relay.setStatus(attempt.provider_reference, "REVIEW_REQUIRED");
    await relayWebhook(webhook(statusEvent(attempt.provider_reference, attempt.provider_order_id, "REVIEW_REQUIRED", utr)));
    expect(await state(orderId)).toMatchObject({ payment: "pending", jobs: 0 });
    expect((await getOrderStatusView(orderId))!.paymentStage).toBe("manual_review");
    expect((await listRelayReviews(await getDb())).map((r) => r.order_id)).toContain(orderId);
  });

  it("one UPI reference can be claimed by one order only", async () => {
    const first = await relayCheckout();
    const second = await relayCheckout();
    const utr = newUtr();
    await submitPaymentReference(first.orderId, utr, `c-${crypto.randomUUID()}`);
    await expect(submitPaymentReference(second.orderId, utr, `c-${crypto.randomUUID()}`)).rejects.toMatchObject({ code: "conflict" });
    expect(relay.updates).toHaveLength(1);
    expect((await state(second.orderId)).attempts[0]!.submitted_reference).toBeNull();
  });

  it("pays exactly once when UroPay says COMPLETED and a signed bank SMS matches the UTR and amount", async () => {
    const { orderId, attempt } = await relayCheckout();
    const utr = newUtr();
    await submitPaymentReference(orderId, utr, `c-${crypto.randomUUID()}`);
    const sms = smsEvent({ uroPayOrderId: attempt.provider_reference, merchantOrderId: attempt.provider_order_id, utr, rupees: "49.00" });
    const smsId = "sms-webhook-1-" + orderId;
    expect((await relayWebhook(webhook(sms, { id: smsId }))).status).toBe(200);
    // The SMS alone does not pay: UroPay has not completed the order yet.
    expect(await state(orderId)).toMatchObject({ payment: "pending", jobs: 0 });

    relay.setStatus(attempt.provider_reference, "COMPLETED");
    const completed = statusEvent(attempt.provider_reference, attempt.provider_order_id, "COMPLETED", utr);
    await relayWebhook(webhook(completed));
    expect(await state(orderId)).toMatchObject({ payment: "paid", jobs: 1 });

    // Duplicates and replays change nothing.
    const again = await relayWebhook(webhook(sms, { id: smsId }));
    expect(((await again.json()) as { status: string }).status).toBe("duplicate");
    await relayWebhook(webhook(sms));
    await relayWebhook(webhook(completed));
    await reconcileOrderPayments(orderId);
    expect(await state(orderId)).toMatchObject({ payment: "paid", jobs: 1 });
    expect(email.sent.filter((e) => e.tags.kind === "report_ready")).toHaveLength(1);
    const db = await getDb();
    expect(await db.query("select id from relay_bank_credits where reference_number = $1", [utr])).toHaveLength(1);
    // Payer name and UPI ID from the SMS are not stored.
    const events = await db.query<{ payload: unknown }>("select payload from payment_events where provider = 'urorelay'");
    expect(JSON.stringify(events)).not.toContain("Payer Name");
    expect(JSON.stringify(events)).not.toContain("payer@upi");
  });

  it("COMPLETED without a bank SMS waits briefly, then goes to the owner, who can confirm it", async () => {
    const { orderId, attempt } = await relayCheckout();
    const utr = newUtr();
    await submitPaymentReference(orderId, utr, `c-${crypto.randomUUID()}`);
    relay.setStatus(attempt.provider_reference, "COMPLETED");
    await reconcileOrderPayments(orderId);
    expect(await state(orderId)).toMatchObject({ payment: "pending", jobs: 0 });

    const db = await getDb();
    await db.query("update payments set reference_submitted_at = now() - interval '20 minutes' where id = $1::uuid", [attempt.id]);
    await relayWebhook(webhook(statusEvent(attempt.provider_reference, attempt.provider_order_id, "COMPLETED", utr)));
    const held = await state(orderId);
    expect(held).toMatchObject({ payment: "needs_review", jobs: 0 });
    expect(held.attempts[0]!.review_reason).toBe("no_bank_sms");
    expect((await getOrderStatusView(orderId))!.paymentStage).toBe("manual_review");

    await expect(confirmPaymentManually(attempt.id, "999999999999", "owner@example.com")).rejects.toMatchObject({ code: "conflict" });
    expect(await confirmPaymentManually(attempt.id, utr, "owner@example.com")).toBe("confirmed");
    const done = await state(orderId);
    expect(done).toMatchObject({ payment: "paid", jobs: 1 });
    expect(done.attempts[0]!.confirmed_by).toBe("owner@example.com");
    expect(await confirmPaymentManually(attempt.id, utr, "owner@example.com")).toBe("already_paid");
    expect((await state(orderId)).jobs).toBe(1);
  });

  it("a wrong amount in the bank SMS is held for review, never fulfilled", async () => {
    const { orderId, attempt } = await relayCheckout();
    const utr = newUtr();
    await submitPaymentReference(orderId, utr, `c-${crypto.randomUUID()}`);
    await relayWebhook(webhook(smsEvent({ uroPayOrderId: attempt.provider_reference, merchantOrderId: attempt.provider_order_id, utr, rupees: "1.00" })));
    relay.setStatus(attempt.provider_reference, "COMPLETED");
    await relayWebhook(webhook(statusEvent(attempt.provider_reference, attempt.provider_order_id, "COMPLETED", utr)));
    const s = await state(orderId);
    expect(s).toMatchObject({ payment: "needs_review", jobs: 0 });
    expect(s.attempts[0]!.review_reason).toBe("amount_mismatch");
  });

  it("an SMS that matches no order is kept for the owner and pays nothing", async () => {
    const { orderId } = await relayCheckout();
    const utr = newUtr();
    await submitPaymentReference(orderId, utr, `c-${crypto.randomUUID()}`);
    const res = await relayWebhook(webhook(smsEvent({ uroPayOrderId: null, merchantOrderId: null, utr, rupees: "49.00" })));
    expect(res.status).toBe(200);
    expect(await state(orderId)).toMatchObject({ payment: "pending", jobs: 0 });
    const unmatched = await listUnmatchedCredits(await getDb());
    const row = unmatched.find((c) => c.reference_number === utr);
    // The owner sees which order's customer typed this reference, but must decide.
    expect(row).toMatchObject({ uropay_order_id: null, claimed_order_id: orderId });
  });

  it("forged, altered and wrong-environment notifications change nothing", async () => {
    const { orderId, attempt } = await relayCheckout();
    const utr = newUtr();
    await submitPaymentReference(orderId, utr, `c-${crypto.randomUUID()}`);
    relay.setStatus(attempt.provider_reference, "COMPLETED");
    const sms = smsEvent({ uroPayOrderId: attempt.provider_reference, merchantOrderId: attempt.provider_order_id, utr, rupees: "49.00" });
    expect((await relayWebhook(webhook(sms, { secret: "attacker" }))).status).toBe(401);
    const tampered = webhook(sms);
    const body = JSON.stringify({ ...sms, amount: "4900.00" });
    expect((await relayWebhook(new Request(tampered.url, { method: "POST", headers: tampered.headers, body }))).status).toBe(401);
    // Correctly signed, but from a phone set to LIVE while this deployment is TEST.
    await relayWebhook(webhook({ ...sms, environment: "LIVE" }, { environmentHeader: "PRODUCTION" }));
    expect((await getDb().then((db) => db.query("select id from relay_bank_credits where reference_number = $1", [utr])))).toHaveLength(0);
    await reconcileOrderPayments(orderId);
    expect(await state(orderId)).toMatchObject({ jobs: 0 });
    expect((await state(orderId)).payment).not.toBe("paid");
  });

  it("the owner can mark a payment as not received; the customer then gets a fresh QR", async () => {
    const { orderId, attempt } = await relayCheckout();
    await submitPaymentReference(orderId, newUtr(), `c-${crypto.randomUUID()}`);
    await rejectPaymentManually(attempt.id, "owner@example.com");
    expect(await state(orderId)).toMatchObject({ payment: "failed", jobs: 0 });
    relay.setStatus(attempt.provider_reference, "FAILED");
    const retry = await startCheckout(orderId, "retry");
    expect(retry.provider).toBe("urorelay");
    const s = await state(orderId);
    expect(s.attempts.map((a) => a.status)).toEqual(["failed", "created"]);
    expect(relay.generated).toHaveLength(2);
  });

  it("switching to Cashfree later leaves open UroRelay orders on UroRelay", async () => {
    const { orderId, attempt } = await relayCheckout();
    const cashfree = new CashfreeProvider({ environment: "test", clientId: "id", clientSecret: "s", apiVersion: "2026-01-01", fetchImpl: (async () => new Response("{}", { status: 500 })) as typeof fetch });
    setPaymentProvidersForTests([relay.provider, cashfree], "urorelay");
    setActivePaymentProviderForTests("cashfree");
    const again = await startCheckout(orderId, "switch");
    expect(again).toMatchObject({ provider: "urorelay", redirectUrl: `/orders/${orderId}?payment=upi` });
    // Its notifications still work after the switch.
    const utr = newUtr();
    await submitPaymentReference(orderId, utr, `c-${crypto.randomUUID()}`);
    await relayWebhook(webhook(smsEvent({ uroPayOrderId: attempt.provider_reference, merchantOrderId: attempt.provider_order_id, utr, rupees: "49.00" })));
    relay.setStatus(attempt.provider_reference, "COMPLETED");
    await relayWebhook(webhook(statusEvent(attempt.provider_reference, attempt.provider_order_id, "COMPLETED", utr)));
    expect(await state(orderId)).toMatchObject({ payment: "paid", jobs: 1 });
    const { csv } = await buildOwnerCsv(await getDb(), parseFilters({ provider: "urorelay", payment: "paid" }));
    expect(csv).toContain(utr);
    expect(csv).not.toContain(SECRET);
  });
});
