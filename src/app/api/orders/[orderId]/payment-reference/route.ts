import { z } from "zod";
import { AppError } from "@/server/errors";
import { assertSameOrigin, clientKey, json, readJson, requireOrderAccess, withErrors } from "@/server/http";
import { getOrderStatusView } from "@/server/orders/status";
import { submitPaymentReference } from "@/server/payments/service";

export const dynamic = "force-dynamic";

const Body = z.object({ reference: z.string().max(40) });

/**
 * UroRelay: the customer submits the UPI reference number (UTR) from their UPI app.
 * It is recorded and passed to UroPay but proves nothing by itself: the order is paid
 * only after UroPay confirms it from the bank's SMS.
 */
export const POST = withErrors("orders.payment-reference", async (request: Request, context: { params: Promise<{ orderId: string }> }) => {
  await assertSameOrigin();
  const { orderId } = await context.params;
  await requireOrderAccess(orderId);
  const parsed = Body.safeParse(await readJson(request, 1_000));
  if (!parsed.success) throw new AppError("validation_failed", "Please enter the UPI reference number.");
  await submitPaymentReference(orderId, parsed.data.reference, await clientKey());
  return json(await getOrderStatusView(orderId));
});
