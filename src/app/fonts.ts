import localFont from "next/font/local";

/**
 * Self-hosted fonts. Only the Latin text and display faces are preloaded.
 *
 * - Display: Fraunces (variable weight and optical size), subset to Latin.
 * - Native-script display: Tiro Tamil / Devanagari Hindi / Telugu / Kannada and Noto
 *   Serif Malayalam, subset to the few words the site shows in them
 *   (npm run fonts:subset). Each declares its Unicode range, so a browser downloads
 *   one only when that script actually appears.
 * - Body and forms: Noto Sans with its Indic companions (customers may type names in
 *   any script). Report PDFs embed their own full copies of these fonts.
 */
export const fraunces = localFont({
  src: [{ path: "../assets/fonts/display-fraunces.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-fraunces",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

// Unicode ranges must be written as literals (next/font requirement).

export const displayTamil = localFont({
  src: "../assets/fonts/display-tamil.woff2",
  variable: "--font-display-ta",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0B80-0BFF, U+200C-200D, U+25CC" }],
});
export const displayDevanagari = localFont({
  src: "../assets/fonts/display-devanagari.woff2",
  variable: "--font-display-hi",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+25CC, U+A8E0-A8FF" }],
});
export const displayTelugu = localFont({
  src: "../assets/fonts/display-telugu.woff2",
  variable: "--font-display-te",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0C00-0C7F, U+200C-200D, U+25CC" }],
});
export const displayKannada = localFont({
  src: "../assets/fonts/display-kannada.woff2",
  variable: "--font-display-kn",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0C80-0CFF, U+200C-200D, U+25CC" }],
});
export const displayMalayalam = localFont({
  src: "../assets/fonts/display-malayalam.woff2",
  variable: "--font-display-ml",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0D00-0D7F, U+200C-200D, U+25CC" }],
});

export const notoSans = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/noto-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  // 400 and 600 only (bold text uses 600): one fewer preloaded file on first visit.
  variable: "--font-noto",
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
  declarations: [{ prop: "unicode-range", value: "U+0B80-0BFF, U+200C-200D, U+25CC" }],
});
export const notoDevanagari = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-devanagari-devanagari-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-devanagari-devanagari-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+25CC, U+A8E0-A8FF" }],
});
export const notoTelugu = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-telugu-telugu-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-telugu-telugu-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-telugu",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0C00-0C7F, U+200C-200D, U+25CC" }],
});
export const notoKannada = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-kannada-kannada-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-kannada-kannada-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-kannada",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0C80-0CFF, U+200C-200D, U+25CC" }],
});
export const notoMalayalam = localFont({
  src: [
    { path: "../assets/fonts/noto-sans-malayalam-malayalam-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/noto-sans-malayalam-malayalam-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-malayalam",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0D00-0D7F, U+200C-200D, U+25CC" }],
});

export const fontVariables = [
  fraunces,
  displayTamil,
  displayDevanagari,
  displayTelugu,
  displayKannada,
  displayMalayalam,
  notoSans,
  notoTamil,
  notoDevanagari,
  notoTelugu,
  notoKannada,
  notoMalayalam,
]
  .map((f) => f.variable)
  .join(" ");
