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
 * Cashfree Payment Gateway (PG) adapter, API version 2026-01-01.
 * Docs: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
 *       https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
 */
export interface CashfreeConfig {
  /** test = Cashfree's sandbox; production = real money. */
  environment: "test" | "production";
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  fetchImpl?: typeof fetch;
}

const BASE_URLS = {
  test: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
} as const;

interface CashfreeOrder {
  order_id: string;
  cf_order_id?: string | number;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED" | string;
  order_amount: number | string;
  order_currency: string;
  payment_session_id?: string;
}

interface CashfreePayment {
  cf_payment_id: string | number;
  payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING" | string;
  payment_amount?: number | string;
  payment_currency?: string;
  payment_completion_time?: string | null;
  payment_time?: string | null;
}

/** Order and captured payment must agree; -1 marks a mismatch for manual review. */
function reconciledAmount(order: CashfreeOrder, successful: CashfreePayment | undefined): number | null {
  const orderAmount = rupeeAmountToPaise(order.order_amount);
  if (!successful || successful.payment_amount === undefined) return orderAmount;
  const paid = rupeeAmountToPaise(successful.payment_amount);
  return paid !== null && paid === orderAmount ? paid : -1;
}

export function mapCashfreePaymentStatus(status: string): EvidenceStatus {
  switch (status) {
    case "SUCCESS":
      return "paid";
    case "PENDING":
      return "pending";
    case "FAILED":
      return "failed";
    case "USER_DROPPED":
    case "CANCELLED":
    case "VOID":
      return "cancelled";
    case "NOT_ATTEMPTED":
      return "not_attempted";
    default:
      return "pending";
  }
}

export class CashfreeProvider implements PaymentProvider {
  readonly id = "cashfree" as const;
  // A Cashfree order stays payable after a failed attempt until it expires.
  readonly retryOnSameOrder = true;
  readonly checkoutLifetimeMinutes = 45;
  readonly environment: "test" | "production";
  private readonly config: CashfreeConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CashfreeConfig) {
    this.config = config;
    this.environment = config.environment;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${BASE_URLS[this.config.environment]}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-api-version": this.config.apiVersion,
          "x-client-id": this.config.clientId,
          "x-client-secret": this.config.clientSecret,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new PaymentProviderError(`Cashfree request failed: ${(error as Error).name}`, null, null, true);
    }
    const text = await response.text();
    if (!response.ok) {
      let code: string | null = null;
      try {
        code = (JSON.parse(text) as { code?: string }).code ?? null;
      } catch {
        // Non-JSON error body; keep code null.
      }
      throw new PaymentProviderError(`Cashfree ${method} ${path.split("/")[1]} returned ${response.status}`, response.status, code, response.status >= 500 || response.status === 429);
    }
    return JSON.parse(text) as T;
  }

  async createCheckout(req: CreateCheckoutRequest): Promise<CheckoutSession> {
    const body = {
      order_id: req.providerOrderId,
      order_amount: paiseToRupeeAmount(req.amountPaise),
      order_currency: req.currency,
      customer_details: {
        customer_id: req.customerId,
        customer_email: req.email,
        customer_phone: req.phone,
      },
      order_meta: {
        return_url: req.returnUrl,
        ...(req.notifyUrl ? { notify_url: req.notifyUrl } : {}),
      },
      order_expiry_time: (req.expiresAt ?? new Date(Date.now() + this.checkoutLifetimeMinutes * 60_000)).toISOString(),
      order_note: req.orderNote,
    };
    let order: CashfreeOrder;
    try {
      order = await this.request<CashfreeOrder>("POST", "/orders", body);
    } catch (error) {
      // 409: this order id already exists, typically because an earlier create timed out
      // after Cashfree accepted it. Use that order rather than opening a second one.
      if (!(error instanceof PaymentProviderError) || error.httpStatus !== 409) throw error;
      order = await this.request<CashfreeOrder>("GET", `/orders/${encodeURIComponent(req.providerOrderId)}`);
    }
    if (order.order_id !== req.providerOrderId) throw new PaymentProviderError("Cashfree returned a different order", null, "reference_mismatch", false);
    if (rupeeAmountToPaise(order.order_amount) !== req.amountPaise || order.order_currency !== req.currency) {
      throw new PaymentProviderError("Cashfree order amount mismatch", null, "amount_mismatch", false);
    }
    const reference = order.cf_order_id !== undefined ? String(order.cf_order_id) : null;
    if (order.order_status !== "ACTIVE") return { paymentSessionId: null, redirectUrl: null, providerReference: reference, environment: this.environment };
    if (!order.payment_session_id) throw new PaymentProviderError("Cashfree did not return a payment session", null, null, true);
    return { paymentSessionId: order.payment_session_id, redirectUrl: null, providerReference: reference, environment: this.environment };
  }

  /** Checks a webhook signature with the secret of this adapter's environment. */
  verifyWebhook(rawBody: string, timestamp: string | null, signature: string | null): boolean {
    return verifyCashfreeSignature(rawBody, timestamp, signature, this.config.clientSecret);
  }

  async fetchEvidence(attempt: PaymentAttemptRef): Promise<PaymentEvidence> {
    const encoded = encodeURIComponent(attempt.providerOrderId);
    const order = await this.request<CashfreeOrder>("GET", `/orders/${encoded}`);
    if (order.order_id !== attempt.providerOrderId) throw new PaymentProviderError("Cashfree order does not belong to this attempt", null, "reference_mismatch", false);
    const payments = await this.request<CashfreePayment[]>("GET", `/orders/${encoded}/payments`);
    const successful = payments.find((p) => p.payment_status === "SUCCESS");
    const latest = [...payments].sort((a, b) => String(b.payment_time ?? "").localeCompare(String(a.payment_time ?? "")))[0];

    let status: EvidenceStatus;
    if (order.order_status === "PAID" || successful) status = "paid";
    else if (order.order_status === "EXPIRED") status = "expired";
    else if (order.order_status === "TERMINATED" || order.order_status === "TERMINATION_REQUESTED") status = "cancelled";
    else status = latest ? mapCashfreePaymentStatus(latest.payment_status) : "not_attempted";

    return {
      source: "api",
      provider: "cashfree",
      environment: this.environment,
      providerOrderId: order.order_id,
      providerReference: order.cf_order_id !== undefined ? String(order.cf_order_id) : null,
      providerPaymentId: successful ? String(successful.cf_payment_id) : latest ? String(latest.cf_payment_id) : null,
      status,
      amountPaise: reconciledAmount(order, successful),
      currency: successful?.payment_currency ?? order.order_currency,
      providerStatus: `order:${order.order_status}${latest ? `/payment:${latest.payment_status}` : ""}`,
    };
  }
}

