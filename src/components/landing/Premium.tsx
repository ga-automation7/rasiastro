import Link from "next/link";
import { REPORT_LANGUAGES } from "@/config/languages";
import { COPY, HOME, PRICE } from "@/content/site-copy";
import { getReportPreview } from "@/server/reports/preview";
import { StarField } from "./Celestial";

/**
 * The premium homepage sections. Copy lives in src/content/site-copy.ts (HOME); every
 * claim maps to docs/CLAIMS.md. Motion comes from [data-reveal] (see globals.css).
 */
const d = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties;

function MaskHeading({ id, lines, className, as: Tag = "h2", accent }: { id?: string; lines: readonly string[]; className: string; as?: "h2" | "h3"; accent: string }) {
  return (
    <Tag id={id} className={className} data-reveal="mask">
      {lines.map((line, i) => (
        <span key={line} className="mask-line" style={{ "--line": i } as React.CSSProperties}>
          <span className={i ? accent : undefined}>{line}</span>
        </span>
      ))}
    </Tag>
  );
}

function Spark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
      <path fill="currentColor" d="M8 0 9.4 6.6 16 8 9.4 9.4 8 16 6.6 9.4 0 8 6.6 6.6Z" />
    </svg>
  );
}

/* ---------------------------------------------------------------- engine */

