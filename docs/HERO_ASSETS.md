# Replacing the homepage hero image or animation

The hero (top section of the homepage) shows a placeholder starfield. You can replace it
with your own image and/or looping video **without changing any page code**.

## 1. Prepare your files

| File | Purpose | Recommended |
| --- | --- | --- |
| Poster image | Always shown first; used alone on phones, slow connections and for people who prefer reduced motion | 2400×1350 px, WebP or AVIF (or JPG), under 250 KB |
| Mobile poster (optional) | A portrait crop for phones | 1080×1600 px, under 150 KB |
| Video (optional) | Gentle loop on tablets and desktops | 8-15 s seamless loop, no sound, 1920×1080, WebM **and** MP4, each under 2.5 MB |

Keep the important part of the artwork on the **right** or centre: the headline sits on
the left over a dark gradient. Avoid text inside the artwork (it would not be translated
or readable on phones). Only use artwork you own or have licensed.

## 2. Put them in the project

Copy the files into `public/hero/`, for example:

```
public/hero/hero-poster.webp
public/hero/hero-poster-mobile.webp
public/hero/hero-loop.webm
public/hero/hero-loop.mp4
```

## 3. Point the site at them

Edit **`src/config/hero-media.ts`** (the only file to change):

```ts
export const HERO_MEDIA: HeroMediaConfig = {
  poster: { src: "/hero/hero-poster.webp", alt: "", objectPosition: "60% 40%" },
  mobilePoster: { src: "/hero/hero-poster-mobile.webp", objectPosition: "50% 30%" },
  video: {
    sources: [
      { src: "/hero/hero-loop.webm", type: "video/webm" },
      { src: "/hero/hero-loop.mp4", type: "video/mp4" },
    ],
    minViewportWidth: 768, // phones below this width get the still image only
  },
  overlay: "linear-gradient(180deg, rgba(13,11,38,0.35) 0%, rgba(13,11,38,0.65) 55%, rgba(13,11,38,0.95) 100%)",
  animatedPlaceholder: false, // turn off the placeholder twinkle
};
```

- `objectPosition` chooses which part of the image stays visible when it is cropped
  ("50% 50%" = centre; "70% 40%" = a little right and up).
- `alt` stays empty for decorative artwork. If the image conveys meaning, describe it.
- `overlay` keeps the white headline readable. If your artwork is bright, make the
  numbers larger (up to 0.9); if it is already dark, smaller.
- Set `video: null` to use only the image.

## 4. Check it

Run `npm run dev` and look at the homepage on a phone-sized window and a desktop window.
The headline must be easy to read everywhere. With "reduce motion" turned on in your
operating system, only the still image should appear.

The component (`src/components/hero/HeroMedia.client.tsx`) already handles: lazy loading
the video only when visible, skipping video on small screens, data-saver and reduced
motion, poster fallback, responsive cropping and the contrast overlay.
