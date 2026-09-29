/**
 * Cuts the display typefaces down to the characters the website actually shows in
 * them, so the homepage does not download whole Indic fonts for a few words.
 *
 *   npm run fonts:subset      (run after npm run fonts:copy, and after editing src/config/regional.ts)
 *
 * - Fraunces (variable, Latin): printable ASCII plus the punctuation and ₹ we use.
 *   Weight and optical size stay variable; the decorative SOFT/WONK axes are pinned
 *   (SOFT 30, WONK 0), which halves the file.
 * - Tiro Tamil / Devanagari Hindi / Telugu / Kannada and Noto Serif Malayalam: only the
 *   characters in DISPLAY_SCRIPT_TEXT. Complex-script shaping tables are kept, so
 *   conjuncts and vowel signs still render correctly.
 *
 * Report PDFs are unaffected: they embed the full Noto Sans script fonts.
 */
import fs from "node:fs";
import path from "node:path";
import subsetFont from "subset-font";
import { DISPLAY_SCRIPT_TEXT } from "../src/config/regional";

const DIR = path.join("src", "assets", "fonts");
const LATIN = `${Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("")}₹·–—‘’“”…•×→←°`;

const JOBS: { from: string; to: string; text: string; axes?: Record<string, number> }[] = [
  { from: "fraunces-latin-full-normal.woff2", to: "display-fraunces.woff2", text: LATIN, axes: { SOFT: 30, WONK: 0 } },
  { from: "tiro-tamil-tamil-400-normal.woff2", to: "display-tamil.woff2", text: DISPLAY_SCRIPT_TEXT },
  { from: "tiro-devanagari-hindi-devanagari-400-normal.woff2", to: "display-devanagari.woff2", text: DISPLAY_SCRIPT_TEXT },
  { from: "tiro-telugu-telugu-400-normal.woff2", to: "display-telugu.woff2", text: DISPLAY_SCRIPT_TEXT },
  { from: "tiro-kannada-kannada-400-normal.woff2", to: "display-kannada.woff2", text: DISPLAY_SCRIPT_TEXT },
  { from: "noto-serif-malayalam-malayalam-600-normal.woff2", to: "display-malayalam.woff2", text: DISPLAY_SCRIPT_TEXT },
];

for (const job of JOBS) {
  const source = fs.readFileSync(path.join(DIR, job.from));
  const out = await subsetFont(source, job.text, { targetFormat: "woff2", ...(job.axes ? { variationAxes: job.axes } : {}) });
  fs.writeFileSync(path.join(DIR, job.to), out);
  console.log(`${job.to}: ${Math.round(source.byteLength / 1024)} KB -> ${Math.round(out.byteLength / 1024)} KB`);
}
