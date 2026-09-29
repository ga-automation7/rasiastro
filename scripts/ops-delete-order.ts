/**
 * Handles a customer's deletion request.
 * - Unpaid order: deleted completely.
 * - Paid order: personal data, report and PDF erased; the order reference, amounts,
 *   dates and payment references are kept as the financial record.
 *
 *   npm run ops:delete-order -- RA-XXXXXXXX            (shows what would happen)
 *   npm run ops:delete-order -- RA-XXXXXXXX --yes      (does it)
 */
import { fail, findOrderId, flag, positional, withDb } from "./lib/cli";
import { erasePersonalData } from "../src/server/ops/retention";

try {
  await withDb(async (db) => {
    const ref = positional()[0] ?? fail("Give an order reference, e.g. npm run ops:delete-order -- RA-7K3M9Q2X");
    const order = await findOrderId(db, ref);
    const [state] = await db.query<{ payment_status: string }>("select payment_status from orders where id = $1::uuid", [order.id]);
    const paid = state!.payment_status === "paid" || state!.payment_status === "needs_review" || state!.payment_status === "pending";
    const plan = paid ? "erase personal data, report and PDF (keep financial record)" : "delete the whole order";
    if (!flag("yes")) {
      console.log(`${order.reference} (${state!.payment_status}): would ${plan}. Re-run with --yes to proceed.`);
      return;
    }
    if (paid) {
      const files = await erasePersonalData(db, order.id);
      console.log(`${order.reference}: personal data erased (${files} file(s) removed). Financial record kept.`);
    } else {
      await db.query("delete from orders where id = $1::uuid", [order.id]);
      console.log(`${order.reference}: order deleted.`);
    }
  });
} catch (error) {
  fail((error as Error).message);
}
