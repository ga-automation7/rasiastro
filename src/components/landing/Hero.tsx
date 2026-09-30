import Link from "next/link";
import { HOME } from "@/content/site-copy";
import { Astrolabe, StarField } from "./Celestial";

/**
 * Homepage hero on a midnight sky. The intro plays once on load in about 1.2 s (the sky
 * resolves from darkness, then eyebrow, headline lines, copy and actions) and never
 * blocks input. It is pure CSS, so it also runs without JavaScript, and reduced motion
 * shows everything at once.
 */
export function Hero({ personalAvailable, compatibilityAvailable, closedMessage }: { personalAvailable: boolean; compatibilityAvailable: boolean; closedMessage: string | null }) {
  const h = HOME.hero;
  const delay = (ms: number) => ({ "--intro-delay": `${ms}ms` }) as React.CSSProperties;
  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative isolate overflow-hidden bg-(--color-midnight) text-ivory-100">
      {/* Sky: layered light, stars and grain. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_72%_38%,rgb(40_51_108/0.55),transparent_70%),radial-gradient(ellipse_60%_50%_at_12%_90%,rgb(122_86_26/0.18),transparent_70%),linear-gradient(180deg,#070c17_0%,#0a1523_60%,#0b1628_100%)]" />
        <StarField className="intro-fade absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 hidden opacity-70 mix-blend-soft-light [background-image:var(--night-grain)] lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-(--color-midnight)" />
      </div>

      <div className="container-page grid items-center gap-10 pb-12 pt-14 sm:pb-20 sm:pt-20 lg:min-h-[min(calc(100svh-4rem),50rem)] lg:grid-cols-[1.08fr_1fr] lg:gap-6 lg:pb-24 lg:pt-16">
        <div className="relative z-10 max-w-[38rem]">
          <p className="intro-rise text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold-300" style={delay(150)}>
            {h.eyebrow}
          </p>
          <h1 id="hero-heading" className="h-hero mt-5 text-ivory-50 lg:text-[clamp(3rem,5vw,5.2rem)]">
            <span className="mask-line intro-line" style={delay(250)}>
              <span>{h.headline[0]}</span>
            </span>
            <span className="mask-line intro-line" style={delay(380)}>
              <span className="bg-gradient-to-r from-gold-200 via-gold-300 to-ivory-100 bg-clip-text text-transparent">{h.headline[1]}</span>
            </span>
          </h1>
          <p className="intro-rise mt-6 max-w-[33rem] text-[1.06rem] leading-relaxed text-ivory-200/90 lg:text-[1.12rem]" style={delay(560)}>
            {h.supporting}
          </p>
          <ul className="intro-rise mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] font-medium tracking-wide text-ivory-300" style={delay(640)} aria-label="What makes it different">
            {h.trust.map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                {i ? <span aria-hidden="true" className="h-1 w-1 rounded-full bg-gold-400/70" /> : null}
                {t}
              </li>
            ))}
          </ul>

          <div className="intro-rise mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap" style={delay(720)}>
            {personalAvailable ? (
              <Link href="/start" className="btn btn-primary px-6 text-[1rem] tracking-wide shadow-[0_10px_30px_-10px_rgb(207_75_44/0.65)]">
                {h.primary}
              </Link>
            ) : null}
            {compatibilityAvailable ? (
              <Link href="/compatibility" className="btn border border-gold-300/45 bg-white/[0.03] px-6 text-[1rem] tracking-wide text-ivory-50 hover:border-gold-300/80 hover:bg-white/[0.07]">
                {h.secondary}
              </Link>
            ) : null}
          </div>
          {closedMessage ? (
            <p role="status" className="intro-rise mt-6 max-w-md rounded-lg border border-ivory-100/20 bg-white/5 px-4 py-3 text-sm text-ivory-100" style={delay(800)}>
              {closedMessage}
            </p>
          ) : (
            <div className="intro-rise mt-5 space-y-2 text-sm text-ivory-300" style={delay(800)}>
              <ul className="flex flex-wrap gap-x-2 gap-y-1">
                {h.reassurance.map((item, i) => (
                  <li key={item} className="whitespace-nowrap">
                    {i ? "· " : ""}
                    {item}
                  </li>
                ))}
              </ul>
              {personalAvailable ? (
                <p>
                  <Link href="/start?questions=1" className="text-gold-200 underline decoration-gold-300/40 underline-offset-4 transition-colors hover:text-gold-100">
                    {h.questions}
                  </Link>
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div aria-hidden="true" className="hero-drift pointer-events-none relative -mx-(--gutter) -mt-4 h-[min(66vw,17rem)] sm:mt-0 sm:h-[28rem] lg:mx-0 lg:h-[min(40rem,78vh)]">
          <Astrolabe className="intro-fade absolute left-1/2 top-1/2 aspect-square h-[132%] max-h-none -translate-x-1/2 -translate-y-1/2 opacity-90 lg:h-full" />
        </div>
      </div>

      {/* The sky resolves from darkness. */}
      <div aria-hidden="true" className="intro-veil absolute inset-0 bg-(--color-midnight)" />
    </section>
  );
}
