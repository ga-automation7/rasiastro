/**
 * Renders a sample personal PDF and a sample compatibility PDF (two people) in every
 * report language, plus a Western compatibility PDF, checks that the right Noto font is
 * embedded and the text layer contains that script, and saves page images so a
 * person can confirm the shaping looks right.
 *
 *   npm run verify:pdf
 * Output: .data/pdf-verify/<name>.pdf and <name>-page<N>.png
 */
import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { fail } from "./lib/cli";
import { renderPdfPages } from "./lib/pdf-preview";
import { REPORT_LANGUAGES } from "../src/config/languages";
import { renderPdf } from "../src/server/reports/pdf";
import { buildLanguageSampleDocument, buildPairLanguageSampleDocument } from "../src/server/reports/language-samples";
import type { AnyReportDocument } from "../src/server/reports/pair-document";

const FONT: Record<string, RegExp> = { ta: /NotoSansTamil/, hi: /NotoSansDevanagari/, te: /NotoSansTelugu/, kn: /NotoSansKannada/, ml: /NotoSansMalayalam/, en: /NotoSans/ };
const BLOCK: Record<string, RegExp> = { ta: /[஀-௿]/g, hi: /[ऀ-ॿ]/g, te: /[ఀ-౿]/g, kn: /[ಀ-೿]/g, ml: /[ഀ-ൿ]/g, en: /[A-Za-z]/g };

const out = path.join(".data", "pdf-verify");
fs.mkdirSync(out, { recursive: true });
let failures = 0;
try {
  const jobs: { name: string; label: string; code: string; build: () => Promise<AnyReportDocument> }[] = [];
  for (const language of REPORT_LANGUAGES) {
    jobs.push({ name: language.code, label: `${language.englishName} personal`, code: language.code, build: () => buildLanguageSampleDocument(language.code) });
    jobs.push({ name: `${language.code}-pair`, label: `${language.englishName} compatibility`, code: language.code, build: () => buildPairLanguageSampleDocument(language.code, "indian", "marriage") });
  }
  jobs.push({ name: "en-pair-western", label: "English compatibility (Western)", code: "en", build: () => buildPairLanguageSampleDocument("en", "western", "career_teamwork") });
  for (const job of jobs) {
    const doc = await job.build();
    const started = Date.now();
    const { pdf, renderer } = await renderPdf(doc);
    fs.writeFileSync(path.join(out, `${job.name}.pdf`), pdf);
    const fontOk = FONT[job.code]!.test(Buffer.from(pdf).toString("latin1"));
    const proxy = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(proxy, { mergePages: true });
    const chars = text.match(BLOCK[job.code]!)?.length ?? 0;
    const footer = /rasiastro\.com/.test(text);
    const shown = [1, 2, 3].filter((n) => n <= proxy.numPages);
    const pages = await renderPdfPages(pdf, shown, 1.2);
    pages.forEach((png, i) => fs.writeFileSync(path.join(out, `${job.name}-page${shown[i]}.png`), png));
    const pass = fontOk && chars > 500 && footer;
    if (!pass) failures += 1;
    console.log(
      `${pass ? "✓" : "✗"} ${job.label.padEnd(34)} ${proxy.numPages} pages, ${Math.round(pdf.byteLength / 1024)} KB, font embedded: ${fontOk}, script characters: ${chars}, footer: ${footer}, ${Date.now() - started} ms (${renderer})`,
    );
  }

  console.log(`\nPage images saved in ${path.resolve(out)} - open them and check the text looks right (vowel signs and conjuncts joined correctly).`);
  if (failures) fail(`${failures} PDF(s) failed. Set enabled: false for an affected language in src/config/languages.ts until fixed.`);
} catch (error) {
  fail((error as Error).message);
}
