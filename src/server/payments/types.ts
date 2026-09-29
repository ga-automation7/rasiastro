/**
 * Payment provider boundary. The app never sees card or UPI credentials: customers
 * pay on the provider's hosted checkout, and we only learn the result through
 * verified server-side evidence (signed webhook or authenticated status lookup).
 */
export type EvidenceStatus = "paid" | "pending" | "failed" | "cancelled" | "expired" | "not_attempted";

export interface PaymentEvidence {
  source: "webhook" | "api" | "demo";
  provider: "cashfree" | "demo";
  providerOrderId: string;
  providerPaymentId: string | null;
  status: EvidenceStatus;
  /** Amount the provider says was charged/ordered, in paise (null if not reported). */
  amountPaise: number | null;
  currency: string | null;
  /** Raw provider status string, for audit. */
  providerStatus: string;
}

export interface CreateCheckoutRequest {
  providerOrderId: string;
  amountPaise: number;
  currency: "INR";
  customerId: string;
  email: string;
  phone: string;
  returnUrl: string;
  notifyUrl: string | null;
  expiresAt: Date;
  orderNote: string;
}

export interface CheckoutSession {
  /** Cashfree: the payment_session_id handed to the browser SDK. */
  paymentSessionId: string | null;
  /** Demo: our local simulated checkout page. */
  redirectUrl: string | null;
  environment: "sandbox" | "production" | "demo";
}

export interface PaymentProvider {
  readonly id: "cashfree" | "demo";
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutSession>;
  /** Authoritative status lookup, used for reconciliation when webhooks are late or lost. */
  fetchEvidence(providerOrderId: string): Promise<PaymentEvidence>;
}

export class PaymentProviderError extends Error {
  readonly httpStatus: number | null;
  readonly providerCode: string | null;
  readonly retriable: boolean;

  constructor(message: string, httpStatus: number | null, providerCode: string | null, retriable: boolean) {
    super(message);
    this.name = "PaymentProviderError";
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
    this.retriable = retriable;
  }
}
