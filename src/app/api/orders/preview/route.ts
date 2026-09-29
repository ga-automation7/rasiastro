import { assertSameOrigin, clientKey, json, readJson, withErrors } from "@/server/http";
import { previewOrder } from "@/server/orders/service";

export const dynamic = "force-dynamic";

/** Validates the whole form and shows how we resolved the birth time - before any order exists. */
export const POST = withErrors("orders.preview", async (request: Request) => {
  await assertSameOrigin();
  const preview = await previewOrder(await readJson(request), await clientKey());
  return json(preview);
});
