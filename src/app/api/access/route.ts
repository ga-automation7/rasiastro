import { resolveAccessToken } from "@/server/access/tokens";
import { getDb } from "@/server/db";
import { orderNotAccessible } from "@/server/errors";
import { assertSameOrigin, clientKey, json, readJson, setOrderAccessCookie, withErrors } from "@/server/http";
import { RATE_LIMITS, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Exchanges a token from an email link (read by /access from the URL fragment, so it
 * never reaches server logs) for an HttpOnly cookie scoped to that order.
 */
export const POST = withErrors("access", async (request: Request) => {
  await assertSameOrigin();
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.accessExchange, await clientKey());
  const body = (await readJson(request, 1_000)) as { token?: unknown };
  const resolved = await resolveAccessToken(db, body.token);
  if (!resolved) throw orderNotAccessible();
  await setOrderAccessCookie(resolved.orderId, body.token as string, resolved.expiresAt);
  return json({ orderId: resolved.orderId });
});
