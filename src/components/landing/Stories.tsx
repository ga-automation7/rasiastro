import Link from "next/link";
import { REGIONAL_TERMS } from "@/config/regional";
import { COPY, PRICE } from "@/content/site-copy";
import { Ornament } from "../site/Ornament";

/** Editorial homepage sections. Copy lives in src/content/site-copy.ts. */

function Headline({ lines, id, tone = "dark" }: { lines: readonly string[]; id: string; tone?: "dark" | "light" }) {
  return (
    <h2 id={id} className={`h-section ${tone === "dark" ? "text-ink-950" : "text-ivory-50"}`}>
      <span className="block">{lines[0]}</span>
      {lines[1] ? <span className={`block ${tone === "dark" ? "text-ink-700" : "text-gold-300"}`}>{lines[1]}</span> : null}
    </h2>
  );
}

export function CampaignBand() {
  return (
    <section aria-label="Our approach" className="bg-ink-950 text-ivory-100">
      <div className="container-page py-10 sm:py-12" data-reveal>
        <p className="font-display text-[clamp(1.35rem,1rem+1.6vw,2.2rem)] leading-tight">
          {COPY.campaign.map((line, i) => (
            <span key={line} className={`mr-3 inline-block ${i === 1 ? "text-gold-300" : ""}`}>
              {line}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

export function PersonalSection({ available }: { available: boolean }) {
  const c = COPY.personal;
  return (
    <section id="personal" aria-labelledby="personal-heading" className="section scroll-mt-16">
      <div className="container-page">
        <div className="max-w-3xl" data-reveal>
          <p className="eyebrow">{c.eyebrow}</p>
          <div className="mt-3">
            <Headline id="personal-heading" lines={c.headline} />
          </div>
          <p className="lede mt-5 max-w-2xl">{c.supporting}</p>
        </div>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ivory-300 bg-ivory-300 sm:grid-cols-2 lg:grid-cols-5">
          {c.themes.map((t, i) => (
            <li key={t.title} className="bg-ivory-50 p-6" data-reveal style={{ "--reveal-delay": `${i * 60}ms` } as React.CSSProperties}>
              <span className="font-display text-sm text-gold-600" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="h-card mt-2 text-ink-900">{t.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{t.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-6 rounded-xl border border-gold-300 bg-gold-100/60 p-6 sm:p-8 md:grid-cols-[1.2fr_1fr] md:items-center" data-reveal>
          <div>
            <h3 className="font-display text-2xl font-semibold text-ink-900">{c.addOn.title}</h3>
            <p className="mt-1 text-lg font-semibold text-vermilion-700">{c.addOn.price}</p>
            <p className="mt-2 text-muted">{c.addOn.body}</p>
            <p className="mt-2 text-sm text-muted">{c.addOn.note}</p>
          </div>
          {available ? (
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
              <Link href="/start" className="btn btn-primary">
                Explore my chart · {PRICE.personal}
              </Link>
              <Link href="/start?questions=1" className="btn btn-outline">
                With three questions · {PRICE.personalWithQuestions}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function IncludesList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[0.98rem] leading-relaxed text-ink-900">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1.5 h-3.5 w-3.5 shrink-0 text-gold-500">
            <path fill="currentColor" d="M8 0 9.4 6.6 16 8 9.4 9.4 8 16 6.6 9.4 0 8 6.6 6.6Z" />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function TraditionsSection() {
  const { indian, western } = COPY;
  return (
    <section aria-label="Indian and Western reports" className="border-y border-ivory-300 bg-ivory-50">
      <div className="container-page grid divide-y divide-ivory-300 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <article aria-labelledby="indian-heading" className="py-14 sm:py-16 lg:pr-12" data-reveal>
          <p className="eyebrow">{indian.eyebrow}</p>
          <div className="mt-3">
            <Headline id="indian-heading" lines={indian.headline} />
          </div>
          <p className="lede mt-5">{indian.supporting}</p>
          <p className="mt-4 text-[0.98rem] text-ink-800">{indian.detail}</p>
          <IncludesList items={indian.includes} />
          <p className="mt-6 border-l-2 border-gold-400 pl-4 text-sm text-muted">{indian.timeNote}</p>
        </article>
        <article aria-labelledby="western-heading" className="py-14 sm:py-16 lg:pl-12" data-reveal style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
          <p className="eyebrow">{western.eyebrow}</p>
          <div className="mt-3">
            <Headline id="western-heading" lines={western.headline} />
          </div>
          <p className="lede mt-5">{western.supporting}</p>
          <IncludesList items={western.includes} />
        </article>
      </div>
    </section>
  );
}

export function RegionalSection() {
  const c = COPY.regional;
  return (
    <section aria-labelledby="regional-heading" className="section">
      <div className="container-page">
        <div className="max-w-3xl" data-reveal>
          <p className="eyebrow">{c.eyebrow}</p>
          <div className="mt-3">
            <Headline id="regional-heading" lines={c.headline} />
          </div>
          <p className="lede mt-5">{c.supporting}</p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {REGIONAL_TERMS.map((t, i) => (
            <li key={t.language} className="card flex flex-col p-5" data-reveal style={{ "--reveal-delay": `${i * 50}ms` } as React.CSSProperties}>
              <p className="text-sm font-semibold text-muted">
                {t.languageName} · <span lang={t.language}>{t.nativeName}</span>
              </p>
              <p lang={t.language} className="script mt-3 font-display text-[1.9rem] leading-snug text-ink-900">
                {t.chartTermNative}
              </p>
              <p className="text-[0.95rem] text-ink-800">{t.chartTerm}</p>
              <p className={`mt-auto pt-4 text-xs font-semibold ${t.perspectiveIncluded ? "text-teal-700" : "text-muted"}`}>
                {t.perspectiveIncluded ? "Regional perspective included" : "Report language (perspective not yet included)"}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid gap-4 text-[0.97rem] leading-relaxed text-ink-800 md:grid-cols-3" data-reveal>
          <p>{c.languagesNote}</p>
          <p>{c.perspectivesNote}</p>
          <p className="text-muted">
            {c.notYet} {c.method}
          </p>
        </div>
      </div>
    </section>
  );
}

export function TechnologySection() {
  const c = COPY.technology;
  return (
    <section aria-labelledby="tech-heading" className="section bg-ivory-200/60">
      <div className="container-page grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div data-reveal>
          <Ornament className="mb-6" />
          <Headline id="tech-heading" lines={c.headline} />
          <p className="lede mt-6">{c.body}</p>
          <p className="mt-4 border-l-2 border-gold-400 pl-4 text-[0.98rem] text-ink-800">{c.notes}</p>
        </div>
        <ul className="space-y-4">
          {c.points.map((p, i) => (
            <li key={p.title} className="card p-6" data-reveal style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}>
              <h3 className="h-card text-ink-900">{p.title}</h3>
              <p className="mt-2 text-[0.96rem] leading-relaxed text-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ReportSection() {
  const c = COPY.report;
  return (
    <section aria-labelledby="report-heading" className="section">
      <div className="container-page">
        <div className="max-w-3xl" data-reveal>
          <h2 id="report-heading" className="h-section text-ink-950">
            {c.headline}
          </h2>
          <p className="lede mt-5">{c.supporting}</p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {c.features.map((f, i) => (
            <li key={f.title} className="border-t-2 border-gold-400 pt-4" data-reveal style={{ "--reveal-delay": `${i * 50}ms` } as React.CSSProperties}>
              <h3 className="h-card text-ink-900">{f.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
