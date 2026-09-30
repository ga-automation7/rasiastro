import crypto from "node:crypto";
import { rupeeAmountToPaise } from "@/domain/pricing";
import { timingSafeEqualString } from "../security/crypto";
import {
  PaymentProviderError,
  type CheckoutSession,
  type CreateCheckoutRequest,
  type PaymentAttemptRef,
  type PaymentEvidence,
  type PaymentProvider,
} from "./types";

/**
 * UroRelay adapter: UroPay's phone and SMS based UPI product. NOT the UroPay Merchant
 * API (./uropay.ts): different base URL, credentials, flow and confirmation.
 * Docs: https://www.uropay.me/documentation (read 29-30 September 2026).
 *
 * How it works (and why we are strict):
 * - We create an order; UroPay returns a UPI QR code and upi:// link for the exact
 *   amount. The customer pays from any UPI app straight into the owner's bank account.
 * - The customer then gives us the UPI reference number (UTR). We pass it to UroPay.
 *   A typed-in UTR is UNVERIFIED: it proves nothing on its own.
 * - The UroPay Companion app on the owner's Android phone reads the bank's UPI credit
 *   SMS and reports it (signed "companion.sms.data" webhook). If it matches, UroPay
 *   marks the order COMPLETED; if no SMS arrives within about 2 minutes the order
 *   becomes REVIEW_REQUIRED.
 * - This is SMS reading, not a bank or payment-gateway API. So an order is paid only
 *   when UroPay's own status (asked by us, server-side) is COMPLETED AND we hold a
 *   signed bank-SMS report for that UroPay order with the customer's UTR and the exact
 *   amount. Anything less is held for the owner. UTR_SUBMITTED and REVIEW_REQUIRED
 *   are never treated as paid.
 */
export interface UroRelayConfig {
  /** Our side's environment. UroRelay itself switches TEST/LIVE per phone in its dashboard. */
  environment: "test" | "production";
  apiKey: string;
  apiSecret: string;
  fetchImpl?: typeof fetch;
  /** What we stored about an attempt: the customer's UTR and the bank credits reported for it. */
  lookup: (providerOrderId: string) => Promise<RelayAttemptFacts | null>;
}

export interface RelayBankCredit {
  referenceNumber: string | null;
  amountPaise: number | null;
  uroPayOrderId: string | null;
  environment: "test" | "production";
}

export interface RelayAttemptFacts {
  submittedReference: string | null;
  referenceSubmittedAt: Date | null;
  credits: RelayBankCredit[];
}

const ORIGIN = "https://api.uropay.me";
/** A COMPLETED order without its bank SMS is given this long for the SMS report to arrive. */
const SMS_GRACE_MS = 15 * 60_000;

interface Envelope<T> {
  code?: number;
  status?: string;
  message?: string;
  data?: T;
}

interface GeneratedOrder {
  uroPayOrderId: string;
  orderStatus: string;
  upiString: string;
  qrCode: string;
  amountInRupees: string;
}

export function sha512Hex(value: string): string {
  return crypto.createHash("sha512").update(value, "utf8").digest("hex");
}

/** UroRelay reports TEST, and LIVE or PRODUCTION for real money. */
export function relayEnvironment(label: unknown): "test" | "production" | null {
  if (label === "TEST") return "test";
  if (label === "LIVE" || label === "PRODUCTION") return "production";
  return null;
}

/** A UPI transaction reference (UTR / RRN) as shown in UPI apps: 12 digits. */
export function normaliseUpiReference(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  return /^\d{12}$/.test(digits) ? digits : null;
}

