import type { Metadata } from "next";
import { NoAccess } from "@/components/status/NoAccess";
import { OrderStatus } from "@/components/status/OrderStatus.client";
import { hasOrderAccess } from "@/server/http";
import { isUuid } from "@/server/orders/repository";
import { getOrderStatusView } from "@/server/orders/status";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  if (!isUuid(orderId) || !(await hasOrderAccess(orderId))) return <NoAccess />;
  const view = await getOrderStatusView(orderId);
  if (!view) return <NoAccess />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Your order</p>
      <h1 className="mt-2 text-3xl font-semibold text-night-900 sm:text-4xl">Thank you - here is where things stand</h1>
      <div className="mt-8">
        <OrderStatus initial={view} paymentReturned={query.payment === "returned"} startFailed={query.payment === "start_failed"} />
      </div>
    </div>
  );
}
