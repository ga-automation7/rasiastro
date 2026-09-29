import type { Metadata } from "next";
import { AccessExchange } from "@/components/access/AccessExchange.client";

export const metadata: Metadata = { title: "Opening your report", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function AccessPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <AccessExchange />
    </div>
  );
}
