import { z } from "zod";
import { requireAdmin } from "@/server/admin/auth";
import { AppError, conflict } from "@/server/errors";
import { assertSameOrigin, json, readJson, withErrors } from "@/server/http";
import { isUuid } from "@/server/orders/repository";
import { confirmPaymentManually } from "@/server/payments/service";

export const dynamic = "force-dynamic";

const Body = z.object({ reference: z.string().max(40) });

/**
 * Owner-only: after checking the bank account, confirm a UroRelay payment by re-typing
 * its UPI reference. It then takes the same atomic path as any verified payment.
 */
export const POST = withErrors("admin.payment-confirm", async (request: Request, context: { params: Promise<{ paymentId: string }> }) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { paymentId } = await context.params;
  if (!isUuid(paymentId)) throw new AppError("not_found", "Not found");
  const parsed = Body.safeParse(await readJson(request, 1_000));
  if (!parsed.success) throw new AppError("validation_failed", "Type the UPI reference number.");
  const outcome = await confirmPaymentManually(paymentId, parsed.data.reference, admin);
  if (outcome === "confirmed" || outcome === "already_paid") return json({ ok: true, outcome });
  throw conflict(
    outcome === "duplicate_payment"
      ? "This order was already paid by another payment. Nothing was generated twice; a refund of this payment may be due."
      : `Not confirmed (${outcome}). Nothing was changed.`,
  );
});
