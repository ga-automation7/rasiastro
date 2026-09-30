import { requireAdmin } from "@/server/admin/auth";
import { getDb } from "@/server/db";
import { AppError, conflict } from "@/server/errors";
import { assertSameOrigin, json, withErrors } from "@/server/http";
import { retryReportGeneration } from "@/server/jobs/retry";
import { log } from "@/server/log";
import { isUuid } from "@/server/orders/repository";

export const dynamic = "force-dynamic";

const REASONS = {
  not_found: "Order not found.",
  not_paid: "This order is not paid, so there is nothing to generate.",
  already_ready: "This report is already ready.",
  in_progress: "This report is still being prepared. Retry only after it has failed.",
} as const;

/** Owner-only: re-queue report generation for a paid order whose report failed. Never charges the customer. */
export const POST = withErrors("admin.retry-report", async (_request: Request, context: { params: Promise<{ orderId: string }> }) => {
  await assertSameOrigin();
  await requireAdmin();
  const { orderId } = await context.params;
  if (!isUuid(orderId)) throw new AppError("not_found", "Not found");
  const result = await retryReportGeneration(await getDb(), orderId, "admin-retry");
  if (!result.ok) {
    if (result.reason === "not_found") throw new AppError("not_found", REASONS.not_found);
    throw conflict(REASONS[result.reason]);
  }
  log.info("admin retried report generation", { orderId });
  return json({ ok: true });
});
