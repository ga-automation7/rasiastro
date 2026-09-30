import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "./types";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

interface MigrationFile {
  version: string;
  sql: string;
  checksum: string;
}

export function readMigrationFiles(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      return {
        version: file.replace(/\.sql$/, ""),
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    });
}

/**
 * Applies pending migrations in order, each inside its own transaction.
 * Applied migrations are immutable: editing one after it ran is an error, because
 * production and local databases would silently diverge. Add a new file instead.
 */
export async function runMigrations(db: Database, dir?: string): Promise<string[]> {
  await db.execScript(`
    create table if not exists schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);
  const applied = new Map(
    (await db.query<{ version: string; checksum: string }>("select version, checksum from schema_migrations")).map(
      (r) => [r.version, r.checksum],
    ),
  );

  const newlyApplied: string[] = [];
  for (const migration of readMigrationFiles(dir)) {
    const existing = applied.get(migration.version);
    if (existing) {
      if (existing !== migration.checksum) {
        throw new Error(
          `Migration ${migration.version} was modified after it was applied. Create a new migration instead.`,
        );
      }
      continue;
    }
    const ran = await db.transaction(async (tx) => {
      // Two deployments building at once must not both apply the same migration. A
      // transaction-level advisory lock works through Supabase's transaction pooler
      // (a session lock would not); whoever waits re-checks and skips what is done.
      await tx.query("select pg_advisory_xact_lock($1::bigint)", [MIGRATION_LOCK_KEY]);
      const done = await tx.query<{ checksum: string }>("select checksum from schema_migrations where version = $1", [migration.version]);
      if (done[0]) {
        if (done[0].checksum !== migration.checksum) {
          throw new Error(`Migration ${migration.version} was modified after it was applied. Create a new migration instead.`);
        }
        return false;
      }
      // Scripts are executed statement-by-statement inside the transaction.
      for (const statement of splitSqlStatements(migration.sql)) {
        await tx.query(statement);
      }
      await tx.query("insert into schema_migrations (version, checksum) values ($1, $2)", [
        migration.version,
        migration.checksum,
      ]);
      return true;
    });
    if (ran) newlyApplied.push(migration.version);
  }
  return newlyApplied;
}

/** Arbitrary constant identifying "Rasi Astro schema migration" advisory locks. */
const MIGRATION_LOCK_KEY = 7_202_609_300;

/** Applied versions and the files not yet applied (read-only). */
export async function getMigrationStatus(db: Database, dir?: string): Promise<{ applied: string[]; pending: string[] }> {
  let applied: string[] = [];
  try {
    applied = (await db.query<{ version: string }>("select version from schema_migrations order by version")).map((r) => r.version);
  } catch {
    applied = [];
  }
  const pending = readMigrationFiles(dir)
    .map((m) => m.version)
    .filter((v) => !applied.includes(v));
  return { applied, pending };
}

export async function getSchemaVersion(db: Database): Promise<string | null> {
  try {
    const rows = await db.query<{ version: string }>(
      "select version from schema_migrations order by version desc limit 1",
    );
    return rows[0]?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Splits a migration into statements. Supports `--` comments, quoted strings and
 * dollar-quoted blocks (`$$ ... $$`) used by DO blocks and functions.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let dollarTag: string | null = null;
  let inSingleQuote = false;

  while (i < sql.length) {
    const ch = sql[i]!;
    const rest = sql.slice(i);

    if (dollarTag) {
      if (rest.startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
      } else {
        current += ch;
        i += 1;
      }
      continue;
    }
    if (inSingleQuote) {
      current += ch;
      i += 1;
      if (ch === "'") {
        if (sql[i] === "'") {
          current += "'";
          i += 1;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      current += "\n";
      continue;
    }
    const dollarMatch = /^\$[a-zA-Z_]*\$/.exec(rest);
    if (dollarMatch) {
      dollarTag = dollarMatch[0];
      current += dollarTag;
      i += dollarTag.length;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}
