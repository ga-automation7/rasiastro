"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HERO_MEDIA } from "@/config/hero-media";

/**
 * Self-contained hero background. Layout and text are passed as children, so artwork
 * can be swapped in src/config/hero-media.ts without touching the page.
 *
 * Video loads only when: a video is configured, the viewport is wide enough, the
 * visitor has not asked for reduced motion or data saving, and the hero is visible.
 */
export function HeroMedia({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [playVideo, setPlayVideo] = useState(false);
  const { poster, mobilePoster, video, overlay, animatedPlaceholder } = HERO_MEDIA;

  useEffect(() => {
    if (!video || !ref.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.matchMedia(`(max-width: ${video.minViewportWidth - 1}px)`).matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduceMotion || narrow || saveData) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setPlayVideo(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [video]);

  const unoptimized = (src: string) => src.endsWith(".svg");

  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-night-950 text-ivory-50">
      <div aria-hidden="true" className="absolute inset-0 -z-20">
        <Image
          src={poster.src}
          alt={poster.alt}
          fill
          priority
          sizes="100vw"
          unoptimized={unoptimized(poster.src)}
          className={`object-cover ${mobilePoster ? "hidden md:block" : ""}`}
          style={{ objectPosition: poster.objectPosition }}
        />
        {mobilePoster ? (
          <Image
            src={mobilePoster.src}
            alt=""
            fill
            sizes="100vw"
            unoptimized={unoptimized(mobilePoster.src)}
            className="object-cover md:hidden"
            style={{ objectPosition: mobilePoster.objectPosition }}
          />
        ) : null}
        {playVideo && video ? (
          <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={poster.src}>
            {video.sources.map((s) => (
              <source key={s.src} src={s.src} type={s.type} />
            ))}
          </video>
        ) : null}
        {animatedPlaceholder && !playVideo ? <div className="hero-twinkle absolute inset-0" /> : null}
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: overlay }} />
      {children}
    </section>
  );
}
