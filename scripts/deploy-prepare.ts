/**
 * Runs on Vercel before `next build` (package.json "vercel-build"), so the owner never
 * has to run database commands by hand.
 *
 * Production deployments only (VERCEL_ENV=production, DATABASE_URL set):
 *  1. Applies pending database migrations. Applied migrations are checksummed and
 *     never re-run; each one runs in its own transaction; nothing is ever dropped
 *     or reset. If a migration fails the build stops, so the live site never runs
 *     new code against an old schema (the previous deployment stays live).
 *  2. Imports the GeoNames birthplace data once, when the database has none yet.
 *  3. Checks the reports bucket is private (the build stops if it is public).
 *
 * Preview and local builds never touch any database. Nothing secret is printed.
 */
import "./lib/cli";

const MIN_GEONAMES_PLACES = 100_000;

async function main(): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") {
    console.log(`[deploy] ${process.env.VERCEL_ENV ?? "local"} build: database and storage left untouched.`);
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.log("[deploy] DATABASE_URL is not set for Production: skipping database preparation (ordering stays closed).");
    return;
  }
  const { getEnv } = await import("../src/server/config/env");
  const { closeDb, getDb } = await import("../src/server/db");
  const { getMigrationStatus, runMigrations } = await import("../src/server/db/migrate");
  const env = getEnv();
  try {
    const db = await getDb();
    const before = await getMigrationStatus(db);
    console.log(`[deploy] migrations already applied: ${before.applied.join(", ") || "none"}`);
    const applied = await runMigrations(db);
    console.log(`[deploy] migrations applied now: ${applied.join(", ") || "none (up to date)"}`);

    const { countPlaces } = await import("../src/server/places/repository");
    const places = await countPlaces(db, "geonames");
    if (places >= MIN_GEONAMES_PLACES) {
      console.log(`[deploy] birthplaces: ${places.toLocaleString()} GeoNames places present.`);
    } else {
      console.log(`[deploy] birthplaces: ${places.toLocaleString()} present; importing GeoNames cities1000 (CC BY 4.0)...`);
      const { importGeonames } = await import("../src/server/places/import");
      const imported = await importGeonames(db, { dataset: "cities1000", log: (m) => console.log(`[deploy]   ${m}`) });
      console.log(`[deploy] birthplaces: imported ${imported.toLocaleString()} places.`);
    }

    if (env.STORAGE_PROVIDER === "supabase" && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data, error } = await client.storage.getBucket(env.SUPABASE_REPORTS_BUCKET);
      if (error || !data) {
        console.log(`[deploy] storage: bucket "${env.SUPABASE_REPORTS_BUCKET}" not found - create it (private) in Supabase Storage.`);
      } else if (data.public) {
        throw new Error(`Storage bucket "${data.name}" is PUBLIC. Reports would be readable by anyone. Make it private in Supabase, then redeploy.`);
      } else {
        console.log(`[deploy] storage: bucket "${data.name}" exists and is private.`);
      }
    }
  } finally {
    await closeDb();
  }
}

/**
 * Production configuration report for the build log: every readiness check (names and
 * explanations only, never values), the OpenAI model, and the Resend sending domain.
 * With APP_MODE=live an unusable AI model stops the deployment: the shop must not take
 * money for reports it cannot write.
 */
