import type { Database, SqlExecutor } from "../db";
import { scrubText } from "../log";
import { enqueueOutbox } from "./outbox";

/** Takes an exclusive, expiring lease on an order's report job. Counts an attempt. */
export async function acquireJobLease(db: SqlExecutor, orderId: string, owner: string, seconds: number): Promise<number | null> {
  const rows = await db.query<{ attempts: number }>(
    `update report_jobs
        set lease_owner = $2, lease_expires_at = now() + ($3::int * interval '1 second'), status = 'running',
            attempts = attempts + 1, started_at = coalesce(started_at, now()), updated_at = now()
      where order_id = $1::uuid and status in ('queued', 'running')
        and (lease_expires_at is null or lease_expires_at < now() or lease_owner = $2)
      returning attempts`,
    [orderId, owner, seconds],
  );
  return rows[0]?.attempts ?? null;
}

/** Releases the lease after a retriable failure; the job becomes eligible again after `retryAfterSeconds`. */
export async function releaseForRetry(db: SqlExecutor, orderId: string, owner: string, error: unknown, retryAfterSeconds: number): Promise<void> {
  await db.query(
    `update report_jobs set status = 'queued', lease_owner = null, lease_expires_at = now() + ($3::int * interval '1 second'),
            last_error_code = $4, last_error_message = $5, updated_at = now()
      where order_id = $1::uuid and lease_owner = $2`,
    [orderId, owner, retryAfterSeconds, (error as Error)?.name ?? "error", scrubText(String((error as Error)?.message ?? error))],
  );
}

export async function markJobRunning(db: SqlExecutor, orderId: string): Promise<void> {
  await db.query(
    `update report_jobs set status = 'running', attempts = attempts + 1, started_at = coalesce(started_at, now()), updated_at = now()
      where order_id = $1::uuid and status in ('queued', 'running')`,
    [orderId],
  );
}

/** Jobs that have made no progress for a while (runner crashed, dispatch lost). */
export async function findStalledJobs(db: SqlExecutor, olderThanMinutes: number, limit = 20): Promise<{ orderId: string; attempts: number }[]> {
  const rows = await db.query<{ order_id: string; attempts: number }>(
    `select j.order_id, j.attempts from report_jobs j join orders o on o.id = j.order_id
      where j.status in ('queued', 'running')
        and o.generation_status not in ('ready', 'failed')
        and j.updated_at < now() - ($1::int * interval '1 minute')
        and (j.lease_expires_at is null or j.lease_expires_at < now())
      order by j.updated_at limit $2::int`,
    [olderThanMinutes, limit],
  );
  return rows.map((r) => ({ orderId: r.order_id, attempts: r.attempts }));
}

/** Queues a fresh generation event for a stalled or manually retried job. */
export async function requeueGeneration(db: Database, orderId: string, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(`update report_jobs set status = 'queued', lease_owner = null, lease_expires_at = null, updated_at = now() where order_id = $1::uuid`, [orderId]);
    await enqueueOutbox(tx, "report.generate", orderId, `report.generate:${orderId}:${reason}:${Date.now()}`);
  });
}
