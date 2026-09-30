# Homepage artwork: replacing the images

The homepage uses two paintings:

| Artwork | Original (full quality, kept in git) | Where it appears |
| --- | --- | --- |
| Elephant | `assets-src/hero-elephant-original.png` | The hero (top of the homepage) |
| Sun and moon | `assets-src/compatibility-sun-moon-original.png` | The compatibility section only |

Web versions are generated into `public/art/` and served through Next.js image
optimisation (each visitor gets a right-sized AVIF/WebP). Paths, sizes, focal points and
tiny blurred placeholders are recorded in `src/config/art-manifest.json` and used from
`src/config/art.ts`. Both images are decorative, so their alt text is empty; the
headline carries the meaning.

## Replacing an image

1. Save the new original in `assets-src/` **with the same file name** (PNG or JPG,
   at least 1600 px wide). Use only artwork you own or have licensed.
2. Run:
   ```bash
   npm run images:build
   ```
   This writes `public/art/*.webp`, the phone crop of the hero, the social-preview image
   (`public/art/og-rasi-astro.jpg`, 1200×630) and the manifest.
3. If the composition changed, adjust in `src/config/art.ts`:
   - `hero.textSafeWidth`: the share of the image width on the **left** that is empty
     enough for the headline (currently 0.38). The headline never goes beyond it.
   - `hero.desktop.focal` / `hero.mobile.focal`: which part must stay visible when the
     picture is trimmed (CSS `object-position`, e.g. `"68% 38%"`).
   - `hero.parchment` / `compatibility.night`: the painting's background colour, so
     the page blends into it.
   - The phone crop rectangle is in `scripts/build-images.ts` (`heroMobile`).
4. Check the page at 360, 390, 768 and 1440 px wide
   (`npx tsx scripts/lib/screenshots.ts / --widths=360,390,768,1440`).

## Layout rules the code follows

- **Hero, desktop:** the painting keeps its own proportions (never stretched); if the
  height is limited it is trimmed at the top/bottom, never the sides, so the text area
  stays over the empty parchment. It loads eagerly with high priority on the parchment
  colour, so the hero is never blank. Nothing animates the flattened artwork.
- **Hero, phones/tablets:** headline and buttons first on the parchment colour, then the
  elephant crop, fading in from the parchment.
- **Compatibility, desktop:** the sun-and-moon painting spans the full width anchored to
  the bottom, fading in at its top edge; the content sits in the dark centre. Phones: the
  content first, then the painting. It is lazy-loaded (below the fold).
- No fixed (parallax) backgrounds.
