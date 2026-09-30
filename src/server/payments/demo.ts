import type { CheckoutSession, CreateCheckoutRequest, PaymentAttemptRef, PaymentEvidence, PaymentProvider } from "./types";

/**
 * DEMO ONLY. Simulates a hosted checkout on our own /demo/checkout page. No money
 * moves. It is only constructed when APP_MODE=demo, and demo mode is refused on the
 * production deployment (see config/readiness.ts).
 *
 * The "provider state" is the payment row's provider_status, set by the simulated
 * checkout page (DEMO_SUCCESS / DEMO_FAILED / DEMO_CANCELLED).
 */
export class DemoPaymentProvider implements PaymentProvider {
  readonly id = "demo" as const;
  readonly environment = "demo" as const;
  readonly retryOnSameOrder = false;
  readonly checkoutLifetimeMinutes = 45;
  private readonly lookup: (providerOrderId: string) => Promise<{ amountPaise: number; providerStatus: string | null } | null>;

  constructor(lookup: (providerOrderId: string) => Promise<{ amountPaise: number; providerStatus: string | null } | null>) {
    this.lookup = lookup;
  }

  async createCheckout(req: CreateCheckoutRequest): Promise<CheckoutSession> {
    return { paymentSessionId: null, redirectUrl: `/demo/checkout/${encodeURIComponent(req.providerOrderId)}`, providerReference: null, environment: "demo" };
  }

  async fetchEvidence(attempt: PaymentAttemptRef): Promise<PaymentEvidence> {
    const { providerOrderId } = attempt;
    const state = await this.lookup(providerOrderId);
    const providerStatus = state?.providerStatus ?? "DEMO_NOT_ATTEMPTED";
    const status =
      providerStatus === "DEMO_SUCCESS" ? "paid" : providerStatus === "DEMO_FAILED" ? "failed" : providerStatus === "DEMO_CANCELLED" ? "cancelled" : "not_attempted";
    return {
      source: "demo",
      provider: "demo",
      environment: "demo",
      providerOrderId,
      providerReference: null,
      providerPaymentId: status === "paid" ? `demo_${providerOrderId}` : null,
      status,
      amountPaise: state?.amountPaise ?? null,
      currency: "INR",
      providerStatus,
    };
  }
}
