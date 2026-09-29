import type { Metadata } from "next";
import { OrderWizard } from "@/components/order/OrderWizard.client";
import { getCheckoutAvailability } from "@/server/config/readiness";

export const metadata: Metadata = {
  title: "Get your report",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tradition = params.tradition === "indian" || params.tradition === "western" ? params.tradition : null;
  const from = typeof params.from === "string" && /^[0-9a-f-]{36}$/i.test(params.from) ? params.from : null;
  const availability = getCheckoutAvailability();
  return (
    <OrderWizard
      checkoutAvailable={availability.available}
      pausedMessage={availability.customerMessage}
      initialTradition={tradition}
      fromOrderId={from}
    />
  );
}
