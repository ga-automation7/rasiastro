import postgres from "postgres";
import type { Database, SqlExecutor, SqlParam } from "./types";

/**
 * Production database adapter (Supabase Postgres).
 *
 * `prepare: false` is required when connecting through Supabase's transaction-mode
 * pooler (port 6543), which is the recommended connection for serverless functions.
 * Each serverless instance keeps a very small pool; the pooler multiplexes them.
 */
export function createPostgresDatabase(connectionString: string): Database {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    // Keep int8 counts etc. as strings (lossless); repositories cast to ::int where needed.
    onnotice: () => undefined,
  });

  const toArgs = (params?: readonly SqlParam[]) => (params ?? []) as postgres.ParameterOrJSON<never>[];

  const executor = (runner: postgres.Sql | postgres.TransactionSql): SqlExecutor => ({
    async query<T extends object>(text: string, params?: readonly SqlParam[]): Promise<T[]> {
      const rows = await runner.unsafe(text, toArgs(params));
      return Array.from(rows) as unknown as T[];
    },
  });

  return {
    kind: "postgres",
    ...executor(sql),
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const result = await sql.begin(async (tx) => fn(executor(tx)));
      return result as T;
    },
    async execScript(script: string): Promise<void> {
      await sql.unsafe(script);
    },
    async close(): Promise<void> {
      await sql.end({ timeout: 5 });
    },
  };
}