async function reportConfiguration(): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") return;
  const { getEnv } = await import("../src/server/config/env");
  const { getConfigChecks, getProductChecks, getSiteState } = await import("../src/server/config/readiness");
  const env = getEnv();
  console.log(`[deploy] configuration (APP_MODE=${process.env.APP_MODE?.trim() || "not set"}, site state: ${getSiteState(env).kind}):`);
  for (const c of [...getConfigChecks(env), ...getProductChecks("personal", env), ...getProductChecks("compatibility", env)]) {
    console.log(`[deploy]   ${c.ok ? "ok     " : "MISSING"} ${c.label}${c.ok ? "" : ` - ${c.detail}`}`);
  }
  let modelOk: boolean | null = null;
  if (env.OPENAI_API_KEY && env.OPENAI_MODEL) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 20_000 });
      await client.models.retrieve(env.OPENAI_MODEL);
      modelOk = true;
      console.log(`[deploy]   ok      OpenAI model "${env.OPENAI_MODEL}" is available to this API key`);
      if (env.OPENAI_REASONING_EFFORT) {
        // A tiny request (a few tokens) proves the model accepts this setting; otherwise
        // every report would fail with "bad request".
        try {
          await client.responses.create({ model: env.OPENAI_MODEL, input: "Reply with OK.", max_output_tokens: 64, store: false, reasoning: { effort: env.OPENAI_REASONING_EFFORT } });
          console.log(`[deploy]   ok      OpenAI model accepts OPENAI_REASONING_EFFORT=${env.OPENAI_REASONING_EFFORT}`);
        } catch (effortError) {
          const effortStatus = (effortError as { status?: number }).status;
          if (effortStatus === 400) {
            modelOk = false;
            console.log(`[deploy]   MISSING OpenAI model "${env.OPENAI_MODEL}" does not accept OPENAI_REASONING_EFFORT=${env.OPENAI_REASONING_EFFORT} (HTTP 400). Remove that setting or choose another value.`);
          } else {
            console.log(`[deploy]   UNKNOWN could not test OPENAI_REASONING_EFFORT (${effortStatus ? `HTTP ${effortStatus}` : (effortError as Error).name}).`);
          }
        }
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      modelOk = status === 404 || status === 400 ? false : null;
      console.log(
        status === 404
          ? `[deploy]   MISSING OpenAI model "${env.OPENAI_MODEL}" does not exist or this key cannot use it (HTTP 404). Choose a model listed in your OpenAI project.`
          : status === 401
            ? "[deploy]   MISSING OpenAI rejected the API key (HTTP 401)."
            : `[deploy]   UNKNOWN could not check the OpenAI model (${status ? `HTTP ${status}` : (error as Error).name}).`,
      );
    }
  }
  if (env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const { data, error } = await new Resend(env.RESEND_API_KEY).domains.list();
      const fromDomain = env.EMAIL_FROM.match(/@([^>\s]+)/)?.[1];
      const domain = data?.data.find((d) => d.name === fromDomain);
      if (error?.name === "restricted_api_key") {
        // A sending-only key (the recommended kind) may send but not list domains.
        console.log("[deploy]   ok      Resend key accepted (sending-only key, so the domain status is not listed; check Resend > Domains shows Verified)");
      } else {
        console.log(
          error
            ? `[deploy]   MISSING Resend rejected the API key (${error.name}).`
            : domain
              ? `[deploy]   ${domain.status === "verified" ? "ok     " : "MISSING"} Resend domain ${domain.name}: ${domain.status}`
              : `[deploy]   MISSING Resend has no domain "${fromDomain}"`,
        );
      }
    } catch (error) {
      console.log(`[deploy]   UNKNOWN could not check Resend (${(error as Error).name}).`);
    }
  }
  const { uroRelayCredentials } = await import("../src/server/payments/config");
  const relay = uroRelayCredentials(env);
  if (relay && (env.PAYMENT_ENV === "test" || env.PAYMENT_ENV === "production")) {
    const { UroRelayProvider } = await import("../src/server/payments/urorelay");
    const provider = new UroRelayProvider({ environment: env.PAYMENT_ENV, ...relay, lookup: async () => null });
    const { result, detail } = await provider.checkCredentials();
    console.log(
      result === "accepted"
        ? `[deploy]   ok      UroRelay accepted the API key and secret (${detail})`
        : result === "rejected"
          ? `[deploy]   MISSING UroRelay rejected the API key or secret (${detail}); check UROPAY_RELAY_API_KEY / UROPAY_RELAY_API_SECRET`
          : `[deploy]   UNKNOWN could not confirm the UroRelay key and secret (${detail})`,
    );
  }
  if (env.APP_MODE === "live" && modelOk === false) {
    throw new Error(`OPENAI_MODEL "${env.OPENAI_MODEL}" (or its OPENAI_REASONING_EFFORT) is not usable, so paid reports could not be written. Fix it before going live.`);
  }
}

