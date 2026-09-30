import Link from "next/link";
import { POLICY_LINKS } from "@/config/site";
import { getEnv } from "@/server/config/env";
import { PROVIDER_NAMES, paymentPartnerIds } from "@/server/payments/config";

/**
 * Shared pieces for the five policy pages. Every operational fact (operator details,
 * retention periods, delivery and refund timings) comes from configuration, so the
 * policies always describe what the running system actually does.
 * Review record: docs/LEGAL_READINESS.md.
 */
export const POLICY_UPDATED = "29 September 2026";

const MISSING = "[to be added by the owner before launch]";

export function businessDetails() {
  const env = getEnv();
  return {
    legalName: env.BUSINESS_LEGAL_NAME ?? MISSING,
    address: env.BUSINESS_ADDRESS ?? MISSING,
    registration: env.BUSINESS_REGISTRATION ?? null,
    gstin: env.BUSINESS_GSTIN ?? null,
    supportEmail: env.SUPPORT_EMAIL,
    supportPhone: env.SUPPORT_PHONE ?? MISSING,
    grievanceName: env.GRIEVANCE_OFFICER_NAME ?? MISSING,
    grievanceDesignation: env.GRIEVANCE_OFFICER_DESIGNATION ?? "Grievance Officer",
    grievanceEmail: env.GRIEVANCE_OFFICER_EMAIL ?? env.SUPPORT_EMAIL,
    grievancePhone: env.GRIEVANCE_OFFICER_PHONE ?? env.SUPPORT_PHONE ?? MISSING,
    unpaidDays: env.RETENTION_UNPAID_DAYS,
    reportDays: env.RETENTION_REPORT_DAYS,
    linkDays: env.ACCESS_LINK_TTL_DAYS,
    typicalMinutes: env.DELIVERY_TYPICAL_MINUTES,
    maxHours: env.DELIVERY_MAX_HOURS,
    refundDays: env.REFUND_INITIATION_WORKING_DAYS,
    /** Payment providers in use (new checkouts first). */
    paymentPartnerIds: paymentPartnerIds(env),
    /** e.g. "UroPay" or "UroPay and Cashfree Payments". */
    paymentPartners: paymentPartnerIds(env).map((id) => PROVIDER_NAMES[id]).join(" and "),
  };
}

export type BusinessDetails = ReturnType<typeof businessDetails>;

export function OperatorBlock({ b }: { b: BusinessDetails }) {
  return (
    <p>
      Rasi Astro (rasiastro.com) is operated by <strong>{b.legalName}</strong>
      {b.registration ? `, ${b.registration}` : ""}, {b.address}
      {b.gstin ? `. GSTIN: ${b.gstin}` : ""}. Contact: <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a>, phone {b.supportPhone}.
    </p>
  );
}

export function LegalPage({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <nav aria-label="Policies" className="mb-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {POLICY_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-ink-700 underline-offset-2 hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
      <article className="prose-legal">
        <p className="eyebrow">Rasi Astro</p>
        <h1 className="h-section mt-2 text-ink-950">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {POLICY_UPDATED}</p>
        <p className="lede mt-6">{summary}</p>
        <div className="mt-6 text-[15.5px]">{children}</div>
      </article>
    </div>
  );
}
