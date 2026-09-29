import { getEnv } from "@/server/config/env";

export const POLICY_UPDATED = "29 September 2026";

export function businessDetails() {
  const env = getEnv();
  const missing = "[to be completed by the owner]";
  return {
    legalName: env.BUSINESS_LEGAL_NAME ?? missing,
    address: env.BUSINESS_ADDRESS ?? missing,
    supportEmail: env.SUPPORT_EMAIL,
    grievanceOfficer: env.GRIEVANCE_OFFICER_NAME ?? missing,
    unpaidDays: env.RETENTION_UNPAID_DAYS,
    reportDays: env.RETENTION_REPORT_DAYS,
    linkDays: env.ACCESS_LINK_TTL_DAYS,
  };
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="prose-legal mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Rasi Astro</p>
      <h1 className="mt-2 text-3xl font-semibold text-night-900 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {POLICY_UPDATED}</p>
      <div className="mt-8 text-[15.5px]">{children}</div>
    </article>
  );
}
