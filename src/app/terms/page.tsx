import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, OperatorBlock, businessDetails } from "@/components/legal/LegalPage";
import { REPORT_LANGUAGES } from "@/config/languages";
import { COPY, PRICE } from "@/content/site-copy";

export const metadata: Metadata = { title: "Terms of Service" };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const b = businessDetails();
  const languages = REPORT_LANGUAGES.filter((l) => l.enabled).map((l) => l.englishName).join(", ");
  return (
    <LegalPage title="Terms of Service" summary="The agreement between you and Rasi Astro when you use this website and buy a report. Nothing here limits the rights you have under Indian consumer law.">
      <h2>Who we are</h2>
      <OperatorBlock b={b} />

      <h2>What we sell</h2>
      <ul>
        <li>
          <strong>Personal report, {PRICE.personal}.</strong> One person, one tradition (Indian or Western) and one report language. Adding three personal questions costs {PRICE.questions} in total,
          making {PRICE.personalWithQuestions}.
        </li>
        <li>
          <strong>Compatibility report, {PRICE.compatibility}</strong> for two people together, with one connection category, one tradition and one language. The question add-on is not available for
          compatibility reports.
        </li>
        <li>Every report is delivered as an online report and a downloadable PDF. Payment is one-time; there is no account and no subscription.</li>
        <li>Report languages: {languages}. Any language can be combined with either tradition.</li>
      </ul>
      <p>Prices are in Indian rupees and are the total you pay. We do not add charges at checkout.</p>

      <h2>How reports are made</h2>
      <p>
        Our software calculates the chart from the birth details you give. An AI service writes the interpretation from that calculated data, your chosen tradition and language, and any notes or
        questions you add. The AI does not calculate chart positions. Reports are checked automatically for structure, completeness and language; no astrologer reviews them before delivery.
      </p>

      <h2>Astrology is interpretive</h2>
      <p>
        {COPY.disclaimer} A report does not predict events with certainty and does not guarantee any outcome. Please do not rely on it alone for decisions about health, money, law, work,
        relationships or safety; consult a qualified professional where that matters. Compatibility reports do not decide whether people should marry, separate, work together or end a relationship.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Enter birth details accurately and check them on the review screen. Once an order is placed its details are fixed; a correction means a new order.</li>
        <li>You and every person a report is about must be 18 or older.</li>
        <li>If a report is about someone else, you must have their permission to share their details and any notes about them.</li>
        <li>Please do not enter health, financial or government ID information in notes or questions.</li>
        <li>Keep your private report link safe; anyone who has it can open the report.</li>
      </ul>

      <h2>Payment</h2>
      <p>
        Payments are processed by Cashfree Payments. An order counts as paid only when we have verified the payment with Cashfree; a browser message or screenshot is not enough. If a payment is
        pending, we wait for confirmation rather than charging you again.
      </p>

      <h2>Delivery, refunds and cancellation</h2>
      <p>
        Delivery is digital; see the <Link href="/delivery-policy">Digital Delivery Policy</Link>. Refunds and cancellations are covered by the{" "}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
      </p>

      <h2>Using the report and the website</h2>
      <ul>
        <li>Your report is for your personal, non-commercial use. You may share it with the people it is about. Please do not resell or republish it.</li>
        <li>The website, its design, text and software belong to the operator or its licensors.</li>
        <li>Do not misuse the service: no automated scraping, attempts to access other people&apos;s reports, interference with security, or unlawful use.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        We take reasonable care to calculate charts correctly and to deliver what you paid for. If something goes wrong, the remedies in our Refund &amp; Cancellation Policy apply. Apart from
        liability that cannot be limited by law, our liability for any claim about an order is limited to the amount you paid for that order. Nothing in these terms excludes or limits your rights
        under the Consumer Protection Act, 2019, or any other law, including your right to approach a consumer commission.
      </p>

      <h2>Complaints and disputes</h2>
      <p>
        Please contact us first; we acknowledge complaints within 48 hours and aim to resolve them within one month. See <Link href="/contact">Contact &amp; Grievance Redressal</Link>. These terms
        are governed by the laws of India.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms; the date above shows the latest version. The terms that applied when you placed an order continue to apply to that order.</p>
    </LegalPage>
  );
}
