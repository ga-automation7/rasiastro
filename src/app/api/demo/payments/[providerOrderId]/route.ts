import { z } from "zod";
import { getEnv, isProductionDeployment } from "@/server/config/env";
import { getDb } from "@/server/db";
import { AppError, orderNotAccessible } from "@/server/errors";
import { assertSameOrigin, json, readJson, requireOrderAccess, withErrors } from "@/server/http";
import { getPaymentByProviderOrderId } from "@/server/payments/repository";
import { providerFor } from "@/server/payments/registry";
import { applyPaymentEvidence } from "@/server/payments/service";

export const dynamic = "force-dynamic";

const Body = z.object({ outcome: z.enum(["success", "failure", "cancel"]) });

/**
 * DEMO ONLY: the simulated checkout page reports what the tester clicked. The result
 * still flows through the normal evidence -> state machine path. Refused unless the
 * app is in demo mode and not on the production deployment.
 */
export const POST = withErrors("demo.payment", async (request: Request, context: { params: Promise<{ providerOrderId: string }> }) => {
  const env = getEnv();
  if (env.APP_MODE !== "demo" || isProductionDeployment(env)) throw new AppError("not_found", "Not found");
  await assertSameOrigin();
  const { providerOrderId } = await context.params;
  const body = Body.parse(await readJson(request, 500));
  const db = await getDb();
  const payment = await getPaymentByProviderOrderId(db, decodeURIComponent(providerOrderId));
  if (!payment || payment.provider !== "demo") throw orderNotAccessible();
  await requireOrderAccess(payment.orderId);

  const providerStatus = body.outcome === "success" ? "DEMO_SUCCESS" : body.outcome === "failure" ? "DEMO_FAILED" : "DEMO_CANCELLED";
  await db.query(`update payments set provider_status = $2, updated_at = now() where id = $1::uuid and status not in ('paid', 'needs_review')`, [payment.id, providerStatus]);
  // Read the "provider" state back exactly as reconciliation would.
  const provider = providerFor("demo", "demo");
  if (!provider) throw new AppError("not_found", "Not found");
  const evidence = await provider.fetchEvidence({ providerOrderId: payment.providerOrderId, providerReference: null });
  const result = await applyPaymentEvidence(evidence);
  return json({ orderId: payment.orderId, outcome: result.outcome });
});
