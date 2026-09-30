import crypto from "node:crypto";
import { paiseToRupeeAmount, rupeeAmountToPaise } from "@/domain/pricing";
import { timingSafeEqualString } from "../security/crypto";
import {
  PaymentProviderError,
  type CheckoutSession,
  type CreateCheckoutRequest,
  type EvidenceStatus,
  type PaymentAttemptRef,
  type PaymentEvidence,
  type PaymentProvider,
} from "./types";

/**
 * UroPay Merchant API adapter (NOT UroRelay: that is a different product with a
 * different API, credentials and confirmation mechanism).
 * Docs: https://api.uropai.in/documentation (read September 2026).
 *
 * - One base URL for both environments. The API key used decides TEST or PRODUCTION,
 *   so we keep two key pairs and never send an environment parameter.
 * - Every request is signed: hex HMAC-SHA256 over
 *   METHOD\nPATH\nTIMESTAMP\nNONCE\nQUERY\nRAW_BODY with the merchant secret.
 * - Amounts are rupees (a number). We keep integer paise and convert only here.
 * - POST /v1/orders is idempotent on tenantOrderRef when the payload is identical,
 *   so a timed-out create can be repeated safely with the same attempt.
 * - The order-status webhook is advisory only. GET /v1/orders/{id} is the source of truth.
 */
export interface UroPayConfig {
  environment: "test" | "production";
  apiKey: string;
  apiSecret: string;
  fetchImpl?: typeof fetch;
}

const ORIGIN = "https://api.uropai.in";
/** Webhook signatures use this fixed path and an empty query string (per the docs). */
const WEBHOOK_SIGNATURE_PATH = "/tenant-webhook";
/** Replay window the docs apply to requests: at most 300 s old, at most 30 s in the future. */
const MAX_AGE_SECONDS = 300;
const MAX_FUTURE_SECONDS = 30;

interface Envelope<T> {
  code?: number;
  status?: string;
  message?: string;
  data?: T;
}

interface UroPayOrder {
  id: string;
  tenantOrderRef: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | string;
  statusReason?: string;
  amount: number | string;
  currency: string;
  checkoutType?: string;
  openUrl?: string;
  createdAt?: string;
}

export function uroPayCanonicalString(method: string, path: string, timestamp: string, nonce: string, query: string, rawBody: string): string {
  return [method, path, timestamp, nonce, query, rawBody].join("\n");
}

