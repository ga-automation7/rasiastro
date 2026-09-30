import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, OperatorBlock, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const b = businessDetails();
  return (
    <LegalPage
      title="Privacy Policy"
      summary="What we collect to prepare your report, why, who helps us process it, how long we keep it, and how to exercise your rights. There are no customer accounts, and we do not use advertising or analytics trackers."
    >
      <h2>Who is responsible</h2>
      <OperatorBlock b={b} />
      <p>
        For privacy questions and requests, write to <a href={`mailto:${b.grievanceEmail}`}>{b.grievanceEmail}</a> ({b.grievanceName}, {b.grievanceDesignation}). See{" "}
        <Link href="/contact">Contact &amp; Grievance Redressal</Link>.
      </p>

      <h2>What we collect and why</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Information</th>
            <th scope="col">Why we need it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name, date, time (and how sure you are of it) and place of birth of each person in the report</td>
            <td>To calculate the chart and put the name on the report. The birthplace gives the coordinates and the historical time zone.</td>
          </tr>
          <tr>
            <td>Optional details: chart details you already know, notes about a person, shared context (compatibility), and three questions if you buy them</td>
            <td>To take them into account in the written interpretation. They are treated as information you shared, not as chart facts.</td>
          </tr>
          <tr>
            <td>Your email address</td>
            <td>To send your private report link and, if you ask, a fresh link. No newsletters or marketing.</td>
          </tr>
          <tr>
            <td>Your mobile number</td>
            <td>Our payment partner requires it to process the payment. We do not call, message or market to it.</td>
          </tr>
          <tr>
            <td>Payment references and status from our payment partner ({b.paymentPartners})</td>
            <td>To confirm payment, prevent fraud, handle refunds and keep financial records. We never receive your card, UPI or bank credentials.</td>
          </tr>
          {b.paymentPartnerIds.includes("urorelay") ? (
            <tr>
              <td>For UPI payments: the UPI reference number you enter, and the amount and reference of the matching credit in our bank account</td>
              <td>To match your payment to your order. We do not keep the payer name or UPI ID from our bank&apos;s message.</td>
            </tr>
          ) : null}
          <tr>
            <td>Confirmations you give (consent, 18 or older, permission to share another person&apos;s details) with their date and time</td>
            <td>To show that the order was placed lawfully.</td>
          </tr>
          <tr>
            <td>Security data: counters keyed by a one-way code made from your IP address or email, and short technical logs that exclude birth details and report text</td>
            <td>To prevent abuse (for example, repeated requests) and to keep the service running.</td>
          </tr>
        </tbody>
      </table>
      <p>We also store what we produce for you: the calculated charts, the written interpretation and the PDF.</p>

      <h2>How your report is produced</h2>
      <p>
        Our own software calculates the chart. An AI service then writes the interpretation from the calculated chart data, your chosen tradition and language, and any notes or questions you add. We
        do not send it anyone&apos;s name, your email address, mobile number, birthplace or payment details; names that appear in your notes are replaced with placeholders before sending. No person
        reviews reports before delivery.
      </p>

      <h2>Who processes data for us</h2>
      <p>These service providers process data on our behalf, only to run the service:</p>
      <ul>
        <li>Supabase: database and private report file storage.</li>
        <li>Vercel: website hosting and short-lived technical logs.</li>
        {b.paymentPartnerIds.includes("urorelay") ? (
          <li>
            UroPay (UroRelay): creates the UPI QR code for your order and confirms payments from the UPI credit messages our bank sends us. Your payment goes directly from your UPI app to our
            bank account. UroPay receives your email address, your order reference and the UPI reference number you enter.
          </li>
        ) : null}
        {b.paymentPartnerIds.includes("uropay") ? (
          <li>
            UroPay: payment orders and its secure payment page (India). UroPay passes each payment to one of its partner payment gateways, which process it under their own policies.
          </li>
        ) : null}
        {b.paymentPartnerIds.includes("cashfree") ? <li>Cashfree Payments: payment processing (India).</li> : null}
        <li>OpenAI: writing the interpretation from the data described above. We ask it not to store responses; its API terms allow it to keep requests for a limited period to detect abuse.</li>
        <li>Resend: sending your report and recovery emails (your email address and the private link).</li>
        <li>Inngest: running background report jobs. It receives only order identifiers, not birth details.</li>
      </ul>
      <p>
        Some of these providers process data outside India, including in the United States. We use them under their data-processing terms and send each only what it needs. We do not sell personal data
        or share it for advertising.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Unpaid orders are deleted automatically {b.unpaidDays} days after they were started.</li>
        <li>
          For paid orders, birth details, notes, questions, shared context, charts, the report and the PDF are erased automatically {b.reportDays} days after payment, or earlier if you ask. Your email
          address and mobile number are erased at the same time.
        </li>
        <li>
          We keep the order reference, product, amounts, dates and payment references for as long as tax and accounting law requires. These records cannot be deleted on request while that duty applies.
        </li>
        <li>Report links expire after {b.linkDays} days. While we still hold your report you can request a fresh link at any time.</li>
        <li>Deleted data may remain in encrypted provider backups for a limited period until those backups expire; it is not used from there.</li>
      </ul>

      <h2>Cookies and tracking</h2>
      <p>
        We set one essential, secure cookie for each order you open, so that your browser can show that order after you used its private link. It expires with the link. We use no analytics,
        advertising or social-media trackers. The payment page is operated by our payment partner ({b.paymentPartners}) under its own policies.
      </p>

      <h2>Information about another person</h2>
      <p>
        If you order a report about someone else, or a compatibility report, you confirm that you have their permission to share their details and any notes you add about them. We use that
        information only for the report you ordered, and we do not contact them. They may ask us about, correct or delete their information in the same way as you.
      </p>

      <h2>Age</h2>
      <p>
        Reports are for adults. The person ordering, and everyone a report is about, must be 18 or older. We do not knowingly process children&apos;s data; if we learn that a report concerns a child,
        we delete it.
      </p>

      <h2>Your rights and how to use them</h2>
      <ul>
        <li>Ask what we hold about you and receive a copy.</li>
        <li>Ask us to correct or update your details. A report that has already been written reflects the details given when it was ordered.</li>
        <li>Ask us to delete your data (subject to the financial records described above).</li>
        <li>Withdraw your consent. This stops further processing; it does not undo processing already done, and withdrawing before your report is ready means we cannot complete it.</li>
        <li>Nominate someone to exercise these rights for you.</li>
        <li>Complain to us, and escalate if you are not satisfied.</li>
      </ul>
      <p>
        Write to <a href={`mailto:${b.grievanceEmail}`}>{b.grievanceEmail}</a> from the email address used for the order, with your order reference if you have it. Because there are no accounts, we
        confirm requests through that email address. We acknowledge requests within 48 hours and aim to resolve them within one month.
      </p>

      <h2>Security</h2>
      <p>
        Connections are encrypted. Report files are private and downloaded through short-lived authorised links. Each report link contains a long random code, and we store only a one-way
        fingerprint of it. Anyone with your link can open the report, so please do not forward it. If a breach affecting your data occurs, we will inform you as the law requires.
      </p>

      <h2>Changes</h2>
      <p>We will update this page when our practices change and show the date above. Significant changes will be highlighted on this page.</p>
    </LegalPage>
  );
}
