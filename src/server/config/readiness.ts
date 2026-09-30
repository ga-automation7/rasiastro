import type { Product } from "@/domain/pricing";
import { getEnv, isAppModeExplicit, isProductionDeployment, isServerlessRuntime, type Env } from "./env";

/**
 * Which integrations are configured, whether each product may take orders, and the
 * single "site state" the UI shows.
 *
 * Principles:
 * - Never accept real money for a report we cannot produce: in live mode a missing
 *   required integration disables checkout with a clear message.
 * - Demo and sandbox never run on the real shop (rasiastro.com).
 * - A hosted deployment never falls back to a default mode.
 * - Each product has its own switch, so a problem with one never disables the other.
 * - The banner and the order buttons come from ONE state, so they cannot contradict.
 */
export interface ConfigCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export type ProviderChoice = {
  payments: "cashfree" | "demo";
  interpretation: "openai" | "demo";
  email: "resend" | "demo-file";
  storage: "supabase" | "local";
  jobs: "inngest" | "local";
};

export function chooseProviders(env: Env = getEnv()): ProviderChoice {
  // Only demo simulates providers. Sandbox uses every real service with test payments.
  const demo = env.APP_MODE === "demo";
  return {
    payments: demo ? "demo" : "cashfree",
    interpretation: demo && env.DEMO_USE_REAL_AI !== "true" ? "demo" : "openai",
    email: demo && env.DEMO_SEND_REAL_EMAIL !== "true" ? "demo-file" : "resend",
    storage: env.STORAGE_PROVIDER,
    jobs: env.JOB_RUNNER,
  };
}

/** Infrastructure shared by both products. */
export function getConfigChecks(env: Env = getEnv()): ConfigCheck[] {
  const providers = chooseProviders(env);
  const checks: ConfigCheck[] = [];
  const add = (key: string, label: string, ok: boolean, detail: string) => checks.push({ key, label, ok, detail });
  const production = isProductionDeployment(env);
  const hosted = isServerlessRuntime();

  if (hosted && !isAppModeExplicit()) {
    // Never fall back to a default mode on a hosted site: it could silently simulate payments.
    add("app_mode", "APP_MODE set explicitly", false, "Set APP_MODE to demo, sandbox or live in the Vercel environment variables.");
  }
  if (hosted || env.APP_MODE !== "demo") {
    add("app_secret", "APP_SECRET", Boolean(env.APP_SECRET && env.APP_SECRET.length >= 32), "Set APP_SECRET to at least 32 random characters.");
  }

  if (env.APP_MODE === "demo") {
    add("mode", "Demo mode allowed here", !production, production ? "Demo mode is refused on the production site (rasiastro.com)." : "Demo mode (simulated payments).");
    if (hosted) {
      // A hosted demo has no persistent disk: it needs a real database and file storage.
      add("demo_database", "Database for the hosted demo", Boolean(env.DATABASE_URL), "A demo on a hosted server needs DATABASE_URL (Supabase).");
      add(
        "demo_storage",
        "File storage for the hosted demo",
        env.STORAGE_PROVIDER === "supabase" && Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        "A demo on a hosted server needs STORAGE_PROVIDER=supabase.",
      );
      // The in-process runner only works on your own computer; hosted jobs must be durable.
      add("demo_jobs", "Background jobs for the hosted demo", providers.jobs === "inngest", "A demo on a hosted server needs JOB_RUNNER=inngest.");
    }
  } else {
    if (env.APP_MODE === "sandbox") {
      add("mode", "Sandbox allowed here", !production, production ? "Sandbox (test payments) is refused on the production site (rasiastro.com)." : "Sandbox: real services, test payments.");
    } else {
      add("mode", "Live mode", true, "Live mode: real providers only.");
    }
    add("database", "Database (Supabase Postgres)", Boolean(env.DATABASE_URL), env.DATABASE_URL ? "DATABASE_URL set." : "Set DATABASE_URL.");
    const httpsRequired = env.APP_MODE === "live" || hosted;
    add("site_url", "Public site URL", !httpsRequired || env.PUBLIC_SITE_URL.startsWith("https://"), "PUBLIC_SITE_URL must be the https address customers use.");
    if (env.APP_MODE === "live") {
      add(
        "business_details",
        "Business and grievance-officer details",
        Boolean(env.BUSINESS_LEGAL_NAME && env.BUSINESS_ADDRESS && env.GRIEVANCE_OFFICER_NAME && env.SUPPORT_PHONE),
        "Set BUSINESS_LEGAL_NAME, BUSINESS_ADDRESS, GRIEVANCE_OFFICER_NAME and SUPPORT_PHONE (shown on the policy and contact pages, required for Indian e-commerce).",
      );
    }
  }

  if (providers.payments === "cashfree") {
    add("cashfree_keys", "Cashfree API keys", Boolean(env.CASHFREE_CLIENT_ID && env.CASHFREE_CLIENT_SECRET), "Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.");
    if (env.APP_MODE === "live") {
      add("cashfree_env", "Cashfree production environment", env.CASHFREE_ENV === "production", "Live mode must use CASHFREE_ENV=production. Use APP_MODE=sandbox for testing.");
    } else {
      add("cashfree_env", "Cashfree test environment", env.CASHFREE_ENV === "sandbox", "Sandbox mode must use CASHFREE_ENV=sandbox so no real money moves.");
    }
  }
  if (providers.interpretation === "openai") {
    add("openai", "OpenAI API key and model", Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL), "Set OPENAI_API_KEY and OPENAI_MODEL (run npm run config:check to verify the model is available).");
  }
  if (providers.email === "resend") {
    add("resend", "Resend email", Boolean(env.RESEND_API_KEY), "Set RESEND_API_KEY and verify the sending domain in Resend.");
  }
  if (providers.storage === "supabase") {
    add("storage", "Supabase private storage", Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY), "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  } else if (env.APP_MODE !== "demo") {
    add(
      "storage",
      "Report storage",
      env.APP_MODE === "sandbox" && !hosted,
      "Live mode, and sandbox on a hosted site, must use STORAGE_PROVIDER=supabase (serverless disks are not persistent).",
    );
  }
  if (providers.jobs === "inngest") {
    const devServer = env.INNGEST_DEV === "1" && !production && !hosted;
    add("inngest", "Inngest background jobs", devServer || Boolean(env.INNGEST_EVENT_KEY && env.INNGEST_SIGNING_KEY), devServer ? "Using the local Inngest dev server." : "Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.");
  } else if (env.APP_MODE !== "demo") {
    add("inngest", "Background jobs", false, "Sandbox and live modes require JOB_RUNNER=inngest (the local runner is for demo only).");
  }
  return checks;
}