/**
 * Webhook signature: base64(HMAC-SHA256(timestamp + rawBody, clientSecret)).
 * Must be computed over the exact raw bytes received - never a re-serialised body.
 */
export function verifyCashfreeSignature(rawBody: string, timestamp: string | null, signature: string | null, clientSecret: string): boolean {
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac("sha256", clientSecret).update(timestamp + rawBody).digest("base64");
  return timingSafeEqualString(expected, signature);
}

export interface ParsedCashfreeWebhook {
  type: string;
  dedupeKey: string;
  evidence: PaymentEvidence | null;
  /** Minimal payload kept for audit - no customer contact details. */
  auditPayload: Record<string, unknown>;
}

interface WebhookBody {
  type?: string;
  event_time?: string;
  data?: {
    order?: { order_id?: string; order_amount?: number | string; order_currency?: string };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number | string;
      payment_currency?: string;
      payment_group?: string;
      payment_message?: string;
    };
  };
}

export function parseCashfreeWebhook(rawBody: string, idempotencyKey: string | null, environment: "test" | "production"): ParsedCashfreeWebhook {
  const body = JSON.parse(rawBody) as WebhookBody;
  const type = body.type ?? "UNKNOWN";
  const order = body.data?.order;
  const payment = body.data?.payment;
  const paymentId = payment?.cf_payment_id !== undefined ? String(payment.cf_payment_id) : null;
  const dedupeKey = idempotencyKey ? `cashfree:${idempotencyKey}` : `cashfree:${type}:${order?.order_id ?? "?"}:${paymentId ?? "?"}:${payment?.payment_status ?? "?"}`;

  let evidence: PaymentEvidence | null = null;
  if (order?.order_id && payment?.payment_status && type.startsWith("PAYMENT_") && type !== "PAYMENT_CHARGES_WEBHOOK") {
    const status = mapCashfreePaymentStatus(payment.payment_status);
    const orderAmount = order.order_amount !== undefined ? rupeeAmountToPaise(order.order_amount) : null;
    const paymentAmount = payment.payment_amount !== undefined ? rupeeAmountToPaise(payment.payment_amount) : null;
    evidence = {
      source: "webhook",
      provider: "cashfree",
      // The signature was checked with this environment's secret.
      environment,
      providerOrderId: order.order_id,
      providerReference: null,
      providerPaymentId: paymentId,
      status,
      // For a success both amounts must agree; a mismatch is surfaced for review.
      amountPaise: status === "paid" ? (paymentAmount !== null && paymentAmount === orderAmount ? paymentAmount : -1) : orderAmount,
      currency: payment.payment_currency ?? order.order_currency ?? null,
      providerStatus: `webhook:${type}/payment:${payment.payment_status}`,
    };
  }

  return {
    type,
    dedupeKey,
    evidence,
    auditPayload: {
      type,
      event_time: body.event_time ?? null,
      order_id: order?.order_id ?? null,
      order_amount: order?.order_amount ?? null,
      order_currency: order?.order_currency ?? null,
      cf_payment_id: paymentId,
      payment_status: payment?.payment_status ?? null,
      payment_amount: payment?.payment_amount ?? null,
      payment_currency: payment?.payment_currency ?? null,
      payment_group: payment?.payment_group ?? null,
    },
  };
}
