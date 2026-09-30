import Link from "next/link";
import { REPORT_LANGUAGES } from "@/config/languages";
import { HOME } from "@/content/site-copy";
import { SectionIntro, revealDelay } from "./ui";

/** Two traditions and six languages, as one choice: any tradition in any language. */
export function TraditionsLanguages() {
  const t = HOME.traditions;
  const languages = REPORT_LANGUAGES.filter((l) => l.enabled);
  return (
    <section id="traditions" aria-labelledby="traditions-heading" className="section scroll-mt-16">
      <div className="container-page">
        <SectionIntro id="traditions-heading" eyebrow={t.eyebrow} lines={t.headline} supporting={t.supporting} />

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[t.indian, t.western].map((tr, i) => (
            <article
              key={tr.title}
              className="group relative overflow-hidden rounded-2xl border border-ivory-300 bg-ivory-50 p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-[0_18px_40px_-28px_rgb(10_21_35/0.4)] sm:p-8"
              data-reveal
              style={revealDelay(i * 120)}
            >
              <svg aria-hidden="true" viewBox="0 0 120 120" className="absolute -right-8 -top-8 h-36 w-36 text-gold-400/40 transition-transform duration-700 group-hover:rotate-12" fill="none" stroke="currentColor" strokeWidth="0.6">
                {i === 0 ? (
                  <>
                    <rect x="20" y="20" width="80" height="80" />
                    <path d="M20 40h80M20 80h80M40 20v80M80 20v80" />
                  </>
                ) : (
                  <>
                    <circle cx="60" cy="60" r="42" />
                    <circle cx="60" cy="60" r="28" />
                    <path d="M18 60h84M60 18v84" />
                  </>
                )}
              </svg>
              <h3 className="font-display text-[1.45rem] text-ink-950">{tr.title}</h3>
              <p className="mt-3 max-w-md text-[0.98rem] leading-relaxed text-ink-800">{tr.body}</p>
              <Link href={tr.href} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700">
                {tr.link}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Report languages">
          {languages.map((l, i) => (
            <li
              key={l.code}
              className="flex flex-col justify-between gap-5 rounded-2xl border border-ivory-300 bg-ivory-50 px-5 py-4 transition-colors duration-300 hover:border-gold-300"
              data-reveal="rise"
              style={revealDelay(i * 60)}
            >
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">{l.englishName}</span>
              <span lang={l.htmlLang} className="script font-display text-[clamp(1.4rem,1.1rem+1vw,1.9rem)] leading-snug text-ink-900">
                {l.nativeName}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-[0.95rem] leading-relaxed text-muted" data-reveal>
          {t.languagesNote}
        </p>
      </div>
    </section>
  );
}
