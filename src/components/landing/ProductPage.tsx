import Link from "next/link";
import type { LandingCopy } from "@/content/landing";
import { StarField } from "./Celestial";
import { Spark, StarRule } from "./ui";

/**
 * Layout for the public product pages (Indian, Western, Compatibility): breadcrumbs,
 * a clear promise with one action, substantial explanatory sections, questions, and
 * links onward. Server rendered, no client JavaScript of its own.
 */
export function Breadcrumbs({ trail }: { trail: { href: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ivory-300">
      <ol className="flex flex-wrap items-center gap-2">
        {trail.map((t, i) => (
          <li key={t.href} className="flex items-center gap-2">
            {i ? <span aria-hidden="true">/</span> : null}
            {i === trail.length - 1 ? (
              <span aria-current="page" className="text-ivory-100">
                {t.label}
              </span>
            ) : (
              <Link href={t.href} className="underline decoration-ivory-300/40 underline-offset-4 hover:text-ivory-50">
                {t.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ProductHero({ copy, available, aside }: { copy: LandingCopy; available: boolean; aside?: React.ReactNode }) {
  return (
    <section aria-labelledby="page-heading" className="relative isolate overflow-hidden bg-(--color-midnight) text-ivory-100">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_75%_40%,rgb(40_51_108/0.5),transparent_70%),linear-gradient(180deg,#070c17,#0a1523)]" />
        <StarField count={40} seed={11} className="absolute inset-0 h-full w-full opacity-70" />
      </div>
      <div className="container-page grid gap-10 pb-16 pt-10 sm:pb-20 sm:pt-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <Breadcrumbs
            trail={[
              { href: "/", label: "Home" },
              { href: copy.path, label: copy.crumb },
            ]}
          />
          <p className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold-300">{copy.eyebrow}</p>
          <h1 id="page-heading" className="h-hero mt-4 text-ivory-50 lg:text-[clamp(2.8rem,4.4vw,4.4rem)]">
            {copy.headline.map((line, i) => (
              <span key={line} className={`block ${i ? "text-gold-200" : ""}`}>
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-xl text-[1.06rem] leading-relaxed text-ivory-200/90">{copy.lead}</p>
          {available ? (
            <div className="mt-8">
              <Link href={copy.cta.href} className="btn btn-primary w-full px-7 text-[1.02rem] shadow-[0_10px_30px_-10px_rgb(207_75_44/0.65)] sm:w-auto">
                {copy.cta.label}
              </Link>
            </div>
          ) : null}
          <p className="mt-4 max-w-lg text-sm text-ivory-300">{copy.priceNote}</p>
        </div>
        {aside ? <div className="lg:justify-self-end">{aside}</div> : null}
      </div>
    </section>
  );
}

export function ProductSections({ copy }: { copy: LandingCopy }) {
  return (
    <div className="container-page grid gap-14 py-[var(--space-section)] lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <aside className="hidden lg:block">
        <nav aria-label="On this page" className="sticky top-24">
          <p className="eyebrow">On this page</p>
          <ul className="mt-4 space-y-2.5 border-l border-ivory-300 pl-4 text-[0.95rem]">
            {copy.sections.map((s, i) => (
              <li key={s.heading}>
                <a href={`#section-${i + 1}`} className="text-ink-700 hover:text-ink-950">
                  {s.heading}
                </a>
              </li>
            ))}
            <li>
              <a href="#questions" className="text-ink-700 hover:text-ink-950">
                Questions
              </a>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="max-w-3xl space-y-14">
        {copy.sections.map((s, i) => (
          <section key={s.heading} id={`section-${i + 1}`} aria-labelledby={`section-${i + 1}-heading`} className="scroll-mt-24">
            <h2 id={`section-${i + 1}-heading`} className="font-display text-[var(--step-2)] leading-tight text-ink-950">
              {s.heading}
            </h2>
            {s.paragraphs?.map((p) => (
              <p key={p} className="mt-4 text-[1.02rem] leading-[1.75] text-ink-800">
                {p}
              </p>
            ))}
            {s.list ? (
              <ul className="mt-5 space-y-2.5">
                {s.list.map((item) => (
                  <li key={item} className="flex gap-3 text-[0.98rem] leading-relaxed text-ink-800">
                    <Spark className="mt-1.5 h-3 w-3 shrink-0 text-gold-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section id="questions" aria-labelledby="questions-heading" className="scroll-mt-24">
          <StarRule className="mb-10" />
          <h2 id="questions-heading" className="font-display text-[var(--step-2)] leading-tight text-ink-950">
            Questions
          </h2>
          <div className="mt-5 divide-y divide-ivory-300 border-y border-ivory-300">
            {copy.faq.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.02rem] font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="text-xl text-gold-600 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <nav aria-label="Related" className="rounded-2xl border border-ivory-300 bg-ivory-50 p-6 sm:p-7">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-ink-900">Keep exploring</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {copy.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="inline-flex min-h-10 items-center gap-2 text-[0.97rem] font-semibold text-ink-700 underline decoration-ink-700/25 underline-offset-4 hover:decoration-ink-700">
                  {r.label}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
