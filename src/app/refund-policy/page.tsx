import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Refund & Cancellation", description: "When Rasi Astro refunds an order, how cancellations work, and what happens if a report cannot be completed.", alternates: { canonical: "/refund-policy" } };
export const dynamic = "force-dynamic";

export default function RefundPolicyPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Refund & Cancellation Policy" summary="When you can cancel, when we refund, and how to ask.">
      <p>
        <strong>
          Rasi Astro reports are personalized digital products. Once report generation has begun, we do not ordinarily offer cancellation or refunds for a change of mind, disagreement with an
          astrological interpretation, or incorrect information entered and confirmed by the customer. This does not limit any rights or remedies available under applicable Indian law.
        </strong>
      </p>

      <h2>Before you pay, and before generation starts</h2>
      <ul>
        <li>An unpaid order costs nothing; you can simply leave it. Unpaid orders are deleted after {b.unpaidDays} days.</li>
        <li>
          After payment, generation normally starts within minutes. Our records show exactly when it starts. If you ask us to cancel before it has started, we cancel the order and refund you in full.
        </li>
      </ul>

      <h2>When we refund</h2>
      <p>You are entitled to a full refund of the affected order in these situations:</p>
      <ul>
        <li>
          <strong>Duplicate charge:</strong> you were charged more than once for the same order. We refund every extra payment.
        </li>
        <li>
          <strong>Not delivered:</strong> you paid, but your report was not delivered within {b.maxHours} hours and we have not been able to deliver it after you contacted us.
        </li>
        <li>
          <strong>Defective or incomplete:</strong> the report has a material technical defect, or content you paid for is missing (for example, the answers to your three purchased questions), and
          we cannot correct it promptly.
        </li>
        <li>
          <strong>Materially different:</strong> the report is materially different from the service described on this website (for example, the wrong product, tradition or language).
        </li>
        <li>
          <strong>Required by law:</strong> any other case where Indian law gives you a refund or another remedy.
        </li>
      </ul>
      <p>
        In these cases we may offer to correct or regenerate the report, and you can choose that instead. If you are entitled to a refund, we will not insist on store credit or regeneration.
      </p>

      <h2>When we do not ordinarily refund</h2>
      <ul>
        <li>A change of mind after generation has begun.</li>
        <li>Disagreement with the astrological interpretation.</li>
        <li>
          Wrong birth details that you entered and confirmed on the review screen. We can help you place a new order with the correct details; the calculation for the original order was done as you
          asked.
        </li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Email <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a> from the email address used for the order, with your order reference (for example RA-7K3M9Q2X) and a short description of the
        problem. Screenshots help but are not required.
      </p>

      <h2>How long it takes</h2>
      <ul>
        <li>We acknowledge your request within 48 hours and tell you our decision as soon as we have reviewed it.</li>
        <li>Once a refund is approved, we initiate it within {b.refundDays} working days, to the original payment method.</li>
        <li>
          After we initiate it, our payment partner ({b.paymentPartners}) and your bank or card issuer credit the amount. How long that takes depends on your payment method and bank and is outside our control; if it has not
          arrived after a reasonable time, contact us with the reference we send you and we will follow it up.
        </li>
      </ul>

      <h2>Complaints</h2>
      <p>
        If you are not satisfied with our answer, see <Link href="/contact">Contact &amp; Grievance Redressal</Link>. You can also approach the National Consumer Helpline or a consumer commission;
        this policy does not affect those rights.
      </p>
    </LegalPage>
  );
}
