import localFont from "next/font/local";

/**
 * Self-hosted fonts (the same files the PDF embeds). Latin fonts are preloaded;
 * Indic script fonts load only when a page actually uses those characters.
 */
export const notoSans = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/noto-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../assets/fonts/noto-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto",
  display: "swap",
});

export const fraunces = localFont({
  src: [
    { path: "../assets/fonts/fraunces-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/fraunces-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

export const notoTamil = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-tamil-tamil-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-tamil-tamil-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-tamil",
  display: "swap",
  preload: false,
});
export const notoDevanagari = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-devanagari-devanagari-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-devanagari-devanagari-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
});
export const notoTelugu = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-telugu-telugu-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-telugu-telugu-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-telugu",
  display: "swap",
  preload: false,
});
export const notoKannada = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-kannada-kannada-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-kannada-kannada-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-kannada",
  display: "swap",
  preload: false,
});
export const notoMalayalam = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-malayalam-malayalam-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-malayalam-malayalam-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-malayalam",
  display: "swap",
  preload: false,
});

export const fontVariables = [notoSans, fraunces, notoTamil, notoDevanagari, notoTelugu, notoKannada, notoMalayalam].map((f) => f.variable).join(" ");
