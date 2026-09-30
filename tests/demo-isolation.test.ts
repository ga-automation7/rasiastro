import { afterEach, describe, expect, it } from "vitest";
import { chooseProviders, getCheckoutAvailability, getSiteState } from "@/server/config/readiness";
import { getEnv } from "@/server/config/env";
import { getInterpretationProvider } from "@/server/interpretation/service";
import { activeProvider, providerFor } from "@/server/payments/registry";
import { setTestEnv } from "./helpers";

const LIVE_OK = {
  APP_MODE: "live",
  NODE_ENV: "production",
  PUBLIC_SITE_URL: "https://staging.rasiastro.example",
  APP_SECRET: "x".repeat(40),
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  PAYMENT_PROVIDER: "cashfree",
  CASHFREE_LIVE_CLIENT_ID: "id",
  CASHFREE_LIVE_CLIENT_SECRET: "secret",
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "some-model",
  RESEND_API_KEY: "re_test",
  STORAGE_PROVIDER: "supabase",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  JOB_RUNNER: "inngest",
  INNGEST_EVENT_KEY: "evt",
  INNGEST_SIGNING_KEY: "sign",
  BUSINESS_LEGAL_NAME: "Example Pvt Ltd",
  BUSINESS_ADDRESS: "Chennai",
  GRIEVANCE_OFFICER_NAME: "A. Person",
  SUPPORT_PHONE: "+91 90000 00000",
  PAYMENT_ENV: "production",
};

const SANDBOX_OK = {
  ...LIVE_OK,
  APP_MODE: "sandbox",
  PAYMENT_ENV: "test",
  CASHFREE_LIVE_CLIENT_ID: undefined,
  CASHFREE_LIVE_CLIENT_SECRET: undefined,
  CASHFREE_TEST_CLIENT_ID: "test-id",
  CASHFREE_TEST_CLIENT_SECRET: "test-secret",
  PUBLIC_SITE_URL: "https://rasi-astro.vercel.app",
};

