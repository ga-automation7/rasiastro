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
  /** demo = synthetic payments, sample chart data allowed, no real money. live = real providers only. */
  APP_MODE: z.enum(["demo", "live"]).default("demo"),
  PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  /** Used to key rate-limit buckets without storing raw IPs or emails. */
  APP_SECRET: optionalString,

  DATABASE_URL: optionalString,
  LOCAL_DB_DIR: z.string().default(".data/pglite"),

  CASHFREE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  CASHFREE_CLIENT_ID: optionalString,
  CASHFREE_CLIENT_SECRET: optionalString,
  CASHFREE_API_VERSION: z.string().default("2026-01-01"),

  AI_PROVIDER: z.enum(["openai"]).default("openai"),
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

  /** Demo mode only: use the real OpenAI adapter / real Resend emails instead of the demo ones. */
  DEMO_USE_REAL_AI: z.enum(["true", "false"]).default("false"),
  DEMO_SEND_REAL_EMAIL: z.enum(["true", "false"]).default("false"),

  BUSINESS_LEGAL_NAME: optionalString,
  BUSINESS_ADDRESS: optionalString,
  GRIEVANCE_OFFICER_NAME: optionalString,

  VERCEL_ENV: optionalString,
});

export type Env = z.infer<typeof EnvSchema>;

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

export function isProductionDeployment(env: Env = getEnv()): boolean {
  if (env.VERCEL_ENV === "production") return true;
  try {
    const host = new URL(env.PUBLIC_SITE_URL).hostname;
    return host === "rasiastro.com" || host === "www.rasiastro.com";
  } catch {
    return false;
  }
}
