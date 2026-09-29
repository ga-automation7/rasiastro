import type { Metadata } from "next";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains what Rasi Astro ({b.legalName}, {b.address}) collects, why, who processes it for us, and how long we keep it. We have no customer accounts and we collect only what we need to prepare and deliver your report.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Details of the person the report is about: full name, date, time (and how certain it is) and place of birth.</li>
        <li>Anything you choose to add: chart details you already know, notes, and - if you buy the add-on - three questions.</li>
        <li>Your email address (to deliver the report link) and mobile number (required by our payment partner Cashfree to process the payment).</li>
        <li>Payment references and status from Cashfree. We never receive your card, UPI or bank credentials.</li>
        <li>Security data: rate-limit counters keyed by a one-way hash of your IP address or email, and technical logs that exclude your birth details and report content.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To calculate your chart, write your report in your chosen language, create the PDF and email you a secure link.</li>
        <li>To process and verify your payment, prevent fraud and abuse, and provide support.</li>
        <li>To keep records we are legally required to keep (for example, payment and tax records).</li>
      </ul>
      <p>We do not sell your data, use it for advertising, or send marketing emails.</p>
      <h2>AI processing</h2>
      <p>
        The interpretive text of your report is written with the help of an AI service (currently OpenAI). We send it only the calculated chart data, your chosen language and tradition, and the notes and questions you add. We do not send your name, email address, mobile number, birthplace or payment details. Chart positions themselves are calculated by our own software, not by AI.
      </p>
      <h2>Service providers</h2>
      <p>We use trusted providers who process data on our behalf, some of them outside India:</p>
      <ul>
        <li>Supabase - database and private report file storage.</li>
        <li>Vercel - website hosting.</li>
        <li>Cashfree Payments - payment processing.</li>
        <li>OpenAI - writing the interpretive text (see above).</li>
        <li>Resend - sending transactional emails.</li>
        <li>Inngest - running background report jobs.</li>
      </ul>
      <h2>How long we keep it</h2>
      <ul>
        <li>Unpaid, abandoned orders are deleted after {b.unpaidDays} days.</li>
        <li>For paid orders, birth details, notes, questions, the report and the PDF are deleted {b.reportDays} days after payment. We keep the order reference, amount, dates and payment references as financial records.</li>
        <li>Report links expire after {b.linkDays} days; you can request a fresh link at any time while the report is kept.</li>
      </ul>
      <h2>Cookies</h2>
      <p>We use one essential, secure cookie per order so that your browser can open that order after you have used its link. We do not use advertising or third-party analytics cookies.</p>
      <h2>Security</h2>
      <p>
        Connections are encrypted. Report files are stored privately and downloaded through short-lived authorised links. Report links contain long random codes; we store only a one-way fingerprint of them. Please do not forward your report email, because anyone with the link can open the report.
      </p>
      <h2>Your rights and choices</h2>
      <p>
        You can ask to see, correct or delete your data by writing to <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a> from the email address used for the order, quoting your order reference. Because there are no accounts, we verify requests using that email address and reference.
      </p>
      <h2>Reports about other people and children</h2>
      <p>If you order a report about someone else, please make sure you have their permission to share their birth details. Reports about a child should be ordered by a parent or guardian.</p>
      <h2>Grievance officer</h2>
      <p>
        {b.grievanceOfficer}, reachable at <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a>. We aim to acknowledge complaints within 48 hours and resolve them within 30 days.
      </p>
      <h2>Changes</h2>
      <p>If this policy changes, we will update the date above. Orders placed earlier are handled under the policy in force when they were placed.</p>
    </LegalPage>
  );
}
