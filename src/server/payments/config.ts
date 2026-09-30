import type { Env } from "../config/env";
import type { PaymentEnvironment, ProviderId } from "./types";

/**
 * How application settings map to payment providers. Pure functions of the parsed
 * environment, so readiness checks, the registry and tests all agree.
 *
 * - PAYMENT_PROVIDER picks the provider for NEW checkouts only.
 * - PAYMENT_ENV says which environment this deployment serves (test or production).
 * - Cashfree and the UroPay Merchant API have separate test and live keys (…_TEST_… /
 *   …_LIVE_…), so a deployment in one environment never reads the other's keys.
 *   UroRelay has a single key pair; its notifications state TEST or LIVE and are
 *   checked against PAYMENT_ENV.
 * - A provider stays usable for its existing attempts as long as its credentials are
 *   present, whichever provider is active for new checkouts.
 */
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  cashfree: "Cashfree Payments",
  uropay: "UroPay",
  urorelay: "UroPay UPI",
  demo: "Demo checkout",
};

/** The environment this deployment serves: demo in demo mode, otherwise PAYMENT_ENV (null if unset). */
export function deploymentPaymentEnvironment(env: Env): PaymentEnvironment | null {
  if (env.APP_MODE === "demo") return "demo";
  return env.PAYMENT_ENV ?? null;
}

/** The provider for new checkouts (null when sandbox/live has no PAYMENT_PROVIDER). */
export function activeProviderId(env: Env): ProviderId | null {
  if (env.APP_MODE === "demo") return "demo";
  return env.PAYMENT_PROVIDER ?? null;
}

export function cashfreeCredentials(env: Env, environment: "test" | "production"): { clientId: string; clientSecret: string } | null {
  const clientId = environment === "production" ? env.CASHFREE_LIVE_CLIENT_ID : env.CASHFREE_TEST_CLIENT_ID;
  const clientSecret = environment === "production" ? env.CASHFREE_LIVE_CLIENT_SECRET : env.CASHFREE_TEST_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** UroPay Merchant API keys (never UroRelay keys: the products are not interchangeable). */
export function uroPayCredentials(env: Env, environment: "test" | "production"): { apiKey: string; apiSecret: string } | null {
  const apiKey = environment === "production" ? env.UROPAY_LIVE_API_KEY : env.UROPAY_TEST_API_KEY;
  const apiSecret = environment === "production" ? env.UROPAY_LIVE_API_SECRET : env.UROPAY_TEST_API_SECRET;
  return apiKey && apiSecret ? { apiKey, apiSecret } : null;
}

/** UroRelay keys (never sent to the Merchant API). */
export function uroRelayCredentials(env: Env): { apiKey: string; apiSecret: string } | null {
  return env.UROPAY_RELAY_API_KEY && env.UROPAY_RELAY_API_SECRET ? { apiKey: env.UROPAY_RELAY_API_KEY, apiSecret: env.UROPAY_RELAY_API_SECRET } : null;
}

export function isProviderConfigured(env: Env, id: ProviderId, environment: PaymentEnvironment): boolean {
  if (id === "demo" || environment === "demo") return id === "demo" && environment === "demo" && env.APP_MODE === "demo";
  if (id === "cashfree") return cashfreeCredentials(env, environment) !== null;
  if (id === "urorelay") return uroRelayCredentials(env) !== null;
  return uroPayCredentials(env, environment) !== null;
}

/** Real providers configured on this deployment (used by policy pages and the admin dashboard). */
export function configuredProviders(env: Env): ProviderId[] {
  const environment = deploymentPaymentEnvironment(env);
  if (!environment) return [];
  if (environment === "demo") return ["demo"];
  return (["urorelay", "uropay", "cashfree"] as const).filter((id) => isProviderConfigured(env, id, environment));
}

/**
 * Payment partners to name in the policies: the provider for new checkouts first, then
 * any other provider still configured for older orders. Without configuration (demo or
 * a local copy) the active provider is unknown, so every possible partner is named.
 */
export function paymentPartnerIds(env: Env): Exclude<ProviderId, "demo">[] {
  const ids = new Set<Exclude<ProviderId, "demo">>();
  const active = activeProviderId(env);
  if (active && active !== "demo") ids.add(active);
  for (const id of configuredProviders(env)) if (id !== "demo") ids.add(id);
  if (ids.size === 0) {
    ids.add("urorelay");
    ids.add("cashfree");
  }
  return [...ids];
}
