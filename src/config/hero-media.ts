/**
 * HERO MEDIA - the only file to edit when replacing the homepage hero artwork.
 * Full instructions: docs/HERO_ASSETS.md
 *
 * Put files in /public/hero/ and reference them here as "/hero/<file>".
 * Recommended budgets: poster <= 250 KB (WebP/AVIF/JPG, 2400x1350), mobile poster
 * <= 150 KB (1080x1600), video <= 2.5 MB (WebM + MP4, 8-15 s loop, no audio).
 */
export interface HeroVideoSource {
  src: string;
  type: "video/webm" | "video/mp4";
}

export interface HeroMediaConfig {
  /** Always shown first, and used on its own on mobile / reduced motion / data saver. */
  poster: { src: string; alt: string; objectPosition: string };
  /** Optional portrait crop for phones. */
  mobilePoster: { src: string; objectPosition: string } | null;
  /** Optional looping background video (desktop/tablet only, muted, lazy-loaded). */
  video: { sources: HeroVideoSource[]; minViewportWidth: number } | null;
  /** Gradient laid over the media so the headline always has enough contrast. */
  overlay: string;
  /** Gentle CSS twinkle for the placeholder; turn off when real artwork is added. */
  animatedPlaceholder: boolean;
}

export const HERO_MEDIA: HeroMediaConfig = {
  poster: { src: "/hero/placeholder-poster.svg", alt: "", objectPosition: "50% 40%" },
  mobilePoster: null,
  video: null,
  overlay: "linear-gradient(180deg, rgba(13,11,38,0.35) 0%, rgba(13,11,38,0.65) 55%, rgba(13,11,38,0.95) 100%)",
  animatedPlaceholder: true,
};
