/**
 * Asks the payment provider for the real status of an order's payments (use when a
 * customer says they paid but the order still shows unpaid).
 *   npm run ops:reconcile -- RA-XXXXXXXX
 *   npm run ops:reconcile -- --all        (recent open payments, like the scheduled sweeper)
 */
import { fail, findOrderId, flag, positional, withDb } from "./lib/cli";
import { reconcileOrderPayments, reconcileRecentPayments } from "../src/server/payments/service";

try {
  await withDb(async (db) => {
    if (flag("all")) {
      const checked = await reconcileRecentPayments(200);
      console.log(`Checked ${checked} open payment attempt(s) with the provider.`);
      return;
    }
    const ref = positional()[0] ?? fail("Give an order reference, e.g. npm run ops:reconcile -- RA-7K3M9Q2X");
    const order = await findOrderId(db, ref);
    const updated = await reconcileOrderPayments(order.id);
    console.log(`${order.reference}: payment=${updated?.paymentStatus} report=${updated?.generationStatus}`);
  });
} catch (error) {
  fail((error as Error).message);
}
