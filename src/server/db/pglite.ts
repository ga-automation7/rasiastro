import fs from "node:fs";
import path from "node:path";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Database, SqlExecutor, SqlParam } from "./types";

/**
 * Local database adapter: PGlite is real PostgreSQL compiled to WebAssembly, so the
 * same SQL migrations, constraints and transactions behave as they do on Supabase.
 * Used for the demo mode (persisted in .data/) and for tests (in memory).
 *
 * PGlite is single-process. A lock file stops two processes (e.g. the dev server and
 * an export script) from opening the same data directory and corrupting it.
 */
export async function createPgliteDatabase(dataDir: string | null): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  let releaseLock: (() => void) | undefined;
  let db: PGlite;
  if (dataDir) {
    const absolute = path.resolve(dataDir);
    fs.mkdirSync(absolute, { recursive: true });
    releaseLock = acquireLock(absolute);
    db = new PGlite(absolute);
  } else {
    db = new PGlite();
  }
  await db.waitReady;

  const executor = (runner: PGlite | Transaction): SqlExecutor => ({
    async query<T extends object>(text: string, params?: readonly SqlParam[]): Promise<T[]> {
      const result = await runner.query<T>(text, params ? [...params] : []);
      return result.rows;
    },
  });

  return {
    kind: "pglite",
    ...executor(db),
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => fn(executor(tx)));
    },
    async execScript(script: string): Promise<void> {
      await db.exec(script);
    },
    async close(): Promise<void> {
      await db.close();
      releaseLock?.();
    },
  };
}

function acquireLock(dir: string): () => void {
  const lockFile = path.join(dir, "..", `${path.basename(dir)}.lock`);
  if (fs.existsSync(lockFile)) {
    const pid = Number(fs.readFileSync(lockFile, "utf8").trim());
    if (Number.isInteger(pid) && pid !== process.pid && isProcessAlive(pid)) {
      throw new Error(
        `The local demo database is in use by another process (pid ${pid}). ` +
          "Stop the dev server (Ctrl+C) before running this command, or set DATABASE_URL to a Postgres database.",
      );
    }
  }
  fs.writeFileSync(lockFile, String(process.pid));
  const release = () => {
    try {
      if (fs.existsSync(lockFile) && fs.readFileSync(lockFile, "utf8").trim() === String(process.pid)) {
        fs.unlinkSync(lockFile);
      }
    } catch {
      // Best effort: a stale lock is detected via the PID check next time.
    }
  };
  process.once("exit", release);
  return release;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
