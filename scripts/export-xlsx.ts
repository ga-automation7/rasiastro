/**
 * Owner-only Excel export. Reads the database with the credentials in .env.local and
 * writes an .xlsx file to exports/ (never committed to git).
 *
 *   npm run export:xlsx
 *   npm run export:xlsx -- --from 2026-10-01 --to 2026-10-31
 *   npm run export:xlsx -- --out D:\backups\october.xlsx
 */
import fs from "node:fs";
import path from "node:path";
import { fail, option, withDb } from "./lib/cli";
import { buildOwnerWorkbook } from "../src/server/exports/xlsx";

const from = option("from");
const to = option("to");
for (const value of [from, to]) {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`Dates must look like 2026-10-31 (got "${value}")`);
}

try {
  await withDb(async (db) => {
    const { buffer, counts } = await buildOwnerWorkbook(db, { from, to });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const out = option("out") ?? path.join("exports", `rasi-astro-export-${stamp}.xlsx`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buffer);
    console.log(`\n✓ Wrote ${path.resolve(out)}`);
    console.log(`  Orders: ${counts.orders} · Birth details: ${counts.birthDetails} · Questions: ${counts.questions} · Payments: ${counts.payments}`);
    console.log("  This file contains personal data. Keep it private and delete it when you no longer need it.\n");
  });
} catch (error) {
  fail((error as Error).message);
}