export function uroPaySignature(canonical: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function mapUroPayStatus(status: string): EvidenceStatus {
  switch (status) {
    case "PAID":
      return "paid";
    case "FAILED":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "CANCELLED":
      return "cancelled";
    case "PENDING":
      // Checkout is still open; nothing has been decided yet.
      return "not_attempted";
    default:
      // An unknown status is never treated as success or failure: keep checking.
      return "pending";
  }
}

export class UroPayMerchantProvider implements PaymentProvider {
  readonly id = "uropay" as const;
  readonly retryOnSameOrder = false;
  // The Merchant API has no expiry parameter: UroPay decides how long a checkout stays open.
  readonly checkoutLifetimeMinutes = null;
  readonly environment: "test" | "production";
  private readonly config: UroPayConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: UroPayConfig) {
    this.config = config;
    this.environment = config.environment;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ httpStatus: number; data: T }> {
    const rawBody = body === undefined ? "" : JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomUUID();
    const signature = uroPaySignature(uroPayCanonicalString(method, path, timestamp, nonce, "", rawBody), this.config.apiSecret);
    let response: Response;
    try {
      response = await this.fetchImpl(`${ORIGIN}${path}`, {
        method,
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          "X-Api-Key": this.config.apiKey,
          "X-Timestamp": timestamp,
          "X-Nonce": nonce,
          "X-Signature": signature,
        },
        body: body === undefined ? undefined : rawBody,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new PaymentProviderError(`UroPay request failed: ${(error as Error).name}`, null, null, true);
    }
    const text = await response.text();
    let envelope: Envelope<T> = {};
    try {
      envelope = JSON.parse(text) as Envelope<T>;
    } catch {
      // Non-JSON body; handled below.
    }
    if (!response.ok) {
      // The message is UroPay's own short text (e.g. the minimum order amount); it contains no secrets.
      const code = typeof envelope.message === "string" ? envelope.message.slice(0, 80) : null;
      throw new PaymentProviderError(`UroPay ${method} ${path.split("/")[2]} returned ${response.status}`, response.status, code, response.status >= 500 || response.status === 429);
    }
    if (envelope.data === undefined) throw new PaymentProviderError("UroPay response had no data", response.status, null, true);
    return { httpStatus: response.status, data: envelope.data };
  }

  async createCheckout(req: CreateCheckoutRequest): Promise<CheckoutSession> {
    // Every field is derived from the stored order and attempt, so a retry sends an
    // identical payload and UroPay returns the same order instead of a new one.
    const body = {
      tenantOrderRef: req.providerOrderId,
      amount: paiseToRupeeAmount(req.amountPaise),
      currency: req.currency,
      customerEmail: req.email,
      ...(req.phone ? { customerPhone: req.phone } : {}),
      metaData: { orderRef: req.orderReference },
      // HTTPS only; locally UroPay falls back to the account defaults and we rely on reconciliation.
      ...(req.returnUrl.startsWith("https://") ? { returnUrl: req.returnUrl } : {}),
      ...(req.notifyUrl?.startsWith("https://") ? { webhookUrl: req.notifyUrl } : {}),
    };
    const { data: order } = await this.request<UroPayOrder>("POST", "/v1/orders", body);
    this.assertMatches(order, req.providerOrderId, req.amountPaise, req.currency);
    if (order.status === "PENDING" && !order.openUrl?.startsWith("https://")) {
      throw new PaymentProviderError("UroPay did not return a secure checkout URL", null, "no_open_url", true);
    }
    return {
      paymentSessionId: null,
      // openUrl is absent once the order is final (e.g. already PAID); the caller then reconciles.
      redirectUrl: order.status === "PENDING" && order.openUrl ? order.openUrl : null,
      providerReference: order.id,
      environment: this.environment,
    };
  }

  /** Verifies an order-status webhook with the key pair of this adapter's environment. */
  verifyWebhook(headers: UroPayWebhookHeaders, rawBody: string, nowSeconds?: number): UroPayWebhookCheck {
    return verifyUroPayWebhook(headers, rawBody, { apiKey: this.config.apiKey, apiSecret: this.config.apiSecret }, nowSeconds);
  }

  async fetchEvidence(attempt: PaymentAttemptRef): Promise<PaymentEvidence> {
    if (!attempt.providerReference) throw new PaymentProviderError("UroPay order id unknown for this attempt", null, "no_reference", false);
    const { data: order } = await this.request<UroPayOrder>("GET", `/v1/orders/${encodeURIComponent(attempt.providerReference)}`);
    if (order.tenantOrderRef !== attempt.providerOrderId || order.id !== attempt.providerReference) {
      throw new PaymentProviderError("UroPay order does not belong to this attempt", null, "reference_mismatch", false);
    }
    return {
      source: "api",
      provider: "uropay",
      environment: this.environment,
      providerOrderId: order.tenantOrderRef,
      providerReference: order.id,
      // The Merchant API does not expose a separate payment id.
      providerPaymentId: null,
      status: mapUroPayStatus(order.status),
      amountPaise: rupeeAmountToPaise(order.amount),
      currency: order.currency ?? null,
      providerStatus: `order:${order.status}${order.statusReason ? `/${order.statusReason}` : ""}`,
    };
  }

  private assertMatches(order: UroPayOrder, providerOrderId: string, amountPaise: number, currency: string): void {
    if (order.tenantOrderRef !== providerOrderId) throw new PaymentProviderError("UroPay returned a different order", null, "reference_mismatch", false);
    if (rupeeAmountToPaise(order.amount) !== amountPaise || (order.currency ?? "INR") !== currency) {
      throw new PaymentProviderError("UroPay order amount mismatch", null, "amount_mismatch", false);
    }
  }
}

export interface UroPayWebhookHeaders {
  apiKey: string | null;
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
}

export type UroPayWebhookCheck = "ok" | "missing_headers" | "wrong_key" | "stale" | "bad_signature";

/**
 * Verifies an order-status webhook exactly as documented: the same HMAC scheme as API
 * requests, with path /tenant-webhook and an empty query string, over the raw body.
 * Also enforces the documented timestamp window, so a captured request cannot be
 * replayed later (duplicates inside the window are removed by eventId).
 */
export function verifyUroPayWebhook(headers: UroPayWebhookHeaders, rawBody: string, credentials: { apiKey: string; apiSecret: string }, nowSeconds = Math.floor(Date.now() / 1000)): UroPayWebhookCheck {
  const { apiKey, timestamp, nonce, signature } = headers;
  if (!apiKey || !timestamp || !nonce || !signature) return "missing_headers";
  if (!timingSafeEqualString(apiKey, credentials.apiKey)) return "wrong_key";
  if (!/^\d{9,11}$/.test(timestamp)) return "stale";
  const ts = Number(timestamp);
  if (nowSeconds - ts > MAX_AGE_SECONDS || ts - nowSeconds > MAX_FUTURE_SECONDS) return "stale";
  if (!/^[0-9a-f]{64}$/i.test(signature)) return "bad_signature";
  const expected = uroPaySignature(uroPayCanonicalString("POST", WEBHOOK_SIGNATURE_PATH, timestamp, nonce, "", rawBody), credentials.apiSecret);
  return timingSafeEqualString(expected, signature.toLowerCase()) ? "ok" : "bad_signature";
}

export interface UroPayWebhook {
  eventId: string;
  orderId: string;
  tenantOrderRef: string;
  status: string;
  /** Captured amount in paise (null if missing or malformed). */
  capturedPaise: number | null;
  currency: string | null;
  environment: "TEST" | "PRODUCTION" | string;
  /** Minimal payload kept for audit: no customer details, no fee breakdown. */
  auditPayload: Record<string, unknown>;
}

export function parseUroPayWebhook(rawBody: string): UroPayWebhook | null {
  const body = JSON.parse(rawBody) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : null);
  const eventId = str("eventId");
  const orderId = str("orderId");
  const tenantOrderRef = str("tenantOrderRef");
  const status = str("status");
  if (!eventId || !orderId || !tenantOrderRef || !status) return null;
  return {
    eventId,
    orderId,
    tenantOrderRef,
    status,
    capturedPaise: rupeeAmountToPaise(body.amount_captured),
    currency: str("currency"),
    environment: str("environment") ?? "",
    auditPayload: {
      eventId,
      occurredAt: str("occurredAt"),
      orderId,
      tenantOrderRef,
      status,
      amount_captured: body.amount_captured ?? null,
      currency: str("currency"),
      environment: str("environment"),
    },
  };
}

/** UroPay labels environments TEST / PRODUCTION. */
export function uroPayEnvironmentLabel(environment: "test" | "production"): "TEST" | "PRODUCTION" {
  return environment === "production" ? "PRODUCTION" : "TEST";
}
