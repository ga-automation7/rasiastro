import { getEnv, isProductionDeployment, isServerlessRuntime } from "../config/env";
import { runMigrations } from "./migrate";
import type { Database } from "./types";

export type { Database, SqlExecutor, SqlParam } from "./types";
export { jsonParam } from "./types";

// Next.js can evaluate this module more than once per process (server components
// and route handlers are bundled separately, and dev mode hot-reloads). Keeping the
// connection on globalThis guarantees one database handle per process - essential
// for PGlite, which must never be opened twice.
const globalKey = Symbol.for("rasi-astro.database");
type GlobalWithDb = typeof globalThis & { [globalKey]?: Promise<Database> };

export function getDb(): Promise<Database> {
  const g = globalThis as GlobalWithDb;
  if (!g[globalKey]) {
    g[globalKey] = openDatabase().catch((error: unknown) => {
      delete g[globalKey];
      throw error;
    });
  }
  return g[globalKey];
}

async function openDatabase(): Promise<Database> {
  const env = getEnv();
  if (env.DATABASE_URL) {
    const { createPostgresDatabase } = await import("./postgres");
    // Production schemas are migrated explicitly with `npm run db:migrate`, never
    // implicitly at request time.
    return createPostgresDatabase(env.DATABASE_URL);
  }
  if (env.APP_MODE !== "demo" || isProductionDeployment(env)) {
    throw new Error("DATABASE_URL is required in sandbox and live modes.");
  }
  if (isServerlessRuntime()) {
    // Serverless hosts have no persistent disk; a local database there would silently
    // lose orders between requests. The site shows its "preview" state instead.
    throw new Error("DATABASE_URL is required on a hosted deployment (the local demo database only runs on your computer).");
  }
  const { createPgliteDatabase } = await import("./pglite");
  const db = await createPgliteDatabase(env.NODE_ENV === "test" ? null : env.LOCAL_DB_DIR);
  await runMigrations(db);
  return db;
}

/** For scripts and tests that manage their own lifecycle. */
export async function closeDb(): Promise<void> {
  const g = globalThis as GlobalWithDb;
  const pending = g[globalKey];
  delete g[globalKey];
  if (pending) await (await pending).close();
}

/** Tests inject an isolated in-memory database. */
export function setDbForTests(db: Database): void {
  (globalThis as GlobalWithDb)[globalKey] = Promise.resolve(db);
}
