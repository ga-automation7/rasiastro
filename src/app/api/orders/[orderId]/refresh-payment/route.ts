import { assertSameOrigin, clientKey, json, requireOrderAccess, withErrors } from "@/server/http";
import { getOrderStatusView } from "@/server/orders/status";
import { refreshPaymentForCustomer } from "@/server/payments/service";

export const dynamic = "force-dynamic";

/**
 * Asks the payment provider directly for this order's status. Used when the customer
 * returns from checkout: we never trust the redirect itself as proof of payment.
 */
export const POST = withErrors("orders.refresh-payment", async (_request: Request, context: { params: Promise<{ orderId: string }> }) => {
  await assertSameOrigin();
  const { orderId } = await context.params;
  await requireOrderAccess(orderId);
  await refreshPaymentForCustomer(orderId, await clientKey());
  return json(await getOrderStatusView(orderId));
});
