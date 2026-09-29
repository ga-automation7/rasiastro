import Link from "next/link";
import { NAV_LINKS, POLICY_LINKS, SITE } from "@/config/site";
import { Logo } from "./Logo";

export function SiteFooter({ supportEmail }: { supportEmail: string }) {
  return (
    <footer className="mt-20 bg-night-950 text-ivory-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-3 max-w-sm text-sm text-ivory-300">{SITE.tagline} Personalised astrology reports in six languages, calculated from your birth details.</p>
          <p className="mt-4 text-sm">
            Support:{" "}
            <a className="underline decoration-gold-400 underline-offset-4 hover:text-ivory-50" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </p>
        </div>
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
      <div className="border-t border-night-800">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-ivory-300 sm:px-6">
          <p>Astrology is an interpretive tradition, not scientifically validated prediction. Reports are for reflection and are not medical, legal, financial or psychological advice.</p>
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
