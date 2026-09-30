/**
 * Checks your configuration and (read-only) tests each configured account:
 * database, payment provider credentials (UroPay Merchant API, Cashfree), OpenAI key + model access, Resend key + domain,
 * Supabase storage bucket, Inngest keys and the PDF browser. Prints no secrets.
 *
 *   npm run config:check
 */
import OpenAI from "openai";
import { Resend } from "resend";
import { fail } from "./lib/cli";
import { getEnv } from "../src/server/config/env";
import { chooseProviders, getCheckoutAvailability, getConfigChecks, getProductChecks, getSiteState } from "../src/server/config/readiness";
import { closeDb, getDb } from "../src/server/db";
import { getSchemaVersion } from "../src/server/db/migrate";
import { configuredProviders, deploymentPaymentEnvironment } from "../src/server/payments/config";
import { providerFor } from "../src/server/payments/registry";
import { PaymentProviderError } from "../src/server/payments/types";
import { getPlacesAvailability } from "../src/server/places/service";
import { findLocalBrowser, resolveBrowserSource } from "../src/server/reports/pdf";

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => console.log(`  ✗ ${msg}`);
const info = (msg: string) => console.log(`  • ${msg}`);

try {
  const env = getEnv();
  const providers = chooseProviders(env);
  console.log(`\nMode: ${env.APP_MODE.toUpperCase()}  ·  site: ${env.PUBLIC_SITE_URL}`);
  console.log(`Providers: payments=${providers.payments}, AI=${providers.interpretation}, email=${providers.email}, storage=${providers.storage}, jobs=${providers.jobs}\n`);

  console.log(`Site state: ${getSiteState(env).kind}
`);
  console.log("Configuration:");
  for (const c of [...getConfigChecks(env), ...getProductChecks("personal", env), ...getProductChecks("compatibility", env)]) (c.ok ? ok : bad)(`${c.label}${c.ok ? "" : ` - ${c.detail}`}`);

  console.log("\nDatabase:");
  try {
    const db = await getDb();
    await db.query("select 1");
    ok(`connected (${db.kind === "postgres" ? "PostgreSQL" : "local demo database"}), schema ${await getSchemaVersion(db)}`);
    const places = await getPlacesAvailability(db);
    (places.ok ? ok : bad)(`birthplaces: ${places.geonames.toLocaleString()} GeoNames + ${places.demo} demo${places.ok ? "" : " - run npm run places:import"}`);
  } catch (error) {
    bad(`cannot connect: ${(error as Error).message}`);
  }

  const paymentEnv = deploymentPaymentEnvironment(env);
  console.log(`
Payments (environment: ${paymentEnv ?? "PAYMENT_ENV not set"}, new checkouts: ${providers.payments}):`);
  for (const legacy of ["CASHFREE_ENV", "CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET"]) {
    if (process.env[legacy]) bad(`${legacy} is no longer used: use PAYMENT_ENV and CASHFREE_TEST_… / CASHFREE_LIVE_… instead`);
  }
  if (paymentEnv === "test" || paymentEnv === "production") {
    const configured = configuredProviders(env);
    if (!configured.length) info("no payment provider keys for this environment");
    for (const id of configured) {
      const provider = providerFor(id, paymentEnv)!;
      // A read-only lookup of an order that cannot exist: "not found" proves the keys (and signing) work.
      try {
        await provider.fetchEvidence({ providerOrderId: "RASI-CONFIG-CHECK", providerReference: "RASI-CONFIG-CHECK" });
        info(`${id}: unexpected answer to the test lookup`);
      } catch (error) {
        const status = error instanceof PaymentProviderError ? error.httpStatus : null;
        if (status === 404) ok(`${id} (${paymentEnv}): credentials accepted (test lookup returned "order not found", as expected)`);
        else if (status === 401) bad(`${id} (${paymentEnv}): credentials rejected - check the ${paymentEnv === "production" ? "LIVE" : "TEST"} keys`);
        else if (status === 403) bad(`${id} (${paymentEnv}): access refused (403). For UroPay PRODUCTION this means KYC is not approved yet.`);
        else info(`${id} (${paymentEnv}): unexpected response ${status ?? (error as Error).message}`);
      }
      const site = env.PUBLIC_SITE_URL.replace(/\/$/, "");
      info(`${id} webhook URL: ${site}/api/webhooks/${id}${site.startsWith("https://") ? "" : " (providers need HTTPS: not usable from this address)"}`);
    }
  }

  if (env.OPENAI_API_KEY) {
    console.log("\nOpenAI:");
    try {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 20_000 });
      const ids: string[] = [];
      for await (const model of client.models.list()) ids.push(model.id);
      ok(`API key works (${ids.length} models visible to this account)`);
      if (!env.OPENAI_MODEL) bad("OPENAI_MODEL is not set. Pick one of the models your account lists, e.g.: " + ids.filter((m) => /^gpt|^o\d/.test(m)).slice(0, 8).join(", "));
      else if (ids.includes(env.OPENAI_MODEL)) ok(`model "${env.OPENAI_MODEL}" is available to this account`);
      else bad(`model "${env.OPENAI_MODEL}" is NOT available to this account. Available: ${ids.filter((m) => /^gpt|^o\d/.test(m)).slice(0, 10).join(", ")}`);
      if (env.OPENAI_MODEL_COMPATIBILITY) {
        if (ids.includes(env.OPENAI_MODEL_COMPATIBILITY)) ok(`compatibility model "${env.OPENAI_MODEL_COMPATIBILITY}" is available to this account`);
        else bad(`compatibility model "${env.OPENAI_MODEL_COMPATIBILITY}" is NOT available to this account`);
      }
    } catch (error) {
      // Only the status: OpenAI error texts can quote part of the key.
      const status = (error as { status?: number }).status;
      bad(`OpenAI check failed${status ? ` (HTTP ${status}${status === 401 ? ": the API key was rejected" : ""})` : `: ${(error as Error).name}`}`);
    }
  }

  if (env.RESEND_API_KEY) {
    console.log("\nResend:");
    try {
      const resend = new Resend(env.RESEND_API_KEY);
      const { data, error } = await resend.domains.list();
      if (error) bad(`key rejected: ${error.message}`);
      else {
        const fromDomain = env.EMAIL_FROM.match(/@([^>\s]+)/)?.[1];
        const domain = data?.data.find((d) => d.name === fromDomain);
        if (!domain) bad(`sending domain "${fromDomain}" is not added in Resend`);
        else (domain.status === "verified" ? ok : bad)(`domain ${domain.name}: ${domain.status}`);
      }
    } catch (error) {
      bad(`Resend check failed: ${(error as Error).message}`);
    }
  }

  if (env.STORAGE_PROVIDER === "supabase" && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("\nSupabase storage:");
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await client.storage.getBucket(env.SUPABASE_REPORTS_BUCKET);
    if (error || !data) bad(`bucket "${env.SUPABASE_REPORTS_BUCKET}" not found - run npm run storage:setup`);
    else (data.public ? bad : ok)(`bucket "${data.name}" is ${data.public ? "PUBLIC (make it private!)" : "private"}`);
  }

  console.log("\nPDF rendering:");
  const source = resolveBrowserSource();
  if (source === "local") {
    const browser = findLocalBrowser();
    (browser ? ok : bad)(browser ? `local browser: ${browser}` : "no Chrome/Edge found - install Google Chrome or set CHROME_EXECUTABLE_PATH");
  } else info(`${source} Chromium (verify after deploying with the health check)`);

  for (const product of ["personal", "compatibility"] as const) {
    const availability = getCheckoutAvailability(env, product);
    console.log(`\nCheckout (${product}): ${availability.available ? "AVAILABLE" : "DISABLED"}`);
    if (!availability.available) for (const m of availability.missing) console.log(`  - ${m}`);
  }
  console.log("");
} catch (error) {
  fail((error as Error).message);
} finally {
  await closeDb();
}
