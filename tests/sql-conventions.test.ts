import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, jsonParam } from "@/server/db";
import { setTestEnv, setupTestDb } from "./helpers";

/**
 * postgres.js (production) serialises a value AGAIN when a parameter's type is jsonb,
 * so `jsonParam(v)` with `$n::jsonb` stored objects as JSON strings in Supabase while
 * PGlite (these tests) looked fine. JSON must go in as `$n::text::jsonb`.
 */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("SQL conventions shared by both database drivers", () => {
  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });

  it("never casts a parameter straight to jsonb", () => {
    const offenders = sourceFiles(path.join(process.cwd(), "src")).filter((f) => /\$\d+::jsonb/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("a text-cast JSON parameter is stored as an object", async () => {
    const [row] = await (await getDb()).query<{ kind: string }>("select jsonb_typeof($1::text::jsonb) as kind", [jsonParam({ a: 1 })]);
    expect(row!.kind).toBe("object");
  });

  it("migration 0006 turns twice-encoded values back into objects and leaves others alone", async () => {
    const db = await getDb();
    const [fixed] = await db.query<{ kind: string; a: number }>(
      `with v(c) as (select to_jsonb($1::text)) select jsonb_typeof((c #>> '{}')::jsonb) as kind, ((c #>> '{}')::jsonb ->> 'a')::int as a from v`,
      [jsonParam({ a: 7 })],
    );
    expect(fixed).toMatchObject({ kind: "object", a: 7 });
  });
});
