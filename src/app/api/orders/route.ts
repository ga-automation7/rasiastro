import { assertSameOrigin, clientKey, json, readJson, setOrderAccessCookie, withErrors } from "@/server/http";
import { createOrder } from "@/server/orders/service";

export const dynamic = "force-dynamic";

/**
 * Creates the order (inputs frozen, price computed on the server) and gives this
 * browser an HttpOnly access cookie for it. The token is never returned in the body.
 */
export const POST = withErrors("orders.create", async (request: Request) => {
  await assertSameOrigin();
  const created = await createOrder(await readJson(request), await clientKey());
  await setOrderAccessCookie(created.orderId, created.accessToken, created.accessExpiresAt);
  return json({ orderId: created.orderId, reference: created.reference, totalAmountPaise: created.totalAmountPaise }, { status: 201 });
});
