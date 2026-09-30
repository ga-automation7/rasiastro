/**
 * Re-runs report generation for a PAID order that failed or got stuck. Completed
 * steps are reused (no repeated AI cost) unless --regenerate-text is given.
 * The customer is never charged again.
 *
 *   npm run ops:retry-report -- RA-XXXXXXXX
 *   npm run ops:retry-report -- RA-XXXXXXXX --rerender-pdf            (rebuild only the PDF file)
 *   npm run ops:retry-report -- RA-XXXXXXXX --regenerate-text --yes   (discard stored AI text and write it again)
 */
import { fail, findOrderId, flag, positional, withDb } from "./lib/cli";
import { retryReportGeneration } from "../src/server/jobs/retry";

try {
  await withDb(async (db) => {
    const ref = positional()[0] ?? fail("Give an order reference, e.g. npm run ops:retry-report -- RA-7K3M9Q2X");
    const order = await findOrderId(db, ref);
    const [state] = await db.query<{ payment_status: string; generation_status: string }>("select payment_status, generation_status from orders where id = $1::uuid", [order.id]);
    if (state!.payment_status !== "paid") fail(`${order.reference} is not paid (payment_status=${state!.payment_status}). Nothing to generate.`);

    if (flag("regenerate-text")) {
      if (!flag("yes")) fail("--regenerate-text discards the stored report and calls the AI again. Add --yes to confirm.");
      const files = await db.query<{ key: string | null }>("select pdf_storage_key as key from reports where order_id = $1::uuid", [order.id]);
      const { getStorage } = await import("../src/server/storage");
      const keys = files.map((f) => f.key).filter((k): k is string => Boolean(k));
      if (keys.length) await getStorage().remove(keys);
      await db.query("delete from reports where order_id = $1::uuid", [order.id]);
      await db.query("delete from report_parts where order_id = $1::uuid", [order.id]);
      console.log("Discarded stored report text and PDF.");
    }
    if (flag("rerender-pdf")) {
      // The stored report text is reused; only the PDF file is rebuilt.
      await db.query("update reports set pdf_storage_key = null where order_id = $1::uuid", [order.id]);
      console.log("The PDF will be rebuilt from the stored report.");
    }
    if (flag("regenerate-text") || flag("rerender-pdf")) {
      await db.query(`update orders set generation_status = 'queued', delivery_status = case when $2::boolean then 'not_sent' else delivery_status end where id = $1::uuid`, [order.id, flag("regenerate-text")]);
    }
    // The same controlled retry as the admin dashboard button (also resumes a stuck job).
    const result = await retryReportGeneration(db, order.id, "owner-retry", { allowInProgress: true });
    if (!result.ok) fail(`${order.reference}: not re-queued (${result.reason}).`);
    const [after] = await db.query<{ generation_status: string }>("select generation_status from orders where id = $1::uuid", [order.id]);
    console.log(`${order.reference}: report generation re-queued (current status: ${after!.generation_status}).`);
    console.log("With Inngest, follow progress in the Inngest dashboard or with npm run ops:status.");
  });
} catch (error) {
  fail((error as Error).message);
}
