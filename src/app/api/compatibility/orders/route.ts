import { assertSameOrigin, clientKey, json, readJson, setOrderAccessCookie, withErrors } from "@/server/http";
import { createCompatibilityOrder } from "@/server/orders/service";

export const dynamic = "force-dynamic";

/**
 * Creates a compatibility order for exactly two people (inputs frozen, ₹39 computed on
 * the server) and gives this browser an HttpOnly access cookie for it.
 */
export const POST = withErrors("compatibility.create", async (request: Request) => {
  await assertSameOrigin();
  const created = await createCompatibilityOrder(await readJson(request), await clientKey());
  await setOrderAccessCookie(created.orderId, created.accessToken, created.accessExpiresAt);
  return json({ orderId: created.orderId, reference: created.reference, totalAmountPaise: created.totalAmountPaise }, { status: 201 });
});