/** Checks that concern only one product. */
export function getProductChecks(product: Product, env: Env = getEnv()): ConfigCheck[] {
  if (product === "personal") {
    return [{ key: "personal_enabled", label: "Personal reports switched on", ok: env.PERSONAL_ORDERS_ENABLED === "true", detail: "PERSONAL_ORDERS_ENABLED=false" }];
  }
  return [{ key: "compatibility_enabled", label: "Compatibility reports switched on", ok: env.COMPATIBILITY_ORDERS_ENABLED === "true", detail: "COMPATIBILITY_ORDERS_ENABLED=false" }];
}

export interface CheckoutAvailability {
  available: boolean;
  mode: Env["APP_MODE"];
  /** Safe to show customers. */
  customerMessage: string | null;
  /** For the owner (health endpoint / config:check); never shown to customers. */
  missing: string[];
}

export const SITE_MESSAGES = {
  demo: "Explore a sample journey. Payments are simulated and reports use sample content.",
  sandbox: "Test site. Payments run in the payment provider's test mode, so no real money is taken.",
  closed: "Online ordering is not open yet. Please check back soon.",
  productPaused: "This report is not available to order right now. Reports you have already bought are unaffected.",
} as const;

export function getCheckoutAvailability(env: Env = getEnv(), product: Product = "personal"): CheckoutAvailability {
  const sharedFailing = getConfigChecks(env).filter((c) => !c.ok);
  const failing = [...sharedFailing, ...getProductChecks(product, env).filter((c) => !c.ok)];
  if (failing.length === 0) return { available: true, mode: env.APP_MODE, customerMessage: null, missing: [] };
  return {
    available: false,
    mode: env.APP_MODE,
    // Shared problems close ordering entirely; a product switch pauses only that product.
    customerMessage: sharedFailing.length ? SITE_MESSAGES.closed : SITE_MESSAGES.productPaused,
    missing: failing.map((c) => `${c.label}: ${c.detail}`),
  };
}

export interface SiteState {
  /**
   * live: the real shop. sandbox: real services with test payments. demo: simulated
   * payments and sample text. closed: ordering is not open here (configuration
   * missing, or a mode that is refused on this host).
   */
  kind: "live" | "sandbox" | "demo" | "closed";
  banner: { tone: "demo" | "sandbox" | "closed"; text: string } | null;
  products: Record<Product, { available: boolean; message: string | null }>;
}

export function getSiteState(env: Env = getEnv()): SiteState {
  const personal = getCheckoutAvailability(env, "personal");
  const compatibility = getCheckoutAvailability(env, "compatibility");
  const products = {
    personal: { available: personal.available, message: personal.customerMessage },
    compatibility: { available: compatibility.available, message: compatibility.customerMessage },
  };
  const sharedOk = getConfigChecks(env).every((c) => c.ok);
  // Cannot take orders at all here: say ONE thing, and never promise a demo.
  if (!sharedOk) return { kind: "closed", banner: { tone: "closed", text: SITE_MESSAGES.closed }, products };
  if (env.APP_MODE === "demo") return { kind: "demo", banner: { tone: "demo", text: SITE_MESSAGES.demo }, products };
  if (env.APP_MODE === "sandbox") return { kind: "sandbox", banner: { tone: "sandbox", text: SITE_MESSAGES.sandbox }, products };
  return { kind: "live", banner: null, products };
}
