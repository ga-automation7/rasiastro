/**
 * Renders a sample PDF in every report language, checks that the right Noto font is
 * embedded and the text layer contains that script, and saves page images so a
 * person can confirm the shaping looks right.
 *
 *   npm run verify:pdf
 * Output: .data/pdf-verify/<language>.pdf and <language>-page<N>.png
 */
import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { fail } from "./lib/cli";
import { renderPdfPages } from "./lib/pdf-preview";
import { REPORT_LANGUAGES } from "../src/config/languages";
import { renderPdf } from "../src/server/reports/pdf";
import { buildLanguageSampleDocument } from "../src/server/reports/language-samples";

const FONT: Record<string, RegExp> = { ta: /NotoSansTamil/, hi: /NotoSansDevanagari/, te: /NotoSansTelugu/, kn: /NotoSansKannada/, ml: /NotoSansMalayalam/, en: /NotoSans/ };
const BLOCK: Record<string, RegExp> = { ta: /[஀-௿]/g, hi: /[ऀ-ॿ]/g, te: /[ఀ-౿]/g, kn: /[ಀ-೿]/g, ml: /[ഀ-ൿ]/g, en: /[A-Za-z]/g };

const out = path.join(".data", "pdf-verify");
fs.mkdirSync(out, { recursive: true });
let failures = 0;
try {
  for (const language of REPORT_LANGUAGES) {
    const doc = await buildLanguageSampleDocument(language.code);
    const started = Date.now();
    const { pdf, renderer } = await renderPdf(doc);
    fs.writeFileSync(path.join(out, `${language.code}.pdf`), pdf);
    const fontOk = FONT[language.code]!.test(Buffer.from(pdf).toString("latin1"));
    const proxy = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(proxy, { mergePages: true });
    const chars = text.match(BLOCK[language.code]!)?.length ?? 0;
    const pages = await renderPdfPages(pdf, [1, 3, 4], 1.2);
    pages.forEach((png, i) => fs.writeFileSync(path.join(out, `${language.code}-page${[1, 3, 4][i]}.png`), png));
    const pass = fontOk && chars > 500;
    if (!pass) failures += 1;
    console.log(`${pass ? "✓" : "✗"} ${language.englishName.padEnd(10)} ${proxy.numPages} pages, ${Math.round(pdf.byteLength / 1024)} KB, font embedded: ${fontOk}, script characters in text layer: ${chars}, ${Date.now() - started} ms (${renderer})`);
  }
  console.log(`\nPage images saved in ${path.resolve(out)} - open them and check the text looks right (vowel signs and conjuncts joined correctly).`);
  if (failures) fail(`${failures} language(s) failed. Set enabled: false for them in src/config/languages.ts until fixed.`);
} catch (error) {
  fail((error as Error).message);
}
