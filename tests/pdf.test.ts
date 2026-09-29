import { extractText, getDocumentProxy } from "unpdf";
import { beforeAll, describe, expect, it } from "vitest";
import { REPORT_LANGUAGES } from "@/config/languages";
import { getDictionary } from "@/i18n";
import { findLocalBrowser, renderPdf } from "@/server/reports/pdf";
import { buildLanguageSampleDocument } from "@/server/reports/language-samples";
import { setTestEnv } from "./helpers";

/**
 * Renders a real PDF per language with Chromium and checks that:
 * - the file is a PDF with the Noto font for that script embedded (not a system fallback);
 * - the text layer contains that script's characters (so copy/paste and search work).
 * Visual shaping is additionally checked by rendering pages to images
 * (npm run verify:pdf writes them to .data/pdf-verify for a human to look at).
 */
const SCRIPT_FONT: Record<string, { font: RegExp; block: RegExp }> = {
  ta: { font: /NotoSansTamil/, block: /[஀-௿]/g },
  hi: { font: /NotoSansDevanagari/, block: /[ऀ-ॿ]/g },
  te: { font: /NotoSansTelugu/, block: /[ఀ-౿]/g },
  kn: { font: /NotoSansKannada/, block: /[ಀ-೿]/g },
  ml: { font: /NotoSansMalayalam/, block: /[ഀ-ൿ]/g },
  en: { font: /NotoSans/, block: /[A-Za-z]/g },
};

const browserAvailable = Boolean((() => {
  try {
    setTestEnv();
    return findLocalBrowser();
  } catch {
    return null;
  }
})());

describe.skipIf(!browserAvailable)("PDF output in every report language", () => {
  beforeAll(() => setTestEnv());

  for (const language of REPORT_LANGUAGES.map((l) => l.code)) {
    it(`renders ${language} with embedded fonts and a searchable text layer`, async () => {
      const doc = await buildLanguageSampleDocument(language);
      const { pdf } = await renderPdf(doc);
      const raw = Buffer.from(pdf).toString("latin1");
      expect(raw.startsWith("%PDF-")).toBe(true);
      expect(raw).toMatch(/\/FontFile2|\/FontFile3|\/FontFile/);
      expect(raw).toMatch(SCRIPT_FONT[language]!.font);

      const proxy = await getDocumentProxy(new Uint8Array(pdf));
      expect(proxy.numPages).toBeGreaterThan(4);
      const { text } = await extractText(proxy, { mergePages: true });
      const scriptChars = text.match(SCRIPT_FONT[language]!.block)?.length ?? 0;
      expect(scriptChars).toBeGreaterThan(500);
      expect(text).toContain(doc.orderReference);
      if (language === "en") expect(text).toContain(getDictionary("en").sections.reportTitleIndian);
    });
  }
});
