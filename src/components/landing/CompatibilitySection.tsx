import Image from "next/image";
import Link from "next/link";
import { ART } from "@/config/art";
import { COPY, HOME, PRICE } from "@/content/site-copy";
import { CompatibilityTeaser } from "../compatibility/CompatibilityTeaser.client";

/**
 * Compatibility section on the sun-and-moon painting (this section only).
 *
 * Desktop (lg+): the painting spans the full width at its own proportions, anchored to
 * the bottom and fading in at its top edge, on its own night colour - so the sun and
 * moon always stay at the edges and the content sits in the dark centre. Phones/tablets: readable content first on the night colour, then
 * the full painting below it. The image is lazy-loaded (it is below the fold).
 */
export function CompatibilitySection({ available, pausedMessage }: { available: boolean; pausedMessage: string | null }) {
  const bg = ART.compatibility.background;
  const c = COPY.compatibility;
  const h = HOME.compatibility;
  return (
    <section id="compatibility" aria-labelledby="compatibility-heading" className="relative scroll-mt-16 overflow-hidden text-ivory-100" style={{ backgroundColor: ART.compatibility.night }}>
      <div
        className="absolute inset-x-0 bottom-0 hidden [mask-image:linear-gradient(to_bottom,transparent,black_24%)] lg:block"
        style={{ aspectRatio: `${bg.width} / ${bg.height}` }}
        aria-hidden="true"
      >
        <Image src={bg.src} alt="" fill sizes="100vw" quality={75} loading="lazy" className="object-cover" style={{ objectPosition: bg.focal }} />
      </div>
      <div className="relative mx-auto max-w-2xl px-(--gutter) pb-10 pt-16 text-center sm:pt-20 lg:pb-[clamp(9rem,13vw,13rem)] lg:pt-[clamp(5rem,7vw,7rem)]">
        <div>
          <p className="eyebrow !text-gold-300" data-reveal>
            {h.eyebrow}
          </p>
          <h2 id="compatibility-heading" className="h-section mt-3 text-ivory-50" data-reveal="mask">
            <span className="mask-line">
              <span>{h.headline[0]}</span>
            </span>
            <span className="mask-line" style={{ "--line": 1 } as React.CSSProperties}>
              <span className="text-gold-300">{h.headline[1]}</span>
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.06rem] leading-relaxed text-ivory-200" data-reveal>
            {h.body}
          </p>
          <p className="mt-7 flex items-baseline justify-center gap-3" data-reveal>
            <span className="font-display text-5xl text-ivory-50">{PRICE.compatibility}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-200">{h.label}</span>
          </p>
        </div>
        <div className="mx-auto mt-2 max-w-xl text-left" data-reveal>
          <CompatibilityTeaser available={available} pausedMessage={pausedMessage} />
          <p className="mt-4 text-sm font-medium text-ivory-200">{c.line}</p>
        </div>
        <div className="mx-auto mt-10 max-w-xl border-t border-ivory-100/15 pt-8 text-left" data-reveal>
          <p className="text-[0.97rem] leading-relaxed text-ivory-200">{c.how}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {c.outputs.map((o) => (
              <li key={o} className="rounded-full border border-gold-300/40 px-3 py-1 text-sm text-gold-200">
                {o}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ivory-300">{c.limits}</p>
          <p className="mt-3 text-sm">
            <Link href="/compatibility-report" className="font-semibold text-gold-200 underline decoration-gold-300/40 underline-offset-4 hover:text-gold-100">
              How the compatibility report works
            </Link>
          </p>
        </div>
      </div>
      <div className="relative lg:hidden" style={{ aspectRatio: `${bg.width} / ${bg.height}` }} aria-hidden="true">
        <Image src={bg.src} alt="" fill sizes="100vw" quality={75} loading="lazy" className="object-cover" />
        <div className="absolute inset-x-0 top-0 h-1/3" style={{ background: `linear-gradient(${ART.compatibility.night}, transparent)` }} />
      </div>
    </section>
  );
}
