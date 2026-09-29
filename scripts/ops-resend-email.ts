/**
 * Sends the "your report is ready" email again, with a fresh secure link.
 *   npm run ops:resend-email -- RA-XXXXXXXX
 */
import { fail, findOrderId, positional, withDb } from "./lib/cli";
import { deliverReport } from "../src/server/delivery/service";

try {
  await withDb(async (db) => {
    const ref = positional()[0] ?? fail("Give an order reference, e.g. npm run ops:resend-email -- RA-7K3M9Q2X");
    const order = await findOrderId(db, ref);
    const result = await deliverReport(order.id, { resend: true });
    console.log(`${order.reference}: ${result === "sent" ? "email sent" : "already sent"}.`);
  });
} catch (error) {
  fail((error as Error).message);
}
