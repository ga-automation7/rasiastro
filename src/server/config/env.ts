import { z } from "zod";

/**
 * Server-side configuration, parsed and validated once from process.env.
 *
 * Nothing in this file may be imported by client components: it contains secrets.
 * Every variable is documented in .env.example.
 */

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const intFromEnv = (fallback: number, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().int().min(min).max(max));

const numberFromEnv = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
  .pipe(z.number().nonnegative().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /**
   * demo    = simulated payments and sample report text; no real money, no paid services.
   * sandbox = every real service, but the payment provider's TEST environment (no real money).
   * live    = real providers only, real money.
   * Hosted deployments must set this explicitly (see readiness.ts).
   */
  APP_MODE: z.enum(["demo", "sandbox", "live"]).default("demo"),
  PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  /** Used to key rate-limit buckets without storing raw IPs or emails. */
  APP_SECRET: optionalString,

  DATABASE_URL: optionalString,
  LOCAL_DB_DIR: z.string().default(".data/pglite"),

  /**
   * The provider used for NEW checkouts in sandbox and live mode. Existing payment
   * attempts always stay with the provider (and environment) that created them.
   * Demo mode ignores this and simulates payments.
   */
  PAYMENT_PROVIDER: z.enum(["uropay", "cashfree"]).optional().or(z.literal("").transform(() => undefined)),
  /** test = the provider's test environment (APP_MODE=sandbox); production = real money (APP_MODE=live). */
  PAYMENT_ENV: z.enum(["test", "production"]).optional().or(z.literal("").transform(() => undefined)),

  /**
   * Which UroPay product the account uses. They have different APIs and credentials:
   * merchant_api = UroPay Merchant API (api.uropai.in), implemented here.
   * urorelay = UroRelay (api.uropay.me, Android companion app), NOT implemented.
   */
  UROPAY_PRODUCT: z.enum(["merchant_api", "urorelay"]).optional().or(z.literal("").transform(() => undefined)),
  UROPAY_TEST_API_KEY: optionalString,
  UROPAY_TEST_API_SECRET: optionalString,
  UROPAY_LIVE_API_KEY: optionalString,
  UROPAY_LIVE_API_SECRET: optionalString,

  CASHFREE_TEST_CLIENT_ID: optionalString,
  CASHFREE_TEST_CLIENT_SECRET: optionalString,
  CASHFREE_LIVE_CLIENT_ID: optionalString,
  CASHFREE_LIVE_CLIENT_SECRET: optionalString,
  CASHFREE_API_VERSION: z.string().default("2026-01-01"),

  OPENAI_API_KEY: optionalString,
  /** Must be a model your OpenAI account can use. There is deliberately no default. */
  OPENAI_MODEL: optionalString,
  OPENAI_REASONING_EFFORT: z
    .enum(["none", "minimal", "low", "medium", "high"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  AI_TIMEOUT_MS: intFromEnv(240_000, 10_000, 780_000),
  AI_MAX_OUTPUT_TOKENS: intFromEnv(16_000, 2_000, 64_000),
  AI_DAILY_TOKEN_BUDGET: intFromEnv(4_000_000, 10_000, 1_000_000_000),
  AI_PRICE_INPUT_PER_MTOK_USD: numberFromEnv,
  AI_PRICE_OUTPUT_PER_MTOK_USD: numberFromEnv,

  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("Rasi Astro <reports@rasiastro.com>"),
  EMAIL_REPLY_TO: optionalString,
  SUPPORT_EMAIL: z.string().email().default("support@rasiastro.com"),
  OWNER_ALERT_EMAIL: optionalString,

  STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default(".data/storage"),
  SUPABASE_URL: optionalString,
  /** The Supabase "secret" / service-role key. Server-only; bypasses row-level security. */
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_REPORTS_BUCKET: z.string().default("reports"),

  JOB_RUNNER: z.enum(["local", "inngest"]).default("local"),
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,
  INNGEST_DEV: optionalString,

  /** auto: serverless Chromium on Vercel/AWS, otherwise a locally installed Chrome/Edge. */
  PDF_BROWSER: z.enum(["auto", "local", "serverless", "remote"]).default("auto"),
  CHROME_EXECUTABLE_PATH: optionalString,
  PDF_BROWSER_WS_ENDPOINT: optionalString,

  ACCESS_LINK_TTL_DAYS: intFromEnv(30, 1, 365),
  RETENTION_UNPAID_DAYS: intFromEnv(14, 1, 365),
  RETENTION_REPORT_DAYS: intFromEnv(400, 30, 3650),

  HEALTH_CHECK_TOKEN: optionalString,
  /**
   * Email addresses allowed to sign in to the owner dashboard (/admin), comma
   * separated. Empty = the dashboard is switched off entirely.
   */
  ADMIN_EMAILS: optionalString,
  /** How long an admin sign-in lasts (hours). */
  ADMIN_SESSION_HOURS: intFromEnv(12, 1, 72),

  /** Demo mode only: use the real OpenAI adapter / real Resend emails instead of the demo ones. */
  DEMO_USE_REAL_AI: z.enum(["true", "false"]).default("false"),
  DEMO_SEND_REAL_EMAIL: z.enum(["true", "false"]).default("false"),

  BUSINESS_LEGAL_NAME: optionalString,
  BUSINESS_ADDRESS: optionalString,
  /** e.g. "Sole proprietorship", "LLP (LLPIN AAA-1234)", "Private limited company (CIN U12345...)". */
  BUSINESS_REGISTRATION: optionalString,
  BUSINESS_GSTIN: optionalString,
  SUPPORT_PHONE: optionalString,
  GRIEVANCE_OFFICER_NAME: optionalString,
  GRIEVANCE_OFFICER_DESIGNATION: optionalString,
  GRIEVANCE_OFFICER_EMAIL: optionalString,
  GRIEVANCE_OFFICER_PHONE: optionalString,

  /** Independent product switches: turning one off never affects the other. */
  PERSONAL_ORDERS_ENABLED: z.enum(["true", "false"]).default("true"),
  COMPATIBILITY_ORDERS_ENABLED: z.enum(["true", "false"]).default("true"),
  /** Optional separate model for compatibility reports (defaults to OPENAI_MODEL). */
  OPENAI_MODEL_COMPATIBILITY: optionalString,

  /** Customer-facing service levels. Set them from measured live performance. */
  DELIVERY_TYPICAL_MINUTES: intFromEnv(30, 1, 1440),
  DELIVERY_MAX_HOURS: intFromEnv(24, 1, 168),
  REFUND_INITIATION_WORKING_DAYS: intFromEnv(7, 1, 30),

  VERCEL_ENV: optionalString,
  /** Set by Vercel: the project's production domain (e.g. rasiastro.com or x.vercel.app). */
  VERCEL_PROJECT_PRODUCTION_URL: optionalString,
});

export type Env = z.infer<typeof EnvSchema>;
export type AppMode = Env["APP_MODE"];

/** Sandbox and live use the real providers (database, AI, email, storage, jobs); only demo simulates them. */
export function usesRealProviders(env: Pick<Env, "APP_MODE"> = getEnv()): boolean {
  return env.APP_MODE !== "demo";
}

/** True when APP_MODE was set explicitly (a hosted deployment must never fall back to a default mode). */
export function isAppModeExplicit(): boolean {
  return Boolean(process.env.APP_MODE && process.env.APP_MODE.trim());
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      // Only variable names and messages are printed - never values.
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment configuration: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Tests replace process.env between cases; this clears the memoised copy. */
export function resetEnvCacheForTests(): void {
  cached = undefined;
}

const DEMO_SECRET = "rasi-astro-demo-secret-not-for-production-use-000";

export function getAppSecret(env: Env = getEnv()): string {
  return env.APP_SECRET ?? DEMO_SECRET;
}

const PRODUCTION_HOSTS = new Set(["rasiastro.com", "www.rasiastro.com"]);

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True for the real shop at rasiastro.com: either the configured public URL, or a
 * Vercel production deployment whose production domain is rasiastro.com. A Vercel
 * deployment on a *.vercel.app address is a preview/staging site, not the shop.
 */
export function isProductionDeployment(env: Env = getEnv()): boolean {
  const publicHost = hostOf(env.PUBLIC_SITE_URL);
  if (publicHost && PRODUCTION_HOSTS.has(publicHost)) return true;
  const vercelProductionHost = hostOf(env.VERCEL_PROJECT_PRODUCTION_URL);
  return env.VERCEL_ENV === "production" && vercelProductionHost !== null && PRODUCTION_HOSTS.has(vercelProductionHost);
}

/** Serverless platforms have no persistent local disk, so local demo storage cannot work there. */
export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}
