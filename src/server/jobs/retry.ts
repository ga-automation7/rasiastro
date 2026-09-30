import type { Database } from "../db";
import { log } from "../log";
import { dispatchForOrder } from "./dispatch";
import { requeueGeneration } from "./job-state";

export type RetryResult = { ok: true } | { ok: false; reason: "not_found" | "not_paid" | "already_ready" | "in_progress" };

/**
 * Owner-controlled retry of report generation for a PAID order whose report failed
 * (or stalled). Completed steps are reused, so stored AI text is not paid for twice,
 * and the customer is never charged again: payment status is not touched.
 */
export async function retryReportGeneration(db: Database, orderId: string, reason: string, options: { allowInProgress?: boolean } = {}): Promise<RetryResult> {
  const [state] = await db.query<{ payment_status: string; generation_status: string }>(
    `select payment_status, generation_status from orders where id = $1::uuid`,
    [orderId],
  );
  if (!state) return { ok: false, reason: "not_found" };
  if (state.payment_status !== "paid") return { ok: false, reason: "not_paid" };
  if (state.generation_status === "ready") return { ok: false, reason: "already_ready" };
  if (state.generation_status !== "failed" && !options.allowInProgress) return { ok: false, reason: "in_progress" };

  await db.query(
    `update orders set generation_status = 'queued', generation_failure_code = null, updated_at = now() where id = $1::uuid and generation_status <> 'ready'`,
    [orderId],
  );
  await db.query(`insert into report_jobs (order_id) values ($1::uuid) on conflict (order_id) do nothing`, [orderId]);
  await db.query(`update report_jobs set attempts = 0, last_error_code = null, last_error_message = null where order_id = $1::uuid`, [orderId]);
  await requeueGeneration(db, orderId, reason);
  await dispatchForOrder(orderId);
  log.info("report generation re-queued", { orderId, reason });
  return { ok: true };
}
