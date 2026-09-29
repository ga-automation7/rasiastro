/**
 * Applies the retention rules now (the daily Inngest job does this automatically).
 *   npm run ops:purge            (dry run: shows what would be removed)
 *   npm run ops:purge -- --yes   (removes it)
 */
import { fail, flag, withDb } from "./lib/cli";
import { runRetention } from "../src/server/ops/retention";

try {
  await withDb(async () => {
    const dryRun = !flag("yes");
    const result = await runRetention({ dryRun });
    console.log(`${dryRun ? "Would delete" : "Deleted"} ${result.unpaidDeleted} expired unpaid order(s); ${dryRun ? "would erase" : "erased"} personal data of ${result.paidAnonymised} paid order(s).`);
    if (!dryRun) console.log(`Report files removed: ${result.filesDeleted}`);
    if (dryRun) console.log("Dry run only. Add --yes to apply.");
  });
} catch (error) {
  fail((error as Error).message);
}
