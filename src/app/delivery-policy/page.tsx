import type { Metadata } from "next";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Delivery policy" };
export const dynamic = "force-dynamic";

export default function DeliveryPolicyPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Delivery policy">
      <p>Rasi Astro sells digital reports only. Nothing is shipped physically.</p>
      <h2>How you receive your report</h2>
      <ul>
        <li>After payment is confirmed, your report is prepared automatically. Most reports are ready within a few minutes; occasionally it can take longer.</li>
        <li>You can follow progress on your order page, read the report online and download the PDF.</li>
        <li>We also email a secure link to the address you gave. Links expire after {b.linkDays} days for privacy; you can request a fresh link at any time on the “Find my report” page.</li>
      </ul>
      <h2>If something is delayed</h2>
      <p>
        If your report is not ready within 24 hours, or you did not receive the email, write to <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a> with your order reference. If we cannot deliver within 48 hours, you will get a full refund.
      </p>
    </LegalPage>
  );
}
