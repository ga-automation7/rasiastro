import type { Metadata } from "next";
import { CompatibilityWizard } from "@/components/compatibility/CompatibilityWizard.client";
import { OrderingUnavailable } from "@/components/order/OrderingUnavailable";
import { isCompatibilityCategory } from "@/config/compatibility";
import { getCheckoutAvailability } from "@/server/config/readiness";

export const metadata: Metadata = {
  title: "Your connection report",
  description: "A compatibility report for two people and one connection: relationship, marriage, friendship, career and teamwork, business partnership or family.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CompatibilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const availability = getCheckoutAvailability(undefined, "compatibility");
  if (!availability.available) return <OrderingUnavailable message={availability.customerMessage ?? "Please check back soon."} />;
  const category = isCompatibilityCategory(params.category) ? params.category : null;
  const from = typeof params.from === "string" && /^[0-9a-f-]{36}$/i.test(params.from) ? params.from : null;
  return <CompatibilityWizard initialCategory={category} fromOrderId={from} />;
}
