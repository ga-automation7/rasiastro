import { getEnv } from "../config/env";
import { getDb } from "../db";
import { AppError } from "../errors";
import { CashfreeProvider } from "./cashfree";
import { activeProviderId, cashfreeCredentials, deploymentPaymentEnvironment, uroPayCredentials, uroRelayCredentials } from "./config";
import { DemoPaymentProvider } from "./demo";
import { getPaymentByProviderOrderId, getRelayAttemptFacts } from "./repository";
import type { PaymentEnvironment, PaymentProvider, ProviderId } from "./types";
import { UroPayMerchantProvider } from "./uropay";
import { UroRelayProvider } from "./urorelay";

/**
 * Chooses the adapter for a payment attempt from the provider and environment SAVED
 * on that attempt, never from the currently active provider. Switching PAYMENT_PROVIDER
 * therefore only changes new checkouts; older attempts keep being checked, confirmed
 * and reconciled through the provider that created them.
 */
let overrides: Map<ProviderId, PaymentProvider> | null = null;
let activeOverride: ProviderId | null = null;

/**
 * Tests register fake adapters (for example a Cashfree adapter with a stubbed fetch).
 * `active` is the provider used for new checkouts (default: the first one given).
 */
export function setPaymentProvidersForTests(providers: PaymentProvider[] | null, active?: ProviderId): void {
  overrides = providers ? new Map(providers.map((p) => [p.id, p])) : null;
  activeOverride = providers ? (active ?? providers[0]?.id ?? null) : null;
}

/** Tests: register one fake adapter and make it the active one (null clears all fakes). */
export function setPaymentProviderForTests(provider: PaymentProvider | null): void {
  setPaymentProvidersForTests(provider ? [provider] : null);
}

/** Tests: switch the provider used for new checkouts, keeping the registered fakes. */
export function setActivePaymentProviderForTests(id: ProviderId): void {
  activeOverride = id;
}

/** The adapter for (provider, environment), or null if this deployment cannot serve it. */
export function providerFor(id: ProviderId, environment: PaymentEnvironment): PaymentProvider | null {
  if (overrides) {
    const fake = overrides.get(id);
    return fake && fake.environment === environment ? fake : null;
  }
  const env = getEnv();
  // A deployment only ever talks to the environment it is configured for.
  if (environment !== deploymentPaymentEnvironment(env)) return null;
  if (id === "demo" || environment === "demo") {
    // Demo is only ever constructed in demo mode (demo mode is refused on the real shop).
    if (id !== "demo" || environment !== "demo" || env.APP_MODE !== "demo") return null;
    return new DemoPaymentProvider(async (providerOrderId) => {
      const payment = await getPaymentByProviderOrderId(await getDb(), providerOrderId);
      return payment ? { amountPaise: payment.amountPaise, providerStatus: payment.providerStatus } : null;
    });
  }
  if (id === "cashfree") {
    const credentials = cashfreeCredentials(env, environment);
    return credentials ? new CashfreeProvider({ environment, ...credentials, apiVersion: env.CASHFREE_API_VERSION }) : null;
  }
  if (id === "urorelay") {
    const relay = uroRelayCredentials(env);
    return relay ? new UroRelayProvider({ environment, ...relay, lookup: async (providerOrderId) => getRelayAttemptFacts(await getDb(), providerOrderId) }) : null;
  }
  const credentials = uroPayCredentials(env, environment);
  return credentials ? new UroPayMerchantProvider({ environment, ...credentials }) : null;
}

/**
 * The adapter this deployment uses for a provider in its own environment. Webhooks
 * use it: a notification is verified with the keys of the environment we serve.
 */
export function deploymentProvider(id: ProviderId): PaymentProvider | null {
  if (overrides) return overrides.get(id) ?? null;
  const environment = deploymentPaymentEnvironment(getEnv());
  return environment ? providerFor(id, environment) : null;
}

/** The adapter for NEW checkouts. Never falls back to another provider or to test mode. */
export function activeProvider(): PaymentProvider {
  if (overrides) {
    const fake = activeOverride ? overrides.get(activeOverride) : undefined;
    if (!fake) throw new AppError("service_unavailable", "Payments are not configured.");
    return fake;
  }
  const env = getEnv();
  const id = activeProviderId(env);
  const environment = deploymentPaymentEnvironment(env);
  const provider = id && environment ? providerFor(id, environment) : null;
  if (!provider) throw new AppError("service_unavailable", "Payments are not configured.");
  return provider;
}
