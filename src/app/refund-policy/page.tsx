import type { Metadata } from "next";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Refund and cancellation policy" };
export const dynamic = "force-dynamic";

export default function RefundPolicyPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Refund and cancellation policy">
      <p>Each report is prepared individually for the birth details you give us. This policy explains when we refund and how.</p>
      <h2>Full refund</h2>
      <ul>
        <li>If we cannot deliver your report within 48 hours of a successful payment.</li>
        <li>If you were charged twice for the same order.</li>
        <li>If your payment went through but no order was created on our side.</li>
      </ul>
      <h2>Correction or refund</h2>
      <p>
        If your report has an error on our side - for example the wrong language, missing sections, or a calculation problem - tell us within 14 days. We will correct and re-issue it at no cost, or refund you if we cannot.
      </p>
      <h2>Not refundable</h2>
      <p>
        Because reports are personalised and delivered digitally, we cannot refund a correctly delivered report because you disagree with its interpretation, or because the birth details you entered were incorrect. For corrected details, please place a new order.
      </p>
      <h2>Cancellation</h2>
      <p>
        Before payment there is nothing to cancel. After payment, report preparation starts automatically within minutes; if you write to us before your report is ready, we will cancel it and refund you in full.
      </p>
      <h2>How refunds are paid</h2>
      <p>Approved refunds are made through Cashfree Payments to the original payment method, usually within 5-7 working days (bank timelines may vary).</p>
      <h2>How to ask</h2>
      <p>
        Email <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a> from the address used for the order, with your order reference (RA-...). We never charge you again because a report needs to be regenerated.
      </p>
    </LegalPage>
  );
}