describe("demo mode can never take real money", () => {
  afterEach(() => setTestEnv());

  it("demo mode uses demo payment and demo AI adapters", () => {
    setTestEnv();
    expect(chooseProviders()).toMatchObject({ payments: "demo", interpretation: "demo", email: "demo-file" });
    expect(activeProvider().id).toBe("demo");
    // Real providers are never constructed in demo mode, whatever keys are present.
    setTestEnv({ CASHFREE_TEST_CLIENT_ID: "id", CASHFREE_TEST_CLIENT_SECRET: "s", PAYMENT_PROVIDER: "cashfree", PAYMENT_ENV: "test" });
    expect(activeProvider().id).toBe("demo");
    expect(providerFor("cashfree", "test")).toBeNull();
    expect(getInterpretationProvider().isDemo).toBe(true);
  });

  it("demo mode is refused on the production deployment", () => {
    setTestEnv({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "rasiastro.com" });
    expect(getCheckoutAvailability().available).toBe(false);
    // A *.vercel.app production deployment is a staging site, not the shop.
    setTestEnv({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "rasi-astro.vercel.app" });
    expect(getCheckoutAvailability().available).toBe(true);
    setTestEnv({ PUBLIC_SITE_URL: "https://rasiastro.com" });
    expect(getCheckoutAvailability().available).toBe(false);
  });

  it("live mode never selects a demo adapter", () => {
    setTestEnv(LIVE_OK);
    expect(chooseProviders()).toMatchObject({ payments: "cashfree", interpretation: "openai", email: "resend", jobs: "inngest", storage: "supabase" });
    expect(activeProvider()).toMatchObject({ id: "cashfree", environment: "production" });
    expect(providerFor("demo", "demo")).toBeNull();
    expect(getInterpretationProvider().isDemo).toBe(false);
    expect(getCheckoutAvailability()).toMatchObject({ available: true });
  });

  it("live mode with any missing integration disables checkout with a customer-safe message", () => {
    for (const key of ["CASHFREE_LIVE_CLIENT_SECRET", "PAYMENT_PROVIDER", "PAYMENT_ENV", "OPENAI_MODEL", "RESEND_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "INNGEST_SIGNING_KEY", "DATABASE_URL", "BUSINESS_LEGAL_NAME"]) {
      setTestEnv({ ...LIVE_OK, [key]: undefined });
      const availability = getCheckoutAvailability();
      expect(availability.available, key).toBe(false);
      expect(availability.customerMessage).not.toMatch(/KEY|SECRET|DATABASE/);
      expect(availability.missing.length).toBeGreaterThan(0);
    }
  });

  it("live mode refuses the local job runner and local disk storage", () => {
    setTestEnv({ ...LIVE_OK, JOB_RUNNER: "local" });
    expect(getCheckoutAvailability().available).toBe(false);
    setTestEnv({ ...LIVE_OK, STORAGE_PROVIDER: "local" });
    expect(getCheckoutAvailability().available).toBe(false);
  });

  it("live mode must use the production payment environment; sandbox must use the test environment", () => {
    setTestEnv({ ...LIVE_OK, PAYMENT_ENV: "test" });
    expect(getCheckoutAvailability().available).toBe(false);
    setTestEnv({ ...LIVE_OK, PAYMENT_ENV: "production" });
    expect(getCheckoutAvailability().available).toBe(true);
    expect(getEnv().PAYMENT_ENV).toBe("production");
    setTestEnv(SANDBOX_OK);
    expect(getCheckoutAvailability().available).toBe(true);
    setTestEnv({ ...SANDBOX_OK, PAYMENT_ENV: "production" });
    expect(getCheckoutAvailability().available).toBe(false);
  });

  it("a deployment only reads the keys of its own environment", () => {
    // Live keys present on a sandbox deployment are never used: no silent live payments.
    setTestEnv({ ...SANDBOX_OK, CASHFREE_TEST_CLIENT_ID: undefined, CASHFREE_TEST_CLIENT_SECRET: undefined, CASHFREE_LIVE_CLIENT_ID: "live", CASHFREE_LIVE_CLIENT_SECRET: "live" });
    expect(getCheckoutAvailability().available).toBe(false);
    expect(providerFor("cashfree", "production")).toBeNull();
    expect(() => activeProvider()).toThrow(/not configured/);
    // Test keys on a live deployment are never used either.
    setTestEnv({ ...LIVE_OK, CASHFREE_LIVE_CLIENT_ID: undefined, CASHFREE_LIVE_CLIENT_SECRET: undefined, CASHFREE_TEST_CLIENT_ID: "t", CASHFREE_TEST_CLIENT_SECRET: "t" });
    expect(getCheckoutAvailability().available).toBe(false);
    expect(providerFor("cashfree", "test")).toBeNull();
  });

  it("Vercel Preview and Development deployments can never take live payments", () => {
    setTestEnv({ ...LIVE_OK, VERCEL_ENV: "preview" });
    const preview = getCheckoutAvailability();
    expect(preview.available).toBe(false);
    expect(preview.missing.join(" ")).toMatch(/Live payments are refused on a Vercel preview deployment/);
    setTestEnv({ ...LIVE_OK, VERCEL_ENV: "development" });
    expect(getCheckoutAvailability().available).toBe(false);
    setTestEnv({ ...LIVE_OK, VERCEL_ENV: "production" });
    expect(getCheckoutAvailability().available).toBe(true);
    // Sandbox (test payments) is fine on Preview.
    setTestEnv({ ...SANDBOX_OK, VERCEL_ENV: "preview" });
    expect(getCheckoutAvailability().available).toBe(true);
  });

  it("UroRelay and the UroPay Merchant API are separate providers with separate keys", () => {
    const relay = { ...LIVE_OK, PAYMENT_PROVIDER: "urorelay", UROPAY_RELAY_API_KEY: "relay-key", UROPAY_RELAY_API_SECRET: "relay-secret" };
    setTestEnv(relay);
    expect(getCheckoutAvailability().available).toBe(true);
    expect(activeProvider()).toMatchObject({ id: "urorelay", environment: "production" });
    // Relay keys are never used for the Merchant API, and the other way round.
    expect(providerFor("uropay", "production")).toBeNull();
    setTestEnv({ ...relay, UROPAY_RELAY_API_SECRET: undefined });
    expect(getCheckoutAvailability().missing.join(" ")).toMatch(/UROPAY_RELAY_API_KEY and UROPAY_RELAY_API_SECRET/);
    setTestEnv({ ...LIVE_OK, PAYMENT_PROVIDER: "urorelay", UROPAY_LIVE_API_KEY: "k", UROPAY_LIVE_API_SECRET: "s" });
    expect(getCheckoutAvailability().available).toBe(false);

    const merchant = { ...LIVE_OK, PAYMENT_PROVIDER: "uropay", UROPAY_LIVE_API_KEY: "k", UROPAY_LIVE_API_SECRET: "s" };
    setTestEnv(merchant);
    expect(getCheckoutAvailability().available).toBe(true);
    expect(activeProvider()).toMatchObject({ id: "uropay", environment: "production" });
    expect(providerFor("urorelay", "production")).toBeNull();
    setTestEnv({ ...merchant, UROPAY_LIVE_API_SECRET: undefined });
    expect(getCheckoutAvailability().available).toBe(false);
  });

  it("the provider that is not active stays available for its existing attempts", () => {
    setTestEnv({ ...LIVE_OK, PAYMENT_PROVIDER: "cashfree", UROPAY_LIVE_API_KEY: "k", UROPAY_LIVE_API_SECRET: "s", UROPAY_RELAY_API_KEY: "rk", UROPAY_RELAY_API_SECRET: "rs" });
    expect(activeProvider().id).toBe("cashfree");
    expect(providerFor("uropay", "production")?.id).toBe("uropay");
    expect(providerFor("urorelay", "production")?.id).toBe("urorelay");
  });

  it("sandbox uses every real adapter but is refused on rasiastro.com", () => {
    setTestEnv(SANDBOX_OK);
    expect(chooseProviders()).toMatchObject({ payments: "cashfree", interpretation: "openai", email: "resend" });
    expect(getSiteState()).toMatchObject({ kind: "sandbox", banner: { tone: "sandbox" } });
    setTestEnv({ ...SANDBOX_OK, PUBLIC_SITE_URL: "https://rasiastro.com" });
    expect(getSiteState().kind).toBe("closed");
  });

  it("the banner and the order buttons never contradict each other", () => {
    for (const env of [{}, { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "rasiastro.com" }, LIVE_OK, { ...LIVE_OK, DATABASE_URL: undefined }, SANDBOX_OK]) {
      setTestEnv(env);
      const state = getSiteState();
      if (state.kind === "demo") expect(state.products.personal.available).toBe(true);
      if (state.kind === "closed") {
        expect(state.products.personal.available).toBe(false);
        expect(state.products.compatibility.available).toBe(false);
        expect(state.banner?.text).not.toMatch(/simulated/i);
      }
    }
  });

  it("a hosted deployment without an explicit APP_MODE takes no orders", () => {
    const previous = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      setTestEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/db", STORAGE_PROVIDER: "supabase", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", APP_SECRET: "x".repeat(40) });
      delete process.env.APP_MODE;
      expect(getSiteState().kind).toBe("closed");
    } finally {
      if (previous === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previous;
    }
  });

  it("each product has its own switch", () => {
    setTestEnv({ ...LIVE_OK, COMPATIBILITY_ORDERS_ENABLED: "false" });
    expect(getCheckoutAvailability(undefined, "personal").available).toBe(true);
    expect(getCheckoutAvailability(undefined, "compatibility").available).toBe(false);
    setTestEnv({ ...LIVE_OK, PERSONAL_ORDERS_ENABLED: "false" });
    expect(getCheckoutAvailability(undefined, "personal").available).toBe(false);
    expect(getCheckoutAvailability(undefined, "compatibility").available).toBe(true);
  });
});
