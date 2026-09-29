import Link from "next/link";
import { NAV_LINKS } from "@/config/site";
import { Logo } from "./Logo";

/**
 * Site header. The mobile menu is a native <details> element, so it works with the
 * keyboard and without JavaScript.
 */
export function SiteHeader({ showOrderButton }: { showOrderButton: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ivory-300/70 bg-ivory-100/90 backdrop-blur supports-[backdrop-filter]:bg-ivory-100/75">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-ink-900 focus:px-3 focus:py-2 focus:text-ivory-50"
      >
        Skip to content
      </a>
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="Rasi Astro home" className="whitespace-nowrap">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-[0.94rem] font-medium text-muted lg:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors duration-150 hover:text-ink-900">
              {l.label}
            </Link>
          ))}
          <Link href="/recover" className="transition-colors duration-150 hover:text-ink-900">
            Find my report
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {showOrderButton ? (
            <Link href="/start" className="btn btn-primary hidden min-h-10 whitespace-nowrap px-4 py-2 text-sm sm:inline-flex">
              Explore my chart
            </Link>
          ) : null}
          <details className="group relative lg:hidden">
            <summary className="btn btn-ghost min-h-10 list-none px-3 py-2 text-sm text-ink-800 [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav aria-label="Main" className="card absolute right-0 top-full z-40 mt-2 w-64 p-2 shadow-xl">
              <ul>
                {showOrderButton ? (
                  <li className="sm:hidden">
                    <Link href="/start" className="block rounded-md bg-vermilion-600 px-3 py-2.5 text-[15px] font-semibold text-white">
                      Explore my chart
                    </Link>
                  </li>
                ) : null}
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
