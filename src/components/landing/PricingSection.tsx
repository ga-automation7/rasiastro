import Link from "next/link";
import { COPY, HOME, PRICE, turnaround } from "@/content/site-copy";
import { Glyph } from "../site/Glyph";
import { MaskHeading, Spark, revealDelay } from "./ui";

/** One clear price, everything it includes, how long it takes, and the questions add-on. */
export function PricingSection({ personalAvailable, typicalMinutes, maxHours }: { personalAvailable: boolean; typicalMinutes: number; maxHours: number }) {
  const c = HOME.pricing;
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="section scroll-mt-16 border-t border-ivory-300">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="eyebrow" data-reveal>
              {c.eyebrow}
            </p>
            <MaskHeading id="pricing-heading" lines={[c.headline]} className="h-section mt-4 text-ink-950" />
            <p className="mt-2 font-display text-[clamp(5rem,3.8rem+7vw,8.5rem)] font-medium leading-none tracking-tight text-ink-950" data-reveal style={revealDelay(100)}>
              {PRICE.personal}
              <span className="text-gold-500">.</span>
            </p>
            {personalAvailable ? (
              <div className="mt-8" data-reveal style={revealDelay(180)}>
                <Link href="/start" className="btn btn-primary w-full px-8 text-[1.02rem] tracking-wide sm:w-auto">
                  {c.cta}
                </Link>
              </div>
            ) : null}
            <p className="mx-auto mt-5 flex max-w-md items-start gap-2.5 text-left text-sm leading-relaxed text-ink-800 lg:mx-0" data-reveal style={revealDelay(220)}>
              <Glyph name="periods" className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
              {turnaround(typicalMinutes, maxHours)}
            </p>
          </div>

          <div className="rounded-3xl border border-ivory-300 bg-ivory-50 p-7 shadow-[0_30px_60px_-45px_rgb(10_21_35/0.45)] sm:p-9" data-reveal style={revealDelay(120)}>
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-ink-900">Everything included</h3>
            <ul className="mt-5 space-y-3.5">
              {c.included.map((item) => (
                <li key={item} className="flex gap-3 text-[0.98rem] leading-relaxed text-ink-800">
                  <Spark className="mt-1.5 h-3 w-3 shrink-0 text-gold-500" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 border-t border-ivory-300 pt-6">
              <p className="font-display text-lg text-ink-900">{c.upsellQuestion}</p>
              <p className="mt-1 text-[0.95rem] text-ink-800">{c.upsell}</p>
              {personalAvailable ? (
                <Link href="/start?questions=1" className="btn btn-outline mt-4 w-full sm:w-auto">
                  {c.upsellCta}
                </Link>
              ) : null}
              <p className="mt-3 text-xs text-muted">{COPY.personal.addOn.note}</p>
            </div>
          </div>
        </div>
        <p className="mt-10 text-center text-sm text-muted" data-reveal>
          {c.footnote}{" "}
          <Link href="/#compatibility" className="font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700">
            {c.compatibility}
          </Link>
        </p>
      </div>
    </section>
  );
}
