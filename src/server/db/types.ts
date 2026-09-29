/**
 * A deliberately small database interface so the same repositories run against
 * Supabase Postgres (production, via postgres.js) and PGlite (local demo + tests).
 *
 * Conventions that keep both drivers behaving identically:
 * - Parameters are only strings, numbers, booleans or null. Cast in SQL
 *   (`$1::uuid`, `$2::jsonb`, `$3::timestamptz`) instead of relying on driver inference.
 * - Select `date`/`time` columns as `::text`, and counts as `::int`.
 * - `timestamptz` columns come back as JS Date objects; `jsonb` as parsed objects.
 */
export type SqlParam = string | number | boolean | null;

export interface SqlExecutor {
  query<T extends object = Record<string, unknown>>(text: string, params?: readonly SqlParam[]): Promise<T[]>;
}

export interface Database extends SqlExecutor {
  readonly kind: "postgres" | "pglite";
  /** Runs fn inside a single transaction. Rolls back if fn throws. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  /** Executes a multi-statement SQL script (migrations only). */
  execScript(sql: string): Promise<void>;
  close(): Promise<void>;
}

export function jsonParam(value: unknown): string {
  return JSON.stringify(value);
}
