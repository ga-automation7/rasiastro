import Link from "next/link";
import { NAV_LINKS } from "@/config/site";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="border-b border-ivory-300/70 bg-ivory-100/95 backdrop-blur supports-[backdrop-filter]:bg-ivory-100/80 sticky top-0 z-30">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-night-900 focus:px-3 focus:py-2 focus:text-ivory-50">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Rasi Astro home">
          <span className="whitespace-nowrap"><Logo /></span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-night-800">
              {l.label}
            </Link>
          ))}
          <Link href="/recover" className="hover:text-night-800">
            Find my report
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/start" className="btn btn-dark hidden whitespace-nowrap px-4 py-2 text-sm sm:inline-flex">
            Get your report
          </Link>
          <details className="relative md:hidden">
            <summary className="btn btn-ghost list-none px-3 py-2 text-sm text-night-800 [&::-webkit-details-marker]:hidden">Menu</summary>
            <nav aria-label="Main" className="card absolute right-0 top-full z-40 mt-2 w-56 p-2 shadow-lg">
              <ul>
                <li className="sm:hidden">
                  <Link href="/start" className="block rounded-md bg-night-800 px-3 py-2.5 text-[15px] font-semibold text-ivory-50">
                    Get your report
                  </Link>
                </li>
                {[...NAV_LINKS, { href: "/recover", label: "Find my report" }].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="block rounded-md px-3 py-2.5 text-[15px] hover:bg-ivory-200">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
