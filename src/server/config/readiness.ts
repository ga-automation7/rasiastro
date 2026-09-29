import { getEnv, isProductionDeployment, type Env } from "./env";

/**
 * Which integrations are configured, and whether we may take an order.
 *
 * Principle: never accept real money for a report we cannot produce. In live mode a
 * single missing required integration disables checkout with a clear message. Demo
 * mode can never run on the production deployment.
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
  const demo = env.APP_MODE === "demo";
  return {
    payments: demo ? "demo" : "cashfree",
    interpretation: demo && env.DEMO_USE_REAL_AI !== "true" ? "demo" : "openai",
    email: demo && env.DEMO_SEND_REAL_EMAIL !== "true" ? "demo-file" : "resend",
    storage: env.STORAGE_PROVIDER,
    jobs: env.JOB_RUNNER,
  };
}

export function getConfigChecks(env: Env = getEnv()): ConfigCheck[] {
  const providers = chooseProviders(env);
  const checks: ConfigCheck[] = [];
  const add = (key: string, label: string, ok: boolean, detail: string) => checks.push({ key, label, ok, detail });
  const production = isProductionDeployment(env);

  if (env.APP_MODE === "demo") {
    add("mode", "Demo mode allowed here", !production, production ? "Demo mode is refused on the production deployment." : "Demo mode (no real payments).");
  } else {
    add("mode", "Live mode", true, "Live mode: real providers only.");
    add("database", "Database (Supabase Postgres)", Boolean(env.DATABASE_URL), env.DATABASE_URL ? "DATABASE_URL set." : "Set DATABASE_URL.");
    add("app_secret", "APP_SECRET", Boolean(env.APP_SECRET && env.APP_SECRET.length >= 32), "At least 32 random characters.");
    add("site_url", "Public site URL uses https", env.PUBLIC_SITE_URL.startsWith("https://"), `PUBLIC_SITE_URL=${env.PUBLIC_SITE_URL}`);
    add(
      "business_details",
      "Business details for policy pages",
      Boolean(env.BUSINESS_LEGAL_NAME && env.BUSINESS_ADDRESS && env.GRIEVANCE_OFFICER_NAME),
      "Set BUSINESS_LEGAL_NAME, BUSINESS_ADDRESS and GRIEVANCE_OFFICER_NAME (shown on the privacy, terms and contact pages).",
    );
  }

  if (providers.payments === "cashfree") {
    add("cashfree_keys", "Cashfree API keys", Boolean(env.CASHFREE_CLIENT_ID && env.CASHFREE_CLIENT_SECRET), "Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.");
    if (production) {
      add("cashfree_env", "Cashfree production environment", env.CASHFREE_ENV === "production", "The production site must use CASHFREE_ENV=production (sandbox payments are not real).");
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
  } else if (env.APP_MODE === "live") {
    add("storage", "Report storage", env.NODE_ENV !== "production", "Live deployments must use STORAGE_PROVIDER=supabase (serverless disks are not persistent).");
  }
  if (providers.jobs === "inngest") {
    const devServer = env.INNGEST_DEV === "1" && !production;
    add("inngest", "Inngest background jobs", devServer || Boolean(env.INNGEST_EVENT_KEY && env.INNGEST_SIGNING_KEY), devServer ? "Using the local Inngest dev server." : "Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.");
  } else if (env.APP_MODE === "live") {
    add("inngest", "Background jobs", false, "Live mode requires JOB_RUNNER=inngest (the local runner is for demo only).");
  }
  return checks;
}

export interface CheckoutAvailability {
  available: boolean;
  mode: Env["APP_MODE"];
  /** Safe to show customers. */
  customerMessage: string | null;
  /** For the owner (health endpoint / config:check); never shown to customers. */
  missing: string[];
}

export function getCheckoutAvailability(env: Env = getEnv()): CheckoutAvailability {
  const failing = getConfigChecks(env).filter((c) => !c.ok);
  if (failing.length === 0) return { available: true, mode: env.APP_MODE, customerMessage: null, missing: [] };
  return {
    available: false,
    mode: env.APP_MODE,
    customerMessage: "New orders are paused while we finish setting up our secure payment and report services. Please check back soon.",
    missing: failing.map((c) => `${c.label}: ${c.detail}`),
  };
}
