import { assertSameOrigin, clientKey, json, requireOrderAccess, withErrors } from "@/server/http";
import { startCheckout } from "@/server/payments/service";

export const dynamic = "force-dynamic";

/** Opens hosted checkout for an order this browser has access to. Amount comes from the order. */
export const POST = withErrors("orders.checkout", async (_request: Request, context: { params: Promise<{ orderId: string }> }) => {
  await assertSameOrigin();
  const { orderId } = await context.params;
  await requireOrderAccess(orderId);
  return json(await startCheckout(orderId, await clientKey()));
});