export class UroRelayProvider implements PaymentProvider {
  readonly id = "urorelay" as const;
  readonly retryOnSameOrder = false;
  // UroRelay orders have no documented expiry; a new attempt is only opened once one fails.
  readonly checkoutLifetimeMinutes = null;
  readonly environment: "test" | "production";
  private readonly config: UroRelayConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: UroRelayConfig) {
    this.config = config;
    this.environment = config.environment;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${ORIGIN}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-API-KEY": this.config.apiKey,
          // Documented: the SHA-512 hash of the secret, never the secret itself.
          Authorization: `Bearer ${sha512Hex(this.config.apiSecret)}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new PaymentProviderError(`UroRelay request failed: ${(error as Error).name}`, null, null, true);
    }
    const text = await response.text();
    let envelope: Envelope<T> = {};
    try {
      envelope = JSON.parse(text) as Envelope<T>;
    } catch {
      // Non-JSON body; handled below.
    }
    if (!response.ok) {
      const code = typeof envelope.message === "string" ? envelope.message.slice(0, 80) : null;
      throw new PaymentProviderError(`UroRelay ${method} ${path.split("/")[2] ?? path} returned ${response.status}`, response.status, code, response.status >= 500 || response.status === 429);
    }
    if (envelope.data === undefined) throw new PaymentProviderError("UroRelay response had no data", response.status, null, true);
    return envelope.data;
  }

  async createCheckout(req: CreateCheckoutRequest): Promise<CheckoutSession> {
    const order = await this.request<GeneratedOrder>("POST", "/order/generate", {
      // Documented in paise (Rs 150 = 15000).
      amount: req.amountPaise,
      merchantOrderId: req.providerOrderId,
      // Required by UroRelay. We send the order reference rather than a person's name.
      customerName: `Rasi Astro order ${req.orderReference}`,
      customerEmail: req.email,
      transactionNote: `Rasi Astro ${req.orderReference}`,
      notes: { orderRef: req.orderReference },
      // Rasi Astro sends its own emails; UroPay must not email customers.
      emailTrigger: "DISABLED",
    });
    if (typeof order.uroPayOrderId !== "string" || !order.uroPayOrderId) throw new PaymentProviderError("UroRelay returned no order id", null, "no_order_id", false);
    if (rupeeAmountToPaise(order.amountInRupees) !== req.amountPaise) throw new PaymentProviderError("UroRelay order amount mismatch", null, "amount_mismatch", false);
    const upi = checkUpiString(order.upiString, req.amountPaise);
    if (!upi) throw new PaymentProviderError("UroRelay returned an unusable UPI link", null, "bad_upi_string", false);
    if (typeof order.qrCode !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(order.qrCode) || order.qrCode.length > 300_000) {
      throw new PaymentProviderError("UroRelay returned an unusable QR code", null, "bad_qr_code", false);
    }
    return {
      paymentSessionId: null,
      redirectUrl: null,
      providerReference: order.uroPayOrderId,
      environment: this.environment,
      checkoutData: { upiString: order.upiString, qrCode: order.qrCode },
    };
  }

  /** Passes the customer's UPI reference number to UroPay (PATCH /order/update). Unverified until the bank SMS confirms it. */
  async submitReference(uroPayOrderId: string, referenceNumber: string): Promise<string | null> {
    const data = await this.request<{ orderStatus?: string }>("PATCH", "/order/update", { uroPayOrderId, referenceNumber });
    return typeof data.orderStatus === "string" ? data.orderStatus : null;
  }

  async fetchEvidence(attempt: PaymentAttemptRef): Promise<PaymentEvidence> {
    const ref = attempt.providerReference;
    if (!ref) throw new PaymentProviderError("UroRelay order id unknown for this attempt", null, "no_reference", false);
    const data = await this.request<{ uroPayOrderId?: string; orderStatus?: string }>("GET", `/order/status/${encodeURIComponent(ref)}`);
    if (data.uroPayOrderId !== ref) throw new PaymentProviderError("UroRelay status is for a different order", null, "reference_mismatch", false);
    const orderStatus = String(data.orderStatus ?? "UNKNOWN");
    const base = {
      source: "api" as const,
      provider: "urorelay" as const,
      environment: this.environment,
      providerOrderId: attempt.providerOrderId,
      providerReference: ref,
      currency: "INR",
    };
    switch (orderStatus) {
      case "COMPLETED":
        return this.completedEvidence(base, ref);
      case "FAILED":
        return { ...base, status: "failed", providerPaymentId: null, amountPaise: null, providerStatus: `order:${orderStatus}` };
      case "CANCELLED":
        return { ...base, status: "cancelled", providerPaymentId: null, amountPaise: null, providerStatus: `order:${orderStatus}` };
      case "CREATED":
      case "UPDATED":
        return { ...base, status: "not_attempted", providerPaymentId: null, amountPaise: null, providerStatus: `order:${orderStatus}` };
      default:
        // UTR_SUBMITTED, PENDING, REVIEW_REQUIRED or anything new: still being checked. Never paid.
        return { ...base, status: "pending", providerPaymentId: null, amountPaise: null, providerStatus: `order:${orderStatus}` };
    }
  }

  /** COMPLETED is paid only with a signed bank-SMS report for this order, the customer's UTR and the amount. */
  private async completedEvidence(base: Omit<PaymentEvidence, "status" | "providerPaymentId" | "amountPaise" | "providerStatus">, ref: string): Promise<PaymentEvidence> {
    const facts = await this.config.lookup(base.providerOrderId);
    const credits = (facts?.credits ?? []).filter(
      (c) => c.environment === this.environment && c.uroPayOrderId === ref && (!facts?.submittedReference || c.referenceNumber === facts.submittedReference),
    );
    if (credits.length === 1) {
      const credit = credits[0]!;
      return { ...base, status: "paid", providerPaymentId: credit.referenceNumber, amountPaise: credit.amountPaise, providerStatus: "order:COMPLETED/bank_sms_matched" };
    }
    if (credits.length > 1) {
      return { ...base, status: "paid", providerPaymentId: facts?.submittedReference ?? null, amountPaise: null, providerStatus: "order:COMPLETED", holdForReview: "multiple_bank_credits" };
    }
    const submittedAt = facts?.referenceSubmittedAt?.getTime() ?? 0;
    if (submittedAt && Date.now() - submittedAt < SMS_GRACE_MS) {
      // The bank-SMS report is normally sent just before COMPLETED; give it a moment.
      return { ...base, status: "pending", providerPaymentId: null, amountPaise: null, providerStatus: "order:COMPLETED/awaiting_bank_sms" };
    }
    return { ...base, status: "paid", providerPaymentId: facts?.submittedReference ?? null, amountPaise: null, providerStatus: "order:COMPLETED", holdForReview: "no_bank_sms" };
  }

  /**
   * Read-only credential check for deployments: asks UroPay to update an order that
   * cannot exist. "Not found" proves the key and secret are accepted; nothing changes.
   */
  async checkCredentials(): Promise<{ result: "accepted" | "rejected" | "unknown"; detail: string }> {
    try {
      await this.request("PATCH", "/order/update", { uroPayOrderId: "rasi-astro-credential-check", referenceNumber: "000000000000" });
      return { result: "unknown", detail: "UroPay accepted an update for an order that does not exist" };
    } catch (error) {
      const status = error instanceof PaymentProviderError ? error.httpStatus : null;
      // UroPay's own short message (never contains our key or secret).
      const detail = `${status === null ? "no answer" : `HTTP ${status}`}${error instanceof PaymentProviderError && error.providerCode ? `: ${error.providerCode}` : ""}`;
      if (status === 401) return { result: "rejected", detail };
      if (status === 404 || status === 400) return { result: "accepted", detail };
      return { result: "unknown", detail };
    }
  }

  /** Verifies X-Uropay-Signature with this account's secret. */
  verifyWebhook(payload: Record<string, unknown>, signature: string | null): boolean {
    return verifyUroRelaySignature(payload, this.config.apiSecret, signature);
  }
}

/** The upi:// link must pay exactly our amount; otherwise we never show it. */
export function checkUpiString(value: unknown, amountPaise: number): URLSearchParams | null {
  if (typeof value !== "string" || !value.startsWith("upi://pay?") || value.length > 2000) return null;
  const params = new URLSearchParams(value.slice("upi://pay?".length));
  if (!params.get("pa")) return null;
  const am = params.get("am");
  if (am !== null && rupeeAmountToPaise(am) !== amountPaise) return null;
  return params;
}

/**
 * The exact payload UroRelay signs, rebuilt as its documented Node.js example does:
 * JSON key order matters, and the rule depends on the event.
 */
export function uroRelaySignedJson(payload: Record<string, unknown>): string {
  const p = payload;
  if (p.event === "order.status.utrsubmitted") {
    return JSON.stringify({
      event: p.event,
      uroPayOrderId: p.uroPayOrderId,
      merchantOrderId: p.merchantOrderId,
      orderStatus: p.orderStatus,
      submittedUTR: p.submittedUTR ?? null,
      amount: p.amount,
      customerName: p.customerName,
      customerEmail: p.customerEmail,
      customerVPA: p.customerVPA ?? null,
      environment: p.environment,
      utrSubmittedAt: p.utrSubmittedAt ?? null,
    });
  }
  if ("orderStatus" in p) {
    return JSON.stringify({
      event: p.event,
      uroPayOrderId: p.uroPayOrderId,
      merchantOrderId: p.merchantOrderId,
      orderStatus: p.orderStatus,
      submittedUTR: p.submittedUTR ?? null,
      environment: p.environment,
    });
  }
  const tail = ["uroPayOrderId", "merchantOrderId", "detectedAt", "environment"];
  const ordered: Record<string, unknown> = {};
  if ("event" in p) ordered.event = p.event;
  for (const k of Object.keys(p)
    .filter((key) => key !== "event" && !tail.includes(key))
    .sort((a, b) => a.localeCompare(b))) {
    ordered[k] = p[k];
  }
  for (const k of tail) ordered[k] = p[k] ?? null;
  return JSON.stringify(ordered);
}

/** hex(HMAC-SHA256(key = hex SHA-512 of the secret, data = the rebuilt JSON)), compared in constant time. */
export function verifyUroRelaySignature(payload: Record<string, unknown>, apiSecret: string, signature: string | null): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", sha512Hex(apiSecret)).update(uroRelaySignedJson(payload), "utf8").digest("hex");
  return timingSafeEqualString(expected, signature.toLowerCase());
}
