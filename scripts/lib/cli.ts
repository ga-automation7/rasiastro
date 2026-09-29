/**
 * Shared helpers for owner scripts: load .env.local, parse simple arguments, open
 * and always close the database, and look up orders by reference.
 */
import fs from "node:fs";
import type { Database, SqlExecutor } from "../../src/server/db";

export function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }
}

loadEnvFiles();

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function option(name: string): string | null {
  const args = process.argv.slice(2);
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith("--") ? args[i + 1]! : null;
}

export function positional(): string[] {
  const args = process.argv.slice(2);
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      if (!a.includes("=") && args[i + 1] && !args[i + 1]!.startsWith("--") && ["from", "to", "out", "dataset", "dir", "file"].includes(a.slice(2))) i += 1;
      continue;
    }
    out.push(a);
  }
  return out;
}

export async function withDb<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  const { closeDb, getDb } = await import("../../src/server/db");
  try {
    return await fn(await getDb());
  } finally {
    await closeDb();
  }
}

export async function findOrderId(db: SqlExecutor, referenceOrId: string): Promise<{ id: string; reference: string }> {
  const rows = await db.query<{ id: string; reference: string }>(
    `select id, reference from orders where reference = $1 or id::text = $2 limit 1`,
    [referenceOrId.trim().toUpperCase(), referenceOrId.trim().toLowerCase()],
  );
  if (!rows[0]) throw new Error(`No order found for "${referenceOrId}". Use the RA-XXXXXXXX reference.`);
  return rows[0];
}

export function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
