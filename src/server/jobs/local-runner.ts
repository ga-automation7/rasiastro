import crypto from "node:crypto";
import { after } from "next/server";
import { getDb } from "../db";
import { deliverReport, isRetriableEmailError, markDeliveryFailed } from "../delivery/service";
import { log } from "../log";
import { acquireJobLease, findStalledJobs, releaseForRetry } from "./job-state";
import type { OutboxMessage } from "./outbox";
import { GENERATION_STEPS, isPermanentError, markGenerationFailed, runGenerationStep } from "./pipeline";

/**
 * DEMO / local development runner. Runs the same idempotent pipeline steps as the
 * Inngest functions, in this process, after the HTTP response has been sent.
 * Durability comes from the database: an exclusive lease per order, bounded
 * attempts, and the status page resuming any job whose lease has expired.
 * Never used in live mode (config/readiness.ts requires Inngest there).
 */
const MAX_ATTEMPTS = 4;
const LEASE_SECONDS = 600;

function schedule(task: () => Promise<void>): Promise<void> | void {
  // Inside the Next.js server (NEXT_RUNTIME is set) the work runs after the response
  // is sent, tracked by the framework. Anywhere else (scripts, tests) it runs to
  // completion before returning - never as an untracked background promise.
  if (process.env.NEXT_RUNTIME) {
    after(task);
    return;
  }
  return task();
}

export async function runLocally(message: OutboxMessage): Promise<void> {
  const task = message.topic === "report.generate" ? () => runGenerationLocally(message.orderId) : () => runDeliveryLocally(message.orderId);
  await schedule(task);
}

export async function runGenerationLocally(orderId: string): Promise<void> {
  const db = await getDb();
  const owner = `local-${process.pid}-${crypto.randomUUID()}`;
  const attempt = await acquireJobLease(db, orderId, owner, LEASE_SECONDS);
  if (attempt === null) return; // Another run holds the lease, or the job already finished.
  try {
    for (const step of GENERATION_STEPS) {
      const result = await runGenerationStep(orderId, step);
      log.info("pipeline step", { orderId, step, outcome: result.skipped ? "skipped" : "done" });
    }
  } catch (error) {
    if (isPermanentError(error) || attempt >= MAX_ATTEMPTS) {
      await markGenerationFailed(orderId, error);
    } else {
      const backoff = 20 * 2 ** (attempt - 1);
      log.warn("pipeline attempt failed; will retry", { orderId, attempt, error });
      await releaseForRetry(db, orderId, owner, error, backoff);
    }
  }
}

export async function runDeliveryLocally(orderId: string): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await deliverReport(orderId);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetriableEmailError(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  await markDeliveryFailed(orderId, lastError);
}

/** Demo only: resume a stalled local job for this order (called by the status poll). */
export async function resumeStalledLocalJob(orderId: string): Promise<void> {
  const db = await getDb();
  const stalled = await findStalledJobs(db, 0, 50);
  if (!stalled.some((j) => j.orderId === orderId)) return;
  await schedule(() => runGenerationLocally(orderId));
}
