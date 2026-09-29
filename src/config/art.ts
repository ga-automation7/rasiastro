import manifest from "./art-manifest.json";

/**
 * Homepage artwork: paths, intrinsic sizes, focal points and placeholders in one place.
 *
 * To replace artwork: put the new original in assets-src/ under the same name (or
 * change the job list in scripts/build-images.ts), run `npm run images:build`, then
 * adjust the focal points below if the composition changed. See docs/HERO_ASSETS.md.
 *
 * Both images are decorative (the headline carries the meaning), so alt text is empty.
 */
export interface ArtImage {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  /** CSS object-position: which part of the picture must stay in view when cropped. */
  focal: string;
  alt: "";
}

const image = (key: keyof typeof manifest, focal: string): ArtImage => ({ ...manifest[key], focal, alt: "" });

export const ART = {
  hero: {
    /** Desktop: the parchment (left ~40%) holds the headline; the elephant sits right. */
    desktop: image("heroDesktop", "68% 38%"),
    /** Phones and tablets: text sits above on ivory; this crop sits below it. */
    mobile: image("heroMobile", "50% 30%"),
    /** The painting's parchment tone, so the page blends into the artwork. */
    parchment: "#efdcb7",
    /** Share of the desktop image width that is empty parchment (text must stay inside it). */
    textSafeWidth: 0.38,
  },
  compatibility: {
    /** Sun and moon sit at the left and right edges; the dark centre holds the content. */
    background: image("compatibility", "50% 100%"),
    /** The painting's night-sky tone. */
    night: "#0a1523",
  },
} as const;
