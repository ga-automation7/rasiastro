import fs from "node:fs";
import path from "node:path";

/**
 * @font-face rules with the font files embedded as data URIs, so the PDF renderer
 * needs no network and no fonts installed on the server. Chromium shapes Indic
 * scripts with HarfBuzz and embeds only the glyph subsets actually used.
 */
const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

const FACES: { family: string; file: string; weight: number; range?: string }[] = [
  { family: "Noto Sans", file: "noto-sans-latin-400-normal.woff2", weight: 400 },
  { family: "Noto Sans", file: "noto-sans-latin-600-normal.woff2", weight: 600 },
  { family: "Noto Sans", file: "noto-sans-latin-700-normal.woff2", weight: 700 },
  { family: "Noto Sans", file: "noto-sans-latin-ext-400-normal.woff2", weight: 400, range: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1EFF, U+2020, U+20A0-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  { family: "Noto Sans", file: "noto-sans-latin-ext-700-normal.woff2", weight: 700, range: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1EFF, U+2020, U+20A0-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  { family: "Fraunces", file: "fraunces-latin-500-normal.woff2", weight: 500 },
  { family: "Fraunces", file: "fraunces-latin-600-normal.woff2", weight: 600 },
];
for (const [family, script] of [
  ["Noto Sans Tamil", "tamil"],
  ["Noto Sans Devanagari", "devanagari"],
  ["Noto Sans Telugu", "telugu"],
  ["Noto Sans Kannada", "kannada"],
  ["Noto Sans Malayalam", "malayalam"],
] as const) {
  for (const weight of [400, 600, 700]) FACES.push({ family, file: `noto-sans-${script}-${script}-${weight}-normal.woff2`, weight });
}

let cachedCss: string | null = null;

export function embeddedFontCss(): string {
  if (cachedCss) return cachedCss;
  cachedCss = FACES.map((face) => {
    const data = fs.readFileSync(path.join(FONT_DIR, face.file)).toString("base64");
    return `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');${face.range ? `unicode-range:${face.range};` : ""}}`;
  }).join("\n");
  return cachedCss;
}

export const REPORT_FONT_STACK =
  "'Noto Sans', 'Noto Sans Tamil', 'Noto Sans Devanagari', 'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam', sans-serif";
export const REPORT_HEADING_STACK =
  "'Fraunces', 'Noto Sans Tamil', 'Noto Sans Devanagari', 'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam', serif";
