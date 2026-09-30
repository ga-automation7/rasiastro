import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Digital Delivery" };
export const dynamic = "force-dynamic";

export default function DeliveryPolicyPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Digital Delivery Policy" summary="How and when your report reaches you. Delivery is entirely digital; nothing is shipped.">
      <h2>What you receive</h2>
      <ul>
        <li>
          <strong>Personal report:</strong> an online report and a downloadable PDF for one person, in your chosen tradition and language, including answers to your three questions if you added
          them.
        </li>
        <li>
          <strong>Compatibility report:</strong> an online report and a downloadable PDF for two people and one connection category, in your chosen tradition and language.
        </li>
      </ul>

      <h2>How it reaches you</h2>
      <ol>
        <li>After you pay, your order page shows each stage as it is actually completed.</li>
        <li>When the report is ready, you can read it on the order page and download the PDF there.</li>
        <li>We also email you a private link to the report.</li>
      </ol>

      <h2>How long it takes</h2>
      <p>
        Reports are prepared in the background after payment is confirmed, usually within about {b.typicalMinutes} minutes. Busy periods, a pending bank confirmation or a technical problem can
        make it take longer; we aim to deliver every report within {b.maxHours} hours of confirmed payment. Delivery is not instant.
      </p>

      <h2>Delays and failures</h2>
      <ul>
        <li>If a step fails, it is retried automatically. A retry never costs you anything.</li>
        <li>If your report cannot be completed, your order page says so and shows how to contact us. We then complete it or refund you under the <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.</li>
        <li>If the email cannot be sent, your report is still available on your order page.</li>
      </ul>

      <h2>Getting back to your report</h2>
      <ul>
        <li>Report links expire after {b.linkDays} days for your security. You can request a fresh link at any time on <Link href="/recover">Find my report</Link> using the email address from your order.</li>
        <li>Reopening a completed report or downloading the PDF again never requires another payment.</li>
        <li>Reports are kept for {b.reportDays} days after payment; please save the PDF if you want to keep it longer.</li>
      </ul>
    </LegalPage>
  );
}
