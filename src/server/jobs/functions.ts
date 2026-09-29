import { NonRetriableError } from "inngest";
import { getDb } from "../db";
import { deliverReport, isRetriableEmailError, markDeliveryFailed } from "../delivery/service";
import { log } from "../log";
import { runRetention } from "../ops/retention";
import { reconcileRecentPayments } from "../payments/service";
import { pruneRateLimits } from "../security/rate-limit";
import { dispatchDue } from "./dispatch";
import { EVENTS, inngest } from "./inngest-client";
import { findStalledJobs, markJobRunning, requeueGeneration } from "./job-state";
import { GENERATION_STEPS, isPermanentError, markGenerationFailed, runGenerationStep } from "./pipeline";

/**
 * Inngest functions (live mode). Each pipeline step is a separate `step.run`, so
 * Inngest checkpoints completed steps and retries only the step that failed.
 * Concurrency: at most REPORT_CONCURRENCY reports at once overall, and never two runs
 * for the same order.
 */
const REPORT_CONCURRENCY = Math.max(1, Math.min(20, Number(process.env.REPORT_CONCURRENCY ?? 3)));

function orderIdFrom(data: unknown): string {
  const orderId = (data as { orderId?: unknown } | undefined)?.orderId;
  if (typeof orderId !== "string") throw new NonRetriableError("Event is missing orderId");
  return orderId;
}

export const generateReport = inngest.createFunction(
  {
    id: "generate-report",
    name: "Generate report",
    triggers: [{ event: EVENTS.generate }],
    retries: 3,
    concurrency: [{ limit: REPORT_CONCURRENCY }, { key: "event.data.orderId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const orderId = orderIdFrom((event.data as { event?: { data?: unknown } }).event?.data);
      await markGenerationFailed(orderId, error);
    },
  },
  async ({ event, step }) => {
    const orderId = orderIdFrom(event.data);
    await step.run("mark-running", async () => markJobRunning(await getDb(), orderId));
    for (const name of GENERATION_STEPS) {
      await step.run(name, async () => {
        try {
          return await runGenerationStep(orderId, name);
        } catch (error) {
          if (isPermanentError(error)) throw new NonRetriableError((error as Error).message, { cause: error });
          throw error;
        }
      });
    }
    return { orderId };
  },
);

export const deliverReportEmail = inngest.createFunction(
  {
    id: "deliver-report",
    name: "Email report link",
    triggers: [{ event: EVENTS.deliver }],
    retries: 5,
    concurrency: [{ key: "event.data.orderId", limit: 1 }],
    onFailure: async ({ event, error }) => {
      const orderId = orderIdFrom((event.data as { event?: { data?: unknown } }).event?.data);
      await markDeliveryFailed(orderId, error);
    },
  },
  async ({ event, step }) => {
    const orderId = orderIdFrom(event.data);
    return step.run("send-email", async () => {
      try {
        return await deliverReport(orderId);
      } catch (error) {
        if (!isRetriableEmailError(error)) throw new NonRetriableError((error as Error).message, { cause: error });
        throw error;
      }
    });
  },
);

/** Every 10 minutes: recover from missed webhooks, lost dispatches and stalled jobs. */
export const sweeper = inngest.createFunction(
  { id: "sweeper", name: "Reconcile and resume", triggers: [{ cron: "*/10 * * * *" }], retries: 1 },
  async ({ step }) => {
    const reconciled = await step.run("reconcile-payments", () => reconcileRecentPayments(50));
    const requeued = await step.run("requeue-stalled-jobs", async () => {
      const db = await getDb();
      const stalled = await findStalledJobs(db, 30);
      for (const job of stalled) await requeueGeneration(db, job.orderId, "stalled");
      return stalled.length;
    });
    const dispatched = await step.run("dispatch-outbox", () => dispatchDue({ limit: 50 }));
    if (reconciled || requeued || dispatched) log.info("sweeper run", { count: reconciled + requeued + dispatched });
    return { reconciled, requeued, dispatched };
  },
);

/** Daily: retention/deletion and housekeeping. */
export const dailyMaintenance = inngest.createFunction(
  { id: "daily-maintenance", name: "Retention and housekeeping", triggers: [{ cron: "TZ=Asia/Kolkata 30 3 * * *" }], retries: 2 },
  async ({ step }) => {
    const purged = await step.run("retention", () => runRetention({ dryRun: false }));
    await step.run("prune-rate-limits", async () => pruneRateLimits(await getDb()));
    return purged;
  },
);

export const inngestFunctions = [generateReport, deliverReportEmail, sweeper, dailyMaintenance];
