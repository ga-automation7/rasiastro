import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";
import { formatInr } from "@/domain/pricing";
import { PRICING } from "@/config/pricing";

export const metadata: Metadata = { title: "Terms of service" };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms apply to reports bought from Rasi Astro at rasiastro.com, operated by {b.legalName}, {b.address}. By placing an order you agree to them.
      </p>
      <h2>The service</h2>
      <p>
        We prepare a personalised astrology report for one person in one tradition (Indian/Vedic or Western) and one language, delivered as a web page and a downloadable PDF, with an optional bundle of three questions answered in the report.
      </p>
      <h2>Nature of astrology</h2>
      <p>
        Astrology is an interpretive tradition. It is not scientifically validated prediction. Reports describe possibilities and themes for reflection, not certainties, and do not replace medical, legal, financial, psychological or other professional advice. Do not make important decisions based only on a report.
      </p>
      <h2>Your details</h2>
      <p>
        You are responsible for the accuracy of the birth details you provide and for having permission to share another person&apos;s details. Once payment is started, an order&apos;s details are fixed; corrections require a new order.
      </p>
      <h2>Prices and payment</h2>
      <p>
        A report costs {formatInr(PRICING.report.amountPaise)}; the optional three-question bundle costs {formatInr(PRICING.questionsAddon.amountPaise)} in total. The full amount is shown before payment and charged once, in Indian rupees, through Cashfree Payments. The PDF is included. There are no subscriptions.
      </p>
      <h2>Delivery and refunds</h2>
      <p>
        See our <Link href="/delivery-policy">delivery policy</Link> and <Link href="/refund-policy">refund and cancellation policy</Link>.
      </p>
      <h2>Acceptable use</h2>
      <p>Please do not misuse the service, attempt to access other people&apos;s reports, or submit unlawful or abusive content in notes or questions.</p>
      <h2>Your report</h2>
      <p>Your report is for personal use. The report design, text templates and software remain our property.</p>
      <h2>Liability</h2>
      <p>
        To the extent permitted by law, our total liability for any order is limited to the amount paid for it. We are not liable for decisions made on the basis of a report.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Courts at the place of our registered address have jurisdiction, without prejudice to your rights as a consumer.</p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a>
      </p>
    </LegalPage>
  );
}
