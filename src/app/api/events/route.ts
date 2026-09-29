import { z } from "zod";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { assertSameOrigin, clientKey, json, readJson, withErrors } from "@/server/http";
import { recordFunnelEvent } from "@/server/orders/repository";
import { consumeRateLimit, RATE_LIMITS } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({ event: z.literal("form_started") });

/**
 * First-party funnel counter ("form started"). Accepts no personal data at all -
 * only the event name. Later funnel steps are recorded server-side.
 */
export const POST = withErrors("events", async (request: Request) => {
  await assertSameOrigin();
  const parsed = Body.safeParse(await readJson(request, 200));
  if (!parsed.success) return json({ ok: false }, { status: 400 });
  const db = await getDb();
  if (await consumeRateLimit(db, RATE_LIMITS.funnelEvent, await clientKey())) {
    await recordFunnelEvent(db, "form_started", getEnv().APP_MODE);
  }
  return json({ ok: true }, { status: 202 });
});
