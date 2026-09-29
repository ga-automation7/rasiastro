import { getImageProps } from "next/image";
import Link from "next/link";
import { ART } from "@/config/art";
import { COPY, CTA } from "@/content/site-copy";

/**
 * Homepage hero with the elephant artwork (art-directed with <picture>, so each device
 * downloads only the crop it shows, optimised by Next.js).
 *
 * Desktop (lg+): the painting fills the section at its own proportions, so the empty
 * parchment on its left always spans the same share of the width. The text is limited
 * to that share (ART.hero.textSafeWidth) and never overlaps the elephant. If the height
 * is capped, the picture is trimmed top/bottom only, never at the sides.
 *
 * Phones/tablets: text first on the parchment colour, then the elephant crop fading in
 * from the parchment. The primary action is in the first screen.
 *
 * The image loads eagerly with high priority on the painting's own background colour,
 * so the hero is never blank. The flattened artwork is never animated.
 */
export function Hero({ personalAvailable, compatibilityAvailable, closedMessage }: { personalAvailable: boolean; compatibilityAvailable: boolean; closedMessage: string | null }) {
  const { desktop, mobile, parchment, textSafeWidth } = ART.hero;
  const common = { alt: "", sizes: "100vw", fetchPriority: "high" as const, loading: "eager" as const };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: desktop.src, width: desktop.width, height: desktop.height, quality: 82 });
  const {
    props: { srcSet: mobileSrcSet, ...imgProps },
  } = getImageProps({ ...common, src: mobile.src, width: mobile.width, height: mobile.height, quality: 82 });

  return (
    <section
      aria-label="Introduction"
      className="hero relative grid overflow-hidden lg:aspect-[var(--hero-ratio)] lg:max-h-[calc(100svh-4rem)] lg:min-h-[35rem]"
      style={
        {
          backgroundColor: parchment,
          "--hero-ratio": `${desktop.width} / ${desktop.height}`,
          "--hero-safe": `${textSafeWidth * 100}%`,
          "--pos-mobile": mobile.focal,
          "--pos-desktop": desktop.focal,
        } as React.CSSProperties
      }
    >
      <div
        className="relative row-start-2 aspect-[var(--mobile-ratio)] max-h-[72svh] w-full lg:col-start-1 lg:row-start-1 lg:aspect-auto lg:h-full lg:max-h-none"
        style={{ "--mobile-ratio": `${mobile.width} / ${mobile.height}` } as React.CSSProperties}
      >
        <picture>
          <source media="(min-width: 1024px)" srcSet={desktopSrcSet} sizes="100vw" />
          <img {...imgProps} srcSet={mobileSrcSet} alt="" className="absolute inset-0 h-full w-full object-cover [object-position:var(--pos-mobile)] lg:[object-position:var(--pos-desktop)]" />
        </picture>
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1/4 lg:hidden" style={{ background: `linear-gradient(${parchment}, transparent)` }} />
      </div>

      <div className="relative z-10 row-start-1 lg:col-start-1 lg:row-start-1 lg:flex lg:w-(--hero-safe) lg:items-center">
        <div className="container-page pb-4 pt-10 sm:pt-14 lg:max-w-none lg:py-10 lg:pl-[clamp(2rem,5vw,5.5rem)] lg:pr-4">
          <h1 className="h-hero text-ink-950 lg:text-[clamp(2.5rem,3.5vw,4.1rem)]">
            <span className="block">{COPY.hero.headline[0]}</span>
            <span className="block text-ink-700">{COPY.hero.headline[1]}</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1.06rem] leading-relaxed text-ink-800 lg:text-[1.1rem]">{COPY.hero.supporting}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col xl:flex-row">
            {personalAvailable ? (
              <Link href="/start" className="btn btn-primary text-[1.02rem]">
                {CTA.personal}
              </Link>
            ) : null}
            {compatibilityAvailable ? (
              <Link href="/compatibility" className="btn btn-outline text-[1.02rem]">
                {CTA.compatibility}
              </Link>
            ) : null}
          </div>
          {closedMessage ? (
            <p role="status" className="mt-5 max-w-md rounded-lg border border-ink-800/20 bg-ivory-50/70 px-4 py-3 text-sm text-ink-900">
              {closedMessage}
            </p>
          ) : (
            <p className="mt-4 text-sm font-medium text-ink-800/85">{COPY.hero.reassurance}</p>
          )}
        </div>
      </div>
    </section>
  );
}
