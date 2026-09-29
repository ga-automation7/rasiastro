/**
 * Checks your configuration and (read-only) tests each configured account:
 * database, Cashfree credentials, OpenAI key + model access, Resend key + domain,
 * Supabase storage bucket, Inngest keys and the PDF browser. Prints no secrets.
 *
 *   npm run config:check
 */
import OpenAI from "openai";
import { Resend } from "resend";
import { fail } from "./lib/cli";
import { getEnv } from "../src/server/config/env";
import { chooseProviders, getCheckoutAvailability, getConfigChecks } from "../src/server/config/readiness";
import { closeDb, getDb } from "../src/server/db";
import { getSchemaVersion } from "../src/server/db/migrate";
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

  console.log("Configuration:");
  for (const c of getConfigChecks(env)) (c.ok ? ok : bad)(`${c.label}${c.ok ? "" : ` - ${c.detail}`}`);

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

  if (env.CASHFREE_CLIENT_ID && env.CASHFREE_CLIENT_SECRET) {
    console.log(`\nCashfree (${env.CASHFREE_ENV}):`);
    const base = env.CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
    const res = await fetch(`${base}/orders/rasi-config-check-does-not-exist`, {
      headers: { "x-api-version": env.CASHFREE_API_VERSION, "x-client-id": env.CASHFREE_CLIENT_ID, "x-client-secret": env.CASHFREE_CLIENT_SECRET },
    });
    if (res.status === 404) ok("credentials accepted (test lookup returned 'order not found', as expected)");
    else if (res.status === 401 || res.status === 403) bad("credentials rejected - check CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET and CASHFREE_ENV");
    else info(`unexpected response ${res.status}`);
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
    } catch (error) {
      bad(`OpenAI check failed: ${(error as Error).message}`);
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

  const availability = getCheckoutAvailability(env);
  console.log(`\nCheckout: ${availability.available ? "AVAILABLE" : "DISABLED"}`);
  if (!availability.available) for (const m of availability.missing) console.log(`  - ${m}`);
  console.log("");
} catch (error) {
  fail((error as Error).message);
} finally {
  await closeDb();
}
