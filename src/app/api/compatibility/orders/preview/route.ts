import { assertSameOrigin, clientKey, json, readJson, withErrors } from "@/server/http";
import { previewCompatibilityOrder } from "@/server/orders/service";

export const dynamic = "force-dynamic";

/** Validates both people's details and shows how each birth time was resolved - before any order exists. */
export const POST = withErrors("compatibility.preview", async (request: Request) => {
  await assertSameOrigin();
  const preview = await previewCompatibilityOrder(await readJson(request), await clientKey());
  return json(preview);
});
