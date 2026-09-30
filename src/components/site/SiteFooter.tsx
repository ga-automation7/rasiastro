import Link from "next/link";
import { NAV_LINKS, POLICY_LINKS, REPORT_LINKS } from "@/config/site";
import { COPY } from "@/content/site-copy";
import { Logo } from "./Logo";

export interface BusinessDetails {
  legalName: string | null;
  address: string | null;
  registration: string | null;
  gstin: string | null;
  supportEmail: string;
  supportPhone: string | null;
}

export function SiteFooter({ business }: { business: BusinessDetails }) {
  return (
    <footer className="bg-ink-950 text-ivory-200">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm font-display text-lg leading-snug text-ivory-100">
            {COPY.campaign.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="mt-5 text-sm">
            Support:{" "}
            <a className="underline decoration-gold-400 underline-offset-4 hover:text-ivory-50" href={`mailto:${business.supportEmail}`}>
              {business.supportEmail}
            </a>
            {business.supportPhone ? <span className="block">Phone: {business.supportPhone}</span> : null}
          </p>
        </div>
        <nav aria-label="Reports">
          <p className="mb-3 text-sm font-semibold text-ivory-50">Reports</p>
          <ul className="space-y-2 text-sm">
            {REPORT_LINKS.map((l) => (
              <li key={l.href}>
                <Link className="hover:text-ivory-50" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Site">
          <p className="mb-3 text-sm font-semibold text-ivory-50">Explore</p>
          <ul className="space-y-2 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link className="hover:text-ivory-50" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link className="hover:text-ivory-50" href="/recover">
                Find my report
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Policies">
          <p className="mb-3 text-sm font-semibold text-ivory-50">Policies</p>
          <ul className="space-y-2 text-sm">
            {POLICY_LINKS.map((l) => (
              <li key={l.href}>
                <Link className="hover:text-ivory-50" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-ink-800">
        <div className="container-page space-y-2 py-6 text-xs leading-relaxed text-ivory-300">
          <p className="text-ivory-200">{COPY.disclaimer}</p>
          {business.legalName ? (
            <p>
              Operated by {business.legalName}
              {business.registration ? ` (${business.registration})` : ""}
              {business.address ? `, ${business.address}` : ""}
              {business.gstin ? ` · GSTIN ${business.gstin}` : ""}.
            </p>
          ) : null}
          <p>
            Birthplace data from{" "}
            <a className="underline" href="https://www.geonames.org/" rel="noopener noreferrer">
              GeoNames
            </a>{" "}
            (CC BY 4.0). Planetary positions calculated with Astronomy Engine (MIT licence).
          </p>
          <p>© {new Date().getFullYear()} Rasi Astro · rasiastro.com</p>
        </div>
      </div>
    </footer>
  );
}