export function EngineSection() {
  const e = HOME.engine;
  return (
    <section id="how-it-works" aria-labelledby="engine-heading" className="relative isolate scroll-mt-16 overflow-hidden bg-(--color-midnight) text-ivory-100">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_45%,rgb(40_51_108/0.3),transparent_70%),linear-gradient(180deg,#070c17,#0a1426)]" />
        <StarField count={40} seed={21} className="absolute inset-0 h-full w-full opacity-60" />
      </div>
      <div className="container-page py-[var(--space-section)]">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <p className="eyebrow !text-gold-300" data-reveal>
              {e.eyebrow}
            </p>
            <MaskHeading id="engine-heading" lines={e.headline} className="h-section mt-4 text-ivory-50 lg:text-[clamp(2.6rem,4vw,3.8rem)]" accent="text-gold-300" />
          </div>
          <div className="space-y-4 text-[1.04rem] leading-relaxed text-ivory-200/90" data-reveal style={d(120)}>
            {e.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>

        <p className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-gold-200" data-reveal style={d(80)}>
          {e.badge.map((b, i) => (
            <span key={b} className="flex items-center gap-3">
              {i ? (
                <span aria-hidden="true" className="text-gold-400/70">
                  ×
                </span>
              ) : null}
              <span className="rounded-full border border-gold-300/30 bg-white/[0.03] px-3 py-1.5">{b}</span>
            </span>
          ))}
        </p>

        <div className="relative mt-14" data-reveal>
          {/* A gold line drawn through the three steps as they come into view. */}
          <svg aria-hidden="true" viewBox="0 0 1000 4" preserveAspectRatio="none" className="absolute left-0 right-0 top-[1.35rem] hidden h-1 w-full md:block">
            <path className="draw-line" pathLength={1} d="M20 2 H980" stroke="var(--color-gold-400)" strokeOpacity="0.5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <ol className="relative grid gap-6 md:grid-cols-3 md:gap-8">
            {e.steps.map((s, i) => (
              <li key={s.n} className="group" data-reveal style={d(150 + i * 140)}>
                <span className="relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold-300/50 bg-(--color-midnight) font-display text-[0.95rem] text-gold-200 transition-colors duration-300 group-hover:border-gold-200">
                  {s.n}
                </span>
                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition-colors duration-300 group-hover:border-gold-300/30 group-hover:bg-white/[0.04]">
                  <h3 className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-gold-200">{s.title}</h3>
                  <p className="mt-3 text-[0.98rem] leading-relaxed text-ivory-200/85">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.08] pt-8 text-sm text-ivory-300 sm:flex-row sm:items-center sm:justify-between" data-reveal>
          <p className="inline-flex items-center gap-2 font-semibold tracking-wide text-gold-200">
            <Spark className="h-3 w-3 text-gold-300" />
            {e.poweredBy}
          </p>
          <p>{e.guardrail}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- what you receive */

function PageHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#e4d4b3] pb-[0.6em] text-[0.62em] font-semibold uppercase tracking-[0.18em] text-[#7a561a]">
      <span>Rasi Astro</span>
      <span>{label}</span>
    </div>
  );
}

function Lines({ n, last = 0.6 }: { n: number; last?: number }) {
  return (
    <div aria-hidden="true" className="mt-[0.9em] space-y-[0.55em]">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-[0.42em] rounded-full bg-[#e9e1cf]" style={{ width: i === n - 1 ? `${last * 100}%` : "100%" }} />
      ))}
    </div>
  );
}

export async function ReceiveSection({ available }: { available: boolean }) {
  const r = HOME.receive;
  const p = await getReportPreview();
  const pages: { key: string; label: string; content: React.ReactNode }[] = [
    {
      key: "cover",
      label: "Cover",
      content: (
        <div className="flex h-full flex-col justify-between bg-[linear-gradient(160deg,#fffdf8_60%,#f6eedd)] p-[1.6em]">
          <div>
            <p className="text-[0.62em] font-semibold uppercase tracking-[0.2em] text-[#7a561a]">Rasi Astro</p>
            <p className="mt-[2.2em] font-display text-[1.55em] leading-[1.12] text-[#1c2552]">{p.title}</p>
            <p className="mt-[0.7em] text-[0.95em] font-semibold text-[#131b3b]">{p.subject}</p>
            <div className="mt-[1.2em] h-px bg-gradient-to-r from-[#b8893a] to-transparent" />
          </div>
          <div className="text-[0.62em] text-[#5c6079]">
            <p>Order reference {p.reference}</p>
            <p className="mt-[0.3em] uppercase tracking-[0.14em] text-[#7a561a]">Sample report</p>
          </div>
        </div>
      ),
    },
    {
      key: "chart",
      label: "Your Rasi chart",
      content: (
        <div className="p-[1.4em]">
          <PageHeader label="Chart" />
          <p className="mt-[0.8em] font-display text-[0.95em] text-[#1c2552]">Your chart at a glance</p>
          <div className="report-web mx-auto mt-[0.6em] w-[86%] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: p.chartSvg }} />
          <dl className="mt-[0.6em] divide-y divide-[#efe6d3] text-[0.62em]">
            {p.glance.map((g) => (
              <div key={g.label} className="flex justify-between gap-2 py-[0.3em]">
                <dt className="font-semibold text-[#1c2552]">{g.label}</dt>
                <dd className="text-right text-[#3b3f58]">{g.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ),
    },
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="p-[1.4em]">
          <PageHeader label="Overview" />
          <p className="mt-[1.1em] font-display text-[1.02em] leading-snug text-[#1c2552]">{p.overview.headline}</p>
          <p className="mt-[0.8em] text-[0.7em] leading-[1.65] text-[#3b3f58]">{p.overview.excerpt}</p>
          <Lines n={5} />
        </div>
      ),
    },
    {
      key: "life",
      label: "Career and relationships",
      content: (
        <div className="p-[1.4em]">
          <PageHeader label="Life areas" />
          <p className="mt-[1.1em] font-display text-[0.98em] text-[#1c2552]">Career and work</p>
          <p className="mt-[0.5em] text-[0.68em] leading-[1.65] text-[#3b3f58]">{p.career}</p>
          <p className="mt-[1.1em] font-display text-[0.98em] text-[#1c2552]">Relationships</p>
          <p className="mt-[0.5em] text-[0.68em] leading-[1.65] text-[#3b3f58]">{p.relationships}</p>
          <Lines n={3} last={0.45} />
        </div>
      ),
    },
    {
      key: "ahead",
      label: "Looking ahead",
      content: (
        <div className="p-[1.4em]">
          <PageHeader label="Periods" />
          <p className="mt-[1.1em] font-display text-[1.02em] text-[#1c2552]">Looking ahead</p>
          <div className="mt-[0.8em] rounded-[0.4em] border border-[#e4d4b3] bg-[#f6eedd] p-[0.8em]">
            <p className="text-[0.62em] font-semibold uppercase tracking-[0.14em] text-[#7a561a]">{p.ahead.dates}</p>
            <p className="mt-[0.2em] font-display text-[0.92em] text-[#1c2552]">{p.ahead.title}</p>
            <p className="mt-[0.4em] text-[0.66em] leading-[1.6] text-[#3b3f58]">{p.ahead.excerpt}</p>
          </div>
          <Lines n={4} />
        </div>
      ),
    },
  ];
  // Desktop fan: gentle rotations and offsets, the chart page in front.
  const fan = ["lg:-rotate-[7deg] lg:translate-y-8", "lg:-rotate-[3deg] lg:translate-y-2", "lg:rotate-0 lg:-translate-y-2 lg:z-10", "lg:rotate-[3deg] lg:translate-y-2", "lg:rotate-[7deg] lg:translate-y-8"];
  const order = [0, 2, 1, 3, 4];
  return (
    <section id="report" aria-labelledby="receive-heading" className="section scroll-mt-16 overflow-hidden">
      <style>{p.chartCss}</style>
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow" data-reveal>
            {r.eyebrow}
          </p>
          <MaskHeading id="receive-heading" lines={r.headline} className="h-section mt-4 text-ink-950" accent="text-ink-700" />
          <p className="lede mx-auto mt-5 max-w-xl" data-reveal style={d(120)}>
            {r.supporting}
          </p>
        </div>

        <div className="relative mt-14">
          <div aria-hidden="true" className="absolute inset-x-[10%] top-[18%] -z-10 h-2/3 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(227_196_134/0.35),transparent_70%)] blur-2xl" />
          {/* Phones and tablets: swipe through the pages. Desktop: a fanned stack. */}
          <ul
            className="-mx-(--gutter) flex snap-x snap-mandatory gap-4 overflow-x-auto px-(--gutter) pb-10 pt-2 [scrollbar-width:none] lg:mx-0 lg:justify-center lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-10"
            aria-label="Sample report pages"
          >
            {order.map((idx, pos) => {
              const page = pages[idx]!;
              return (
                <li
                  key={page.key}
                  className={`w-[70vw] max-w-[17rem] shrink-0 snap-center text-[clamp(11px,3.4vw,14px)] sm:w-[15rem] lg:-mx-5 lg:w-[16.5rem] lg:text-[13.5px] lg:transition-transform lg:duration-500 lg:hover:z-20 lg:hover:-translate-y-4 lg:hover:rotate-0 ${fan[pos]}`}
                >
                  <div data-reveal="rise" style={d(pos * 110)}>
                    <figure className="doc-page">
                      {page.content}
                    </figure>
                    <figcaption className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted">{page.label}</figcaption>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-center" data-reveal>
          {available ? (
            <Link href="/start" className="btn btn-primary px-7">
              {r.cta}
            </Link>
          ) : null}
          <p className="text-sm font-medium text-ink-800">{r.note}</p>
          <p className="max-w-lg text-xs text-muted">{r.sampleNote}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- includes */

const GLYPHS: Record<string, React.ReactNode> = {
  chart: <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />,
  nakshatra: (
    <>
      <path d="M17 4.5A8 8 0 1 0 19.5 16 6.5 6.5 0 0 1 17 4.5Z" />
      <path d="M19 5.2l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" />
    </>
  ),
  lagna: (
    <>
      <path d="M2 16h20" />
      <path d="M6 16a6 6 0 0 1 12 0" />
      <path d="M12 4v4M5.6 6.6l2.1 2.1M18.4 6.6l-2.1 2.1" />
    </>
  ),
  patterns: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5l2.4 5.8 6.1.4-4.7 3.9 1.5 6-5.3-3.3-5.3 3.3 1.5-6-4.7-3.9 6.1-.4z" />
    </>
  ),
  career: (
    <>
      <path d="M4 20l6.5-6.5 3 3L20 10" />
      <path d="M15 10h5v5" />
    </>
  ),
  relationships: (
    <>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </>
  ),
  periods: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  summary: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 10h6M9 14h6M9 18h4" />
    </>
  ),
};

export function IncludesSection() {
  const c = HOME.includes;
  return (
    <section aria-labelledby="includes-heading" className="section border-y border-ivory-300 bg-ivory-50">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow" data-reveal>
            {c.eyebrow}
          </p>
          <MaskHeading id="includes-heading" lines={[c.headline]} className="h-section mt-4 text-ink-950" accent="" />
        </div>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-ivory-300 bg-ivory-300 sm:grid-cols-2 lg:grid-cols-4">
          {c.cards.map((card, i) => (
            <li key={card.title} className="group bg-ivory-50 p-7 transition-colors duration-300 hover:bg-white" data-reveal style={d((i % 4) * 70)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 text-gold-600 transition-transform duration-500 group-hover:rotate-[8deg]" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                {GLYPHS[card.glyph]}
              </svg>
              <h3 className="mt-5 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-ink-900">{card.title}</h3>
              <p className="mt-2.5 text-[0.95rem] leading-relaxed text-muted">{card.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted" data-reveal>
          {c.note}
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- pricing */

export function PriceSection({ personalAvailable }: { personalAvailable: boolean }) {
  const c = HOME.pricing;
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="section scroll-mt-16">
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow" data-reveal>
            {c.eyebrow}
          </p>
          <h2 id="pricing-heading" className="h-section mt-4 text-ink-950" data-reveal="mask">
            <span className="mask-line">
              <span>{c.headline}</span>
            </span>
            <span className="mask-line" style={{ "--line": 1 } as React.CSSProperties}>
              <span className="mt-2 block font-display text-[clamp(5.5rem,4rem+9vw,10rem)] font-medium leading-none tracking-tight text-ink-950">
                {PRICE.personal}
                <span className="text-gold-500">.</span>
              </span>
            </span>
          </h2>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[1.02rem] text-ink-800" data-reveal style={d(160)}>
            {c.points.map((pt) => (
              <li key={pt} className="flex items-center gap-2">
                <Spark className="h-2.5 w-2.5 text-gold-500" />
                {pt}
              </li>
            ))}
          </ul>
          {personalAvailable ? (
            <div className="mt-9" data-reveal style={d(220)}>
              <Link href="/start" className="btn btn-primary px-8 text-[1.02rem] tracking-wide">
                {c.cta}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-gold-300/70 bg-[linear-gradient(135deg,var(--color-gold-100),var(--color-ivory-50))] p-7 sm:p-9" data-reveal>
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-display text-xl text-ink-900">{c.upsellQuestion}</p>
              <p className="mt-1 text-ink-800">{c.upsell}</p>
              <p className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-gold-700">
                Total <span className="ml-1 font-display text-lg normal-case tracking-normal text-ink-950">{c.total}</span>
              </p>
            </div>
            {personalAvailable ? (
              <Link href="/start?questions=1" className="btn btn-outline">
                {c.upsellCta}
              </Link>
            ) : null}
          </div>
          <p className="mt-5 border-t border-gold-300/50 pt-4 text-sm text-muted">{COPY.personal.addOn.note}</p>
        </div>
        <p className="mt-5 text-center text-sm text-muted" data-reveal>
          {c.footnote}
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- languages */

export function LanguagesSection() {
  const c = HOME.languages;
  const languages = REPORT_LANGUAGES.filter((l) => l.enabled);
  return (
    <section aria-labelledby="languages-heading" className="section">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="eyebrow" data-reveal>
              {c.eyebrow}
            </p>
            <MaskHeading id="languages-heading" lines={[c.headline]} className="h-section mt-4 text-ink-950" accent="" />
          </div>
          <p className="lede" data-reveal style={d(120)}>
            {c.body}
          </p>
        </div>
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {languages.map((l, i) => (
            <li
              key={l.code}
              className="group flex aspect-[4/5] flex-col justify-between rounded-2xl border border-ivory-300 bg-ivory-50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gold-300 hover:shadow-[0_18px_40px_-24px_rgb(10_21_35/0.35)]"
              data-reveal="rise"
              style={d(i * 70)}
            >
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">{l.englishName}</span>
              <span lang={l.htmlLang} className="script font-display text-[clamp(1.6rem,1.2rem+1.4vw,2.2rem)] leading-snug text-ink-900">
                {l.nativeName}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-[0.97rem] leading-relaxed text-ink-800" data-reveal>
          {c.note}
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- traditions */

function Includes({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[0.94rem] leading-relaxed text-ink-800">
          <Spark className="mt-1.5 h-3 w-3 shrink-0 text-gold-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function TraditionsSplit() {
  const t = HOME.traditions;
  return (
    <section aria-labelledby="traditions-heading" className="section border-y border-ivory-300 bg-ivory-50">
      <div className="container-page">
        <h2 id="traditions-heading" className="sr-only">
          {t.eyebrow}
        </h2>
        <div className="relative grid gap-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
          <article data-reveal>
            <p className="eyebrow">{t.indian.title}</p>
            <p className="mt-4 font-display text-[clamp(1.5rem,1.1rem+1.2vw,2.1rem)] leading-snug text-ink-950">{t.indian.body}</p>
            <Includes items={COPY.indian.includes} />
          </article>

          <div className="flex items-center justify-center lg:flex-col" data-reveal style={d(120)}>
            <div className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full border border-gold-300 bg-(--color-midnight) text-center text-ivory-100 shadow-[0_24px_60px_-30px_rgb(10_21_35/0.8)]">
              <svg aria-hidden="true" viewBox="0 0 160 160" className="absolute inset-0 h-full w-full">
                <circle className="draw-line" pathLength={1} cx="80" cy="80" r="72" fill="none" stroke="var(--color-gold-400)" strokeOpacity="0.55" strokeWidth="0.8" />
              </svg>
              <Spark className="h-3.5 w-3.5 text-gold-300" />
              <p className="mt-2 px-4 font-display text-lg leading-tight">{t.center}</p>
              <p className="mt-1 px-5 text-[0.68rem] leading-snug text-ivory-300">{t.centerNote}</p>
            </div>
          </div>

          <article data-reveal style={d(200)}>
            <p className="eyebrow">{t.western.title}</p>
            <p className="mt-4 font-display text-[clamp(1.5rem,1.1rem+1.2vw,2.1rem)] leading-snug text-ink-950">{t.western.body}</p>
            <Includes items={COPY.western.includes} />
          </article>
        </div>
        <p className="mx-auto mt-10 max-w-3xl border-l-2 border-gold-400 pl-4 text-sm text-muted" data-reveal>
          {COPY.indian.timeNote}
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- transparency + recovery */

export function TransparencySection() {
  const t = HOME.transparency;
  const r = HOME.recovery;
  return (
    <section aria-labelledby="transparency-heading" className="section">
      <div className="container-page">
        <h2 id="transparency-heading" className="eyebrow font-sans" data-reveal>
          {t.eyebrow}
        </h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {t.points.map((pt, i) => (
            <li key={pt.title} className="border-t border-ink-900/15 pt-5" data-reveal style={d(i * 80)}>
              <h3 className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-ink-900">{pt.title}</h3>
              <p className="mt-3 text-[0.97rem] leading-relaxed text-muted">
                {pt.body}
                {pt.title === "Your privacy" ? (
                  <>
                    {" "}
                    <Link href="/privacy" className="text-ink-700 underline underline-offset-4">
                      Read it
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex flex-col gap-5 rounded-2xl bg-(--color-midnight) p-8 text-ivory-100 sm:flex-row sm:items-center sm:justify-between sm:p-10" data-reveal>
          <div className="max-w-xl">
            <p className="font-display text-2xl text-ivory-50">{r.title}</p>
            <p className="mt-2 text-[0.98rem] leading-relaxed text-ivory-300">{r.body}</p>
          </div>
          <Link href="/recover" className="btn border border-gold-300/50 px-6 text-ivory-50 hover:border-gold-200 hover:bg-white/5">
            {r.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** A hairline of gold that fills as the visitor reads (scroll-driven CSS; invisible elsewhere). */
export function ScrollProgress() {
  return <div aria-hidden="true" className="scroll-progress" />;
}
