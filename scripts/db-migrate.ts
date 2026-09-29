/**
 * Applies database migrations (db/migrations/*.sql) in order.
 *   npm run db:migrate
 * Uses DATABASE_URL (Supabase) when set, otherwise the local demo database in .data/.
 */
import { fail, withDb } from "./lib/cli";
import { getSchemaVersion, runMigrations } from "../src/server/db/migrate";

try {
  await withDb(async (db) => {
    console.log(`Database: ${db.kind === "postgres" ? "PostgreSQL (DATABASE_URL)" : "local demo database (.data/pglite)"}`);
    const applied = await runMigrations(db);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "No pending migrations.");
    console.log(`Schema version: ${await getSchemaVersion(db)}`);
  });
} catch (error) {
  fail((error as Error).message);
}
