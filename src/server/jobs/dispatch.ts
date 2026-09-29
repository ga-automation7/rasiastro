import { getEnv } from "../config/env";
import { chooseProviders } from "../config/readiness";
import { getDb } from "../db";
import { log } from "../log";
import { EVENTS, inngest } from "./inngest-client";
import { claimDueMessages, markDispatched, markDispatchFailed, type OutboxMessage } from "./outbox";

/**
 * Hands outbox messages to the job runner.
 *
 * - Inngest (live): sends an event whose id is the outbox dedupe key, so Inngest
 *   ignores accidental duplicates. Inngest then runs each step durably with retries.
 * - Local (demo only): runs the pipeline in this process after the HTTP response has
 *   been sent (Next.js `after`). Stalled local jobs are resumed by the status poll.
 */
async function dispatchOne(message: OutboxMessage): Promise<void> {
  const env = getEnv();
  if (chooseProviders(env).jobs === "inngest") {
    // The product rides along so Inngest can apply a separate concurrency limit per product.
    const rows = await (await getDb()).query<{ product: string }>(`select product from orders where id = $1::uuid`, [message.orderId]);
    const product = rows[0]?.product ?? "personal";
    await inngest.send({ id: message.dedupeKey, name: message.topic === "report.generate" ? EVENTS.generate : EVENTS.deliver, data: { orderId: message.orderId, product } });
    return;
  }
  const { runLocally } = await import("./local-runner");
  await runLocally(message);
}

export async function dispatchDue(options: { orderId?: string; limit?: number } = {}): Promise<number> {
  const db = await getDb();
  const messages = await claimDueMessages(db, options);
  for (const message of messages) {
    try {
      await dispatchOne(message);
      await markDispatched(db, message.id);
    } catch (error) {
      log.error("outbox dispatch failed", { orderId: message.orderId, topic: message.topic, attempt: message.attempts, error });
      await markDispatchFailed(db, message.id, message.attempts, (error as Error).message);
    }
  }
  return messages.length;
}

/** Best-effort immediate dispatch right after a commit. Failures are retried by the sweeper. */
export async function dispatchForOrder(orderId: string): Promise<void> {
  try {
    await dispatchDue({ orderId, limit: 5 });
  } catch (error) {
    log.error("immediate dispatch failed; sweeper will retry", { orderId, error });
  }
}
