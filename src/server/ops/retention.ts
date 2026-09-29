import { getDb, type Database } from "../db";
import { log } from "../log";
import { getStorage } from "../storage";

/**
 * Data retention and deletion.
 *
 * - Unpaid, abandoned orders are deleted completely once `delete_after` passes
 *   (RETENTION_UNPAID_DAYS). No money moved, so there is no financial record to keep.
 * - Paid orders have their personal data erased after RETENTION_REPORT_DAYS: birth
 *   details, notes, questions, chart, report text, PDF, access links, email/phone.
 *   The order reference, package, amounts, dates and payment references remain as
 *   the business/tax record. Confirm the retention period with your accountant.
 * - Orders flagged "needs_review" are never auto-deleted.
 */
export interface RetentionResult {
  unpaidDeleted: number;
  paidAnonymised: number;
  filesDeleted: number;
}

export async function erasePersonalData(db: Database, orderId: string): Promise<number> {
  const files = await db.query<{ key: string }>(`select pdf_storage_key as key from reports where order_id = $1::uuid and pdf_storage_key is not null`, [orderId]);
  if (files.length) await getStorage().remove(files.map((f) => f.key));
  await db.transaction(async (tx) => {
    for (const table of ["birth_details", "order_context", "order_questions", "charts", "report_parts", "reports", "access_tokens", "deliveries", "outbox"]) {
      await tx.query(`delete from ${table} where order_id = $1::uuid`, [orderId]);
    }
    await tx.query(`update payment_events set payload = '{}'::jsonb where provider_order_id in (select provider_order_id from payments where order_id = $1::uuid)`, [orderId]);
    await tx.query(
      `update orders set report_email = 'erased', payer_phone = null, personal_data_deleted_at = now(), updated_at = now() where id = $1::uuid`,
      [orderId],
    );
  });
  return files.length;
}

export async function runRetention(options: { dryRun: boolean }): Promise<RetentionResult> {
  const db = await getDb();
  const unpaid = await db.query<{ id: string }>(
    `select id from orders where delete_after < now() and payment_status in ('awaiting_payment', 'failed', 'cancelled', 'expired') limit 500`,
  );
  const paid = await db.query<{ id: string }>(
    `select id from orders where delete_after < now() and payment_status = 'paid' and personal_data_deleted_at is null limit 200`,
  );
  const result: RetentionResult = { unpaidDeleted: unpaid.length, paidAnonymised: paid.length, filesDeleted: 0 };
  if (options.dryRun) return result;
  for (const { id } of unpaid) {
    // A pending payment could still complete: double-check the status inside the delete.
    await db.query(`delete from orders where id = $1::uuid and payment_status in ('awaiting_payment', 'failed', 'cancelled', 'expired')`, [id]);
  }
  for (const { id } of paid) result.filesDeleted += await erasePersonalData(db, id);
  if (unpaid.length || paid.length) log.info("retention run", { count: unpaid.length + paid.length });
  return result;
}
