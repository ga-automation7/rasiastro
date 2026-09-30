import Link from "next/link";
import { NAV_LINKS } from "@/config/site";
import { Logo } from "./Logo";

/**
 * Site header. The mobile menu is a native <details> element, so it works with the
 * keyboard and without JavaScript.
 */
export function SiteHeader({ showOrderButton }: { showOrderButton: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-(--color-midnight) text-ivory-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-ink-900 focus:px-3 focus:py-2 focus:text-ivory-50"
      >
        Skip to content
      </a>
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="Rasi Astro home" className="whitespace-nowrap">
          <Logo tone="light" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-[0.92rem] font-medium text-ivory-300 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors duration-150 hover:text-ivory-50">
              {l.label}
            </Link>
          ))}
          <Link href="/recover" className="transition-colors duration-150 hover:text-ivory-50">
            Find my report
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {showOrderButton ? (
            <Link href="/start" className="btn btn-primary hidden min-h-10 whitespace-nowrap px-4 py-2 text-sm sm:inline-flex">
              Get my report
            </Link>
          ) : null}
          <details className="group relative lg:hidden">
            <summary className="btn btn-ghost min-h-10 list-none border-white/25 px-3 py-2 text-sm text-ivory-100 [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav aria-label="Main" className="card absolute right-0 top-full z-40 mt-2 w-64 p-2 shadow-xl">
              <ul>
                {showOrderButton ? (
                  <li className="sm:hidden">
                    <Link href="/start" className="block rounded-md bg-vermilion-600 px-3 py-2.5 text-[15px] font-semibold text-white">
                      Get my report
                    </Link>
                  </li>
                ) : null}
                {[...NAV_LINKS, { href: "/recover", label: "Find my report" }].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="block rounded-md px-3 py-2.5 text-[15px] text-ink-900 hover:bg-ivory-200">
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
