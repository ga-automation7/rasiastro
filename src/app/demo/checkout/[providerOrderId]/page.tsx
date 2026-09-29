import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoCheckout } from "@/components/demo/DemoCheckout.client";
import { NoAccess } from "@/components/status/NoAccess";
import { formatInr } from "@/domain/pricing";
import { getEnv, isProductionDeployment } from "@/server/config/env";
import { getDb } from "@/server/db";
import { hasOrderAccess } from "@/server/http";
import { getPaymentByProviderOrderId } from "@/server/payments/repository";

export const metadata: Metadata = { title: "Demo checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DemoCheckoutPage({ params }: { params: Promise<{ providerOrderId: string }> }) {
  const env = getEnv();
  if (env.APP_MODE !== "demo" || isProductionDeployment(env)) notFound();
  const { providerOrderId } = await params;
  const payment = await getPaymentByProviderOrderId(await getDb(), decodeURIComponent(providerOrderId));
  if (!payment || payment.provider !== "demo") notFound();
  if (!(await hasOrderAccess(payment.orderId))) return <NoAccess />;
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border-2 border-dashed border-gold-600 bg-gold-200/40 p-4 text-sm font-semibold text-night-900" role="note">
        DEMO CHECKOUT - this page imitates a payment provider. No real payment is taken and no card or UPI details are requested.
      </div>
      <h1 className="mt-8 text-3xl font-semibold text-night-900">Simulated payment</h1>
      <p className="mt-2 text-muted">Order payment {payment.providerOrderId}</p>
      <div className="mt-6">
        <DemoCheckout providerOrderId={payment.providerOrderId} amountLabel={formatInr(payment.amountPaise)} orderId={payment.orderId} />
      </div>
    </div>
  );
}
