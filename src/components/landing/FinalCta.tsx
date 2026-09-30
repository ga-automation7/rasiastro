import Link from "next/link";
import { CTA, HOME } from "@/content/site-copy";
import { StarField } from "./Celestial";
import { MaskHeading, revealDelay } from "./ui";

/** The page's natural conclusion: one clear action on the night sky it began with. */
export function FinalCta({ personalAvailable, compatibilityAvailable }: { personalAvailable: boolean; compatibilityAvailable: boolean }) {
  const f = HOME.final;
  if (!personalAvailable && !compatibilityAvailable) return null;
  return (
    <section id="begin" aria-labelledby="final-heading" className="relative isolate overflow-hidden bg-(--color-midnight) text-ivory-100">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,rgb(40_51_108/0.45),transparent_70%)]" />
        <StarField count={36} seed={7} className="absolute inset-0 h-full w-full opacity-60" />
        <svg viewBox="0 0 800 800" className="absolute left-1/2 top-full h-[56rem] w-[56rem] -translate-x-1/2 -translate-y-1/2 text-gold-300/25" fill="none" stroke="currentColor" strokeWidth="0.7">
          <circle cx="400" cy="400" r="390" />
          <circle cx="400" cy="400" r="300" strokeDasharray="2 8" />
          <circle cx="400" cy="400" r="210" />
        </svg>
      </div>
      <div className="container-page py-[var(--space-section)] text-center">
        <p className="eyebrow !text-gold-300" data-reveal>
          {f.eyebrow}
        </p>
        <MaskHeading id="final-heading" lines={f.headline} className="h-section mx-auto mt-4 max-w-3xl text-ivory-50" accent="text-gold-300" />
        <p className="mx-auto mt-5 max-w-lg text-[1.05rem] leading-relaxed text-ivory-200/90" data-reveal style={revealDelay(120)}>
          {f.supporting}
        </p>
        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center" data-reveal style={revealDelay(200)}>
          {personalAvailable ? (
            <Link href="/start" className="btn btn-primary px-7 text-[1.02rem] shadow-[0_10px_30px_-10px_rgb(207_75_44/0.65)]">
              {CTA.personal}
            </Link>
          ) : null}
          {compatibilityAvailable ? (
            <Link href="/compatibility" className="btn border border-gold-300/45 px-7 text-[1.02rem] text-ivory-50 hover:border-gold-300/80 hover:bg-white/[0.06]">
              {CTA.compatibility}
            </Link>
          ) : null}
        </div>
        <p className="mt-6 text-sm text-ivory-300" data-reveal>
          {HOME.hero.reassurance.join(" · ")}
        </p>
      </div>
    </section>
  );
}
