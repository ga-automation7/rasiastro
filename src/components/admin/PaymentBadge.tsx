import { PAYMENT_GROUPS } from "@/server/admin/filters";

/** Unpaid orders are marked clearly; paid, pending and review states each have their own tone. */
export function PaymentBadge({ status }: { status: string }) {
  const unpaid = PAYMENT_GROUPS.unpaid.includes(status);
  const tone = status === "paid" ? "bg-teal-100 text-teal-700" : unpaid ? "bg-vermilion-100 text-vermilion-700" : "bg-gold-100 text-gold-700";
  const label = status === "paid" ? "Paid" : unpaid ? `Unpaid · ${status.replace("_", " ")}` : status.replace("_", " ");
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}
