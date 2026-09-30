import { jsonParam, type SqlExecutor } from "../db";

/**
 * Transactional outbox. Work owed to a customer (generate a report, deliver it) is
 * recorded in the SAME transaction as the state change that creates the obligation.
 * A separate dispatch step hands it to the job runner; if that hand-off fails (or the
 * process dies), the sweeper finds the undispatched row and tries again.
 */
export type OutboxTopic = "report.generate" | "report.deliver";

export interface OutboxMessage {
  id: string;
  topic: OutboxTopic;
  orderId: string;
  dedupeKey: string;
  attempts: number;
}

export async function enqueueOutbox(tx: SqlExecutor, topic: OutboxTopic, orderId: string, dedupeKey: string, payload: Record<string, unknown> = {}): Promise<void> {
  await tx.query(
    `insert into outbox (topic, order_id, dedupe_key, payload) values ($1, $2::uuid, $3, $4::text::jsonb)
     on conflict (dedupe_key) do nothing`,
    [topic, orderId, dedupeKey, jsonParam(payload)],
  );
}

/**
 * Claims up to `limit` due messages by pushing their availability forward (a short
 * lease), so concurrent dispatchers never hand the same message over twice at once.
 */
export async function claimDueMessages(db: SqlExecutor, options: { orderId?: string; limit?: number } = {}): Promise<OutboxMessage[]> {
  const rows = await db.query<{ id: string; topic: OutboxTopic; order_id: string; dedupe_key: string; attempts: number }>(
    `update outbox set available_at = now() + interval '2 minutes', attempts = attempts + 1
      where id in (
        select id from outbox
         where dispatched_at is null and available_at <= now()
           and ($1::uuid is null or order_id = $1::uuid)
         order by created_at
         limit $2::int
         for update skip locked
      )
      returning id, topic, order_id, dedupe_key, attempts`,
    [options.orderId ?? null, options.limit ?? 20],
  );
  return rows.map((r) => ({ id: r.id, topic: r.topic, orderId: r.order_id, dedupeKey: r.dedupe_key, attempts: r.attempts }));
}

export async function markDispatched(db: SqlExecutor, id: string): Promise<void> {
  await db.query(`update outbox set dispatched_at = now(), last_error = null where id = $1::uuid`, [id]);
}

export async function markDispatchFailed(db: SqlExecutor, id: string, attempts: number, error: string): Promise<void> {
  // Exponential backoff capped at one hour.
  const delaySeconds = Math.min(3600, 15 * 2 ** Math.min(attempts, 8));
  await db.query(
    `update outbox set last_error = $2, available_at = now() + ($3::int * interval '1 second') where id = $1::uuid`,
    [id, error.slice(0, 300), delaySeconds],
  );
}

/** Re-opens a message so it is dispatched again (used when a job must be re-run). */
export async function reopenMessage(db: SqlExecutor, dedupeKey: string): Promise<void> {
  await db.query(`update outbox set dispatched_at = null, available_at = now() where dedupe_key = $1`, [dedupeKey]);
}

export async function countUndispatched(db: SqlExecutor, olderThanMinutes: number): Promise<number> {
  const rows = await db.query<{ n: number }>(
    `select count(*)::int as n from outbox where dispatched_at is null and created_at < now() - ($1::int * interval '1 minute')`,
    [olderThanMinutes],
  );
  return rows[0]?.n ?? 0;
}
