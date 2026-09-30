/**
 * Payment provider boundary. The app never sees card or UPI credentials: customers
 * pay on the provider's hosted checkout, and we only learn the result through
 * verified server-side evidence (a signed notification, or an authenticated status
 * lookup with our own API credentials).
 *
 * Everything provider specific (URLs, signing, status names, SDKs, response formats)
 * stays inside that provider's module. The rest of the app only sees these types.
 */
/**
 * cashfree = Cashfree Payments. uropay = UroPay Merchant API (hosted checkout).
 * urorelay = UroRelay (UroPay's phone/SMS product: UPI QR straight to the owner's bank,
 * confirmed from the bank's credit SMS). demo = simulated, demo mode only.
 */
export type ProviderId = "cashfree" | "uropay" | "urorelay" | "demo";

/**
 * Which of a provider's environments a payment attempt lives in. Saved on every
 * attempt, so an attempt is always checked against the environment that created it.
 * Each provider maps this to its own mechanism (Cashfree: sandbox or production base
 * URL; UroPay: TEST or PRODUCTION key pair). It is never sent to a provider as-is.
 */
export type PaymentEnvironment = "demo" | "test" | "production";

export type EvidenceStatus = "paid" | "pending" | "failed" | "cancelled" | "expired" | "not_attempted";

export interface PaymentEvidence {
  source: "webhook" | "api" | "demo" | "manual";
  provider: ProviderId;
  /** The environment whose credentials produced or verified this evidence. */
  environment: PaymentEnvironment;
  /** Our reference for the attempt (sent to the provider when the order was created). */
  providerOrderId: string;
  /** The provider's own id for that order (Cashfree cf_order_id, UroPay order id), when known. */
  providerReference: string | null;
  providerPaymentId: string | null;
  status: EvidenceStatus;
  /** Amount the provider says was charged/ordered, in paise (null if not reported; -1 = the provider's own figures disagree). */
  amountPaise: number | null;
  currency: string | null;
  /** Raw provider status string, for audit. */
  providerStatus: string;
  /**
   * The provider reports success but the proof we require is missing or incomplete
   * (UroRelay: no matching bank SMS). A "paid" claim is then held for the owner to
   * check, never fulfilled automatically.
   */
  holdForReview?: string | null;
}

export interface CreateCheckoutRequest {
  /** Our reference for this attempt. Providers must treat a repeat with the same value as the same order. */
  providerOrderId: string;
  /** The internal order reference (RA-...), for the provider's dashboard. */
  orderReference: string;
  amountPaise: number;
  currency: "INR";
  customerId: string;
  email: string;
  phone: string;
  returnUrl: string;
  notifyUrl: string | null;
  /** Null when the provider sets the lifetime itself. */
  expiresAt: Date | null;
  orderNote: string;
}

export interface CheckoutSession {
  /** Cashfree: the payment_session_id handed to the browser SDK. */
  paymentSessionId: string | null;
  /** UroPay: the hosted checkout URL. Demo: our local simulated checkout page. */
  redirectUrl: string | null;
  /** The provider's own id for the order, when it returns one. */
  providerReference: string | null;
  environment: PaymentEnvironment;
  /**
   * Payment details shown on OUR order page instead of a provider page (UroRelay:
   * the UPI QR image and upi:// link). Browser-safe; stored on the attempt.
   */
  checkoutData?: Record<string, string> | null;
}

export interface PaymentAttemptRef {
  providerOrderId: string;
  providerReference: string | null;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly environment: PaymentEnvironment;
  /**
   * True when a failed or cancelled payment can be retried on the SAME provider order
   * (Cashfree keeps the order open until it expires). Then we reuse that order instead
   * of opening a second payable one.
   */
  readonly retryOnSameOrder: boolean;
  /** How long we ask the provider to keep a checkout open, or null when the provider decides (UroPay). */
  readonly checkoutLifetimeMinutes: number | null;
  /**
   * Creates the provider order and returns what the browser needs. Must be safe to
   * repeat with the same providerOrderId (it returns the existing order, never a second one).
   * Returns a session with neither paymentSessionId nor redirectUrl when the provider
   * order can no longer be paid (for example it is already paid); the caller then reconciles.
   */
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutSession>;
  /** Authoritative status lookup, used for reconciliation and to confirm advisory notifications. */
  fetchEvidence(attempt: PaymentAttemptRef): Promise<PaymentEvidence>;
}

export class PaymentProviderError extends Error {
  readonly httpStatus: number | null;
  readonly providerCode: string | null;
  /** True when the outcome is unknown (timeout, network, 5xx, 429): the request may or may not have taken effect. */
  readonly retriable: boolean;

  constructor(message: string, httpStatus: number | null, providerCode: string | null, retriable: boolean) {
    super(message);
    this.name = "PaymentProviderError";
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
    this.retriable = retriable;
  }
}

/** A short, safe description of a provider failure for logs and the admin dashboard (no secrets, no payloads). */
export function safeProviderErrorCode(error: unknown): string {
  if (error instanceof PaymentProviderError) {
    if (error.httpStatus === null) return error.retriable ? "unreachable" : "invalid_response";
    return `http_${error.httpStatus}${error.providerCode ? `_${error.providerCode.replace(/[^a-z0-9_]/gi, "").slice(0, 40)}` : ""}`;
  }
  return "error";
}
