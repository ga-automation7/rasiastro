import { HOME } from "@/content/site-copy";
import { StarField } from "./Celestial";
import { MaskHeading, Spark, revealDelay } from "./ui";

/** How it works: calculate, interpret, compose. Continues the hero's night sky. */
export function HowItWorks() {
  const e = HOME.engine;
  return (
    <section id="how-it-works" aria-labelledby="engine-heading" className="relative isolate overflow-hidden bg-(--color-midnight) text-ivory-100">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_45%,rgb(40_51_108/0.3),transparent_70%),linear-gradient(180deg,#070c17,#0a1426)]" />
        <StarField count={28} seed={21} className="absolute inset-0 h-full w-full opacity-50" />
      </div>
      <div className="container-page pb-[var(--space-section)] pt-[calc(var(--space-section)*0.6)]">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-end lg:gap-10">
          <div>
            <p className="eyebrow !text-gold-300" data-reveal>
              {e.eyebrow}
            </p>
            <MaskHeading id="engine-heading" lines={e.headline} className="h-section mt-4 text-ivory-50 lg:text-[clamp(2.6rem,4vw,3.8rem)]" accent="text-gold-300" />
          </div>
          <p className="text-[1.04rem] leading-relaxed text-ivory-200/90" data-reveal style={revealDelay(120)}>
            {e.body}
          </p>
        </div>

        <div className="relative mt-12 sm:mt-14" data-reveal>
          {/* A gold line drawn through the three steps as they come into view. */}
          <svg aria-hidden="true" viewBox="0 0 1000 4" preserveAspectRatio="none" className="absolute left-0 right-0 top-[1.35rem] hidden h-1 w-full md:block">
            <path className="draw-line" pathLength={1} d="M20 2 H980" stroke="var(--color-gold-400)" strokeOpacity="0.5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <ol className="relative grid gap-4 md:grid-cols-3 md:gap-8">
            {e.steps.map((s, i) => (
              <li key={s.n} className="group grid grid-cols-[auto_1fr] items-start gap-4 md:block" data-reveal style={revealDelay(150 + i * 140)}>
                <span className="relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold-300/50 bg-(--color-midnight) font-display text-[0.95rem] text-gold-200 transition-colors duration-300 group-hover:border-gold-200">
                  {s.n}
                </span>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition-colors duration-300 group-hover:border-gold-300/30 group-hover:bg-white/[0.04] md:mt-5 md:p-6">
                  <h3 className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-gold-200">{s.title}</h3>
                  <p className="mt-2.5 text-[0.98rem] leading-relaxed text-ivory-200/85">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-10 flex items-start gap-2.5 border-t border-white/[0.08] pt-7 text-sm text-ivory-300" data-reveal>
          <Spark className="mt-1 h-3 w-3 shrink-0 text-gold-300" />
          {e.guardrail}
        </p>
      </div>
    </section>
  );
}
