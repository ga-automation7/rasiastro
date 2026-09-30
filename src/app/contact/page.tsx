import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Contact & Grievance Redressal", description: "How to reach Rasi Astro support about an order, a report or your data, and how grievances are handled.", alternates: { canonical: "/contact" } };
export const dynamic = "force-dynamic";

export default function ContactPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Contact & Grievance Redressal" summary="How to reach us, and how complaints are handled.">
      <h2>Operator</h2>
      <table>
        <tbody>
          <tr>
            <th scope="row">Business name</th>
            <td>{b.legalName}</td>
          </tr>
          {b.registration ? (
            <tr>
              <th scope="row">Registration</th>
              <td>{b.registration}</td>
            </tr>
          ) : null}
          {b.gstin ? (
            <tr>
              <th scope="row">GSTIN</th>
              <td>{b.gstin}</td>
            </tr>
          ) : null}
          <tr>
            <th scope="row">Address</th>
            <td>{b.address}</td>
          </tr>
          <tr>
            <th scope="row">Customer support</th>
            <td>
              <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a>
              {b.supportPhone ? ` · ${b.supportPhone}` : null}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Grievance Officer</h2>
      <table>
        <tbody>
          <tr>
            <th scope="row">Name</th>
            <td>{b.grievanceName}</td>
          </tr>
          <tr>
            <th scope="row">Designation</th>
            <td>{b.grievanceDesignation}</td>
          </tr>
          <tr>
            <th scope="row">Email</th>
            <td>
              <a href={`mailto:${b.grievanceEmail}`}>{b.grievanceEmail}</a>
            </td>
          </tr>
          {b.grievancePhone ? (
            <tr>
              <th scope="row">Phone</th>
              <td>{b.grievancePhone}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p>The Grievance Officer also handles privacy requests (access, correction, deletion and consent withdrawal).</p>

      <h2>How complaints are handled</h2>
      <ol>
        <li>Email us from the address used for your order, with your order reference if you have one, and describe the problem.</li>
        <li>We acknowledge your complaint within 48 hours.</li>
        <li>We aim to resolve it within one month of receiving it, and tell you the outcome and the reasons.</li>
      </ol>
      <p>
        If you are not satisfied, you can contact the National Consumer Helpline or file a complaint with a consumer commission under the Consumer Protection Act, 2019. Using our process first does
        not remove those rights.
      </p>

      <h2>Lost your report link?</h2>
      <p>
        You do not need to contact us: use <Link href="/recover">Find my report</Link> and we will email fresh links to the address used for the order.
      </p>
    </LegalPage>
  );
}
