import { getEnv } from "@/server/config/env";
import { chooseProviders } from "@/server/config/readiness";
import { json, requireOrderAccess, withErrors } from "@/server/http";
import { dispatchForOrder } from "@/server/jobs/dispatch";
import { log } from "@/server/log";
import { getOrderStatusView } from "@/server/orders/status";
import { orderNotAccessible } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = withErrors("orders.status", async (_request: Request, context: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await context.params;
  await requireOrderAccess(orderId);
  const view = await getOrderStatusView(orderId);
  if (!view) throw orderNotAccessible();

  // Self-healing while the customer watches: hand over any undispatched work, and in
  // local demo mode resume a job whose runner stopped (e.g. dev server restarted).
  if (view.paymentStatus === "paid" && (view.generationStatus !== "ready" || view.deliveryStatus === "not_sent")) {
    try {
      await dispatchForOrder(orderId);
      if (chooseProviders(getEnv()).jobs === "local") {
        const { resumeStalledLocalJob } = await import("@/server/jobs/local-runner");
        await resumeStalledLocalJob(orderId);
      }
    } catch (error) {
      log.warn("status self-heal failed", { orderId, error });
    }
  }
  return json(view);
});
