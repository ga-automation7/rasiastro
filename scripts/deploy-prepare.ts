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

try {
  await main();
} catch (error) {
  // Hide anything that looks like a connection string, just in case a driver echoes one.
  const message = String((error as Error).message).replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[address hidden]");
  if (!process.env.APP_MODE?.trim()) {
    // Without APP_MODE a hosted site never takes orders (see readiness.ts), so the pages
    // can safely go live while the database is being set up. Once APP_MODE is set, a
    // database problem stops the deployment instead.
    console.warn(`[deploy] WARNING: database preparation did not complete: ${message}`);
    console.warn("[deploy] Continuing because APP_MODE is not set, so ordering stays closed.");
  } else {
    console.error(`[deploy] FAILED: ${message}`);
    process.exit(1);
  }
}
