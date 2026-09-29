import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, businessDetails } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

export default function ContactPage() {
  const b = businessDetails();
  return (
    <LegalPage title="Contact us">
      <p>
        Email: <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a>
      </p>
      <p>
        Business: {b.legalName}
        <br />
        Address: {b.address}
      </p>
      <p>We reply within two working days. For anything about an order, please include your order reference (RA-...). Never send us card, UPI or bank details.</p>
      <p>
        Lost your report link? <Link href="/recover">Request a fresh one</Link>.
      </p>
    </LegalPage>
  );
}