/**
 * Explains a DATABASE_URL problem without revealing it: only the host type, port,
 * username shape and yes/no facts about the password are printed, never the password.
 */
function describeDatabaseUrl(raw: string | undefined): string[] {
  if (!raw) return ["DATABASE_URL is empty."];
  const notes: string[] = [];
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return ["DATABASE_URL is not a valid connection address (it should start with postgresql://)."];
  }
  if (raw !== raw.trim()) notes.push("It has spaces or line breaks at the start or end.");
  if (!/^postgres(ql)?:$/.test(url.protocol)) notes.push(`It starts with "${url.protocol}" instead of "postgresql:".`);
  const host = url.hostname;
  const port = url.port || "5432";
  const pooler = host.endsWith(".pooler.supabase.com");
  const direct = /^db\.[a-z0-9]+\.supabase\.co$/.test(host);
  notes.push(`Host type: ${pooler ? "Supabase pooler" : direct ? "Supabase direct connection" : "not a Supabase host"}, port ${port}.`);
  if (pooler && port !== "6543") notes.push("Use the Transaction pooler (port 6543), not the Session pooler.");
  if (direct) notes.push("This is the direct connection; use the Transaction pooler string instead.");
  const user = decodeURIComponent(url.username);
  const userRef = /^postgres\.([a-z0-9]{20})$/.exec(user)?.[1] ?? null;
  if (pooler && !userRef) notes.push(`Username should be "postgres.<your project id>" for the pooler; it is "${user.replace(/\..*/, ".…")}".`);
  const urlRef = (() => {
    try {
      return new URL(process.env.SUPABASE_URL ?? "").hostname.split(".")[0] ?? null;
    } catch {
      return null;
    }
  })();
  if (userRef && urlRef) notes.push(userRef === urlRef ? "Project id matches SUPABASE_URL." : "Project id does NOT match SUPABASE_URL: the string is from a different Supabase project.");
  const password = (() => {
    try {
      return decodeURIComponent(url.password);
    } catch {
      return url.password;
    }
  })();
  if (!password) notes.push("There is no password in the address.");
  else {
    if (/YOUR-PASSWORD/i.test(password)) notes.push("The password is still the [YOUR-PASSWORD] placeholder.");
    if (/[[\]]/.test(password)) notes.push("The password contains square brackets: remove the [ ] around it.");
    if ((raw.match(/@/g) ?? []).length > 1 || /[#/?\s]/.test(url.password)) notes.push("The password contains characters (@ # / ? or spaces) that break the address: reset it to letters and numbers only.");
  }
  return notes;
}

// Hide anything that looks like a connection string, just in case a driver echoes one.
const safe = (error: unknown) => String((error as Error).message).replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[address hidden]");
let failed = false;
try {
  await main();
} catch (error) {
  if (!process.env.APP_MODE?.trim()) {
    // Without APP_MODE a hosted site never takes orders (see readiness.ts), so the pages
    // can safely go live while the database is being set up. Once APP_MODE is set, a
    // database problem stops the deployment instead.
    console.warn(`[deploy] WARNING: database preparation did not complete: ${safe(error)}`);
    for (const note of describeDatabaseUrl(process.env.DATABASE_URL)) console.warn(`[deploy]   DATABASE_URL check: ${note}`);
    console.warn("[deploy] Continuing because APP_MODE is not set, so ordering stays closed.");
  } else {
    console.error(`[deploy] FAILED: ${safe(error)}`);
    for (const note of describeDatabaseUrl(process.env.DATABASE_URL)) console.error(`[deploy]   DATABASE_URL check: ${note}`);
    failed = true;
  }
}
try {
  await reportConfiguration();
} catch (error) {
  console.error(`[deploy] FAILED: ${safe(error)}`);
  failed = true;
}
if (failed) process.exit(1);
