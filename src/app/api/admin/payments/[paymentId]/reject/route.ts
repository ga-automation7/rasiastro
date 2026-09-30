import { requireAdmin } from "@/server/admin/auth";
import { AppError } from "@/server/errors";
import { assertSameOrigin, json, withErrors } from "@/server/http";
import { isUuid } from "@/server/orders/repository";
import { rejectPaymentManually } from "@/server/payments/service";

export const dynamic = "force-dynamic";

/** Owner-only: the money never reached the bank account. The customer can pay again with a fresh QR code. */
export const POST = withErrors("admin.payment-reject", async (_request: Request, context: { params: Promise<{ paymentId: string }> }) => {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const { paymentId } = await context.params;
  if (!isUuid(paymentId)) throw new AppError("not_found", "Not found");
  await rejectPaymentManually(paymentId, admin);
  return json({ ok: true });
});
