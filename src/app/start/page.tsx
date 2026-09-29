import type { Metadata } from "next";
import { OrderWizard } from "@/components/order/OrderWizard.client";
import { OrderingUnavailable } from "@/components/order/OrderingUnavailable";
import { getCheckoutAvailability } from "@/server/config/readiness";

export const metadata: Metadata = {
  title: "Your personal report",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const availability = getCheckoutAvailability(undefined, "personal");
  if (!availability.available) return <OrderingUnavailable message={availability.customerMessage ?? "Please check back soon."} />;
  const tradition = params.tradition === "indian" || params.tradition === "western" ? params.tradition : null;
  const from = typeof params.from === "string" && /^[0-9a-f-]{36}$/i.test(params.from) ? params.from : null;
  return <OrderWizard checkoutAvailable={availability.available} initialTradition={tradition} initialQuestions={params.questions === "1"} fromOrderId={from} />;
}
